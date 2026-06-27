import {
  decodeServer,
  encode,
  DEFAULT_PORT,
  type ClientMsg,
  type ServerMsg,
} from '../shared/protocol'

/** Default dev endpoint: same host as the page, fixed game port. */
export function defaultServerUrl(): string {
  const host = typeof location !== 'undefined' ? location.hostname : 'localhost'
  return `ws://${host}:${DEFAULT_PORT}`
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
