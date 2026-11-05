// Property-based tests for the state machine via engine.step().
// Design "Correctness Properties > Property 5, 20".
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

// Feature: flappy-kiro, Property 5: Ready stays Ready without a flap
test('Property 5: Ready stays Ready without a flap', () => {
  fc.assert(
    fc.property(dtArb, (dt) => {
      const world = createWorld(dims, 0, CONFIG, rng);
      const { state } = step(world, dt, { flap: false }, rng, CONFIG);
      assert.equal(state.status, States.READY);
      // Ghosty held stationary, no gravity. (Req 2.2)
      assert.equal(state.ghosty.y, world.ghosty.y);
      assert.equal(state.ghosty.vy, 0);
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 20: Restart after the lockout resets the session
test('Property 20: Restart after the lockout resets the session', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 1500, noNaN: true }),
      (elapsedMs) => {
        // Build a GameOver world with pipes and a displaced Ghosty.
        const base = createWorld(dims, 5, CONFIG, rng);
        const gameOver = {
          ...base,
          status: States.GAME_OVER,
          pipes: [{ id: 0, x: 100, width: 20, gapTop: 10, gapBottom: 80, scored: false }],
          ghosty: { ...base.ghosty, y: 10, vy: 400 },
          finalScore: 5,
          gameOverElapsed: elapsedMs,
        };
        // A flap this frame; dt small so the lockout decision is driven by elapsedMs.
        const { state } = step(gameOver, CONFIG.DT_MIN, { flap: true }, rng, CONFIG);

        if (elapsedMs + CONFIG.DT_MIN * 1000 >= CONFIG.RESTART_LOCKOUT_MS) {
          // Transitions to Ready, clears pipes, resets Ghosty, no impulse.
          assert.equal(state.status, States.READY);
          assert.equal(state.pipes.length, 0);
          assert.equal(state.ghosty.y, dims.height * CONFIG.GHOSTY_START_Y_FACTOR);
          assert.equal(state.ghosty.vy, 0);
          // vy is 0 (reset), never the negative flap impulse. (Req 9.10)
          assert.ok(state.ghosty.vy >= 0);
        } else {
          // Still locked out: remains GameOver, no impulse.
          assert.equal(state.status, States.GAME_OVER);
          assert.equal(state.ghosty.vy, 400); // unchanged, no flap impulse
        }
      }
    ),
    RUNS
  );
});
