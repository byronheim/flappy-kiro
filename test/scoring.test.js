// Property-based test for scoring.
// Design "Correctness Properties > Property 17".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { updateScore } from '../src/core/scoring.js';

const RUNS = { numRuns: 100 };

// dt band constants kept local to avoid importing CONFIG just for generators.
const CONFIG_DT_MIN = 0.016;
const CONFIG_DT_MAX = 0.1;

// Feature: flappy-kiro, Property 17: Passing a pipe scores exactly once
test('Property 17: Passing a pipe scores exactly once', () => {
  fc.assert(
    fc.property(
      // N pipes at increasing x positions, all to the left of Ghosty so each is passable.
      fc.integer({ min: 0, max: 10 }),
      fc.array(fc.double({ min: CONFIG_DT_MIN, max: CONFIG_DT_MAX, noNaN: true }), {
        minLength: 1,
        maxLength: 8,
      }),
      (n, extraFrames) => {
        const ghosty = { x: 1000, y: 100, vy: 0, w: 10, h: 10 };
        // Build N pipes whose trailing edge is left of Ghosty (already passed),
        // plus one pipe still ahead (never passed).
        const pipes = [];
        for (let i = 0; i < n; i += 1) {
          pipes.push({ id: i, x: 100 + i * 30, width: 20, gapTop: 10, gapBottom: 60, scored: false });
        }
        pipes.push({ id: 999, x: 2000, width: 20, gapTop: 10, gapBottom: 60, scored: false });

        // First pass: should score exactly N.
        let state = updateScore(0, ghosty, pipes);
        assert.equal(state.score, n);

        // Additional frames must not re-score already-scored pipes.
        for (let f = 0; f < extraFrames.length; f += 1) {
          state = updateScore(state.score, ghosty, state.pipes);
        }
        assert.equal(state.score, n);

        // The pipe still ahead remains unscored.
        const ahead = state.pipes.find((p) => p.id === 999);
        assert.equal(ahead.scored, false);
      }
    ),
    RUNS
  );
});
