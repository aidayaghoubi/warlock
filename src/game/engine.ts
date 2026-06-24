import * as C from './constants'
import type { GameState, HudSnapshot, MapId, Vec2, Warlock, WarlockKind } from './types'
import { angle, clamp, dist, len, norm, rand, scale, sub } from './math'
import { Input } from './input'
import { aiUpdate } from './ai'
import { MAPS } from './maps'
import { applyKnockback, castSpell, dealDamage, SPELLS, SPELL_ORDER } from './spells'
import { spawnDeath, spawnHit } from './effects'
import { draw } from './render'

export interface EngineConfig {
  bots: number
  targetScore: number
  mapId: MapId
  kind: WarlockKind // the player's warlock kind
}

export interface EngineCallbacks {
  onHud: (h: HudSnapshot) => void
  onMatchOver: (winner: string | null) => void
}

function makeWarlock(
  id: number,
  name: string,
  kind: WarlockKind,
  color: string,
  isPlayer: boolean,
): Warlock {
  return {
    id,
    name,
    kind,
    color,
    isPlayer,
    alive: true,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: C.WARLOCK_RADIUS,
    hp: C.WARLOCK_MAX_HP,
    maxHp: C.WARLOCK_MAX_HP,
    moveTarget: null,
    facing: 0,
    cooldowns: { bolt: 0, burst: 0, blink: 0 },
    score: 0,
    safeTime: 0,
    slowTimer: 0,
    ai: isPlayer ? null : { thinkTimer: 0, aimError: rand(60, 130), desiredRange: rand(175, 255) },
  }
}

export class Engine {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private input!: Input
  private readonly cfg: EngineConfig
  private readonly cb: EngineCallbacks

  state: GameState
  private raf = 0
  private last = 0
  private acc = 0
  private running = false
  private hudTimer = 0

  private cssW = 1
  private cssH = 1
  private dpr = 1
  private view = { cx: 0, cy: 0, scale: 1 }

  constructor(cfg: EngineConfig, cb: EngineCallbacks) {
    this.cfg = cfg
    this.cb = cb
    const playerColor = cfg.kind === 'snow' ? C.SNOW_COLOR : C.PLAYER_COLOR
    const warlocks: Warlock[] = [makeWarlock(0, 'You', cfg.kind, playerColor, true)]
    for (let i = 0; i < cfg.bots; i++) {
      warlocks.push(
        makeWarlock(
          i + 1,
          C.BOT_NAMES[i % C.BOT_NAMES.length],
          'arcane',
          C.BOT_COLORS[i % C.BOT_COLORS.length],
          false,
        ),
      )
    }
    this.state = {
      warlocks,
      projectiles: [],
      particles: [],
      mapId: cfg.mapId,
      phase: 'countdown',
      phaseTimer: C.COUNTDOWN_TIME,
      round: 1,
      roundTime: 0,
      targetScore: cfg.targetScore,
      nextProjectileId: 1,
      winnerName: null,
    }
    this.startRound()
  }

  // --- lifecycle ---

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.input = new Input(canvas)
    this.resize()
    window.addEventListener('resize', this.onResize)
    this.running = true
    this.last = performance.now()
    this.acc = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  unmount(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.input?.detach()
  }

  private onResize = (): void => this.resize()

