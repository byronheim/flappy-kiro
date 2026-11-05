# Implementation Plan: Flappy Kiro

## Overview

This plan implements the initial version of Flappy Kiro (Requirements 1–10) plus the developer-facing configuration/tuning system (`config.js` three-layer resolution and `tuningPanel.js`) described in the design. Requirements 11–13 are out of scope and have no tasks here.

The implementation follows the design's central architectural decision: a strict separation between a **pure simulation core** (`constants.js`, `physics.js`, `pipes.js`, `collision.js`, `scoring.js`, `stateMachine.js`, `engine.js`) and an **impure I/O shell** (`loop.js`, `input.js`, `renderer.js`, `audio.js`, `storage.js`, `config.js`, `tuningPanel.js`, `main.js`). The core receives the effective CONFIG and intents as data and returns new state plus effects (`playSound`, `persistHighScore`).

Tasks build incrementally: scaffolding and defaults first, then each pure core module with its property-based tests placed right next to it, then the shell modules with their example/rendering tests, then wiring, then a final end-to-end integration task. Property-based tests use `fast-check` (dev-only), each configured for a minimum of 100 iterations and tagged `// Feature: flappy-kiro, Property {number}: {property_text}` per the design's Testing Strategy. Tooling is Node's `node:test` + `node:assert`; the game itself ships no runtime dependencies and runs by opening `index.html`.

## Tasks

- [x] 1. Set up project structure, dev test tooling, and default constants
  - [x] 1.1 Create the source/test directory layout and dev tooling
    - Create `src/core/` and `src/shell/` directories for ES modules and a `test/` directory for Node tests
    - Add a minimal `package.json` with `"type": "module"`, a `"test": "node --test"` script, and `fast-check` as the only `devDependency` (no runtime dependencies)
    - Document in the plan/README that the game runs by opening `index.html` with no build step; tests run via `node --test`
    - _Requirements: Overview (dependency-free, no-build), Design "Overview", Design "Testing Strategy > Tooling"_

  - [x] 1.2 Implement `src/core/constants.js` as the frozen DEFAULTS layer
    - Export a frozen `CONFIG` object with all numeric defaults from the design's "Tunable constants (the DEFAULTS layer)" table (scene, physics, pipes, loop/timing, game over, ready state, persistence keys)
    - Use requirement-allowed values: `GRAVITY: 1600`, `MAX_FALL_SPEED: 1200`, `FLAP_IMPULSE: 480`, `FLAP_IMPULSE_MIN: 300`, `FLAP_IMPULSE_MAX: 700`, `PIPE_SPEED_FACTOR: 0.35`, `PIPE_SPACING_FACTOR: 0.5`, `PIPE_GAP_MARGIN_FACTOR: 0.1`, `PIPE_GAP_GHOSTY_MULTIPLE: 2.5`, `GROUND_HEIGHT_FACTOR: 0.12`, `GHOSTY_HEIGHT_FACTOR: 0.10`, `CLOUD_OPACITY_MIN/MAX: 0.2/0.8`, `CLOUD_MIN_SPEED: 10`, `CLOUD_LAYER_FACTORS: [0.2, 0.4]`, `DT_MIN: 0.016`, `DT_MAX: 0.100`, `RESTART_LOCKOUT_MS: 500`, `GHOSTY_START_Y_FACTOR: 0.4`, `HIGH_SCORE_KEY: 'flappyKiro.highScore'`
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.9, 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 8.4, 9.6, 10.1, 10.3; Design "Tunable constants (the DEFAULTS layer)"_

  - [x] 1.3 Write example tests for default constants
    - Assert `CONFIG.GRAVITY` is within [800, 2400] (Req 4.1) and `FLAP_IMPULSE` within [300, 700] (Req 4.4)
    - Assert resolved ground height within [5%, 20%] and Ghosty height within [5%, 15%] of play height for a sample `Dims` (Req 1.2, 1.3)
    - Assert the exported `CONFIG` is frozen
    - _Requirements: 1.2, 1.3, 4.1, 4.4; Design "Testing Strategy > Example and edge-case tests"_

