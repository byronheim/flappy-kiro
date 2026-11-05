# Tech Stack

## Runtime stack

- **Language:** Vanilla JavaScript (ES modules).
- **Rendering:** HTML5 Canvas 2D API.
- **Persistence:** Browser `localStorage` (high score).
- **Audio:** `HTMLAudioElement` for the provided `.wav` assets.
- **No runtime dependencies.** No framework, bundler, or transpiler. The game runs by opening a single `index.html` in a modern browser — there is no build step.

## Why this stack

The game is a small, self-contained retro game with pixel-art rendering, per-frame physics, and local persistence. Canvas 2D, ES modules, and `localStorage` are browser primitives that cover all of that, so adding a framework or bundler would only add tooling the project does not need and would break the "open the file and play" experience.

## Architecture (at a glance)

- **Pure simulation core** — plain functions over plain data (`engine.js`, `physics.js`, `pipes.js`, `collision.js`, `scoring.js`, `stateMachine.js`, `constants.js`). No DOM, Canvas, storage, audio, `Date.now`, or direct `Math.random`. Randomness and `dt` are injected; side effects are returned as data.
- **Impure I/O shell** — browser-facing modules (`main.js`, `loop.js`, `input.js`, `renderer.js`, `audio.js`, `storage.js`, plus dev-only `config.js`/`tuningPanel.js`). All I/O and error handling live here.

See `coding-standards.md` for the rules that enforce this split.

## Dev / test tooling

Tests are mandatory, not optional — see `testing.md`. A working test suite is a prerequisite for development, not an afterthought, so the dev toolchain below must be in place and the suite must run before work is considered complete.

- **Test runner:** Node's built-in `node:test` + `node:assert` — zero dependency, matching the no-build philosophy.
- **Property-based testing:** [`fast-check`](https://github.com/dubzzz/fast-check) — the one required dev dependency. Used for property tests of the pure core; it is dev-only and never shipped to the browser, so the game stays dependency-free at runtime.
- The pure core runs directly in Node (ES modules, no DOM). The shell is exercised with a recording `CanvasRenderingContext2D`, a stubbed `localStorage`, and synthetic DOM events.

### Prerequisite setup

The repository does not yet have a committed `package.json`. Before (or as part of) the first code change, add one that declares `fast-check` as a dev dependency and wires the test script, so `node --test` can run the suite:

```bash
npm init -y                    # create package.json (first time only)
npm install --save-dev fast-check
```

Keep `fast-check` under `devDependencies` only. `package-lock.json` is gitignored, and no runtime dependency is ever added — the shipped game remains buildless and dependency-free.

## Common commands

No build or compile step exists — the game is served as static files.

```bash
# Run the game: open index.html directly in a browser, or serve statically:
python3 -m http.server 8000        # then visit http://localhost:8000

# Install dev dependencies (first time — see Prerequisite setup):
npm install

# Run all tests — required before work is considered complete:
node --test

# Run a single test file:
node --test test/physics.test.js
```

Tests must pass before a change is done; never leave the suite red (see `testing.md`). `package-lock.json` is gitignored. Keep `fast-check` a dev-only dependency so the shipped game stays buildless and dependency-free.
