// Property and example tests for engine.step() orchestration.
// Design "Correctness Properties > Property 4, 7, 15, 16, 18".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import { createWorld, step } from '../src/core/engine.js';
import { States } from '../src/core/stateMachine.js';

const RUNS = { numRuns: 100 };
const dims = { width: 400, height: 600, groundHeight: Math.round(600 * CONFIG.GROUND_HEIGHT_FACTOR) };
const rng = () => 0.5;
const dtArb = fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true });

function playingWorld(overrides = {}) {
  const base = createWorld(dims, 0, CONFIG, rng);
  return {
    ...base,
    status: States.PLAYING,
    // Keep Ghosty safely away from pipes/ground/ceiling by default.
    ghosty: { ...base.ghosty, y: 300, vy: 0 },
    pipes: [],
    ...overrides,
  };
}

// Feature: flappy-kiro, Property 4: Non-Playing states freeze the simulation
test('Property 4: Non-Playing states freeze the simulation', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(States.READY, States.GAME_OVER),
      dtArb,
      (status, dt) => {
        // A frozen state does not advance under stepping:
        //  - Ready with no flap (a flap legitimately starts the game).
        //  - GameOver within the restart lockout (a flap cannot restart yet).
        const flap = status === States.GAME_OVER; // flap is ignored during lockout
        const base = createWorld(dims, 3, CONFIG, rng);
        const pipes = [{ id: 0, x: 150, width: 20, gapTop: 10, gapBottom: 80, scored: false }];
        const world = {
          ...base,
          status,
          pipes,
          ghosty: { ...base.ghosty, y: 123, vy: 77 },
          finalScore: status === States.GAME_OVER ? 9 : 0,
          gameOverElapsed: 0, // keep GameOver locked so a flap cannot restart
        };
        const { state } = step(world, dt, { flap }, rng, CONFIG);
        // Ghosty position/velocity unchanged.
        assert.equal(state.ghosty.y, 123);
        assert.equal(state.ghosty.vy, 77);
        // Pipe x unchanged.
        assert.equal(state.pipes[0].x, 150);
        // Frozen final score unchanged.
        assert.equal(state.finalScore, world.finalScore);
      }
    ),
    RUNS
  );
});