- [x] 2. Implement physics core (gravity, integration, flap impulse, clamps)
  - [x] 2.1 Implement `src/core/physics.js`
    - Implement `applyGravity(ghosty, dt, config)`: increase `vy` by `GRAVITY*dt`, then clamp downward velocity to `MAX_FALL_SPEED` (Req 4.1, 4.3)
    - Implement `integrate(ghosty, dt)`: advance `y` from `vy` over `dt` (Req 4.2)
    - Implement `clampImpulse(value, config)`: clamp a requested impulse into `[FLAP_IMPULSE_MIN, FLAP_IMPULSE_MAX]` (Req 4.4)
    - Implement `applyFlap(ghosty, config)`: set `vy` to the clamped upward impulse (Req 4.4)
    - All functions return new objects; never mutate inputs
    - _Requirements: 4.1, 4.2, 4.3, 4.4; Design "Components and Interfaces > physics.js"_

  - [x] 2.2 Write property test for flap impulse clamping
    - **Property 8: Flap impulse is clamped into range** — for all requested impulse values, the clamped impulse lies within [300, 700] and equals the nearest boundary when out of range; applying a flap sets `vy` to exactly the clamped upward impulse
    - Tag: `// Feature: flappy-kiro, Property 8: Flap impulse is clamped into range`
    - **Validates: Requirements 4.4**; min 100 iterations
    - _Requirements: 4.4; Design "Correctness Properties > Property 8"_

  - [x] 2.3 Write property test for gravity integration and frame-rate independence
    - **Property 9: Gravity integration is correct and frame-rate independent** — a no-flap Playing step increases velocity by `gravity*dt` (before capping) and advances position by the integrated velocity; splitting a fixed total elapsed time into two different frame cadences (each frame within [16 ms, 100 ms]) yields approximately the same resulting position and velocity
    - Tag: `// Feature: flappy-kiro, Property 9: Gravity integration is correct and frame-rate independent`
    - **Validates: Requirements 4.2, 10.3**; min 100 iterations
    - _Requirements: 4.2, 10.3; Design "Correctness Properties > Property 9"_

  - [x] 2.4 Write property test for terminal velocity cap
    - **Property 10: Downward velocity never exceeds terminal velocity** — for all starting velocities and any sequence of gravity steps, downward velocity never exceeds 1200 px/s
    - Tag: `// Feature: flappy-kiro, Property 10: Downward velocity never exceeds terminal velocity`
    - **Validates: Requirements 4.3**; min 100 iterations
    - _Requirements: 4.3; Design "Correctness Properties > Property 10"_

- [x] 3. Implement pipe generation, scrolling, and recycling core
  - [x] 3.1 Implement `src/core/pipes.js`
    - Implement `generatePipe(dims, rng, leftEdgeX, config)`: choose gap center via injected `rng` within legal bounds; gap top ≥ `0.1*height` from top, gap bottom ≥ `0.1*height` above ground, gap height = `2.5*ghosty.h` (Req 5.3, 5.4)
    - Implement `updatePipes(pipes, dims, dt, rng, config)`: scroll each pipe left by `0.35*width*dt`; append a new pair when horizontal spacing reaches `0.5*width` since the previous generated pair (Req 5.1, 5.2)
    - Implement `cullPipes(pipes, dims)`: remove pairs whose right edge has scrolled past the left edge (Req 5.5)
    - Pure functions; no direct `Math.random`, randomness only through injected `rng`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5; Design "Components and Interfaces > pipes.js"_

  - [x] 3.2 Write property test for pipe scroll speed
    - **Property 11: Pipes scroll at a constant speed** — a Playing step decreases each pipe's left-edge x by exactly `0.35*(play-area width)*dt`
    - Tag: `// Feature: flappy-kiro, Property 11: Pipes scroll at a constant speed`
    - **Validates: Requirements 5.1**; min 100 iterations
    - _Requirements: 5.1; Design "Correctness Properties > Property 11"_

  - [x] 3.3 Write property test for fixed pipe spacing
    - **Property 12: Generated pipes keep fixed spacing** — the horizontal distance between the left edges of each generated pair and the previously generated pair equals `0.5*(play-area width)`
    - Tag: `// Feature: flappy-kiro, Property 12: Generated pipes keep fixed spacing`
    - **Validates: Requirements 5.2**; min 100 iterations
    - _Requirements: 5.2; Design "Correctness Properties > Property 12"_

  - [x] 3.4 Write property test for gap margins and fixed gap height
    - **Property 13: Pipe gaps respect margins and fixed height** — over any rng, gap top ≥ `0.1*height` from the top, gap bottom ≥ `0.1*height` above the ground, gap height = `2.5*(Ghosty sprite height)`
    - Tag: `// Feature: flappy-kiro, Property 13: Pipe gaps respect margins and fixed height`
    - **Validates: Requirements 5.3, 5.4**; min 100 iterations
    - _Requirements: 5.3, 5.4; Design "Correctness Properties > Property 13"_

  - [x] 3.5 Write property test for off-screen pipe culling
    - **Property 14: Off-screen pipes are culled** — culling removes exactly those pairs whose right edge has scrolled past the left edge and retains all others
    - Tag: `// Feature: flappy-kiro, Property 14: Off-screen pipes are culled`
    - **Validates: Requirements 5.5**; min 100 iterations
    - _Requirements: 5.5; Design "Correctness Properties > Property 14"_

