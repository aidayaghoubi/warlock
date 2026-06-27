import { create } from 'zustand'
import type { MapId, WarlockKind } from '../game/types'
import type { GameState } from '../game/types'
import type { LobbyState, LobbySummary, ServerMsg } from '../shared/protocol'
import { net, type NetStatus } from '../net/client'

/** Where the multiplayer flow currently is. `idle` means "not in multiplayer". */
export type NetView = 'idle' | 'lobbyList' | 'lobby' | 'playing' | 'gameover'

export interface MatchInfo {
  localWarlockId: number
  mapId: MapId
  targetScore: number
}

// Snapshots arrive ~20Hz and must NOT go through React state (it would thrash the UI).
// The in-match controller subscribes here for the raw stream instead.
type SnapshotListener = (serverTime: number, state: GameState, acks: Record<number, number>) => void
const snapshotListeners = new Set<SnapshotListener>()

export function subscribeSnapshots(cb: SnapshotListener): () => void {
  snapshotListeners.add(cb)
  return () => snapshotListeners.delete(cb)
}

interface NetStore {
  status: NetStatus
  selfId: string | null
  name: string
  view: NetView
  lobbies: LobbySummary[]
  lobby: LobbyState | null
  match: MatchInfo | null
  winner: string | null
  error: string | null

  setName: (name: string) => void
  browseLobbies: (name: string) => void
  createLobby: (mapId: MapId, targetScore: number, kind: WarlockKind) => void
  joinLobby: (code: string, kind: WarlockKind) => void
  setKind: (kind: WarlockKind) => void
  setReady: (ready: boolean) => void
  setBots: (bots: number) => void
  setConfig: (cfg: { mapId?: MapId; targetScore?: number }) => void
  startMatch: () => void
  leaveLobby: () => void
  returnToLobby: () => void
  backToMenu: () => void
}

export const useNet = create<NetStore>((set, get) => {
  // wire the singleton socket to this store once
  net.onStatusChange((status) => set({ status }))
  net.onMessage((msg: ServerMsg) => handle(msg, set, get))

  return {
    status: 'disconnected',
    selfId: null,
    name: localStorage.getItem('warlock.name') ?? '',
    view: 'idle',
    lobbies: [],
    lobby: null,
    match: null,
    winner: null,
    error: null,

    setName: (name) => {
      localStorage.setItem('warlock.name', name)
      set({ name })
    },

    browseLobbies: (name) => {
      get().setName(name)
      net.connect(name || 'Player')
      net.send({ type: 'subscribeLobbies' })
      set({ view: 'lobbyList', error: null })
    },

    createLobby: (mapId, targetScore, kind) => {
      net.send({ type: 'unsubscribeLobbies' })
      net.send({ type: 'createLobby', mapId, targetScore, kind })
    },

    joinLobby: (code, kind) => {
      net.send({ type: 'unsubscribeLobbies' })
      net.send({ type: 'joinLobby', code, kind })
    },

    setKind: (kind) => net.send({ type: 'setKind', kind }),
    setReady: (ready) => net.send({ type: 'setReady', ready }),
    setBots: (bots) => net.send({ type: 'setBots', bots }),
    setConfig: (cfg) => net.send({ type: 'setConfig', ...cfg }),
    startMatch: () => net.send({ type: 'startMatch' }),

    leaveLobby: () => {
      net.send({ type: 'leaveLobby' })
      net.send({ type: 'subscribeLobbies' })
      set({ lobby: null, view: 'lobbyList' })
    },

    returnToLobby: () => set({ view: 'lobby', winner: null }),

    backToMenu: () => {
      net.send({ type: 'leaveLobby' })
      net.send({ type: 'unsubscribeLobbies' })
      set({ view: 'idle', lobby: null, match: null, winner: null, error: null })
    },
  }
})

type Setter = (partial: Partial<NetStore>) => void
type Getter = () => NetStore

function handle(msg: ServerMsg, set: Setter, get: Getter): void {
  switch (msg.type) {
    case 'welcome':
      set({ selfId: msg.selfId })
      break

    case 'lobbyList':
      set({ lobbies: msg.lobbies })
      break

    case 'lobbyState': {
      // entering a lobby from the list/create flow flips the view; otherwise just refresh
      const view = get().view
      set({ lobby: msg.lobby, view: view === 'lobbyList' || view === 'idle' ? 'lobby' : view })
      break
    }

    case 'lobbyClosed':
      set({ lobby: null, match: null })
      break

    case 'matchStart':
      set({
        match: { localWarlockId: msg.localWarlockId, mapId: msg.mapId, targetScore: msg.targetScore },
        winner: null,
        view: 'playing',
      })
      break

    case 'snapshot':
      for (const cb of snapshotListeners) cb(msg.serverTime, msg.state, msg.acks)
      break

    case 'matchOver':
      set({ winner: msg.winner, view: 'gameover' })
      break

    case 'error':
      set({ error: msg.message })
      break
  }
}
