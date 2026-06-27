import * as C from './constants'
import type {
  GameState,
  HudSnapshot,
  MapId,
  SpellId,
  Vec2,
  Warlock,
  WarlockKind,
} from './types'
import { angle, clamp, dist, len, norm, rand, scale, sub } from './math'
import { aiUpdate } from './ai'
import { MAPS } from './maps'
import {
  applyKnockback,
  castSpell,
  dealDamage,
  KIND_SPELLS,
  spellCooldown,
  SPELLS,
  SPELL_ORDER,
} from './spells'
import { spawnDeath, spawnHit } from './effects'

/**
 * Per-warlock control for a single sim step. The whole input surface of the game:
 * where the cursor points (world space), whether the player is holding to move, and
 * any spells pressed this tick. The local client and the network server both produce
 * these and feed them to {@link stepSim}.
 */
export interface PlayerIntent {
  aim: Vec2 // world-space cursor position (camera is fixed at the arena center)
  moveDown: boolean // holding the mouse to walk toward `aim`
  casts: SpellId[] // spells pressed since the last step
}

/** Intents keyed by warlock id. Warlocks with no entry simply receive no commands. */
export type IntentMap = Record<number, PlayerIntent>

/** A seat in the match — one human or one bot. */
export interface Seat {
  name: string
  kind: WarlockKind
  color: string
  isBot: boolean
  isLocal: boolean // marks the warlock controlled by this client (solo: the human)
}

export interface SimConfig {
  seats: Seat[]
  targetScore: number
  mapId: MapId
}

function makeWarlock(id: number, seat: Seat): Warlock {
  return {
    id,
    name: seat.name,
    kind: seat.kind,
    color: seat.color,
    isPlayer: seat.isLocal,
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
    rootTimer: 0,
    invisTimer: 0,
    home: null,
    ai: seat.isBot ? { thinkTimer: 0, aimError: rand(60, 130), desiredRange: rand(175, 255) } : null,
  }
}

/** Build a fresh match state from a seat list. The first round is started immediately. */
export function createGameState(cfg: SimConfig): GameState {
  const warlocks = cfg.seats.map((seat, i) => makeWarlock(i, seat))
  const state: GameState = {
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
    crown: null,
  }
  startRound(state)
  return state
}

function mapOf(state: GameState) {
  return MAPS[state.mapId]
}

// --- the authoritative step (fixed timestep) ---------------------------------

/**
 * Advance the whole match by `dt` seconds. Pure with respect to the DOM: no canvas,
 * no timers, no rendering — just mutate `state` from the given intents. The host
 * (client for solo, server for multiplayer) calls this on a fixed `SIM_DT` cadence.
 *
 * Watch `state.phase`: a transition to `'matchover'` signals the match ended and
 * `state.winnerName` holds the winner.
 */
export function stepSim(state: GameState, intents: IntentMap, dt: number): void {
  const s = state
  if (s.phase === 'matchover') return

  if (s.phase === 'countdown') {
    s.phaseTimer -= dt
    applyFacing(s, intents)
    updateParticles(s, dt)
    if (s.phaseTimer <= 0) s.phase = 'fighting'
    return
  }

  if (s.phase === 'roundover') {
    s.phaseTimer -= dt
    updateProjectiles(s, dt)
    updateParticles(s, dt)
    if (s.phaseTimer <= 0) {
      s.round += 1
      startRound(s)
    }
    return
  }

  // fighting (arena geometry is derived from roundTime by the active map)
  s.roundTime += dt

  applyIntents(s, intents)
  for (const w of s.warlocks) aiUpdate(s, w, dt)
  for (const w of s.warlocks) updateWarlock(s, w, dt)
  updateProjectiles(s, dt)
  updateParticles(s, dt)
  if (s.crown) updateCrown(s)
  if (s.phase !== 'fighting') return // a crown carry may have just ended the round

  const alive = s.warlocks.filter((w) => w.alive)
  if (alive.length <= 1) endRound(s, alive[0] ?? null)
}

