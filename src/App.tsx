import { useGame } from './store/gameStore'
import { useNet } from './store/netStore'
import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { MainMenu } from './components/MainMenu'
import { GameOver } from './components/GameOver'
import { LobbyBrowser } from './components/LobbyBrowser'
import { LobbyRoom } from './components/LobbyRoom'
import { MultiplayerCanvas } from './components/MultiplayerCanvas'
import { MultiplayerGameOver } from './components/MultiplayerGameOver'

export default function App() {
  const screen = useGame((s) => s.screen)
  const netView = useNet((s) => s.view)

  // Multiplayer takes over the whole screen whenever we're in a net flow.
  if (netView !== 'idle') {
    return (
      <div className="app">
        {netView === 'lobbyList' && <LobbyBrowser />}
        {netView === 'lobby' && <LobbyRoom />}
        {(netView === 'playing' || netView === 'gameover') && (
          <>
            <MultiplayerCanvas />
            <Hud />
            {netView === 'gameover' && <MultiplayerGameOver />}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      {screen === 'menu' ? (
        <MainMenu />
      ) : (
        <>
          <GameCanvas />
          <Hud />
          {screen === 'gameover' && <GameOver />}
        </>
      )}
    </div>
  )
}
