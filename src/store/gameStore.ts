import { create } from 'zustand'
import type { HudSnapshot, MapId, WarlockKind } from '../game/types'

export type Screen = 'menu' | 'playing' | 'gameover'

export interface MatchConfig {
  bots: number
  targetScore: number
  mapId: MapId
  kind: WarlockKind
}

interface GameStore {
  screen: Screen
  gameId: number
  config: MatchConfig
  hud: HudSnapshot | null
  winner: string | null
  startGame: (config: MatchConfig) => void
  setHud: (hud: HudSnapshot) => void
  endMatch: (winner: string | null) => void
  toMenu: () => void
}

export const useGame = create<GameStore>((set) => ({
  screen: 'menu',
  gameId: 0,
  config: { bots: 2, targetScore: 5, mapId: 'circle', kind: 'arcane' },
  hud: null,
  winner: null,
  startGame: (config) =>
    set((s) => ({ screen: 'playing', config, gameId: s.gameId + 1, hud: null, winner: null })),
  setHud: (hud) => set({ hud }),
  endMatch: (winner) => set({ screen: 'gameover', winner }),
  toMenu: () => set({ screen: 'menu', hud: null, winner: null }),
}))
