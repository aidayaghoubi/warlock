import * as C from './constants'
import type { MapId, Vec2 } from './types'
import type { View } from './render'
import { fromAngle, len, norm } from './math'

/**
 * A GameMap owns all arena geometry: where the lava is, how the safe zone shrinks over a round,
 * where warlocks spawn, and how the platform is drawn. The engine/AI query it instead of assuming
 * a circle centered at the origin. `t` is the elapsed fighting time in seconds (0 => full size).
 */
export interface GameMap {
  id: MapId
  name: string
  /** World half-size that should fit on screen; drives the view scale. */
  viewExtent: number
  /** Spawn positions for n warlocks, using the round-start (full-size) geometry. */
  spawns(n: number): Vec2[]
  /** False => the point is in lava and taking damage. */
  isSafe(p: Vec2, t: number): boolean
  /** >0 = margin to the nearest lava edge, <0 = depth inside lava. */
  signedDanger(p: Vec2, t: number): number
  /** Unit vector pointing toward safety from p (no "center is safe" assumption). */
  safeDir(p: Vec2, t: number): Vec2
  /** Pull a point inside the safe zone, keeping a margin m from any lava. */
  clampToSafe(p: Vec2, t: number, m: number): Vec2
  /** 1 at round start, shrinks toward 0 — feeds the HUD arena bar. */
  progressPct(t: number): number
  draw(ctx: CanvasRenderingContext2D, view: View, t: number, time: number): void
}

const sign = (n: number): number => (n < 0 ? -1 : 1)

// ---------------------------------------------------------------------------
// Circle — the original shrinking disk.
// ---------------------------------------------------------------------------

const circleRadius = (t: number): number =>
  Math.max(C.ARENA_RADIUS_MIN, C.ARENA_RADIUS_START - C.ARENA_SHRINK_PER_SEC * t)

const circle: GameMap = {
  id: 'circle',
  name: 'Circle',
  viewExtent: C.ARENA_RADIUS_START * 1.16,
  spawns(n) {
    const ring = C.ARENA_RADIUS_START * 0.62
    return Array.from({ length: n }, (_, i) => fromAngle((i / n) * Math.PI * 2 - Math.PI / 2, ring))
  },
  isSafe: (p, t) => len(p) <= circleRadius(t),
  signedDanger: (p, t) => circleRadius(t) - len(p),
  safeDir: (p) => norm({ x: -p.x, y: -p.y }),
  clampToSafe(p, t, m) {
    const r = circleRadius(t) - m
    const d = len(p)
    if (d <= r || d < 1e-6) return { x: p.x, y: p.y }
    return { x: (p.x / d) * r, y: (p.y / d) * r }
  },
  progressPct: (t) => circleRadius(t) / C.ARENA_RADIUS_START,
  draw(ctx, view, t, time) {
    const { cx, cy, scale } = view
    const ar = circleRadius(t) * scale

    // molten halo where lava meets the rim
    const halo = ctx.createRadialGradient(cx, cy, ar * 0.88, cx, cy, ar * 1.3)
    halo.addColorStop(0, 'rgba(255,140,40,0)')
    halo.addColorStop(0.45, 'rgba(255,120,30,0.55)')
    halo.addColorStop(1, 'rgba(255,80,20,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, ar * 1.3, 0, Math.PI * 2)
    ctx.fill()

    // stone disk
    const disk = ctx.createRadialGradient(cx, cy, ar * 0.1, cx, cy, ar)
    disk.addColorStop(0, '#454b54')
    disk.addColorStop(0.7, '#343941')
    disk.addColorStop(1, '#252930')
    ctx.fillStyle = disk
    ctx.beginPath()
    ctx.arc(cx, cy, ar, 0, Math.PI * 2)
    ctx.fill()

    // concentric detail rings
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(cx, cy, (ar * i) / 4, 0, Math.PI * 2)
      ctx.stroke()
    }

    // hot glowing rim (pulses)
    const pulse = 0.6 + 0.4 * Math.sin(time * 3)
    ctx.strokeStyle = `rgba(255,${120 + pulse * 60},40,${0.7 + pulse * 0.3})`
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, ar, 0, Math.PI * 2)
    ctx.stroke()
  },
}

