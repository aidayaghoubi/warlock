import type { GameState, MapId, Projectile, SpellId, Vec2, Warlock } from '../game/types'
import * as C from '../game/constants'
import { Input } from '../game/input'
import { MAPS } from '../game/maps'
import { buildHud, stepSim } from '../game/sim'
import { draw } from '../game/render'
import { useGame } from '../store/gameStore'
import { net } from './client'
import { subscribeSnapshots } from '../store/netStore'

// Render this far behind the latest snapshot so we always have two frames to
// interpolate between. At 30Hz snapshots (~33ms apart), ~70ms covers normal jitter
// while keeping other players' lag low.
const INTERP_DELAY = 0.07
const INPUT_HZ = 60 // stream local intent every frame-ish, so casts/turns reach the server fast
const HUD_INTERVAL = 0.08

interface Frame {
  t: number // server time (seconds)
  state: GameState
  recvAt: number // client time (seconds) when received
}

/** A local input we've sent but the server hasn't acked yet — replayed for prediction. */
interface PendingInput {
  seq: number
  aim: Vec2
  moveDown: boolean
  casts: SpellId[]
}

/**
 * Drives a multiplayer match on the client: buffers authoritative snapshots, renders
 * them interpolated a little in the past for smoothness, streams local input to the
 * server, and projects the HUD for the local warlock. It runs no simulation itself —
 * the server is authoritative.
 */
export class NetGame {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private input!: Input
  private readonly localId: number
  private readonly mapId: MapId

  private buffer: Frame[] = []
  private unsub: (() => void) | null = null
  private raf = 0
  private running = false

  private inputAcc = 0
  private hudAcc = 0

  // client-side prediction: our own warlock is simulated locally and reconciled
  private inputSeq = 0
  private pending: PendingInput[] = []
  private serverAck = 0
  private predictedLocal: Warlock | null = null

  private cssW = 1
  private cssH = 1
  private dpr = 1
  private view = { cx: 0, cy: 0, scale: 1 }

  constructor(localWarlockId: number, mapId: MapId) {
    this.localId = localWarlockId
    this.mapId = mapId
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.input = new Input(canvas)
    this.resize()
    window.addEventListener('resize', this.onResize)
    this.unsub = subscribeSnapshots((t, state, acks) => {
      this.buffer.push({ t, state, recvAt: performance.now() / 1000 })
      if (this.buffer.length > 12) this.buffer.shift()
      // reconcile: drop inputs the server has already applied, then re-predict
      const ack = acks[this.localId]
      if (ack !== undefined) {
        this.serverAck = ack
        this.pending = this.pending.filter((p) => p.seq > ack)
      }
      this.repredict()
    })
    this.running = true
    this.raf = requestAnimationFrame(this.loop)
  }

  unmount(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.input?.detach()
    this.unsub?.()
  }

  private onResize = (): void => this.resize()

  private get map() {
    return MAPS[this.mapId]
  }

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

