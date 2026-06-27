import * as C from '../src/game/constants'
import { createGameState, stepSim, type IntentMap, type PlayerIntent, type Seat } from '../src/game/sim'
import type { GameState, MapId, SpellId, Vec2, WarlockKind } from '../src/game/types'
import {
  MAX_SEATS,
  type LobbyPlayer,
  type LobbyState,
  type LobbySummary,
  type ServerMsg,
} from '../src/shared/protocol'

const SNAPSHOT_HZ = 20
const SNAPSHOT_INTERVAL = 1 / SNAPSHOT_HZ

/** A connected human inside a room. */
interface Member {
  id: string
  name: string
  kind: WarlockKind
  ready: boolean
  send: (msg: ServerMsg) => void
  warlockId: number | null // seat index once the match starts
  intent: PlayerIntent // latest control state (persists between sim steps)
}

function freshIntent(): PlayerIntent {
  return { aim: { x: 0, y: 0 }, moveDown: false, casts: [] }
}

/**
 * A single public room: a lobby that the host can launch into an authoritative match.
 * The room owns the simulation while playing and broadcasts snapshots to its members.
 * It reverts to the lobby when the match ends, and is destroyed when it goes empty.
 */
export class Room {
  readonly code: string
  hostId: string
  mapId: MapId
  targetScore: number
  bots: number
  status: 'lobby' | 'playing' = 'lobby'

  private members: Member[] = []
  private state: GameState | null = null
  private serverTime = 0
  private acc = 0
  private snapAcc = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTick = 0

  /** Called whenever something the public lobby list cares about changes. */
  private readonly onChanged: () => void

  constructor(code: string, host: { mapId: MapId; targetScore: number }, onChanged: () => void) {
    this.code = code
    this.hostId = ''
    this.mapId = host.mapId
    this.targetScore = host.targetScore
    this.bots = 0
    this.onChanged = onChanged
  }

  get isEmpty(): boolean {
    return this.members.length === 0
  }

  get playerCount(): number {
    return this.members.length
  }

  // --- membership ------------------------------------------------------------

  /** Returns false if the room can't be joined (full, or already playing). */
  add(member: { id: string; name: string; kind: WarlockKind; send: (m: ServerMsg) => void }): boolean {
    if (this.status === 'playing') return false
    if (this.members.length >= MAX_SEATS) return false
    const first = this.members.length === 0
    this.members.push({
      id: member.id,
      name: member.name,
      kind: member.kind,
      ready: false,
      send: member.send,
      warlockId: null,
      intent: freshIntent(),
    })
    if (first) this.hostId = member.id
    this.clampBots()
    this.broadcastLobby()
    this.onChanged()
    return true
  }

  remove(connId: string): void {
    const idx = this.members.findIndex((m) => m.id === connId)
    if (idx === -1) return
    this.members.splice(idx, 1)
    // If the host left, hand the role to whoever is next (server owns the game,
    // so this is purely about who controls lobby settings / the start button).
    if (connId === this.hostId && this.members.length > 0) {
      this.hostId = this.members[0].id
    }
    this.clampBots()
    if (this.status === 'lobby') this.broadcastLobby()
    this.onChanged()
  }

  private member(connId: string): Member | undefined {
    return this.members.find((m) => m.id === connId)
  }

  private isHost(connId: string): boolean {
    return connId === this.hostId
  }

  // --- lobby actions ---------------------------------------------------------

  setKind(connId: string, kind: WarlockKind): void {
    const m = this.member(connId)
    if (!m || this.status !== 'lobby') return
    m.kind = kind
    this.broadcastLobby()
  }

  setReady(connId: string, ready: boolean): void {
    const m = this.member(connId)
    if (!m || this.status !== 'lobby') return
    m.ready = ready
    this.broadcastLobby()
  }

  setBots(connId: string, bots: number): void {
    if (!this.isHost(connId) || this.status !== 'lobby') return
    this.bots = bots
    this.clampBots()
    this.broadcastLobby()
    this.onChanged()
  }

  setConfig(connId: string, cfg: { mapId?: MapId; targetScore?: number }): void {
    if (!this.isHost(connId) || this.status !== 'lobby') return
    if (cfg.mapId) this.mapId = cfg.mapId
    if (cfg.targetScore) this.targetScore = cfg.targetScore
    this.broadcastLobby()
    this.onChanged()
  }

  /** Keep bot count within the seats left after humans (at least 0). */
  private clampBots(): void {
    const maxBots = Math.max(0, MAX_SEATS - this.members.length)
    if (this.bots > maxBots) this.bots = maxBots
  }