// ---------------------------------------------------------------------------
// Square — a shrinking square platform.
// ---------------------------------------------------------------------------

const squareHalf = (t: number): number =>
  Math.max(C.SQUARE_HALF_MIN, C.SQUARE_HALF_START - C.SQUARE_SHRINK_PER_SEC * t)

const square: GameMap = {
  id: 'square',
  name: 'Square',
  viewExtent: C.SQUARE_HALF_START * 1.2,
  spawns(n) {
    const ring = C.SQUARE_HALF_START * 0.6
    return Array.from({ length: n }, (_, i) => fromAngle((i / n) * Math.PI * 2 - Math.PI / 2, ring))
  },
  isSafe: (p, t) => Math.max(Math.abs(p.x), Math.abs(p.y)) <= squareHalf(t),
  signedDanger: (p, t) => squareHalf(t) - Math.max(Math.abs(p.x), Math.abs(p.y)),
  safeDir: (p) => norm({ x: -p.x, y: -p.y }),
  clampToSafe(p, t, m) {
    const h = squareHalf(t) - m
    return { x: Math.max(-h, Math.min(h, p.x)), y: Math.max(-h, Math.min(h, p.y)) }
  },
  progressPct: (t) => squareHalf(t) / C.SQUARE_HALF_START,
  draw(ctx, view, t, time) {
    const { cx, cy, scale } = view
    const hs = squareHalf(t) * scale
    drawRectPlatform(ctx, cx, cy, hs, hs, time)
  },
}

// ---------------------------------------------------------------------------
// Rectangle — a shrinking rectangle with a fixed lava square in the center.
// ---------------------------------------------------------------------------

const rectHW = (t: number): number =>
  Math.max(C.RECT_HALF_W_MIN, C.RECT_HALF_W_START - C.RECT_SHRINK_PER_SEC * t)
const rectHH = (t: number): number =>
  Math.max(C.RECT_HALF_H_MIN, C.RECT_HALF_H_START - C.RECT_SHRINK_PER_SEC * t)

const IH = C.RECT_INNER_HALF

/** Distance to the inner lava square's edge: >0 outside it, <0 inside it. */
const rectInnerMargin = (p: Vec2): number => Math.max(Math.abs(p.x), Math.abs(p.y)) - IH
/** Distance to the outer rectangle's lava edge: >0 inside the platform. */
const rectOuterMargin = (p: Vec2, t: number): number =>
  Math.min(rectHW(t) - Math.abs(p.x), rectHH(t) - Math.abs(p.y))

const rect: GameMap = {
  id: 'rect',
  name: 'Rectangle',
  viewExtent: Math.max(C.RECT_HALF_W_START, C.RECT_HALF_H_START) * 1.18,
  spawns(n) {
    const rx = C.RECT_HALF_W_START * 0.62
    const ry = C.RECT_HALF_H_START * 0.62
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * rx, y: Math.sin(a) * ry }
    })
  },
  isSafe: (p, t) => rectOuterMargin(p, t) >= 0 && rectInnerMargin(p) >= 0,
  signedDanger: (p, t) => Math.min(rectOuterMargin(p, t), rectInnerMargin(p)),
  safeDir(p, t) {
    // Push away from whichever lava (inner square vs outer rim) is the binding constraint.
    if (rectInnerMargin(p) < rectOuterMargin(p, t)) {
      // escape the central lava square along the axis nearest its edge
      if (Math.abs(p.x) >= Math.abs(p.y)) return { x: sign(p.x), y: 0 }
      return { x: 0, y: sign(p.y) }
    }
    // flee the nearest outer edge, inward
    if (rectHW(t) - Math.abs(p.x) <= rectHH(t) - Math.abs(p.y)) return { x: -sign(p.x), y: 0 }
    return { x: 0, y: -sign(p.y) }
  },
  clampToSafe(p, t, m) {
    const hw = rectHW(t) - m
    const hh = rectHH(t) - m
    let x = Math.max(-hw, Math.min(hw, p.x))
    let y = Math.max(-hh, Math.min(hh, p.y))
    // shove out of the central lava square (plus margin) along the dominant axis
    const inner = IH + m
    if (Math.max(Math.abs(x), Math.abs(y)) < inner) {
      if (Math.abs(x) >= Math.abs(y)) x = inner * (x === 0 ? 1 : sign(x))
      else y = inner * (y === 0 ? 1 : sign(y))
    }
    return { x, y }
  },
  progressPct: (t) => Math.min(rectHW(t) / C.RECT_HALF_W_START, rectHH(t) / C.RECT_HALF_H_START),
  draw(ctx, view, t, time) {
    const { cx, cy, scale } = view
    const hw = rectHW(t) * scale
    const hh = rectHH(t) * scale
    drawRectPlatform(ctx, cx, cy, hw, hh, time)
    drawLavaSquare(ctx, cx, cy, IH * scale, time)
  },
}

