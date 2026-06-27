/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Multiplayer server WebSocket URL, e.g. `wss://play.example.com/ws`. Optional. */
  readonly VITE_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
