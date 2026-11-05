// Property and example tests for the pure distance tracking core (Req 13).
// Design "Correctness Properties > Property 23, 24".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import { updateDistance, resolveBestDistance } from '../src/core/distance.js';
import { pipeSpeed } from '../src/core/pipes.js';

const RUNS = { numRuns: 100 };
const dims = { width: 400, height: 600, groundHeight: 48 };
const dtArb = fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true });

const FRESH = { distanceTraveled: 0, markerReached: false, markerHighlightElapsed: 0 };

// Feature: flappy-kiro, Property 23: Distance accrues at pipe speed and the marker triggers exactly once
test('Property 23: Distance accrues at pipe speed and the marker triggers exactly once', () => {
  fc.assert(
    fc.property(
      fc.array(dtArb, { minLength: 1, maxLength: 40 }),
      // best distance somewhere within the reachable range for these frames.
      fc.double({ min: 0, max: 5000, noNaN: true }),
      (frames, bestDistance) => {
        const speed = pipeSpeed(dims, CONFIG);
        let state = { ...FRESH };
        let expectedDistance = 0;
        let flips = 0;
        let prevReached = false;

        for (const dt of frames) {
          const before = state.distanceTraveled;
          const res = updateDistance(state, dt, bestDistance, dims, CONFIG);
          state = res.state;
          expectedDistance += speed * dt;

          // (Req 13.1) distance grows by exactly pipeSpeed*dt each frame.
          assert.ok(Math.abs(state.distanceTraveled - (before + speed * dt)) < 1e-6);

          // The one-shot never flips back to false.
          if (prevReached) assert.equal(state.markerReached, true);
          if (state.markerReached && !prevReached) flips += 1;
          // reachedNow is reported on exactly the flipping frame.
          assert.equal(res.reachedNow, state.markerReached && !prevReached);
          prevReached = state.markerReached;
        }

        // Cumulative distance matches the sum of pipeSpeed*dt.
        assert.ok(Math.abs(state.distanceTraveled - expectedDistance) < 1e-6);

        // The marker flips at most once per session; it flips iff a positive
        // best distance was reached by the accrued distance (Req 13.4).
        assert.ok(flips <= 1);
        if (bestDistance > 0 && expectedDistance >= bestDistance) {
          assert.equal(state.markerReached, true);
          assert.equal(flips, 1);
        }
        if (bestDistance <= 0) {
          assert.equal(state.markerReached, false);
          assert.equal(flips, 0);
        }
      }
    ),
    RUNS
  );
});

test('distance tracking ignores a zero best distance (no marker on a first-ever run)', () => {
  let state = { ...FRESH };
  for (let i = 0; i < 20; i += 1) {
    const res = updateDistance(state, CONFIG.DT_MAX, 0, dims, CONFIG);
    state = res.state;
    assert.equal(res.reachedNow, false);
  }
  assert.equal(state.markerReached, false);
  assert.equal(state.markerHighlightElapsed, 0);
  assert.ok(state.distanceTraveled > 0);
});

test('highlight timer accrues only after the marker is reached', () => {
  const speed = pipeSpeed(dims, CONFIG);
  const best = speed * CONFIG.DT_MAX * 0.5; // reached on the first frame
  let state = { ...FRESH };
  // Frame 1 crosses the marker.
  let res = updateDistance(state, CONFIG.DT_MAX, best, dims, CONFIG);
  state = res.state;
  assert.equal(res.reachedNow, true);
  assert.ok(state.markerHighlightElapsed > 0);
  const afterFirst = state.markerHighlightElapsed;
  // Frame 2 keeps accumulating the highlight, but does not re-trigger.
  res = updateDistance(state, CONFIG.DT_MAX, best, dims, CONFIG);
  state = res.state;
  assert.equal(res.reachedNow, false);
  assert.ok(state.markerHighlightElapsed > afterFirst);
});

// resolveBestDistance half of Property 24 (the load half is in storage.test.js).
test('resolveBestDistance only improves on a strictly greater session (Req 13.5)', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      (session, prior) => {
        const { bestDistance, improved } = resolveBestDistance(session, prior);
        if (session > prior) {
          assert.equal(improved, true);
          assert.equal(bestDistance, session);
        } else {
          assert.equal(improved, false);
          assert.equal(bestDistance, prior);
        }
      }
    ),
    RUNS
  );
});
