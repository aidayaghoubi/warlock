import {
  decodeServer,
  encode,
  DEFAULT_PORT,
  type ClientMsg,
  type ServerMsg,
} from '../shared/protocol'

/**
 * Resolve the multiplayer server endpoint.
 *
 * Priority:
 *  1. `VITE_SERVER_URL` baked in at build time (e.g. `wss://play.example.com/ws`)
 *     — use this for any real deployment behind a reverse proxy.
 *  2. Auto-derive from the page: same host as the page, matching protocol
 *     (`wss://` when served over HTTPS, `ws://` otherwise), on the fixed game port.
 *     This is the convenient dev / bare-IP default.
 */
export function defaultServerUrl(): string {
  const configured = import.meta.env?.VITE_SERVER_URL
  if (configured) return configured

  if (typeof location === 'undefined') return `ws://localhost:${DEFAULT_PORT}`
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.hostname}:${DEFAULT_PORT}`
}

type MsgHandler = (msg: ServerMsg) => void
type StatusHandler = (status: NetStatus) => void

export type NetStatus = 'disconnected' | 'connecting' | 'connected'

/**
 * Thin typed WebSocket wrapper. Owns the socket lifecycle and fans server messages
 * out to a single handler; the store and the in-match controller subscribe through it.
 */
export class NetClient {
  private ws: WebSocket | null = null
  private onMsg: MsgHandler = () => {}
  private onStatus: StatusHandler = () => {}
  status: NetStatus = 'disconnected'
  private name = 'Player'

  onMessage(h: MsgHandler): void {
    this.onMsg = h
  }

  onStatusChange(h: StatusHandler): void {
    this.onStatus = h
  }

  get connected(): boolean {
    return this.status === 'connected'
  }

  /** Connect (idempotent) and send the `hello` once open. */
  connect(name: string, url = defaultServerUrl()): void {
    this.name = name
    if (this.ws && (this.status === 'connected' || this.status === 'connecting')) {
      // already connected — just refresh the name
      this.send({ type: 'hello', name })
      return
    }
    this.setStatus('connecting')
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onopen = () => {
      this.setStatus('connected')
      this.send({ type: 'hello', name: this.name })
    }
    ws.onmessage = (ev) => {
      let msg: ServerMsg
      try {
        msg = decodeServer(typeof ev.data === 'string' ? ev.data : '')
      } catch {
        return
      }
      this.onMsg(msg)
    }
    ws.onclose = () => {
      this.ws = null
      this.setStatus('disconnected')
    }
    ws.onerror = () => {
      /* close handler will follow */
    }
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(encode(msg))
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
  }

  private setStatus(s: NetStatus): void {
    this.status = s
    this.onStatus(s)
  }
}

/** Process-wide singleton — there is only ever one connection per tab. */
export const net = new NetClient()
