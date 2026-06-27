import type { MapId, WarlockKind } from '../src/game/types'
import type { ClientMsg, LobbySummary, ServerMsg } from '../src/shared/protocol'
import { Room } from './room'

let nextConnSeq = 1

/** One connected client. Wraps the transport's send and tracks lobby membership. */
export class Connection {
  readonly id = `c${nextConnSeq++}`
  name = 'Player'
  roomCode: string | null = null
  watchingList = false

  constructor(private readonly sendRaw: (msg: ServerMsg) => void) {}

  send(msg: ServerMsg): void {
    this.sendRaw(msg)
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no easily-confused chars

/**
 * Central coordinator: owns all connections and rooms, routes client messages,
 * and keeps subscribers updated with the live public lobby list.
 */
export class Hub {
  private readonly rooms = new Map<string, Room>()
  private readonly listWatchers = new Set<Connection>()

  // --- connection lifecycle --------------------------------------------------

  disconnect(conn: Connection): void {
    this.listWatchers.delete(conn)
    if (conn.roomCode) this.leaveRoom(conn)
  }

  handle(conn: Connection, msg: ClientMsg): void {
    switch (msg.type) {
      case 'hello':
        conn.name = sanitizeName(msg.name)
        conn.send({ type: 'welcome', selfId: conn.id })
        break

      case 'subscribeLobbies':
        conn.watchingList = true
        this.listWatchers.add(conn)
        conn.send({ type: 'lobbyList', lobbies: this.summaries() })
        break

      case 'unsubscribeLobbies':
        conn.watchingList = false
        this.listWatchers.delete(conn)
        break

      case 'createLobby':
        this.createRoom(conn, msg.mapId, msg.targetScore, msg.kind)
        break

      case 'joinLobby':
        this.joinRoom(conn, msg.code.toUpperCase(), msg.kind)
        break

      case 'leaveLobby':
        this.leaveRoom(conn)
        break

      default:
        this.routeToRoom(conn, msg)
    }
  }

  /** Forward in-room messages (lobby settings, ready, input, start) to the room. */
  private routeToRoom(conn: Connection, msg: ClientMsg): void {
    const room = conn.roomCode ? this.rooms.get(conn.roomCode) : null
    if (!room) return
    switch (msg.type) {
      case 'setKind':
        room.setKind(conn.id, msg.kind)
        break
      case 'setReady':
        room.setReady(conn.id, msg.ready)
        break
      case 'setBots':
        room.setBots(conn.id, msg.bots)
        break
      case 'setConfig':
        room.setConfig(conn.id, { mapId: msg.mapId, targetScore: msg.targetScore })
        break
      case 'startMatch':
        room.start(conn.id)
        break
      case 'input':
        room.input(conn.id, msg.aim, msg.moveDown, msg.casts)
        break
    }
  }

  // --- rooms -----------------------------------------------------------------

  private createRoom(conn: Connection, mapId: MapId, targetScore: number, kind: WarlockKind): void {
    if (conn.roomCode) this.leaveRoom(conn)
    const code = this.newCode()
    const room = new Room(code, { mapId, targetScore }, () => this.refreshList())
    this.rooms.set(code, room)
    room.add({ id: conn.id, name: conn.name, kind, send: (m) => conn.send(m) })
    conn.roomCode = code
    this.refreshList()
  }

  private joinRoom(conn: Connection, code: string, kind: WarlockKind): void {
    const room = this.rooms.get(code)
    if (!room) {
      conn.send({ type: 'error', message: 'No lobby with that code.' })
      return
    }
    if (room.status === 'playing') {
      conn.send({ type: 'error', message: 'That match has already started.' })
      return
    }
    if (conn.roomCode && conn.roomCode !== code) this.leaveRoom(conn)
    const ok = room.add({ id: conn.id, name: conn.name, kind, send: (m) => conn.send(m) })
    if (!ok) {
      conn.send({ type: 'error', message: 'That lobby is full.' })
      return
    }
    conn.roomCode = code
    this.refreshList()
  }

  private leaveRoom(conn: Connection): void {
    if (!conn.roomCode) return
    const room = this.rooms.get(conn.roomCode)
    conn.roomCode = null
    conn.send({ type: 'lobbyClosed', reason: 'You left the lobby.' })
    if (!room) return
    room.remove(conn.id)
    if (room.isEmpty) {
      room.dispose()
      this.rooms.delete(room.code)
    }
    this.refreshList()
  }

  // --- public lobby list -----------------------------------------------------

  private summaries(): LobbySummary[] {
    const out: LobbySummary[] = []
    for (const room of this.rooms.values()) {
      if (room.status === 'lobby') out.push(room.summary())
    }
    return out
  }

  /** Push the current public list to everyone browsing lobbies. */
  private refreshList(): void {
    const lobbies = this.summaries()
    const msg: ServerMsg = { type: 'lobbyList', lobbies }
    for (const w of this.listWatchers) w.send(msg)
  }

  private newCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = ''
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      if (!this.rooms.has(code)) return code
    }
    return `${Date.now()}` // astronomically unlikely fallback
  }
}

function sanitizeName(raw: string): string {
  const trimmed = (raw ?? '').trim().slice(0, 16)
  return trimmed.length ? trimmed : 'Player'
}
