import type { GameState, Vec2 } from './types'
import { fromAngle, rand } from './math'

export function spawnSpray(
  state: GameState,
  pos: Vec2,
  color: string,
  count: number,
  speed: number,
  life = 0.5,
  size = 3,
): void {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2)
    const s = rand(speed * 0.25, speed)
    state.particles.push({
      pos: { ...pos },
      vel: fromAngle(a, s),
      life,
      maxLife: life,
      size: rand(size * 0.5, size),
      color,
    })
  }
}

export function spawnHit(state: GameState, pos: Vec2, dir: Vec2, color: string): void {
  const base = Math.atan2(dir.y, dir.x)
  for (let i = 0; i < 12; i++) {
    const a = base + rand(-0.7, 0.7)
    const s = rand(70, 260)
    state.particles.push({
      pos: { ...pos },
      vel: fromAngle(a, s),
      life: 0.45,
      maxLife: 0.45,
      size: rand(2, 4),
      color,
    })
  }
}

export function spawnRing(state: GameState, pos: Vec2, color: string, radius: number): void {
  const n = 30
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    state.particles.push({
      pos: { ...pos },
      vel: fromAngle(a, radius * 2.4),
      life: 0.4,
      maxLife: 0.4,
      size: 4,
      color,
    })
  }
}

export function spawnDeath(state: GameState, pos: Vec2, color: string): void {
  spawnSpray(state, pos, color, 34, 340, 0.85, 5)
}
