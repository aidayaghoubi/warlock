import { WebSocketServer, type WebSocket } from 'ws'
import { decodeClient, encode, DEFAULT_PORT, type ServerMsg } from '../src/shared/protocol'
import { Connection, Hub } from './hub'

const PORT = Number(process.env.PORT ?? DEFAULT_PORT)

const hub = new Hub()
const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws: WebSocket) => {
  const send = (msg: ServerMsg): void => {
    if (ws.readyState === ws.OPEN) ws.send(encode(msg))
  }
  const conn = new Connection(send)

  ws.on('message', (data) => {
    let msg
    try {
      msg = decodeClient(data.toString())
    } catch {
      return // ignore malformed frames
    }
    try {
      hub.handle(conn, msg)
    } catch (err) {
      console.error('handler error:', err)
    }
  })

  ws.on('close', () => hub.disconnect(conn))
  ws.on('error', () => hub.disconnect(conn))
})

console.log(`⚔️  Warlock server listening on ws://localhost:${PORT}`)
