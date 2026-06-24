import type { GameState, SpellId, Vec2, Warlock } from './types'
import * as C from './constants'
import { add, angle, dist, fromAngle, len, norm, scale, sub } from './math'
import { spawnRing, spawnSpray } from './effects'

export interface SpellDef {
  id: SpellId
  name: string
  key: string
  cooldown: number
}

export const SPELLS: Record<SpellId, SpellDef> = {
  bolt: { id: 'bolt', name: 'Bolt', key: 'Q', cooldown: C.BOLT_COOLDOWN },
  burst: { id: 'burst', name: 'Burst', key: 'W', cooldown: C.BURST_COOLDOWN },
  blink: { id: 'blink', name: 'Blink', key: 'E', cooldown: C.BLINK_COOLDOWN },
}

export const SPELL_ORDER: SpellId[] = ['bolt', 'burst', 'blink']

export function applyKnockback(w: Warlock, dir: Vec2, mag: number): void {
  w.vel.x += dir.x * mag
  w.vel.y += dir.y * mag
}

export function dealDamage(w: Warlock, amount: number): void {
  if (w.safeTime > 0) return
  w.hp -= amount
}

/** Attempt to cast; returns true if it fired (off cooldown). */
export function castSpell(state: GameState, caster: Warlock, id: SpellId, aim: Vec2): boolean {
  if (caster.cooldowns[id] > 0) return false
  switch (id) {
    case 'bolt':
      castBolt(state, caster, aim)
      break
    case 'burst':
      castBurst(state, caster)
      break
    case 'blink':
      castBlink(state, caster, aim)
      break
  }
  caster.cooldowns[id] = SPELLS[id].cooldown
  return true
}

function castBolt(state: GameState, caster: Warlock, aim: Vec2): void {
  let dir = norm(sub(aim, caster.pos))
  if (dir.x === 0 && dir.y === 0) dir = fromAngle(caster.facing)
  caster.facing = angle(dir)
  const spawn = add(caster.pos, scale(dir, caster.radius + 8))
  state.projectiles.push({
    id: state.nextProjectileId++,
    ownerId: caster.id,
    pos: spawn,
    vel: scale(dir, C.BOLT_SPEED),
    radius: C.BOLT_RADIUS,
    damage: C.BOLT_DAMAGE,
    knockback: C.BOLT_KNOCKBACK,
    life: C.BOLT_RANGE / C.BOLT_SPEED,
    color: caster.color,
    trail: [],
  })
}

function castBurst(state: GameState, caster: Warlock): void {
  spawnRing(state, caster.pos, '#ffce5a', C.BURST_RADIUS)
  for (const w of state.warlocks) {
    if (w.id === caster.id || !w.alive) continue
    const d = dist(w.pos, caster.pos)
    if (d > C.BURST_RADIUS) continue
    const dir = d < 1e-3 ? fromAngle(Math.random() * Math.PI * 2) : norm(sub(w.pos, caster.pos))
    const falloff = 1 - (d / C.BURST_RADIUS) * 0.45
    applyKnockback(w, dir, C.BURST_KNOCKBACK * falloff)
    dealDamage(w, C.BURST_DAMAGE)
  }
}

function castBlink(state: GameState, caster: Warlock, aim: Vec2): void {
  const to = sub(aim, caster.pos)
  const d = len(to)
  const dir = d < 1e-3 ? fromAngle(caster.facing) : scale(to, 1 / d)
  const reach = Math.min(d, C.BLINK_RANGE)
  spawnSpray(state, caster.pos, caster.color, 14, 130)
  caster.pos = add(caster.pos, scale(dir, reach))
  caster.facing = angle(dir)
  // Blink sheds most knockback — the core escape tool.
  caster.vel.x *= 0.2
  caster.vel.y *= 0.2
  spawnSpray(state, caster.pos, caster.color, 14, 130)
}
