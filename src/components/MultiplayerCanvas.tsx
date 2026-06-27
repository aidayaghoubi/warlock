import { useEffect, useRef } from 'react'
import { NetGame } from '../net/netGame'
import { useNet } from '../store/netStore'

/** Renders the live server-authoritative match (snapshots interpolated by NetGame). */
export function MultiplayerCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const match = useNet((s) => s.match)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !match) return
    const game = new NetGame(match.localWarlockId, match.mapId)
    game.mount(canvas)
    return () => game.unmount()
  }, [match?.localWarlockId, match?.mapId])

  return <canvas ref={ref} className="game-canvas" />
}
