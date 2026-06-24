import { useGame } from './store/gameStore'
import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { MainMenu } from './components/MainMenu'
import { GameOver } from './components/GameOver'

export default function App() {
  const screen = useGame((s) => s.screen)

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
