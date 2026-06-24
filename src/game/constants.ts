// --- Simulation ---
export const SIM_HZ = 60
export const SIM_DT = 1 / SIM_HZ
export const MAX_FRAME_DT = 0.1 // clamp huge frames (tab refocus) so physics stays sane

// --- Arena ---
export const ARENA_RADIUS_START = 320
export const ARENA_RADIUS_MIN = 130
export const ARENA_SHRINK_PER_SEC = 6 // lava creeps inward during a round

// --- Warlock ---
export const WARLOCK_RADIUS = 16
export const WARLOCK_MAX_HP = 30
export const WALK_SPEED = 170 // units / sec
export const FRICTION = 2.1 // velocity decay coefficient (higher = stops faster)
export const WALK_CANCEL_SPEED = 95 // above this slide speed you can't walk (pure slide)
export const LAVA_DPS = 28

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

export const PLAYER_COLOR = '#46c6ff'
export const BOT_COLORS = ['#ff5a5a', '#7be36a', '#ffd24a', '#c77dff', '#ff9d3a']
export const BOT_NAMES = ['Grommash', 'Sylvana', 'Kelthar', 'Mannoroth', 'Vexa']
