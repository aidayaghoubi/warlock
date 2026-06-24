import { useGame } from '../store/gameStore'

export function Hud() {
  const hud = useGame((s) => s.hud)
  if (!hud) return null

  const countdown = hud.phase === 'countdown' ? Math.ceil(hud.phaseTimer) : 0

  return (
    <div className="hud">
      {/* Scoreboard */}
      <div className="scoreboard">
        {hud.scores.map((sc) => (
          <div key={sc.name} className={`score-chip${sc.alive ? '' : ' dead'}`}>
            <span className="dot" style={{ background: sc.color }} />
            <span className="name">{sc.isPlayer ? 'You' : sc.name}</span>
            <span className="val">{sc.score}</span>
          </div>
        ))}
      </div>

      {/* Center banner */}
      {hud.phase === 'countdown' && (
        <div className="banner">
          <div className="banner-sub">{hud.banner}</div>
          <div className="banner-big">{countdown > 0 ? countdown : 'FIGHT!'}</div>
        </div>
      )}
      {hud.phase === 'roundover' && (
        <div className="banner">
          <div className="banner-big small">{hud.banner}</div>
        </div>
      )}

      {hud.inLava && <div className="lava-warn">IN THE LAVA — GET OUT!</div>}
      {!hud.alive && hud.phase === 'fighting' && (
        <div className="lava-warn dead-note">You were eliminated — spectating…</div>
      )}

      {/* Bottom bar: HP + spells */}
      <div className="bottombar">
        <div className="hpwrap">
          <div className="hp-label">HP</div>
          <div className="hp-track">
            <div
              className="hp-fill"
              style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
            />
            <span className="hp-text">
              {hud.hp}/{hud.maxHp}
            </span>
          </div>
        </div>

        <div className="spellbar">
          {hud.spells.map((sp) => (
            <div key={sp.id} className={`spell${sp.ready ? ' ready' : ''}`}>
              <div className="spell-key">{sp.key}</div>
              <div className="spell-name">{sp.name}</div>
              {!sp.ready && (
                <div className="spell-cd" style={{ height: `${sp.cooldownPct * 100}%` }} />
              )}
            </div>
          ))}
        </div>

        <div className="controls-hint">
          Click/hold to move · Q/W/E to cast · knock foes into the lava
        </div>
      </div>
    </div>
  )
}
