import type { GameState, Vec2, Warlock } from './types'
import * as C from './constants'
import { add, angle, dist, len, norm, rand, scale, sub } from './math'
import { castSpell } from './spells'

/** Lightweight bot brain: avoid lava, keep range, poke with bolts, peel with burst. */
export function aiUpdate(state: GameState, bot: Warlock, dt: number): void {
  if (!bot.alive || !bot.ai) return
  const ai = bot.ai

  const distCenter = len(bot.pos)
  const danger = state.arenaRadius - distCenter // < 0 means standing in lava
  const nearEdge = danger < 65

  // --- reactive safety, evaluated every frame ---
  if (nearEdge) {
    bot.moveTarget = { x: 0, y: 0 }
    if (danger < 12 && bot.cooldowns.blink <= 0) {
      const inward = norm(scale(bot.pos, -1))
      castSpell(state, bot, 'blink', add(bot.pos, scale(inward, C.BLINK_RANGE)))
    }
  }

  ai.thinkTimer -= dt
  if (ai.thinkTimer > 0) return
  ai.thinkTimer = rand(0.12, 0.28)

  const target = nearestEnemy(state, bot)
  if (!target) {
    bot.moveTarget = { x: 0, y: 0 }
    return
  }
  bot.facing = angle(sub(target.pos, bot.pos))
  const d = dist(bot.pos, target.pos)

  // burst when an enemy is right on top of us
  if (d < C.BURST_RADIUS * 0.7 && bot.cooldowns.burst <= 0) {
    castSpell(state, bot, 'burst', bot.pos)
  }

  // movement: hold preferred range (edge safety already set target if needed)
  if (!nearEdge) {
    const toTarget = norm(sub(target.pos, bot.pos))
    let desired: Vec2
    if (d > ai.desiredRange + 40) {
      desired = add(bot.pos, scale(toTarget, 130)) // close in
    } else if (d < ai.desiredRange - 40) {
      desired = add(bot.pos, scale(toTarget, -130)) // back off
    } else {
      const side = bot.id % 2 === 0 ? 1 : -1
      desired = add(bot.pos, { x: -toTarget.y * 120 * side, y: toTarget.x * 120 * side }) // strafe
    }
    const dl = len(desired)
    const maxR = state.arenaRadius - 55
    if (dl > maxR) desired = scale(norm(desired), maxR)
    bot.moveTarget = desired
  }

  // bolt with lead + accuracy error that grows with distance
  if (bot.cooldowns.bolt <= 0 && d < C.BOLT_RANGE * 0.92) {
    const travel = d / C.BOLT_SPEED
    const lead = add(target.pos, scale(target.vel, travel))
    const err = ai.aimError * (d / C.BOLT_RANGE)
    const aim = add(lead, { x: rand(-err, err), y: rand(-err, err) })
    castSpell(state, bot, 'bolt', aim)
  }
}

function nearestEnemy(state: GameState, bot: Warlock): Warlock | null {
  let best: Warlock | null = null
  let bd = Infinity
  for (const w of state.warlocks) {
    if (w.id === bot.id || !w.alive) continue
    const d = dist(w.pos, bot.pos)
    if (d < bd) {
      bd = d
      best = w
    }
  }
  return best
}
