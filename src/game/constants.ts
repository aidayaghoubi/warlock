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
export const FIRE_COLOR = '#ff4d3a' // arcane (fire) bolt projectile
export const ICE_COLOR = '#bdebff' // ice-bolt projectile / frost FX
export const ICE_SLOW_FACTOR = 0.5 // movement multiplier while slowed (50%)
export const ICE_SLOW_DURATION = 2.0 // seconds the slow lasts

// Nature warlock: green bolt that roots the target; no blink, regenerates HP.
export const NATURE_COLOR = '#6fd66f' // nature player body tint
export const NATURE_BOLT_COLOR = '#4ce06a' // green bolt projectile / FX
export const NATURE_ROOT_DURATION = 2.0 // seconds the target is rooted (can't move)
export const NATURE_REGEN_PER_SEC = 2.5 // HP regenerated per second

// Assassin: black bolt (no knockback); Burst is replaced by Stealth (invisibility + strike).
export const ASSASSIN_COLOR = '#2e2c36' // assassin player body tint (near-black)
export const SHADOW_BOLT_COLOR = '#2b2535' // black bolt projectile (white core keeps it visible)
export const STEALTH_DURATION = 2.0 // seconds of invisibility
export const STEALTH_COOLDOWN = 8 // W-slot cooldown for assassin stealth
export const STEALTH_STRIKE_DAMAGE = 20 // heavy damage when passing through a foe while invisible

// --- Arena: Crown (capture-the-crown; lava does NOT shrink) ---
export const CROWN_RADIUS = 330 // fixed arena radius (no shrink in this scenario)
export const CROWN_HOME_RING = 0.82 // home pads sit at this fraction of the radius (near the border)
export const CROWN_PICKUP_RADIUS = 24 // walk this close to the loose crown to grab it
export const CROWN_HOME_RADIUS = 34 // carry the crown this close to your home to win the round
export const CROWN_COLOR = '#ffd24a' // gold

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
  { id: 'nature', name: 'Nature' },
  { id: 'assassin', name: 'Assassin' },
]

export const PLAYER_COLOR = '#46c6ff'
export const BOT_COLORS = ['#ff5a5a', '#7be36a', '#ffd24a', '#c77dff', '#ff9d3a']
export const BOT_NAMES = ['Grommash', 'Sylvana', 'Kelthar', 'Mannoroth', 'Vexa']

/** Body tint for a human player's chosen warlock kind. */
export function playerColorForKind(kind: WarlockKind): string {
  return kind === 'snow'
    ? SNOW_COLOR
    : kind === 'nature'
      ? NATURE_COLOR
      : kind === 'assassin'
        ? ASSASSIN_COLOR
        : PLAYER_COLOR
}
