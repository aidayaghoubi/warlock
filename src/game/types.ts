export interface Vec2 {
  x: number
  y: number
}

export type SpellId = 'bolt' | 'burst' | 'blink'

export type MapId = 'circle' | 'square' | 'rect'

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
}
