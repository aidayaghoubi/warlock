import { useNet } from '../store/netStore'

/** Post-match overlay for multiplayer: the server has reverted the room to its lobby. */
export function MultiplayerGameOver() {
  const winner = useNet((s) => s.winner)
  const name = useNet((s) => s.name)
  const returnToLobby = useNet((s) => s.returnToLobby)
  const backToMenu = useNet((s) => s.backToMenu)

  const youWon = winner != null && winner === (name || 'Player')

  return (
    <div className="overlay">
      <div className="menu-card">
        <h1 className={`title ${youWon ? 'win' : 'lose'}`}>{youWon ? 'VICTORY' : 'DEFEAT'}</h1>
        <p className="tagline">
          {youWon ? 'You are the champion of the arena.' : `${winner ?? 'Nobody'} won the match.`}
        </p>
        <button className="play" onClick={returnToLobby}>
          BACK TO LOBBY
        </button>
        <button className="ghost" onClick={backToMenu}>
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
