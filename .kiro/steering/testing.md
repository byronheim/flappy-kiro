# Testing Standards

Testing is mandatory for Flappy Kiro. Favor correctness and good test coverage over speed of development. When there is tension between shipping faster and testing properly, choose testing.

## Core rule: tests are not optional

- Every change to behavior ships **with** its tests in the same unit of work. A feature or bug fix is not "done" until it has passing tests that exercise the new or changed behavior.
- Do not defer, skip, or stub out tests to move faster. "I'll add tests later" is not acceptable.
- A task is only complete when the relevant tests exist and pass. Treat missing tests as a failing task, not a follow-up.
- Only skip a test when there is a genuine, stated reason it cannot be written (e.g. a purely manual visual check), and call that out explicitly.

## What must be tested

- **Simulation core (pure modules):** must have thorough automated tests. This is where the testable logic lives — physics, pipes, collision, scoring, state transitions, persistence validation. These run directly in Node with no browser.
- **Property-based tests** for the core's universal invariants, using `fast-check` with a minimum of 100 iterations per property. Each of the design's Correctness Properties is implemented as exactly one property test, tagged:
  `// Feature: flappy-kiro, Property {number}: {property_text}`
- **Example / edge-case tests** for specific wiring and boundaries (e.g. resolved sizes within range, Ready→Playing entry actions, input de-duplication, storage validation, visibility pause).
- **Shell modules:** test against test doubles — a recording `CanvasRenderingContext2D`, a stubbed `localStorage`, and synthetic DOM events. Rendering, input hygiene, audio effect forwarding, and storage load/save are all covered.
- **Integration / smoke:** at least one scripted end-to-end session (flap to start, pass a pipe, crash) asserting effects reach the real audio/storage shells.

Purely visual appearance checks (retro aesthetic) may remain a documented manual smoke step, but everything with input-varying or branching logic must be covered by automated tests.

## How we work

- Prefer writing the test alongside (or before) the implementation. Use tests to pin down the behavior described in the requirements and design.
- Keep the core pure so it stays directly testable — determinism via injected `rng`/`dt` and effects-as-data is what makes full coverage practical. Do not sacrifice that for a shortcut.
- Run the full test suite (`node --test`) before considering work complete, and fix failures before moving on — never leave the suite red.
- Mirror source layout in tests: `src/physics.js` → `test/physics.test.js`.

## Tooling

- **Runner:** Node's built-in `node:test` + `node:assert` (zero dependency, no build).
- **Property testing:** `fast-check` (dev-only; never shipped to the browser).
