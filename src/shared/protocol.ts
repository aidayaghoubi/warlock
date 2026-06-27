/**
 * Wire protocol shared by the client and the authoritative server.
 *
 * Transport is a single WebSocket per client carrying JSON-encoded messages. Every
 * message has a `type` discriminator. Client→server messages are {@link ClientMsg};
 * server→client are {@link ServerMsg}.
 */
import type { GameState, MapId, SpellId, Vec2, WarlockKind } from '../game/types'

/** Hard cap on warlocks in one match (humans + bots). Matches the available colors. */
export const MAX_SEATS = 6

/** WebSocket port the dev server listens on. */
export const DEFAULT_PORT = 8787

// --- lobby data shapes -------------------------------------------------------

/** One human in a lobby. `id` is the server-assigned connection id. */
export interface LobbyPlayer {
  id: string
  name: string
  kind: WarlockKind
  ready: boolean
}

/** Full state of a single lobby, sent to the players inside it. */
export interface LobbyState {
  code: string
  hostId: string
  mapId: MapId
  targetScore: number
  bots: number
  players: LobbyPlayer[]
}

/** Compact lobby description for the public "browse lobbies" list. */
export interface LobbySummary {
  code: string
  hostName: string
  mapId: MapId
  targetScore: number
  playerCount: number
  maxPlayers: number
  status: 'lobby' | 'playing'
}

// --- client -> server --------------------------------------------------------

export type ClientMsg =
  /** First message after connecting: establish the player's display name. */
  | { type: 'hello'; name: string }
  /** Start/stop receiving live updates of the public lobby list. */
  | { type: 'subscribeLobbies' }
  | { type: 'unsubscribeLobbies' }
  /** Create a new public lobby and join it as host. */
  | { type: 'createLobby'; mapId: MapId; targetScore: number; kind: WarlockKind }
  /** Join an existing lobby by its code. */
  | { type: 'joinLobby'; code: string; kind: WarlockKind }
  /** Leave the current lobby (back to the menu). */
  | { type: 'leaveLobby' }
  /** Change your chosen warlock kind in the lobby. */
  | { type: 'setKind'; kind: WarlockKind }
  /** Toggle your ready flag in the lobby. */
  | { type: 'setReady'; ready: boolean }
  /** Host only: set how many AI bots fill the match. */
  | { type: 'setBots'; bots: number }
  /** Host only: change map and/or rounds-to-win. */
  | { type: 'setConfig'; mapId?: MapId; targetScore?: number }
  /** Host only: lock the lobby and start the match. */
  | { type: 'startMatch' }
  /** During play: this client's control intent. `seq` lets the server ack progress
   *  so the client can reconcile its local prediction. */
  | { type: 'input'; seq: number; aim: Vec2; moveDown: boolean; casts: SpellId[] }

// --- server -> client --------------------------------------------------------

export type ServerMsg =
  /** Acknowledges `hello`; carries this connection's stable id. */
  | { type: 'welcome'; selfId: string }
  /** Live public lobby list (sent on subscribe and whenever it changes). */
  | { type: 'lobbyList'; lobbies: LobbySummary[] }
  /** The lobby you are in changed (join, settings, players, ready flags). */
  | { type: 'lobbyState'; lobby: LobbyState }
  /** You left / the lobby closed — return to the menu. */
  | { type: 'lobbyClosed'; reason: string }
  /** The match is starting; `localWarlockId` is the warlock this client controls. */
  | { type: 'matchStart'; localWarlockId: number; mapId: MapId; targetScore: number }
  /** Periodic authoritative world state for rendering. `serverTime` is seconds.
   *  `acks` maps each warlock id to the last input `seq` the server has applied for
   *  it, so a client can drop reconciled inputs and replay only the rest. */
  | { type: 'snapshot'; serverTime: number; state: GameState; acks: Record<number, number> }
  /** The match ended. */
  | { type: 'matchOver'; winner: string | null }
  /** A request failed (bad code, lobby full, not host, etc.). */
  | { type: 'error'; message: string }

// --- helpers -----------------------------------------------------------------

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg)
}

export function decodeClient(data: string): ClientMsg {
  return JSON.parse(data) as ClientMsg
}

export function decodeServer(data: string): ServerMsg {
  return JSON.parse(data) as ServerMsg
}