  // --- starting & running the match ------------------------------------------

  start(connId: string): void {
    if (!this.isHost(connId) || this.status !== 'lobby') return
    if (this.members.length === 0) return

    const seats: Seat[] = this.members.map((m) => ({
      name: m.name,
      kind: m.kind,
      color: C.playerColorForKind(m.kind),
      isBot: false,
      isLocal: false,
    }))
    for (let i = 0; i < this.bots; i++) {
      seats.push({
        name: C.BOT_NAMES[i % C.BOT_NAMES.length],
        kind: 'arcane',
        color: C.BOT_COLORS[i % C.BOT_COLORS.length],
        isBot: true,
        isLocal: false,
      })
    }

    this.state = createGameState({ seats, targetScore: this.targetScore, mapId: this.mapId })
    this.status = 'playing'
    this.serverTime = 0
    this.acc = 0
    this.snapAcc = 0

    // each human controls the warlock at their seat index
    this.members.forEach((m, i) => {
      m.warlockId = i
      m.intent = freshIntent()
      m.send({ type: 'matchStart', localWarlockId: i, mapId: this.mapId, targetScore: this.targetScore })
    })

    this.onChanged() // drop out of the public "joinable" list
    this.lastTick = Date.now()
    this.timer = setInterval(this.tick, 1000 / C.SIM_HZ)
  }

  /** Record a player's latest control intent (called from the network layer). */
  input(connId: string, aim: Vec2, moveDown: boolean, casts: SpellId[]): void {
    const m = this.member(connId)
    if (!m || m.warlockId === null) return
    m.intent.aim = aim
    m.intent.moveDown = moveDown
    if (casts.length) m.intent.casts.push(...casts)
  }

  private tick = (): void => {
    if (this.status !== 'playing' || !this.state) return
    const now = Date.now()
    let dt = (now - this.lastTick) / 1000
    this.lastTick = now
    if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT
    this.acc += dt

    let steps = 0
    while (this.acc >= C.SIM_DT && steps < 6) {
      stepSim(this.state, this.buildIntents(), C.SIM_DT)
      this.acc -= C.SIM_DT
      this.serverTime += C.SIM_DT
      steps++
      if (this.state.phase === 'matchover') {
        this.endMatch()
        return
      }
    }

    this.snapAcc += dt
    if (this.snapAcc >= SNAPSHOT_INTERVAL) {
      this.snapAcc = 0
      this.broadcast({ type: 'snapshot', serverTime: this.serverTime, state: this.state })
    }
  }

  /** Assemble the per-warlock intents for one step, consuming queued casts. */
  private buildIntents(): IntentMap {
    const intents: IntentMap = {}
    for (const m of this.members) {
      if (m.warlockId === null) continue
      intents[m.warlockId] = { aim: m.intent.aim, moveDown: m.intent.moveDown, casts: m.intent.casts }
      m.intent.casts = [] // casts are one-shot edge events
    }
    return intents
  }

  private endMatch(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const winner = this.state?.winnerName ?? null
    this.broadcast({ type: 'snapshot', serverTime: this.serverTime, state: this.state! })
    this.broadcast({ type: 'matchOver', winner })

    // revert to the lobby so the group can play again
    this.status = 'lobby'
    this.state = null
    for (const m of this.members) {
      m.warlockId = null
      m.ready = false
    }
    this.broadcastLobby()
    this.onChanged()
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // --- snapshots of lobby state ----------------------------------------------

  summary(): LobbySummary {
    const host = this.members.find((m) => m.id === this.hostId)
    return {
      code: this.code,
      hostName: host?.name ?? '—',
      mapId: this.mapId,
      targetScore: this.targetScore,
      playerCount: this.members.length,
      maxPlayers: MAX_SEATS,
      status: this.status,
    }
  }

  private lobbyState(): LobbyState {
    const players: LobbyPlayer[] = this.members.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      ready: m.ready,
    }))
    return {
      code: this.code,
      hostId: this.hostId,
      mapId: this.mapId,
      targetScore: this.targetScore,
      bots: this.bots,
      players,
    }
  }

  private broadcastLobby(): void {
    const msg: ServerMsg = { type: 'lobbyState', lobby: this.lobbyState() }
    for (const m of this.members) m.send(msg)
  }

  private broadcast(msg: ServerMsg): void {
    for (const m of this.members) m.send(msg)
  }
}
