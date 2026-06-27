import * as C from './constants'
import type { GameState, HudSnapshot, MapId, Vec2, WarlockKind } from './types'
import { angle, sub } from './math'
import { Input } from './input'
import { buildHud, createGameState, stepSim, type IntentMap, type Seat } from './sim'
import { MAPS } from './maps'
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

/** Build the seat list for a solo match: the human in seat 0, then AI bots. */
function soloSeats(cfg: EngineConfig): Seat[] {
  const seats: Seat[] = [
    { name: 'You', kind: cfg.kind, color: C.playerColorForKind(cfg.kind), isBot: false, isLocal: true },
  ]
  for (let i = 0; i < cfg.bots; i++) {
    seats.push({
      name: C.BOT_NAMES[i % C.BOT_NAMES.length],
      kind: 'arcane',
      color: C.BOT_COLORS[i % C.BOT_COLORS.length],
      isBot: true,
      isLocal: false,
    })
  }
  return seats
}

/**
 * Solo (single-player) client engine. Owns the canvas, input, render loop, and runs
 * the authoritative {@link stepSim} locally — there is no server in solo play. The
 * simulation itself lives in `sim.ts` and is shared with the multiplayer server.
 */
export class Engine {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private input!: Input
  private readonly cb: EngineCallbacks
  private readonly localId = 0 // the human player is always seat 0 in solo

  state: GameState
  private raf = 0
  private last = 0
  private acc = 0
  private running = false
  private hudTimer = 0
  private matchOverFired = false

  private cssW = 1
  private cssH = 1
  private dpr = 1
  private view = { cx: 0, cy: 0, scale: 1 }

  constructor(cfg: EngineConfig, cb: EngineCallbacks) {
    this.cb = cb
    this.state = createGameState({
      seats: soloSeats(cfg),
      targetScore: cfg.targetScore,
      mapId: cfg.mapId,
    })
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
      stepSim(this.state, this.collectIntents(), C.SIM_DT)
      this.acc -= C.SIM_DT
      steps++
      this.checkMatchOver()
    }
    this.render()
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.cb.onHud(buildHud(this.state, this.localId))
      this.hudTimer = 0.07
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private checkMatchOver(): void {
    if (this.state.phase === 'matchover' && !this.matchOverFired) {
      this.matchOverFired = true
      this.cb.onHud(buildHud(this.state, this.localId))
      this.cb.onMatchOver(this.state.winnerName)
    }
  }

  // --- input ---

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

  /** Translate the local mouse/keyboard into the sim's intent for our warlock. */
  private collectIntents(): IntentMap {
    const aim = this.worldMouse()
    return {
      [this.localId]: {
        aim,
        moveDown: this.input.moveDown,
        casts: this.input.consumeCasts(),
      },
    }
  }

  // --- render ---

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
}