- [x] 4. Implement cloud motion and recycling core
  - [x] 4.1 Implement cloud generation and update logic in `src/core/pipes.js` (or a sibling core helper)
    - Generate clouds with opacity within `[0.2, 0.8]` and a `layer`/`speedFactor` per `CLOUD_LAYER_FACTORS` (Req 1.7, 1.9)
    - Compute per-layer speed as `max(CLOUD_MIN_SPEED, layerFactor*pipeSpeed)` so clouds always move (> 0) yet stay slower than pipes, farther layers slower than nearer (Req 1.8, 1.9)
    - Update cloud x by its layer speed over `dt`; when a cloud scrolls fully past the left edge, reposition it to the right with new y/opacity, preserving cloud count (Req 1.10)
    - Pure functions operating on `World.clouds`; randomness via injected `rng`
    - _Requirements: 1.7, 1.8, 1.9, 1.10; Design "Rendering Approach" (cloud motion computed in core), "Tunable constants"_

  - [x] 4.2 Write property test for cloud opacity
    - **Property 1: Cloud opacity stays semi-transparent** — each generated cloud's opacity lies within [0.2, 0.8]
    - Tag: `// Feature: flappy-kiro, Property 1: Cloud opacity stays semi-transparent`
    - **Validates: Requirements 1.7**; min 100 iterations
    - _Requirements: 1.7; Design "Correctness Properties > Property 1"_

  - [x] 4.3 Write property test for parallax cloud speeds
    - **Property 2: Parallax cloud speeds are positive, bounded, and depth-ordered** — every layer's speed is > 0 and ≥ min cloud speed, strictly < pipe speed, and a nearer layer's speed is strictly greater than any farther layer's
    - Tag: `// Feature: flappy-kiro, Property 2: Parallax cloud speeds are positive, bounded, and depth-ordered`
    - **Validates: Requirements 1.8, 1.9**; min 100 iterations
    - _Requirements: 1.8, 1.9; Design "Correctness Properties > Property 2"_

  - [x] 4.4 Write property test for cloud repositioning
    - **Property 3: Clouds never remain fully off the left edge** — after a Playing-state update, every cloud intersects or is to the right of the play area and the cloud count is preserved
    - Tag: `// Feature: flappy-kiro, Property 3: Clouds never remain fully off the left edge`
    - **Validates: Requirements 1.10**; min 100 iterations
    - _Requirements: 1.10; Design "Correctness Properties > Property 3"_

- [x] 5. Implement collision detection core
  - [x] 5.1 Implement `src/core/collision.js`
    - Implement `aabbOverlap(a, b)`: true if two axis-aligned boxes overlap or touch
    - Implement `hasCollision(ghosty, pipes, dims)`: a single boolean OR over Ghosty-vs-pipe, Ghosty-vs-ground, and Ghosty-vs-ceiling so simultaneous conditions count once (Req 6.1, 6.2, 6.3, 6.4)
    - Pure functions; never mutate inputs
    - _Requirements: 6.1, 6.2, 6.3, 6.4; Design "Components and Interfaces > collision.js"_

