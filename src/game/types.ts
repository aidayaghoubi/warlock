export interface Vec2 {
  x: number
  y: number
}

export type SpellId = 'bolt' | 'burst' | 'blink'

export type MapId = 'circle' | 'square' | 'rect' | 'crown'

export type WarlockKind = 'arcane' | 'snow' | 'nature' | 'assassin'

export interface AIState {
  thinkTimer: number
  aimError: number
  desiredRange: number
}

export interface Warlock {
  id: number
  name: string
  kind: WarlockKind
  color: string
  isPlayer: boolean
  alive: boolean
  pos: Vec2
  vel: Vec2
  radius: number
  hp: number
  maxHp: number
  moveTarget: Vec2 | null
  facing: number
  cooldowns: Record<SpellId, number>
  score: number
  safeTime: number
  slowTimer: number // seconds of remaining movement slow (from ice)
  rootTimer: number // seconds of remaining root / can't-move (from nature)
  invisTimer: number // seconds of remaining invisibility (assassin stealth)
  home: Vec2 | null // crown scenario: this warlock's home pad near the border
  ai: AIState | null
}

export interface Projectile {
  id: number
  ownerId: number
  pos: Vec2
  vel: Vec2
  radius: number
  damage: number
  knockback: number
  life: number
  color: string
  trail: Vec2[]
  slow?: number // if set, seconds of movement slow applied on hit (ice bolt)
  root?: number // if set, seconds of root / can't-move applied on hit (nature bolt)
}

export interface Particle {
  pos: Vec2
  vel: Vec2
  life: number
  maxLife: number
  size: number
  color: string
}

export type Phase = 'countdown' | 'fighting' | 'roundover' | 'matchover'

/** Crown scenario: the crown either sits on the ground at `pos` or is carried by `holderId`. */
export interface Crown {
  pos: Vec2
  holderId: number | null
}

export interface GameState {
  warlocks: Warlock[]
  projectiles: Projectile[]
  particles: Particle[]
  mapId: MapId
  phase: Phase
  phaseTimer: number
  round: number
  roundTime: number
  targetScore: number
  nextProjectileId: number
  winnerName: string | null
  crown: Crown | null // non-null only in the crown scenario
}

export interface HudSpell {
  id: SpellId
  name: string
  key: string
  ready: boolean
  cooldownPct: number
}

export interface HudScore {
  name: string
  color: string
  score: number
  alive: boolean
  isPlayer: boolean
}

export interface HudSnapshot {
  alive: boolean
  hp: number
  maxHp: number
  spells: HudSpell[]
  round: number
  phase: Phase
  phaseTimer: number
  banner: string
  scores: HudScore[]
  arenaPct: number
  inLava: boolean
  crownActive: boolean // crown scenario in play
  crownHolderName: string | null // who carries the crown (null = on the ground)
  crownYouHaveIt: boolean // the local player is carrying the crown
}
