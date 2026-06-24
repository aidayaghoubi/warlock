import { useEffect, useRef } from 'react'
import { Engine } from '../game/engine'
import { useGame } from '../store/gameStore'

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const gameId = useGame((s) => s.gameId)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const { config, setHud, endMatch } = useGame.getState()
    const engine = new Engine(config, { onHud: setHud, onMatchOver: endMatch })
    engine.mount(canvas)
    return () => engine.unmount()
  }, [gameId])

  return <canvas ref={ref} className="game-canvas" />
}