- [x] 6. Implement scoring core
  - [x] 6.1 Implement `src/core/scoring.js`
    - Implement `updateScore(score, ghosty, pipes)`: increment by 1 for each pipe whose trailing (left) edge Ghosty first crosses, set that pair's `scored` flag, never score a pair twice (Req 7.2)
    - Return a new `{ score, pipes }`; mutate nothing
    - _Requirements: 7.2; Design "Components and Interfaces > scoring.js"_

  - [x] 6.2 Write property test for score-exactly-once
    - **Property 17: Passing a pipe scores exactly once** — over any partition of elapsed time, passing N gaps yields a score of N and no pair increments more than once across additional frames
    - Tag: `// Feature: flappy-kiro, Property 17: Passing a pipe scores exactly once`
    - **Validates: Requirements 7.2**; min 100 iterations
    - _Requirements: 7.2; Design "Correctness Properties > Property 17"_

- [x] 7. Implement the state machine core
  - [x] 7.1 Implement `src/core/stateMachine.js`
    - Export `States = { READY, PLAYING, GAME_OVER }`
    - Implement `advanceState(state, intents, dt, config)` handling: Ready→Playing on flap (set `vy=0`, `score=0`, clear prompt) (Req 2.4, 2.5, 4.5, 7.1); Playing→GameOver on collision with a single transition even for simultaneous conditions (Req 6.4); GameOver timer accumulation; restart lockout and Ready reset after 500 ms (Req 9.6–9.9); non-flap input keeps Ready (Req 2.6)
    - In Ready/GameOver, do not apply gravity or impulses and hold positions (Req 2.2, 9.2, 9.3, 9.10)
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 4.5, 6.4, 7.1, 9.2, 9.3, 9.6, 9.7, 9.8, 9.9, 9.10; Design "Game Loop and State Machine Design"_

  - [x] 7.2 Write property test for Ready-stays-Ready
    - **Property 5: Ready stays Ready without a flap** — for all Ready worlds and intents with no flap, stepping keeps status Ready
    - Tag: `// Feature: flappy-kiro, Property 5: Ready stays Ready without a flap`
    - **Validates: Requirements 2.6**; min 100 iterations
    - _Requirements: 2.6; Design "Correctness Properties > Property 5"_

  - [x] 7.3 Write property test for restart-after-lockout reset
    - **Property 20: Restart after the lockout resets the session** — a flap before 500 ms keeps GameOver; a flap at/after 500 ms transitions to Ready, removes all pipes, and resets Ghosty to start; no upward impulse in either case
    - Tag: `// Feature: flappy-kiro, Property 20: Restart after the lockout resets the session`
    - **Validates: Requirements 9.6, 9.7, 9.8, 9.9, 9.10**; min 100 iterations
    - _Requirements: 9.6, 9.7, 9.8, 9.9, 9.10; Design "Correctness Properties > Property 20"_

