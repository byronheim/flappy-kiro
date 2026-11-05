# Coding Standards

JavaScript conventions for Flappy Kiro. These rules reflect the architecture in the spec: a **pure simulation core** and an **impure I/O shell**, shipped as dependency-free, no-build ES modules.

## Language and modules

- Use vanilla ES modules (`import`/`export`). No bundler, transpiler, or runtime dependency — the game must run by opening `index.html` directly.
- Prefer `const`; use `let` only when reassignment is required. Never use `var`.
- Use strict equality (`===`/`!==`). Avoid implicit coercion.
- Keep modules small and single-purpose, matching the module responsibilities in the design (e.g. `physics.js`, `pipes.js`, `collision.js`, `renderer.js`).
- Document public functions with JSDoc type signatures, matching the interfaces in the design doc.

## Core vs shell separation (the central rule)

- **Core modules are pure.** They are plain functions over plain data. They MUST NOT touch the DOM, `Canvas`, `localStorage`, audio, `Date.now`, or call `Math.random` directly.
- **Randomness is injected.** The core receives an `rng: () => number` argument; it never reads `Math.random` itself. This keeps runs reproducible and shrinkable in property tests.
- **Timing is injected.** The core receives an already-clamped `dt` (seconds); only the shell (`loop.js`) reads `requestAnimationFrame` timestamps.
- **Side effects are returned as data.** `step()` returns `{ state, effects }` where effects are plain descriptors like `{ type: 'playSound', name: 'jump' }`. The shell performs the actual audio/storage I/O. Never call audio or storage from the core.
- **Config flows in as data.** The core consumes a frozen effective CONFIG passed by the loop. It never reads URL params, `window` globals, or the DOM.
- All I/O and all error handling live in the shell (the layer that can fail). The core has no error paths.

## Game loop patterns

- Drive the loop with `requestAnimationFrame`; target 60 FPS, sustain at least 30 FPS.
- Compute `dt` from successive timestamps and clamp it to `[0.016, 0.100]` seconds before stepping. Integrate motion by `dt` so physics is frame-rate independent — never assume a fixed frame time.
- On `visibilitychange` to hidden, stop advancing the simulation; on return, reset `lastTimestamp` to now so the hidden interval is discarded rather than applied as one huge `dt`.
- Per frame: drain input intents → read effective CONFIG → `step()` → forward effects to shell → render.

## State immutability

- Treat the `World` state as immutable by convention. The engine returns new state objects rather than mutating in place, which keeps `step()` referentially transparent.
- Expose constants and the resolved CONFIG as frozen objects (`Object.freeze`).
- Collapse multiple same-frame inputs into a single intent (e.g. at most one flap per frame).

## Naming conventions

- **Modules / files:** lowerCamelCase matching their export (`stateMachine.js`, `tuningPanel.js`).
- **Functions and variables:** `camelCase` (`applyGravity`, `highScore`, `nextPipeId`).
- **Classes and type names (JSDoc typedefs):** `PascalCase` (`World`, `Ghosty`, `PipePair`, `Cloud`, `Intents`, `Effect`). Prefer plain-data typedefs and pure functions over stateful classes in the core; reserve classes for shell wrappers (e.g. an audio engine) where they genuinely hold resources.
- **Constants:** `UPPER_SNAKE_CASE` in `constants.js` (`GRAVITY`, `MAX_FALL_SPEED`, `PIPE_SPEED_FACTOR`, `HIGH_SCORE_KEY`).
- **State enum values:** lowercase strings via a frozen `States` object (`'ready'`, `'playing'`, `'gameOver'`).
- **Effect types:** `camelCase` string tags (`'playSound'`, `'persistHighScore'`).
- **Boolean flags:** read as predicates (`scored`, `spriteLoaded`).

## Configuration

- `constants.js` is the single source of default values. All numeric tuning lives there; no magic numbers scattered through logic.
- Lengths that scale with the play area are expressed as factors and resolved against `Dims` at runtime.
- Values that requirements fix exactly are **locked** — overrides force them back to the required value. Range-valued fields are **clamped** to their bounds. Never apply a raw override; always validate/clamp, and ignore unknown keys.

## Performance

- Run the per-frame hot path (`step()` + `render()`) allocation-light. Avoid creating throwaway objects/arrays and avoid closures inside tight per-pipe/per-cloud loops.
- Recycle pipes and clouds instead of growing unbounded arrays: cull entries past the left edge and reposition clouds to the right rather than allocating new ones every frame.
- Only draw elements at least partially within the horizontal bounds of the play area.
- Set `ctx.imageSmoothingEnabled = false` once and draw at integer-aligned coordinates for crisp pixel edges; avoid redundant canvas state changes.
- Keep rendering a pure draw of the world — `renderer.js` never mutates state. UI widgets (e.g. the tuning panel) are DOM overlays, not canvas draws.
- For rapidly re-triggered sounds (`jump.wav`), reset `currentTime = 0` before `play()` (or use a small clone pool) so overlapping flaps each produce audible sound.
- Guard all `localStorage` and audio access in `try/catch`; swallow failures and keep the in-memory value so gameplay is never interrupted.

## Testing

- Node's built-in `node:test` + `node:assert` for tests. `fast-check` is the only dev-dependency, for property-based tests of the core; it is never shipped to the browser.
- Keep the core directly testable in Node (pure ES modules, no DOM). Tag each property test: `// Feature: flappy-kiro, Property {number}: {property_text}`.
- Tests are mandatory, not optional: every behavior change ships with passing tests in the same unit of work. Favor correctness and coverage over speed of development. See `testing.md` for the full testing standards.
