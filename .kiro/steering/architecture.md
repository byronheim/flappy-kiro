# Game Architecture Standards

How Flappy Kiro's systems fit together. This complements `structure.md` (where code lives) and `coding-standards.md` (how code is written) by defining the runtime architecture: modular systems, event/effect flow, and state management.

## Guiding principle: functional core, imperative shell

The whole architecture rests on one decision: a **pure simulation core** wrapped by an **imperative I/O shell**.

- The core advances the game as a pure function: `step(state, dt, intents, rng, config) -> { state, effects }`. Same inputs always produce the same output.
- The shell owns everything the core cannot: timing, input events, Canvas, audio, `localStorage`, config resolution.
- This makes the game deterministic, testable without a browser, and simple to reason about — there is exactly one place where state changes (the core) and exactly one place where the world is touched (the shell).

Dependencies point **shell → core, never core → shell.**

## Modular systems

Each system is a single-purpose module with a narrow contract. Systems communicate only through plain data (`World`, `Intents`, `Config`, `Effect[]`) — never by reaching into each other's internals.

### Core systems (pure)

- **engine** — the orchestrator. Runs the state machine, then the active-play systems, and assembles the resulting `World` + `Effect[]`. It is the only core module the shell calls each frame.
- **physics** — gravity, velocity integration, velocity cap, flap-impulse clamp.
- **pipes** — generate at fixed spacing, scroll, cull/recycle off-screen pairs.
- **collision** — AABB overlap of Ghosty vs pipes/ground/ceiling; OR'd into one boolean so multiple hits in a frame cause exactly one game over.
- **scoring** — detect gap pass, increment once per pipe (via a per-pipe `scored` flag).
- **stateMachine** — legal status transitions and their timers.
- **constants** — default tuning values; the data every other core system reads.

A core system takes the relevant slice of state (plus `dt`/`rng`/`config` as needed) and returns a new slice. It never mutates its input and never calls another system's side effects.

### Shell systems (impure)

- **main** — bootstraps: loads assets, builds the effective config, wires everything, starts the loop.
- **loop** — the frame driver (see State management below).
- **input** — translates raw browser events into `Intents`.
- **renderer** — draws `World` to the canvas; read-only.
- **audio** / **storage** — perform the I/O that core effects describe.
- **config** / **tuningPanel** — dev-only; resolve/clamp config and expose live tuning.

## Event handling patterns

### Inbound: raw events → intents

Raw browser events never reach the core. `input.js` is the single translation boundary:

- Normalize keyboard and pointer events into a small, declarative `Intents` object (e.g. `{ flap: boolean }`).
- Apply event hygiene at this boundary: ignore OS key auto-repeat (`event.repeat`), reject pointer events outside the canvas bounds, and collapse multiple same-frame inputs into a single intent.
- The buffer is **drained once per frame** by the loop and cleared. The core sees intents as plain booleans and has no knowledge of keys, pointers, or the DOM.
- The same intent means different things in different states (start, flap, restart) — that decision belongs to `stateMachine`, not `input`.

### Outbound: effects as data, not callbacks

The core never calls audio or storage directly. Instead it **returns effects** — plain descriptors the shell interprets:

```js
{ type: 'playSound', name: 'jump' }
{ type: 'playSound', name: 'gameOver' }
{ type: 'persistHighScore', value: 42 }
```

- `step()` returns `{ state, effects }`. The loop forwards each effect to the matching shell system.
- This keeps side effects testable (assert on the returned effect list) and keeps "one sound per flap" / "one game-over sound" decidable by inspecting the list.
- Add new side effects by adding a new effect type and a shell handler — the core stays pure.

### No global event bus

There is no pub/sub event emitter. The only coupling between systems is the per-frame data flow: `intents` in, `World` + `effects` out. Avoid introducing a global event bus, singletons, or shared mutable module state; they defeat the determinism the core depends on.

## State management

### Single source of truth: the `World`

All game state lives in one immutable-by-convention `World` object (status, dims, ghosty, pipes, clouds, score, highScore, timers, ids). There is no state scattered across modules or hidden in closures.

- The engine returns a **new** `World` each step rather than mutating in place, keeping `step()` referentially transparent.
- Config is frozen data handed in per frame — it is state the core reads, never state the core edits.
- The shell holds exactly one live reference to the current `World` and swaps it for the returned one each frame.

### Status via an explicit state machine

Game status is an explicit enum (`'ready' | 'playing' | 'gameOver'`) driven by `stateMachine.js`:

```
Ready  --flap-->            Playing
Playing --collision-->      GameOver
GameOver --flap after 500ms lockout--> Ready
```

- Each transition has defined entry actions (e.g. entering Playing zeroes velocity and resets score; entering GameOver freezes pipes, captures final score, updates/persists high score, emits the game-over sound).
- Non-Playing states freeze the simulation: stepping in Ready/GameOver leaves positions, velocities, and the final score unchanged and never applies a flap impulse.
- The state machine runs first in `step()` so downstream systems act only in the appropriate status.

### The frame as the unit of state change

`loop.js` is the sole driver and owns timing so the core never reads a clock:

1. Compute `dt` from the `requestAnimationFrame` timestamp and clamp to `[0.016, 0.100]` s.
2. Drain `intents` from `input`.
3. Read the current effective `config`.
4. `step()` → new `World` + `effects`.
5. Forward `effects` to `audio`/`storage`.
6. Hand the new `World` to `renderer`.

On `visibilitychange` to hidden, advancing stops; on return, `lastTimestamp` resets to now so the hidden interval is discarded rather than applied as one huge `dt`. Motion is integrated by `dt`, so behavior is identical across frame rates.

## Extension pattern

Future features (color/flair customization, best-distance marker) extend along existing seams, not by restructuring:

- Add fields to `World` and have the **core** evolve them.
- Add draw logic in `renderer` driven by those fields.
- Add persisted keys through `storage` using the same validated load/save pattern as the high score.
- New side effects become new effect types with shell handlers.

None of this changes the `step()` contract — new state and rendering ride on the boundaries already defined above.