- [x] 8. Implement the engine `step()` orchestration and world factory
  - [x] 8.1 Implement `src/core/engine.js`
    - Implement `createWorld(dims, highScore, config)`: a fresh Ready-state `World` sized to the play area with Ghosty at `GHOSTY_START_Y_FACTOR`, empty pipes, seeded clouds
    - Implement `step(state, dt, intents, rng, config)`: run the state machine, then (in Playing) physics → pipe/cloud updates → collision → scoring; return `{ state, effects }` where effects are `playSound: 'jump'` (on an applied flap), `playSound: 'gameOver'` and `persistHighScore` (on Playing→GameOver with high-score update)
    - Emit exactly one `jump` per applied flap; emit `gameOver` and the high-score effects exactly once on the single transition (Req 3.5, 6.4, 8.1, 8.2, 9.1)
    - The core reads only the `config` data it is handed; never touches DOM/`window`/`Math.random`/`localStorage`
    - _Requirements: 3.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 8.1, 8.2, 9.1, 9.4; Design "Architecture > Data flow per frame", "Components and Interfaces > engine.js"_

  - [x] 8.2 Write property test for freeze in non-Playing states
    - **Property 4: Non-Playing states freeze the simulation** — in Ready/GameOver, stepping leaves Ghosty position/velocity, every pipe x, and the frozen final score unchanged and applies no flap impulse
    - Tag: `// Feature: flappy-kiro, Property 4: Non-Playing states freeze the simulation`
    - **Validates: Requirements 2.2, 9.2, 9.3, 9.4, 9.10**; min 100 iterations
    - _Requirements: 2.2, 9.2, 9.3, 9.4, 9.10; Design "Correctness Properties > Property 4"_

  - [x] 8.3 Write property test for one-flap-one-jump-sound
    - **Property 7: One flap yields exactly one jump sound** — a Playing step with a flap intent emits exactly one `playSound: 'jump'` effect; without a flap intent, none
    - Tag: `// Feature: flappy-kiro, Property 7: One flap yields exactly one jump sound`
    - **Validates: Requirements 3.5**; min 100 iterations
    - _Requirements: 3.5; Design "Correctness Properties > Property 7"_

  - [x] 8.4 Write property test for collision → single game over
    - **Property 15: Any collision condition triggers exactly one game over** — when Ghosty overlaps a pipe, touches the ground, crosses the top edge, or satisfies several at once, stepping transitions to GameOver exactly once and emits exactly one `playSound: 'gameOver'`
    - Tag: `// Feature: flappy-kiro, Property 15: Any collision condition triggers exactly one game over`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 9.1**; min 100 iterations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1; Design "Correctness Properties > Property 15"_

  - [x] 8.5 Write property test for GameOver halting collision evaluation
    - **Property 16: GameOver stops evaluating collisions** — in GameOver, stepping does not change status and emits no additional `playSound: 'gameOver'`
    - Tag: `// Feature: flappy-kiro, Property 16: GameOver stops evaluating collisions`
    - **Validates: Requirements 6.5**; min 100 iterations
    - _Requirements: 6.5; Design "Correctness Properties > Property 16"_

  - [x] 8.6 Write property test for high score becoming the session maximum
    - **Property 18: High score becomes the session maximum** — entering GameOver sets high score to `max(finalScore, priorHigh)` and emits a `persistHighScore` effect with that value iff the final score exceeds the prior high score
    - Tag: `// Feature: flappy-kiro, Property 18: High score becomes the session maximum`
    - **Validates: Requirements 8.1, 8.2**; min 100 iterations
    - _Requirements: 8.1, 8.2; Design "Correctness Properties > Property 18"_

  - [x] 8.7 Write example tests for the Ready → Playing transition
    - Flap in Ready sets `vy = 0`, resets `score` to 0, and the world no longer shows the start prompt (status Playing)
    - _Requirements: 2.4, 2.5, 4.5, 7.1; Design "Testing Strategy > Example and edge-case tests"_

- [x] 9. Checkpoint - Ensure all core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement persistence shell (`storage.js`)
  - [x] 10.1 Implement `src/shell/storage.js`
    - Implement `loadHighScore(config)`: read `CONFIG.HIGH_SCORE_KEY`; return the parsed value only when it is a non-negative integer, else 0 (missing, non-numeric, negative, or non-integer) (Req 8.4, 8.5, 8.6)
    - Implement `saveHighScore(value, config)`: write to localStorage wrapped in try/catch; on failure return silently so the in-memory value is kept and gameplay continues (Req 8.2, 8.3)
    - Only this module touches `localStorage`
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6; Design "Persistence (Local Storage)"_

  - [x] 10.2 Write property test for high-score load validation
    - **Property 19: High-score load validates its input** — for all stored strings, loading returns the parsed value when it is a non-negative integer, else 0
    - Tag: `// Feature: flappy-kiro, Property 19: High-score load validates its input`
    - **Validates: Requirements 8.5, 8.6**; min 100 iterations
    - _Requirements: 8.5, 8.6; Design "Correctness Properties > Property 19"_

  - [x] 10.3 Write example/edge tests for storage with a stubbed localStorage
    - A valid stored value loads (Req 8.4); missing key → 0 (Req 8.5, edge); `setItem` throwing is swallowed and the in-memory value retained (Req 8.3, edge)
    - _Requirements: 8.3, 8.4, 8.5; Design "Testing Strategy > Example and edge-case tests"_

