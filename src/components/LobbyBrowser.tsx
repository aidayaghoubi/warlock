import { useState } from 'react'
import { useNet } from '../store/netStore'
import { MAP_LIST } from '../game/maps'
import { WARLOCK_KIND_LIST } from '../game/constants'
import type { MapId, WarlockKind } from '../game/types'

const SCORE_OPTIONS = [3, 5, 7]
const mapName = (id: MapId) => MAP_LIST.find((m) => m.id === id)?.name ?? id

/** Public lobby browser: live list of joinable rooms plus a create-lobby form. */
export function LobbyBrowser() {
  const lobbies = useNet((s) => s.lobbies)
  const error = useNet((s) => s.error)
  const name = useNet((s) => s.name)
  const joinLobby = useNet((s) => s.joinLobby)
  const createLobby = useNet((s) => s.createLobby)
  const backToMenu = useNet((s) => s.backToMenu)

  const [kind, setKind] = useState<WarlockKind>('arcane')
  const [mapId, setMapId] = useState<MapId>('circle')
  const [targetScore, setTargetScore] = useState(5)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="menu">
      <div className="menu-card lobby-card">
        <h1 className="title">
          LOB<span>BIES</span>
        </h1>
        <p className="tagline">Playing as <b>{name || 'Player'}</b></p>
        {error && <div className="lobby-error">{error}</div>}

        <div className="field">
          <label>Your warlock</label>
          <div className="seg">
            {WARLOCK_KIND_LIST.map((k) => (
              <button key={k.id} className={k.id === kind ? 'on' : ''} onClick={() => setKind(k.id)}>
                {k.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Open lobbies</label>
          <div className="lobby-list">
            {lobbies.length === 0 && <div className="lobby-empty">No open lobbies — create one!</div>}
            {lobbies.map((l) => (
              <div key={l.code} className="lobby-row">
                <div className="lobby-row-main">
                  <span className="lobby-code">{l.code}</span>
                  <span className="lobby-meta">
                    {l.hostName}'s game · {mapName(l.mapId)} · first to {l.targetScore}
                  </span>
                </div>
                <span className="lobby-count">
                  {l.playerCount}/{l.maxPlayers}
                </span>
                <button
                  className="mini"
                  disabled={l.playerCount >= l.maxPlayers}
                  onClick={() => joinLobby(l.code, kind)}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>

        {!showCreate ? (
          <button className="play" onClick={() => setShowCreate(true)}>
            CREATE A LOBBY
          </button>
        ) : (
          <div className="create-box">
            <div className="field">
              <label>Arena</label>
              <div className="seg">
                {MAP_LIST.map((m) => (
                  <button key={m.id} className={m.id === mapId ? 'on' : ''} onClick={() => setMapId(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Rounds to win</label>
              <div className="seg">
                {SCORE_OPTIONS.map((n) => (
                  <button key={n} className={n === targetScore ? 'on' : ''} onClick={() => setTargetScore(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button className="play" onClick={() => createLobby(mapId, targetScore, kind)}>
              CREATE & HOST
            </button>
          </div>
        )}

        <button className="ghost" onClick={backToMenu}>
          BACK TO MENU
        </button>
      </div>
    </div>
  )
}