  private resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.cssW = w
    this.cssH = h
    this.dpr = dpr
    this.view.cx = w / 2
    this.view.cy = h / 2
    this.view.scale = Math.min(w, h) / (2 * this.map.viewExtent)
  }

  // --- main loop (fixed timestep) ---

  private loop = (now: number): void => {
    if (!this.running) return
    let dt = (now - this.last) / 1000
    this.last = now
    if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT
    this.acc += dt
    let steps = 0
    while (this.acc >= C.SIM_DT && steps < 6) {
      this.step(C.SIM_DT)
      this.acc -= C.SIM_DT
      steps++
    }
    this.render()
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.cb.onHud(this.buildHud())
      this.hudTimer = 0.07
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  // --- simulation ---

  private step(dt: number): void {
    const s = this.state
    if (s.phase === 'matchover') return

    if (s.phase === 'countdown') {
      s.phaseTimer -= dt
      this.updatePlayerFacing()
      this.updateParticles(dt)
      if (s.phaseTimer <= 0) s.phase = 'fighting'
      return
    }

    if (s.phase === 'roundover') {
      s.phaseTimer -= dt
      this.updateProjectiles(dt)
      this.updateParticles(dt)
      if (s.phaseTimer <= 0) {
        s.round += 1
        this.startRound()
      }
      return
    }

    // fighting (arena geometry is derived from roundTime by the active map)
    s.roundTime += dt

    this.handlePlayerInput()
    for (const w of s.warlocks) aiUpdate(s, w, dt)
    for (const w of s.warlocks) this.updateWarlock(w, dt)
    this.updateProjectiles(dt)
    this.updateParticles(dt)

    const alive = s.warlocks.filter((w) => w.alive)
    if (alive.length <= 1) this.endRound(alive[0] ?? null)
  }

  private startRound(): void {
    const s = this.state
    s.roundTime = 0
    s.projectiles = []
    s.particles = []
    s.winnerName = null
    s.phase = 'countdown'
    s.phaseTimer = C.COUNTDOWN_TIME

    const spawns = this.map.spawns(s.warlocks.length)
    s.warlocks.forEach((w, i) => {
      w.pos = spawns[i]
      w.vel = { x: 0, y: 0 }
      w.hp = w.maxHp
      w.alive = true
      w.moveTarget = null
      w.safeTime = C.SAFE_TIME
      w.slowTimer = 0
      w.facing = angle(this.map.safeDir(w.pos, 0)) // face toward safety / center
      w.cooldowns = { bolt: 0, burst: 0, blink: 0 }
      if (w.ai) w.ai.thinkTimer = rand(0, 0.2)
    })
  }

  private endRound(winner: Warlock | null): void {
    const s = this.state
    if (s.phase !== 'fighting') return
    s.winnerName = winner ? winner.name : null
    if (winner) {
      winner.score += 1
      if (winner.score >= s.targetScore) {
        s.phase = 'matchover'
        this.cb.onHud(this.buildHud())
        this.cb.onMatchOver(winner.name)
        return
      }
    }
    s.phase = 'roundover'
    s.phaseTimer = C.ROUNDOVER_TIME
  }

  private updateWarlock(w: Warlock, dt: number): void {
    if (!w.alive) return

    for (const id of SPELL_ORDER) {
      if (w.cooldowns[id] > 0) w.cooldowns[id] = Math.max(0, w.cooldowns[id] - dt)
    }
    if (w.safeTime > 0) w.safeTime -= dt
    if (w.slowTimer > 0) w.slowTimer -= dt

    // knockback friction
    const decay = Math.exp(-C.FRICTION * dt)
    w.vel.x *= decay
    w.vel.y *= decay

    // walking toward move target (suppressed while sliding fast)
    if (w.moveTarget) {
      const to = sub(w.moveTarget, w.pos)
      const d = len(to)
      if (d > 5) {
        const speed = len(w.vel)
        const factor = clamp(1 - speed / C.WALK_CANCEL_SPEED, 0, 1)
        if (factor > 0) {
          const walk = C.WALK_SPEED * (w.slowTimer > 0 ? C.ICE_SLOW_FACTOR : 1)
          const dir = scale(to, 1 / d)
          w.pos.x += dir.x * walk * factor * dt
          w.pos.y += dir.y * walk * factor * dt
        }
      } else {
        w.moveTarget = null
      }
    }

    // knockback slide
    w.pos.x += w.vel.x * dt
    w.pos.y += w.vel.y * dt

    // lava damage when off the platform
    if (w.safeTime <= 0 && !this.map.isSafe(w.pos, this.state.roundTime)) {
      w.hp -= C.LAVA_DPS * dt
    }

    if (w.hp <= 0) {
      w.hp = 0
      w.alive = false
      w.moveTarget = null
      spawnDeath(this.state, w.pos, w.color)
    }
  }

  private updateProjectiles(dt: number): void {
    const s = this.state
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const p = s.projectiles[i]
      p.pos.x += p.vel.x * dt
      p.pos.y += p.vel.y * dt
      p.life -= dt
      p.trail.push({ x: p.pos.x, y: p.pos.y })
      if (p.trail.length > 8) p.trail.shift()

      let hit = false
      for (const w of s.warlocks) {
        if (!w.alive || w.id === p.ownerId || w.safeTime > 0) continue
        if (dist(p.pos, w.pos) <= p.radius + w.radius) {
          const dir = norm(p.vel)
          applyKnockback(w, dir, p.knockback)
          dealDamage(w, p.damage)
          if (p.slow) w.slowTimer = Math.max(w.slowTimer, p.slow)
          spawnHit(s, p.pos, dir, p.color)
          hit = true
          break
        }
      }

      const off = len(p.pos) > this.map.viewExtent + 240
      if (hit || p.life <= 0 || off) s.projectiles.splice(i, 1)
    }
  }

  private updateParticles(dt: number): void {
    const ps = this.state.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) {
        ps.splice(i, 1)
        continue
      }
      p.pos.x += p.vel.x * dt
      p.pos.y += p.vel.y * dt
      p.vel.x *= 0.92
      p.vel.y *= 0.92
    }
  }

  // --- input ---

  private player(): Warlock {
    return this.state.warlocks[0]
  }

  private get map() {
    return MAPS[this.state.mapId]
  }

  private worldMouse(): Vec2 {
    const m = this.input.mouse
    return {
      x: (m.x - this.view.cx) / this.view.scale,
      y: (m.y - this.view.cy) / this.view.scale,
    }
  }

  private updatePlayerFacing(): void {
    const p = this.player()
    if (!p.alive) return
    p.facing = angle(sub(this.worldMouse(), p.pos))
  }

  private handlePlayerInput(): void {
    const p = this.player()
    if (!p.alive) return
    const m = this.worldMouse()
    p.facing = angle(sub(m, p.pos))
    if (this.input.moveDown) p.moveTarget = { x: m.x, y: m.y }
    for (const id of this.input.consumeCasts()) castSpell(this.state, p, id, m)
  }

  // --- render + HUD ---

  private render(): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    draw(
      ctx,
      this.state,
      { w: this.cssW, h: this.cssH, cx: this.view.cx, cy: this.view.cy, scale: this.view.scale },
      this.worldMouse(),
      performance.now() / 1000,
    )
  }

  private buildHud(): HudSnapshot {
    const s = this.state
    const p = this.player()
    const spells = SPELL_ORDER.map((id) => {
      const def = SPELLS[id]
      const cd = p.cooldowns[id]
      return {
        id,
        name: p.kind === 'snow' && id === 'bolt' ? 'Frostbolt' : def.name,
        key: def.key,
        ready: cd <= 0,
        cooldownPct: clamp(cd / def.cooldown, 0, 1),
      }
    })

    let banner = ''
    if (s.phase === 'countdown') banner = `Round ${s.round}`
    else if (s.phase === 'roundover') banner = s.winnerName ? `${s.winnerName} wins the round!` : 'Draw!'

    return {
      alive: p.alive,
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: p.maxHp,
      spells,
      round: s.round,
      phase: s.phase,
      phaseTimer: Math.max(0, s.phaseTimer),
      banner,
      scores: s.warlocks.map((w) => ({
        name: w.name,
        color: w.color,
        score: w.score,
        alive: w.alive,
        isPlayer: w.isPlayer,
      })),
      arenaPct: this.map.progressPct(s.roundTime),
      inLava: p.alive && !this.map.isSafe(p.pos, s.roundTime),
    }
  }
}