- [x] 11. Implement input shell (`input.js`)
  - [x] 11.1 Implement `src/shell/input.js`
    - Implement `createInput(canvas)` returning `{ drain() }` that yields an `Intents` buffer and clears it
    - Spacebar `keydown` enqueues a flap only when `event.repeat === false`; a pressed flag + `keyup` guard yields exactly one flap until released and pressed again (Req 3.1, 3.2)
    - `pointerdown`/`click`/`touchstart` enqueues a flap only when the mapped canvas coordinate lies within the Play_Area bounds; outside points are ignored (Req 3.3, 3.4)
    - Collapse multiple same-frame flaps into a single `flap: true`
    - _Requirements: 3.1, 3.2, 3.3, 3.4; Design "Input Handling"_

  - [x] 11.2 Write property test for pointer bounds eligibility
    - **Property 6: Pointer bounds decide flap eligibility** — the input layer produces a flap intent iff the pointer position lies within the play-area rectangle
    - Tag: `// Feature: flappy-kiro, Property 6: Pointer bounds decide flap eligibility`
    - **Validates: Requirements 3.3, 3.4**; min 100 iterations
    - _Requirements: 3.3, 3.4; Design "Correctness Properties > Property 6"_

  - [x] 11.3 Write example/edge tests for keyboard input with synthetic events
    - One keydown → one flap (Req 3.1); `event.repeat === true` → no additional flap until keyup+keydown (Req 3.2, edge); one pointerdown inside bounds → one flap (Req 3.3)
    - _Requirements: 3.1, 3.2, 3.3; Design "Testing Strategy > Example and edge-case tests"_

- [x] 12. Implement audio shell (`audio.js`)
  - [x] 12.1 Implement `src/shell/audio.js`
    - Implement `createAudio(assets)` returning `{ play(name) }` wrapping `HTMLAudioElement`s for `jump.wav` and `game_over.wav`
    - Play with `loop = false`; reset `currentTime` to 0 (or use a small clone pool) so rapid flaps each produce sound; swallow autoplay/promise rejections so gameplay is unaffected
    - Driven only by effects forwarded from the loop; never called by the core
    - _Requirements: 3.5, 9.1; Design "Audio"_

- [x] 13. Implement configuration resolution shell (`config.js`)
  - [x] 13.1 Implement `src/shell/config.js`
    - Implement `clampConfig(base, rawPartial)`: pure merge of known keys only; force locked fields to their exact required values (pipe speed 0.35, spacing 0.5, gap margin 0.1, gap multiple 2.5, max fall 1200, dt clamp, cloud opacity, restart lockout 500); clamp tunable fields to range (gravity [800,2400], flap impulse [300,700], ground height [0.05,0.20], Ghosty height [0.05,0.15], cloud min speed >0, cloud layer factors positive/ascending/<1); ignore unknown keys and malformed/NaN values; return a frozen CONFIG of the same shape
    - Implement `resolveConfig(sources)`: merge `defaults ← window.FLAPPY_CONFIG ← URL query params` (URL wins over global), applying the clamp discipline; friendly URL aliases map to CONFIG keys
    - Implement `withLiveOverrides(liveOverrides)`: re-resolve as `defaults ← global ← URL ← liveOverrides` with the same clamping
    - The pure core never reads URL params/`window`/DOM; config is passed to it as data
    - _Requirements: Design "Configuration and Tuning" (dev tooling; preserves 1.2, 1.3, 1.7, 4.1, 4.3, 4.4, 5.1–5.4, 9.6, 10.3)_

  - [x] 13.2 Write example tests: default run equals pre-tuning behavior and frozen shape
    - With no global object, no URL params, and no live overrides, the effective CONFIG is value-equal to `constants.js` (key guard that the feature does not change Req 1–10 behavior)
    - The returned CONFIG is frozen and has the same keys as `constants.js`
    - _Requirements: Design "Testing Strategy > Configuration resolution and clamping"_

  - [x] 13.3 Write example tests: merge precedence
    - `GRAVITY` set at defaults/global/URL/live resolves to the last layer; a URL param overrides the same key in the global object; a live override overrides both
    - _Requirements: Design "Testing Strategy > Configuration resolution and clamping"_

  - [x] 13.4 Write example tests: tunable clamping
    - Out-of-range gravity clamps into [800, 2400] (`99999 → 2400`, `0 → 800`); `GHOSTY_HEIGHT_FACTOR: 0.3 → 0.15`; flap impulse clamps into [300, 700]
    - _Requirements: Design "Testing Strategy > Configuration resolution and clamping"_

  - [x] 13.5 Write example tests: locked fields, unknown keys, malformed values
    - A requirement-fixed value such as pipe speed (0.35) cannot be changed by any override and resolves back to 0.35 (likewise spacing 0.5, gap margins 0.1, gap multiple 2.5, max fall 1200, dt clamp, cloud opacity, restart lockout 500)
    - An override/URL key not in the default shape (e.g. `wobble`) leaves the effective CONFIG unchanged
    - Non-numeric / `NaN` URL params are clamped or ignored, never applied raw
    - _Requirements: Design "Testing Strategy > Configuration resolution and clamping"_

