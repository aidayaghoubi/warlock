import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { MAP_LIST } from '../game/maps'
import { WARLOCK_KIND_LIST } from '../game/constants'
import type { WarlockKind } from '../game/types'
import arcaneImg from '../assets/heroes/arcane.jpeg'
import snowImg from '../assets/heroes/snow.jpeg'
import natureImg from '../assets/heroes/nature.jpeg'
import assassinImg from '../assets/heroes/assassin.jpeg'

const BOT_OPTIONS = [1, 2, 3, 4]
const SCORE_OPTIONS = [3, 5, 7]

const HERO_IMAGES: Record<WarlockKind, string> = {
  arcane: arcaneImg,
  snow: snowImg,
  nature: natureImg,
  assassin: assassinImg,
}

export function MainMenu() {
  const startGame = useGame((s) => s.startGame)
  const config = useGame((s) => s.config)
  const [bots, setBots] = useState(config.bots)
  const [targetScore, setTargetScore] = useState(config.targetScore)
  const [mapId, setMapId] = useState(config.mapId)
  const [kind, setKind] = useState(config.kind)

  const selectedKind = WARLOCK_KIND_LIST.find((k) => k.id === kind)

  return (
    <div className="menu">
      <div className="menu-layout">
        <div className="hero-panel">
          <img
            className="hero-img"
            src={HERO_IMAGES[kind]}
            alt={`${selectedKind?.name ?? 'Arcane'} warlock`}
          />
          <div className="field">
            <label>Warlock</label>
            <div className="seg seg-col">
              {WARLOCK_KIND_LIST.map((k) => (
                <button
                  key={k.id}
                  className={k.id === kind ? 'on' : ''}
                  onClick={() => setKind(k.id)}
                >
                  {k.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="menu-card">
        <h1 className="title">
          WAR<span>LOCK</span>
        </h1>
        <p className="tagline">Knock your rivals into the lava. Last wizard standing wins.</p>

        <div className="field">
          <label>Opponents (AI bots)</label>
          <div className="seg">
            {BOT_OPTIONS.map((n) => (
              <button
                key={n}
                className={n === bots ? 'on' : ''}
                onClick={() => setBots(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Rounds to win</label>
          <div className="seg">
            {SCORE_OPTIONS.map((n) => (
              <button
                key={n}
                className={n === targetScore ? 'on' : ''}
                onClick={() => setTargetScore(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Arena</label>
          <div className="seg">
            {MAP_LIST.map((m) => (
              <button
                key={m.id}
                className={m.id === mapId ? 'on' : ''}
                onClick={() => setMapId(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <button className="play" onClick={() => startGame({ bots, targetScore, mapId, kind })}>
          ENTER THE ARENA
        </button>

        <div className="howto">
          <div><b>Move</b> — click or hold the mouse on the ground</div>
          <div><b>Q · Bolt</b> — skillshot that knocks foes back</div>
          <div><b>W · Burst</b> — shove everyone near you outward</div>
          <div><b>E · Blink</b> — dash toward the cursor &amp; shed knockback</div>
          <div className="muted">Snow warlock&apos;s Bolt throws ice — hits slow the target by 50%.</div>
          <div className="muted">Nature warlock&apos;s Bolt roots foes (2s) &amp; regenerates HP — but has no Blink.</div>
          <div className="muted">Assassin&apos;s Bolt is black (no knockback); W turns invisible (2s) — pass through a foe to strike hard.</div>
          <div className="muted">The lava creeps inward each round — keep moving.</div>
        </div>
        </div>
      </div>
    </div>
  )
}