/** During countdown, players can still aim (turn to face the cursor) but not act. */
function applyFacing(state: GameState, intents: IntentMap): void {
  for (const w of state.warlocks) {
    if (!w.alive) continue
    const intent = intents[w.id]
    if (intent) w.facing = angle(sub(intent.aim, w.pos))
  }
}

/** Apply each human's intent: aim, optional move target, and queued spell casts. */
function applyIntents(state: GameState, intents: IntentMap): void {
  for (const w of state.warlocks) {
    if (!w.alive) continue
    const intent = intents[w.id]
    if (!intent) continue
    w.facing = angle(sub(intent.aim, w.pos))
    if (intent.moveDown) w.moveTarget = { x: intent.aim.x, y: intent.aim.y }
    for (const id of intent.casts) castSpell(state, w, id, intent.aim)
  }
}

/** Crown scenario: handle pickup, carrying, and the carry-it-home win. */
function updateCrown(state: GameState): void {
  const s = state
  const crown = s.crown!

  if (crown.holderId !== null) {
    const holder = s.warlocks.find((w) => w.id === crown.holderId)
    if (!holder || !holder.alive) {
      // holder died — drop the crown back in the center
      crown.holderId = null
      crown.pos = { x: 0, y: 0 }
      return
    }
    crown.pos = { x: holder.pos.x, y: holder.pos.y } // crown rides the carrier
    if (holder.home && dist(holder.pos, holder.home) <= C.CROWN_HOME_RADIUS) {
      endRound(s, holder) // carried home — round won
    }
    return
  }

  // loose crown: first warlock to touch it picks it up
  for (const w of s.warlocks) {
    if (!w.alive) continue
    if (dist(w.pos, crown.pos) <= w.radius + C.CROWN_PICKUP_RADIUS) {
      crown.holderId = w.id
      break
    }
  }
}

function startRound(state: GameState): void {
  const s = state
  s.roundTime = 0
  s.projectiles = []
  s.particles = []
  s.winnerName = null
  s.phase = 'countdown'
  s.phaseTimer = C.COUNTDOWN_TIME

  const map = mapOf(s)
  const isCrown = s.mapId === 'crown'
  const spawns = map.spawns(s.warlocks.length)
  s.warlocks.forEach((w, i) => {
    w.pos = spawns[i]
    w.vel = { x: 0, y: 0 }
    w.hp = w.maxHp
    w.alive = true
    w.moveTarget = null
    w.safeTime = C.SAFE_TIME
    w.slowTimer = 0
    w.rootTimer = 0
    w.invisTimer = 0
    // crown scenario: spawns double as each warlock's home pad near the border
    w.home = isCrown ? { x: spawns[i].x, y: spawns[i].y } : null
    w.facing = angle(map.safeDir(w.pos, 0)) // face toward safety / center
    w.cooldowns = { bolt: 0, burst: 0, blink: 0 }
    if (w.ai) w.ai.thinkTimer = rand(0, 0.2)
  })

  // crown starts loose in the center; nobody holds it
  s.crown = isCrown ? { pos: { x: 0, y: 0 }, holderId: null } : null
}

function endRound(state: GameState, winner: Warlock | null): void {
  const s = state
  if (s.phase !== 'fighting') return
  s.winnerName = winner ? winner.name : null
  if (winner) {
    winner.score += 1
    if (winner.score >= s.targetScore) {
      s.phase = 'matchover'
      return
    }
  }
  s.phase = 'roundover'
  s.phaseTimer = C.ROUNDOVER_TIME
}