- [x] 14. Implement renderer shell (`renderer.js`)
  - [x] 14.1 Implement `src/shell/renderer.js`
    - Implement `render(ctx, world, assets)` drawing top-to-bottom each frame without mutating state: sky-blue fill (Req 1.1); clouds farther-layer-first with `globalAlpha` in [0.2, 0.8] (Req 1.6, 1.7); green pipe rectangles with `imageSmoothingEnabled = false` and integer-aligned coords for hard edges, drawing only pairs at least partially in horizontal bounds (Req 1.5, 10.2); full-width ground strip (Req 1.2); Ghosty from `ghosty.png` or a solid placeholder rectangle of equal bounds when the sprite failed to load (Req 1.3, 1.4); HUD current score + high score as integers (Req 7.3, 7.4); Ready start prompt or GameOver message with final score + restart prompt by `world.status` (Req 2.3, 9.5)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.3, 7.3, 7.4, 9.5, 10.2; Design "Rendering Approach"_

  - [x] 14.2 Write rendering tests with a recording 2D context
    - Sky fill and draw order clouds → pipes → ground → Ghosty (Req 1.1, 1.6); `imageSmoothingEnabled === false` set before pipes/sprite (Req 1.5); sprite-load-failure path draws a placeholder rect of equal bounds and does not throw (Req 1.4)
    - HUD shows current + high score as integers; GameOver overlay shows final score + restart prompt; Ready overlay shows the start prompt (Req 2.3, 7.3, 7.4, 9.5)
    - Each frame draws Ghosty, on-screen pipes, ground, and HUD (Req 10.2)
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.3, 7.3, 7.4, 9.5, 10.2; Design "Testing Strategy > Rendering tests"_

- [x] 15. Implement the frame loop shell (`loop.js`)
  - [x] 15.1 Implement `src/shell/loop.js`
    - Implement `startLoop({ getState, setState, input, render, audio, storage, getConfig })`: drive via `requestAnimationFrame` at a 60 FPS target (Req 10.1); compute `dt` from successive timestamps and clamp to `[DT_MIN, DT_MAX]` (Req 10.3); read the effective CONFIG each frame and call `engine.step(...)`; forward returned effects to `audio`/`storage` and pass new state to `render` (Req 7.3)
    - Add a `visibilitychange` listener: while hidden, stop advancing the simulation; on becoming visible, reset `lastTimestamp` so the hidden interval is discarded rather than applied as one large `dt` (Req 10.4)
    - _Requirements: 7.3, 10.1, 10.3, 10.4; Design "Game Loop and State Machine Design > Frame loop"_

  - [x] 15.2 Write example/edge test for visibility pause
    - A simulated hidden→visible cycle produces no step that uses the hidden interval as `dt`
    - _Requirements: 10.4; Design "Testing Strategy > Example and edge-case tests"_

- [x] 16. Implement the tuning panel shell (`tuningPanel.js`)
  - [x] 16.1 Implement `src/shell/tuningPanel.js`
    - Implement `createTuningPanel({ onChange, defaults })` returning `{ toggle(), destroy() }`
    - Mount an HTML/DOM overlay (not on the Canvas) with inputs/sliders for only the freely-tunable params, each label stating its allowed range; hidden by default; toggled by the backtick key or a "Toggle tuning panel" button
    - Editing a field passes the raw partial to `onChange`, which re-resolves via `config.js` (clamping); the panel then reflects the clamped effective value so a value can never escape its range on screen; include a "reset to defaults" action
    - The panel never advances or alters the simulation on its own
    - _Requirements: Design "Configuration and Tuning > Tuning panel behavior" (dev tooling)_

  - [x] 16.2 Write smoke test for the tuning panel with synthetic DOM
    - The panel is hidden on mount and toggles open on the backtick key/button; an edit routes a raw partial through `config.js` so the live value is clamped (typing `99999` for gravity yields an effective 2400); "reset to defaults" restores the defaults
    - _Requirements: Design "Testing Strategy > Integration and smoke tests" (tuning panel)_

