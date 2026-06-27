import { useNet } from '../store/netStore'
import { MAP_LIST } from '../game/maps'
import { WARLOCK_KIND_LIST, playerColorForKind } from '../game/constants'
import { MAX_SEATS } from '../shared/protocol'
import type { MapId } from '../game/types'

const SCORE_OPTIONS = [3, 5, 7]

/** A single lobby room: roster, per-player warlock pick + ready, and host controls. */
export function LobbyRoom() {
  const lobby = useNet((s) => s.lobby)
  const selfId = useNet((s) => s.selfId)
  const setKind = useNet((s) => s.setKind)
  const setReady = useNet((s) => s.setReady)
  const setBots = useNet((s) => s.setBots)
  const setConfig = useNet((s) => s.setConfig)
  const startMatch = useNet((s) => s.startMatch)
  const leaveLobby = useNet((s) => s.leaveLobby)
  const error = useNet((s) => s.error)

  if (!lobby) return null
  const me = lobby.players.find((p) => p.id === selfId)
  const isHost = lobby.hostId === selfId
  const maxBots = Math.max(0, MAX_SEATS - lobby.players.length)
  const everyoneReady = lobby.players.every((p) => p.ready)

  return (
    <div className="menu">
      <div className="menu-card lobby-card">
        <h1 className="title">
          LOB<span>BY {lobby.code}</span>
        </h1>
        <p className="tagline">
          Share code <b>{lobby.code}</b> · {lobby.players.length + lobby.bots}/{MAX_SEATS} fighters
          {isHost ? ' · you are the host' : ''}
        </p>
        {error && <div className="lobby-error">{error}</div>}

        <div className="field">
          <label>Players</label>
          <div className="roster">
            {lobby.players.map((p) => (
              <div key={p.id} className={`roster-row${p.ready ? ' ready' : ''}`}>
                <span className="dot" style={{ background: playerColorForKind(p.kind) }} />
                <span className="roster-name">
                  {p.name}
                  {p.id === selfId ? ' (you)' : ''}
                  {p.id === lobby.hostId ? ' 👑' : ''}
                </span>
                <span className="roster-kind">{p.kind}</span>
                <span className="roster-flag">{p.ready ? 'READY' : '…'}</span>
              </div>
            ))}
            {lobby.bots > 0 && (
              <div className="roster-row bot">
                <span className="dot" style={{ background: '#888' }} />
                <span className="roster-name">{lobby.bots} AI bot{lobby.bots > 1 ? 's' : ''}</span>
                <span className="roster-flag">CPU</span>
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label>Your warlock</label>
          <div className="seg">
            {WARLOCK_KIND_LIST.map((k) => (
              <button
                key={k.id}
                className={me?.kind === k.id ? 'on' : ''}
                onClick={() => setKind(k.id)}
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>

        {isHost && (
          <>
            <div className="field">
              <label>Arena (host)</label>
              <div className="seg">
                {MAP_LIST.map((m) => (
                  <button
                    key={m.id}
                    className={lobby.mapId === m.id ? 'on' : ''}
                    onClick={() => setConfig({ mapId: m.id as MapId })}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Rounds to win (host)</label>
              <div className="seg">
                {SCORE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    className={lobby.targetScore === n ? 'on' : ''}
                    onClick={() => setConfig({ targetScore: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>AI bots (host) — {maxBots} slots free</label>
              <div className="seg">
                {Array.from({ length: maxBots + 1 }, (_, n) => (
                  <button key={n} className={lobby.bots === n ? 'on' : ''} onClick={() => setBots(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className={`play ${me?.ready ? 'ghost' : ''}`} onClick={() => setReady(!me?.ready)}>
          {me?.ready ? 'NOT READY' : 'READY UP'}
        </button>

        {isHost && (
          <button className="play" disabled={!everyoneReady} onClick={startMatch}>
            {everyoneReady ? 'START MATCH' : 'WAITING FOR PLAYERS…'}
          </button>
        )}

        <button className="ghost" onClick={leaveLobby}>
          LEAVE LOBBY
        </button>
      </div>
    </div>
  )
}