  private worldMouse(): Vec2 {
    const m = this.input.mouse
    return {
      x: (m.x - this.view.cx) / this.view.scale,
      y: (m.y - this.view.cy) / this.view.scale,
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return
    const t = now / 1000
    const dt = this.lastT ? t - this.lastT : 0
    this.lastT = t

    this.sendInput(dt)
    this.renderInterpolated(t)
    this.pushHud(dt)

    this.raf = requestAnimationFrame(this.loop)
  }
  private lastT = 0

  // --- input ---------------------------------------------------------------

  private sendInput(dt: number): void {
    this.inputAcc += dt
    const casts = this.input.consumeCasts()
    // send on a fixed cadence, but never drop a cast: flush immediately if one fired
    if (this.inputAcc < 1 / INPUT_HZ && casts.length === 0) return
    this.inputAcc = 0
    const seq = ++this.inputSeq
    const aim = this.worldMouse()
    const moveDown = this.input.moveDown
    this.pending.push({ seq, aim, moveDown, casts })
    net.send({ type: 'input', seq, aim, moveDown, casts })
    this.repredict()
  }

  // --- client-side prediction ----------------------------------------------

  /**
   * Re-derive our own warlock by taking its latest authoritative state and replaying
   * every still-unacked input through the shared sim. This makes our movement and Blink
   * feel instant while staying consistent with the server. Combat done TO us (incoming
   * knockback/damage) stays authoritative and arrives via snapshots — we don't predict it.
   */
  private repredict(): void {
    const latest = this.buffer[this.buffer.length - 1]
    if (!latest) {
      this.predictedLocal = null
      return
    }
    const sim: GameState = structuredClone(latest.state)
    // focus the replay on our own locomotion; don't predict others or combat resolution
    sim.projectiles = []
    sim.particles = []
    for (const p of this.pending) {
      stepSim(sim, { [this.localId]: { aim: p.aim, moveDown: p.moveDown, casts: p.casts } }, C.SIM_DT)
    }
    this.predictedLocal = sim.warlocks.find((w) => w.id === this.localId) ?? null
  }

  // --- rendering -----------------------------------------------------------

  private renderInterpolated(tClient: number): void {
    if (this.buffer.length === 0) return
    const latest = this.buffer[this.buffer.length - 1]
    const serverNow = latest.t + (tClient - latest.recvAt)
    const renderT = serverNow - INTERP_DELAY

    const state = this.withPredictedLocal(this.sampleAt(renderT))
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    draw(
      ctx,
      state,
      { w: this.cssW, h: this.cssH, cx: this.view.cx, cy: this.view.cy, scale: this.view.scale },
      this.worldMouse(),
      tClient,
    )
  }

  /** Swap the interpolated (laggy) local warlock for our locally-predicted one. */
  private withPredictedLocal(state: GameState): GameState {
    const pred = this.predictedLocal
    if (!pred) return state
    return {
      ...state,
      warlocks: state.warlocks.map((w) =>
        w.id === this.localId ? { ...w, pos: pred.pos, vel: pred.vel, facing: pred.facing } : w,
      ),
    }
  }

  /** Pick (and interpolate) the world state at server time `renderT`. */
  private sampleAt(renderT: number): GameState {
    const buf = this.buffer
    if (renderT <= buf[0].t) return buf[0].state
    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i]
      const b = buf[i + 1]
      if (renderT >= a.t && renderT <= b.t) {
        const span = b.t - a.t
        const alpha = span > 1e-6 ? (renderT - a.t) / span : 0
        return lerpState(a.state, b.state, alpha)
      }
    }
    return buf[buf.length - 1].state // ahead of the newest snapshot — show the latest
  }

  // --- HUD -----------------------------------------------------------------

  private pushHud(dt: number): void {
    this.hudAcc += dt
    if (this.hudAcc < HUD_INTERVAL) return
    this.hudAcc = 0
    const latest = this.buffer[this.buffer.length - 1]
    if (latest) useGame.getState().setHud(buildHud(latest.state, this.localId))
  }
}

// --- interpolation helpers --------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

/**
 * Blend two snapshots for rendering. `b` (the newer one) supplies all discrete state
 * (hp, alive, scores, phase, particles); only continuous positions/facings are lerped
 * from `a` toward `b`, matched by id.
 */
function lerpState(a: GameState, b: GameState, t: number): GameState {
  const aw = new Map<number, Warlock>(a.warlocks.map((w) => [w.id, w]))
  const warlocks = b.warlocks.map((wb) => {
    const wa = aw.get(wb.id)
    if (!wa || !wa.alive || !wb.alive) return wb
    return { ...wb, pos: lerpVec(wa.pos, wb.pos, t), facing: lerpAngle(wa.facing, wb.facing, t) }
  })

  const ap = new Map<number, Projectile>(a.projectiles.map((p) => [p.id, p]))
  const projectiles = b.projectiles.map((pb) => {
    const pa = ap.get(pb.id)
    return pa ? { ...pb, pos: lerpVec(pa.pos, pb.pos, t) } : pb
  })

  let crown = b.crown
  if (crown && a.crown && a.crown.holderId === crown.holderId) {
    crown = { ...crown, pos: lerpVec(a.crown.pos, crown.pos, t) }
  }

  return { ...b, warlocks, projectiles, crown }
}
