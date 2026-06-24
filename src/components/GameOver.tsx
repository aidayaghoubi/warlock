import { useGame } from '../store/gameStore'

export function GameOver() {
  const winner = useGame((s) => s.winner)
  const config = useGame((s) => s.config)
  const startGame = useGame((s) => s.startGame)
  const toMenu = useGame((s) => s.toMenu)

  const youWon = winner === 'You'

  return (
    <div className="overlay">
      <div className="menu-card">
        <h1 className={`title ${youWon ? 'win' : 'lose'}`}>
          {youWon ? 'VICTORY' : 'DEFEAT'}
        </h1>
        <p className="tagline">
          {youWon ? 'You are the last warlock standing.' : `${winner ?? 'Nobody'} won the match.`}
        </p>
        <button className="play" onClick={() => startGame(config)}>
          PLAY AGAIN
        </button>
        <button className="ghost" onClick={toMenu}>
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
