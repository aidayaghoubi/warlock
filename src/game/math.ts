import type { Vec2 } from './types'

export const v = (x: number, y: number): Vec2 => ({ x, y })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })

export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export function norm(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y)
  if (l < 1e-6) return { x: 0, y: 0 }
  return { x: a.x / l, y: a.y / l }
}

export const angle = (a: Vec2): number => Math.atan2(a.y, a.x)
export const fromAngle = (r: number, m = 1): Vec2 => ({ x: Math.cos(r) * m, y: Math.sin(r) * m })

export const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo)