function updateWarlock(state: GameState, w: Warlock, dt: number): void {
  if (!w.alive) return
  const map = mapOf(state)

  for (const id of SPELL_ORDER) {
    if (w.cooldowns[id] > 0) w.cooldowns[id] = Math.max(0, w.cooldowns[id] - dt)
  }
  if (w.safeTime > 0) w.safeTime -= dt
  if (w.slowTimer > 0) w.slowTimer -= dt
  if (w.rootTimer > 0) w.rootTimer -= dt
  if (w.invisTimer > 0) w.invisTimer -= dt

  // knockback friction
  const decay = Math.exp(-C.FRICTION * dt)
  w.vel.x *= decay
  w.vel.y *= decay

  // walking toward move target (suppressed while sliding fast or rooted)
  if (w.moveTarget && w.rootTimer <= 0) {
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

  // assassin stealth: passing through a foe while invisible strikes hard (and breaks stealth)
  if (w.kind === 'assassin' && w.invisTimer > 0) {
    for (const e of state.warlocks) {
      if (e.id === w.id || !e.alive || e.safeTime > 0) continue
      if (dist(w.pos, e.pos) <= w.radius + e.radius) {
        dealDamage(e, C.STEALTH_STRIKE_DAMAGE)
        spawnHit(state, e.pos, norm(sub(e.pos, w.pos)), C.SHADOW_BOLT_COLOR)
        w.invisTimer = 0
        break
      }
    }
  }

  // lava damage when off the platform
  if (w.safeTime <= 0 && !map.isSafe(w.pos, state.roundTime)) {
    w.hp -= C.LAVA_DPS * dt
  }

  // nature warlocks slowly regenerate health
  if (w.kind === 'nature' && w.hp > 0) {
    w.hp = Math.min(w.maxHp, w.hp + C.NATURE_REGEN_PER_SEC * dt)
  }

  if (w.hp <= 0) {
    w.hp = 0
    w.alive = false
    w.moveTarget = null
    spawnDeath(state, w.pos, w.color)
  }
}

function updateProjectiles(state: GameState, dt: number): void {
  const s = state
  const map = mapOf(s)
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
        if (p.root) w.rootTimer = Math.max(w.rootTimer, p.root)
        // a bolt to the crown-carrier knocks the crown loose, back to the center
        if (s.crown && s.crown.holderId === w.id) {
          s.crown.holderId = null
          s.crown.pos = { x: 0, y: 0 }
        }
        spawnHit(s, p.pos, dir, p.color)
        hit = true
        break
      }
    }

    const off = len(p.pos) > map.viewExtent + 240
    if (hit || p.life <= 0 || off) s.projectiles.splice(i, 1)
  }
}

function updateParticles(state: GameState, dt: number): void {
  const ps = state.particles
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

// --- HUD projection (presentation, but DOM-free so it's shared) ---------------

/** Build the HUD snapshot from the point of view of warlock `localId`. */
export function buildHud(state: GameState, localId: number): HudSnapshot {
  const s = state
  const map = mapOf(s)
  const p = s.warlocks.find((w) => w.id === localId) ?? s.warlocks[0]
  const boltName =
    p.kind === 'snow'
      ? 'Frostbolt'
      : p.kind === 'nature'
        ? 'Thornbolt'
        : p.kind === 'assassin'
          ? 'Shadowbolt'
          : SPELLS.bolt.name
  const holdsCrown = s.crown?.holderId === p.id
  const spells = KIND_SPELLS[p.kind].map((id) => {
    const def = SPELLS[id]
    const cd = p.cooldowns[id]
    const maxCd = spellCooldown(p.kind, id)
    const name =
      id === 'bolt' ? boltName : id === 'burst' && p.kind === 'assassin' ? 'Stealth' : def.name
    const blocked = id === 'blink' && holdsCrown // can't blink while carrying the crown
    return {
      id,
      name,
      key: def.key,
      ready: cd <= 0 && !blocked,
      cooldownPct: blocked ? 1 : clamp(cd / maxCd, 0, 1),
    }
  })

  let banner = ''
  if (s.phase === 'countdown') banner = `Round ${s.round}`
  else if (s.phase === 'roundover')
    banner = s.winnerName ? `${s.winnerName} wins the round!` : 'Draw!'

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
      isPlayer: w.id === p.id,
    })),
    arenaPct: map.progressPct(s.roundTime),
    inLava: p.alive && !map.isSafe(p.pos, s.roundTime),
    crownActive: !!s.crown,
    crownHolderName:
      s.crown?.holderId != null
        ? (s.warlocks.find((w) => w.id === s.crown!.holderId)?.name ?? null)
        : null,
    crownYouHaveIt: holdsCrown,
  }
}
