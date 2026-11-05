# Project Structure

## Current layout

The repository currently holds assets and the spec; source code is added against the design.

```
/
├── index.html              # entry point (to be added) — loads main.js, hosts the canvas
├── README.md               # project overview
├── LICENCE.md              # license
├── .gitignore
├── assets/                 # game media (committed, fixed)
│   ├── ghosty.png          # character sprite
│   ├── jump.wav            # flap sound
│   └── game_over.wav       # game-over sound
├── img/                    # screenshots / docs images
│   └── example-ui.png
├── src/                    # game source (to be added) — see module layout below
├── test/                   # tests (to be added), mirrors src module names
└── .kiro/
    ├── specs/flappy-kiro/  # requirements.md, design.md
    └── steering/           # product.md, tech.md, structure.md, coding-standards.md
```

## Source module layout (`src/`)

Code is organized by the core/shell split from the design. Keep each module small and single-purpose.

### Simulation core (pure)

No DOM, Canvas, storage, audio, `Date.now`, or direct `Math.random`. Functions over plain data; `rng` and `dt` injected; effects returned as data.

| Module | Responsibility |
|--------|----------------|
| `constants.js` | Single source of default tuning values. |
| `physics.js` | Gravity, velocity integration, velocity/impulse clamps. |
| `pipes.js` | Generate, scroll, and cull/recycle pipe pairs. |
| `collision.js` | AABB overlap tests (Ghosty vs pipes/ground/ceiling). |
| `scoring.js` | Detect gap pass, increment once per pipe. |
| `stateMachine.js` | Ready ↔ Playing ↔ GameOver transitions. |
| `clouds.js` | Generate/scroll/recycle parallax cloud shapes. |
| `difficulty.js` | Difficulty presets resolved to full configs. |
| `theme.js` | Color_Palette + Environment palettes and validation (presentation data). |
| `engine.js` | Orchestrates the above into `step()`, produces effects. |

### I/O shell (impure, browser-only)

All I/O and error handling live here.

| Module | Responsibility |
|--------|----------------|
| `main.js` | Bootstrap: asset loading, wiring, fallback sprite. |
| `loop.js` | `requestAnimationFrame` driver; `dt` clamp; visibility pause. |
| `input.js` | Keyboard/pointer events → intents. |
| `renderer.js` | Canvas 2D drawing of the world (never mutates state). |
| `audio.js` | Plays `jump.wav` / `game_over.wav`. |
| `storage.js` | Reads/validates/writes high score in `localStorage`. |
| `config.js` | Dev tooling: resolve + validate/clamp effective CONFIG. |
| `tuningPanel.js` | Dev tooling: hidden DOM overlay for live tuning. |

## Organizing conventions

- **Core and shell stay separate.** A file under the core must not import a shell module or touch browser APIs. Dependencies point from shell → core, never the reverse.
- **One concern per module.** Follow the responsibility table; don't fold rendering into the engine or physics into the loop.
- **Tests mirror source.** A test for `src/physics.js` lives at `test/physics.test.js`.
- **Assets are referenced, not duplicated.** Load media from `assets/` by path; don't copy binaries into `src/`.
- **Defaults live in `constants.js`.** No magic numbers elsewhere; scale lengths as factors resolved against the play-area `Dims` at runtime.
- **Dev-only tooling** (`config.js`, `tuningPanel.js`) must never change default-config behavior and stays in the shell.
