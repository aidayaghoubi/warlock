import type { WarlockKind } from './types'

// --- Simulation ---
export const SIM_HZ = 60
export const SIM_DT = 1 / SIM_HZ
export const MAX_FRAME_DT = 0.1 // clamp huge frames (tab refocus) so physics stays sane

// --- Arena: Circle (default) ---
export const ARENA_RADIUS_START = 320
export const ARENA_RADIUS_MIN = 130
export const ARENA_SHRINK_PER_SEC = 6 // lava creeps inward during a round

// --- Arena: Square ---
export const SQUARE_HALF_START = 300 // half side-length at round start
export const SQUARE_HALF_MIN = 120
export const SQUARE_SHRINK_PER_SEC = 5.5

// --- Arena: Rectangle (with a fixed lava square in the center) ---
export const RECT_HALF_W_START = 380
export const RECT_HALF_H_START = 240
export const RECT_HALF_W_MIN = 175
export const RECT_HALF_H_MIN = 110
export const RECT_SHRINK_PER_SEC = 5
export const RECT_INNER_HALF = 70 // half side-length of the central lava square (fixed)

// --- Warlock ---
export const WARLOCK_RADIUS = 16
export const WARLOCK_MAX_HP = 30
export const WALK_SPEED = 170 // units / sec
export const FRICTION = 2.1 // velocity decay coefficient (higher = stops faster)
export const WALK_CANCEL_SPEED = 95 // above this slide speed you can't walk (pure slide)
export const LAVA_DPS = 28

// --- Warlock kinds ---
// Snow warlock's Bolt throws ice that slows the target's movement.
export const SNOW_COLOR = '#8fd8ff' // snow player body tint
export const ICE_COLOR = '#bdebff' // ice-bolt projectile / frost FX
export const ICE_SLOW_FACTOR = 0.5 // movement multiplier while slowed (50%)
export const ICE_SLOW_DURATION = 2.0 // seconds the slow lasts

// --- Round flow (seconds) ---
export const COUNTDOWN_TIME = 2.2
export const ROUNDOVER_TIME = 2.8
export const SAFE_TIME = 0.6 // brief invulnerability at round start

// --- Spell: Bolt (Q) ---
export const BOLT_SPEED = 540
export const BOLT_RANGE = 720
export const BOLT_DAMAGE = 7
export const BOLT_KNOCKBACK = 300
export const BOLT_RADIUS = 7
export const BOLT_COOLDOWN = 0.95

// --- Spell: Burst / Nova (W) ---
export const BURST_RADIUS = 145
export const BURST_KNOCKBACK = 470
export const BURST_DAMAGE = 4
export const BURST_COOLDOWN = 7

// --- Spell: Blink (E) ---
export const BLINK_RANGE = 230
export const BLINK_COOLDOWN = 5

export const WARLOCK_KIND_LIST: { id: WarlockKind; name: string }[] = [
  { id: 'arcane', name: 'Arcane' },
  { id: 'snow', name: 'Snow' },
]

export const PLAYER_COLOR = '#46c6ff'
export const BOT_COLORS = ['#ff5a5a', '#7be36a', '#ffd24a', '#c77dff', '#ff9d3a']
export const BOT_NAMES = ['Grommash', 'Sylvana', 'Kelthar', 'Mannoroth', 'Vexa']