// ---------------------------------------------------------------------------
// Shared rectangular-platform drawing.
// ---------------------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Stone platform spanning [cx-hw, cx+hw] x [cy-hh, cy+hh], with molten halo + glowing rim. */
function drawRectPlatform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  time: number,
): void {
  const radius = Math.min(hw, hh) * 0.12

  // molten halo bleeding outward from the rim
  ctx.save()
  ctx.shadowColor = 'rgba(255,120,30,0.55)'
  ctx.shadowBlur = Math.min(hw, hh) * 0.5
  roundRectPath(ctx, cx - hw, cy - hh, hw * 2, hh * 2, radius)
  ctx.fillStyle = 'rgba(255,120,30,0.18)'
  ctx.fill()
  ctx.restore()

  // stone slab
  const disk = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh)
  disk.addColorStop(0, '#454b54')
  disk.addColorStop(0.7, '#343941')
  disk.addColorStop(1, '#252930')
  roundRectPath(ctx, cx - hw, cy - hh, hw * 2, hh * 2, radius)
  ctx.fillStyle = disk
  ctx.fill()

  // subtle inset detail
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  const inset = Math.min(hw, hh) * 0.18
  roundRectPath(ctx, cx - hw + inset, cy - hh + inset, (hw - inset) * 2, (hh - inset) * 2, radius)
  ctx.stroke()

  // hot glowing rim (pulses)
  const pulse = 0.6 + 0.4 * Math.sin(time * 3)
  ctx.strokeStyle = `rgba(255,${120 + pulse * 60},40,${0.7 + pulse * 0.3})`
  ctx.lineWidth = 4
  roundRectPath(ctx, cx - hw, cy - hh, hw * 2, hh * 2, radius)
  ctx.stroke()
}

/** A central pool of lava (used as a hazard hole inside the rectangle platform). */
function drawLavaSquare(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  time: number,
): void {
  const radius = h * 0.18

  // molten fill
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 1.4)
  g.addColorStop(0, 'rgba(255,170,60,0.95)')
  g.addColorStop(0.55, 'rgba(220,70,20,0.9)')
  g.addColorStop(1, 'rgba(90,15,8,0.95)')
  roundRectPath(ctx, cx - h, cy - h, h * 2, h * 2, radius)
  ctx.fillStyle = g
  ctx.fill()

  // hot glowing rim (pulses, in sync with the outer rim)
  const pulse = 0.6 + 0.4 * Math.sin(time * 3)
  ctx.strokeStyle = `rgba(255,${120 + pulse * 60},40,${0.75 + pulse * 0.25})`
  ctx.lineWidth = 3
  roundRectPath(ctx, cx - h, cy - h, h * 2, h * 2, radius)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Registry.
// ---------------------------------------------------------------------------

export const MAPS: Record<MapId, GameMap> = { circle, square, rect }

export const MAP_LIST: { id: MapId; name: string }[] = [
  { id: 'circle', name: circle.name },
  { id: 'square', name: square.name },
  { id: 'rect', name: rect.name },
]