// Feature: flappy-kiro, Property 7: One flap yields exactly one jump sound
test('Property 7: One flap yields exactly one jump sound', () => {
  fc.assert(
    fc.property(dtArb, fc.boolean(), (dt, flap) => {
      const world = playingWorld();
      const { effects } = step(world, dt, { flap }, rng, CONFIG);
      const jumps = effects.filter((e) => e.type === 'playSound' && e.name === 'jump').length;
      assert.equal(jumps, flap ? 1 : 0);
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 15: Any collision condition triggers exactly one game over
test('Property 15: Any collision condition triggers exactly one game over', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('ceiling', 'ground', 'pipe', 'all'),
      dtArb,
      (kind, dt) => {
        let world = playingWorld();
        const groundTop = dims.height - dims.groundHeight;
        if (kind === 'ceiling') {
          // Far enough above the top that one physics step cannot clear it.
          world = { ...world, ghosty: { ...world.ghosty, y: -50, vy: 0 } };
        } else if (kind === 'ground') {
          world = { ...world, ghosty: { ...world.ghosty, y: groundTop + 5, vy: 0 } };
        } else if (kind === 'pipe') {
          const g = world.ghosty;
          world = {
            ...world,
            pipes: [{ id: 0, x: g.x, width: g.w, gapTop: 0, gapBottom: dims.height, scored: false }],
          };
          // Make the pipe solid where Ghosty is: gapTop below Ghosty top so it overlaps.
          world.pipes[0].gapTop = g.y + g.h + 50;
          world.pipes[0].gapBottom = g.y + g.h + 60;
        } else {
          // all three at once
          world = { ...world, ghosty: { ...world.ghosty, y: -50 } };
          world = {
            ...world,
            pipes: [{ id: 0, x: world.ghosty.x, width: world.ghosty.w, gapTop: dims.height, gapBottom: dims.height, scored: false }],
          };
        }
        const { state, effects } = step(world, dt, { flap: false }, rng, CONFIG);
        assert.equal(state.status, States.GAME_OVER);
        const gameOvers = effects.filter((e) => e.type === 'playSound' && e.name === 'gameOver').length;
        assert.equal(gameOvers, 1);
      }
    ),
    RUNS
  );
});

// Feature: flappy-kiro, Property 16: GameOver stops evaluating collisions
test('Property 16: GameOver stops evaluating collisions', () => {
  fc.assert(
    fc.property(dtArb, (dt) => {
      const base = createWorld(dims, 0, CONFIG, rng);
      const world = {
        ...base,
        status: States.GAME_OVER,
        // Ghosty overlapping everything; must not emit a new gameOver.
        ghosty: { ...base.ghosty, y: -50 },
        gameOverElapsed: 0,
        finalScore: 2,
      };
      const { state, effects } = step(world, dt, { flap: false }, rng, CONFIG);
      assert.equal(state.status, States.GAME_OVER);
      const gameOvers = effects.filter((e) => e.type === 'playSound' && e.name === 'gameOver').length;
      assert.equal(gameOvers, 0);
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 18: High score becomes the session maximum
test('Property 18: High score becomes the session maximum', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 50 }),
      fc.integer({ min: 0, max: 50 }),
      (finalScore, priorHigh) => {
        // Force an immediate collision so this step enters GameOver.
        const base = createWorld(dims, priorHigh, CONFIG, rng);
        const world = {
          ...base,
          status: States.PLAYING,
          score: finalScore,
          highScore: priorHigh,
          ghosty: { ...base.ghosty, y: -5 }, // ceiling collision after physics
        };
        const { state, effects } = step(world, CONFIG.DT_MIN, { flap: false }, rng, CONFIG);
        assert.equal(state.status, States.GAME_OVER);
        assert.equal(state.highScore, Math.max(finalScore, priorHigh));
        const persists = effects.filter((e) => e.type === 'persistHighScore');
        if (finalScore > priorHigh) {
          assert.equal(persists.length, 1);
          assert.equal(persists[0].value, finalScore);
        } else {
          assert.equal(persists.length, 0);
        }
      }
    ),
    RUNS
  );
});

// Example test: Ready -> Playing transition (Req 2.4, 2.5, 4.5, 7.1).
test('Ready -> Playing on flap zeroes velocity, resets score, clears prompt', () => {
  const world = { ...createWorld(dims, 0, CONFIG, rng), score: 7, ghosty: { ...createWorld(dims, 0, CONFIG, rng).ghosty, vy: 999 } };
  const { state } = step(world, CONFIG.DT_MIN, { flap: true }, rng, CONFIG);
  assert.equal(state.status, States.PLAYING);
  assert.equal(state.score, 0);
  // vy was zeroed on entry, then one gravity step applied (so it is small/positive, not 999).
  assert.ok(state.ghosty.vy < 999);
});

// --- Best-distance marker wiring (Req 13.1, 13.2, 13.5) ----------------------

// Feature: flappy-kiro, Property 24: Best distance load validates, and improvement persists
test('Property 24 (persist): entering GameOver persists best distance iff the session beat it', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 50000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      (sessionDistance, priorBest) => {
        const base = createWorld(dims, 0, CONFIG, rng, priorBest);
        const world = {
          ...base,
          status: States.PLAYING,
          distanceTraveled: sessionDistance,
          ghosty: { ...base.ghosty, y: -5 }, // force a ceiling collision this step
        };
        const { state, effects } = step(world, CONFIG.DT_MIN, { flap: false }, rng, CONFIG);
        assert.equal(state.status, States.GAME_OVER);
        // The session distance includes one extra frame of travel; best is the max.
        const persists = effects.filter((e) => e.type === 'persistBestDistance');
        if (state.distanceTraveled > priorBest) {
          assert.equal(state.bestDistance, state.distanceTraveled);
          assert.equal(persists.length, 1);
          assert.equal(persists[0].value, state.bestDistance);
        } else {
          assert.equal(state.bestDistance, priorBest);
          assert.equal(persists.length, 0);
        }
      }
    ),
    RUNS
  );
});

test('entering Playing resets distance and marker state for the new session (Req 13.2)', () => {
  const base = createWorld(dims, 0, CONFIG, rng, 500);
  const world = {
    ...base,
    distanceTraveled: 999, // stale from a prior session
    markerReached: true,
    markerHighlightElapsed: 400,
  };
  const { state } = step(world, CONFIG.DT_MIN, { flap: true }, rng, CONFIG);
  assert.equal(state.status, States.PLAYING);
  // distance restarts at ~one frame of travel, marker flags cleared.
  assert.ok(state.distanceTraveled < 999);
  assert.equal(state.markerReached, false);
  // bestDistance from the prior session is preserved.
  assert.equal(state.bestDistance, 500);
});

test('distanceTraveled stays frozen in Ready and during the GameOver lockout (Req 13; freeze)', () => {
  // Ready: no flap -> no distance accrual.
  const ready = { ...createWorld(dims, 0, CONFIG, rng, 100), distanceTraveled: 42 };
  const r = step(ready, CONFIG.DT_MAX, { flap: false }, rng, CONFIG);
  assert.equal(r.state.distanceTraveled, 42);
  // GameOver (locked): no distance accrual.
  const over = { ...createWorld(dims, 0, CONFIG, rng, 100), status: States.GAME_OVER, distanceTraveled: 77, gameOverElapsed: 0 };
  const o = step(over, CONFIG.DT_MAX, { flap: false }, rng, CONFIG);
  assert.equal(o.state.distanceTraveled, 77);
});
