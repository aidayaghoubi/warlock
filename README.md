# Warlock — Arena

A web remake of the classic **Warcraft III "Warlock"** custom map: a top-down arena ringed by
lava where wizards knock each other into the molten edge. Last warlock standing wins the round;
first to the round target wins the match. Single-player vs AI bots.

## Stack

- **Vite + React + TypeScript** — UI shell, menus, HUD
- **Zustand** — meta/UI state (screen, config, HUD snapshot)
- **Plain Canvas 2D + fixed-timestep loop** — the actual simulation (movement, projectiles,
  knockback physics, lava death). Redux/Zustand are deliberately **not** in the per-frame path.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

## Controls

- **Move** — click or hold the mouse on the ground
- **Q — Bolt** — skillshot that damages and knocks foes back
- **W — Burst** — shove everyone near you outward (peel / escape)
- **E — Blink** — dash toward the cursor and shed most knockback
- Goal: **knock enemies into the lava.** The arena shrinks each round.

## Maps

Pick one from the main menu (the **Arena** selector). All three shrink each round:

- **Circle** — the classic shrinking disk.
- **Square** — a shrinking square platform.
- **Rectangle** — a wide arena with a **fixed lava square in the center** to fight around.

## Layout

```
src/
  game/            # framework-agnostic simulation (no React)
    types.ts        # shared data shapes
    constants.ts    # all tunable numbers (speeds, damage, knockback, cooldowns)
    math.ts         # vector helpers
    engine.ts       # game state, fixed-timestep loop, phases, physics, HUD bridge
    maps.ts         # arena geometry: circle / square / rectangle (lava, shrink, spawns, draw)
    spells.ts       # bolt / burst / blink definitions + cast logic
    ai.ts           # bot brain (edge avoidance, range-keeping, aiming)
    input.ts        # mouse/keyboard for the local player
    effects.ts      # particle spawners
    render.ts       # all canvas drawing
  store/
    gameStore.ts    # zustand: screen + config + HUD snapshot
  components/
    GameCanvas.tsx  # mounts the canvas, owns the Engine lifecycle
    MainMenu.tsx    # match setup
    Hud.tsx         # scoreboard, banners, HP, spell bar
    GameOver.tsx    # victory/defeat + replay
  App.tsx           # screen switch
```

## Tuning

Almost everything that affects game feel lives in [`src/game/constants.ts`](src/game/constants.ts):
arena size/shrink rate, walk speed, friction, lava DPS, and each spell's damage / knockback /
cooldown / range. Start there.

## Ideas for next steps

- Between-round **shop** (spend gold on extra spells / stats — gold per kill & round win)
- More spells: homing missile, boomerang, gravity well, teleport-swap
- Sound effects + screen shake on big hits
- Online multiplayer (server-authoritative sim) — biggest lift; keep this single-player core intact