- [x] 17. Checkpoint - Ensure all core and shell tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Wire the game together (HTML, bootstrap, asset loading)
  - [x] 18.1 Create `index.html`
    - Add a `<canvas>` sized to the Play_Area and a `<script type="module" src="src/shell/main.js">` entry; no build step so the file runs by opening it in a browser
    - Include a container/button for the dev tuning panel overlay
    - _Requirements: Overview (open index.html to play), Design "Overview"; supports 1.1, 2.1_

  - [x] 18.2 Implement `src/shell/main.js` bootstrap and asset loading
    - Load `assets/ghosty.png`, `assets/jump.wav`, `assets/game_over.wav`; set a `spriteLoaded` flag and fall back to the placeholder sprite path if `ghosty.png` fails to load, continuing to render the rest of the scene (Req 1.4)
    - Build the effective CONFIG via `config.js` (`resolveConfig`), read the high score via `storage.loadHighScore`, create the world via `engine.createWorld`, wire `input`, `renderer`, `audio`, `storage`, and the loop; reach Ready within 100 ms of assets loading (Req 2.1)
    - Mount `tuningPanel.js` with an `onChange` that calls `config.withLiveOverrides` and feeds the refreshed config to the loop
    - _Requirements: 1.4, 2.1, 8.4; Design "Module responsibilities > main.js", "Architecture"_

- [x] 19. Final integration and smoke tests
  - [x] 19.1 Write boot and loop smoke tests
    - Boot with stubbed assets reaches Ready (Req 2.1 smoke); the loop uses `requestAnimationFrame` and clamps `dt` to [16 ms, 100 ms] (Req 10.1 smoke)
    - _Requirements: 2.1, 10.1, 10.3; Design "Testing Strategy > Integration and smoke tests"_

  - [x] 19.2 Write an end-to-end scripted-session integration test
    - A scripted session (flap to start, pass a pipe, crash) produces one jump sound per flap, one game-over sound, a score of 1, and a persisted high score — asserting effects are actually forwarded to the real audio/storage shells
    - _Requirements: 3.5, 7.2, 8.2, 9.1; Design "Testing Strategy > Integration and smoke tests"_

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation sub-tasks are never optional.
- Each of the 20 Correctness Properties maps to exactly one property-based `fast-check` test (Properties 1–3 in task 4; 4, 7, 15, 16, 18 in task 8; 5, 20 in task 7; 6 in task 11; 8, 9, 10 in task 2; 11–14 in task 3; 17 in task 6; 19 in task 10), each tagged `// Feature: flappy-kiro, Property {number}: {property_text}` and configured for a minimum of 100 iterations.
- Property tests cover the pure core's universal logic; example, edge-case, rendering, config-clamping, integration, and smoke tests cover concrete scenarios, I/O boundaries, rendering, cadence, and the dev-only config/tuning layer.
- `config.js` / `tuningPanel.js` are developer tooling: with no overrides and the panel untouched, the effective CONFIG is value-equal to `constants.js`, so Requirements 1–10 behavior is unchanged.
- Requirements 11–13 (color, flair, best-distance marker) and Requirement 16 (environment themes) were originally out of scope for this plan; they were subsequently implemented as follow-on work (see requirements.md and design.md), each shipping with its own property and example tests. This plan's checklist covers Requirements 1–10 plus the config/tuning system.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.1", "6.2"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 8, "tasks": ["10.1", "11.1", "12.1", "13.1", "14.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "11.2", "11.3", "13.2", "13.3", "13.4", "13.5", "14.2"] },
    { "id": 10, "tasks": ["15.1", "16.1"] },
    { "id": 11, "tasks": ["15.2", "16.2", "18.1"] },
    { "id": 12, "tasks": ["18.2"] },
    { "id": 13, "tasks": ["19.1", "19.2"] }
  ]
}
```
