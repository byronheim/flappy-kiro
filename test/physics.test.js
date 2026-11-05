// Property-based tests for the physics core.
// Design "Correctness Properties > Property 8, 9, 10".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import {
  applyGravity,
  integrate,
  clampImpulse,
  applyFlap,
} from '../src/core/physics.js';

const RUNS = { numRuns: 100 };

// Feature: flappy-kiro, Property 8: Flap impulse is clamped into range
test('Property 8: Flap impulse is clamped into range', () => {
  fc.assert(
    fc.property(fc.double({ min: -10000, max: 10000, noNaN: true }), (requested) => {
      const clamped = clampImpulse(requested, CONFIG);
      // Lies within [300, 700].
      assert.ok(clamped >= CONFIG.FLAP_IMPULSE_MIN && clamped <= CONFIG.FLAP_IMPULSE_MAX);
      // Equals the nearest boundary when out of range.
      if (requested < CONFIG.FLAP_IMPULSE_MIN) assert.equal(clamped, CONFIG.FLAP_IMPULSE_MIN);
      else if (requested > CONFIG.FLAP_IMPULSE_MAX) assert.equal(clamped, CONFIG.FLAP_IMPULSE_MAX);
      else assert.equal(clamped, requested);
    }),
    RUNS
  );

  // Applying a flap sets vy to exactly the clamped upward impulse.
  const ghosty = { x: 0, y: 100, vy: 50, w: 10, h: 10 };
  const flapped = applyFlap(ghosty, CONFIG);
  assert.equal(flapped.vy, -clampImpulse(CONFIG.FLAP_IMPULSE, CONFIG));
});

// Feature: flappy-kiro, Property 9: Gravity integration is correct and frame-rate independent
test('Property 9: Gravity integration is correct and frame-rate independent', () => {
  // Per-step correctness (before capping): velocity increases by gravity*dt,
  // position advances by the integrated velocity.
  fc.assert(
    fc.property(
      fc.double({ min: -500, max: 500, noNaN: true }),
      fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true }),
      (vy0, dt) => {
        const ghosty = { x: 0, y: 300, vy: vy0, w: 10, h: 10 };
        const expectedVy = Math.min(vy0 + CONFIG.GRAVITY * dt, CONFIG.MAX_FALL_SPEED);
        const afterGravity = applyGravity(ghosty, dt, CONFIG);
        assert.ok(Math.abs(afterGravity.vy - expectedVy) < 1e-6);
        const afterIntegrate = integrate(afterGravity, dt);
        assert.ok(Math.abs(afterIntegrate.y - (ghosty.y + afterGravity.vy * dt)) < 1e-6);
      }
    ),
    RUNS
  );

  // Frame-rate independence: splitting a fixed total time into different
  // cadences (each frame within [DT_MIN, DT_MAX]) yields approximately the same
  // result. Semi-implicit Euler leaves a small O(gravity*dt*T) position
  // difference between cadences, so the tolerance reflects that principled bound
  // rather than demanding bit-exactness.
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 12 }),
      fc.integer({ min: 2, max: 12 }),
      (nA, nB) => {
        const total = 0.192; // seconds; frames 2..12 keep every dt within [0.016, 0.1]
        const simulate = (frames) => {
          const dt = total / frames;
          if (dt < CONFIG.DT_MIN - 1e-9 || dt > CONFIG.DT_MAX + 1e-9) return null;
          let g = { x: 0, y: 300, vy: 0, w: 10, h: 10 };
          for (let i = 0; i < frames; i += 1) {
            g = integrate(applyGravity(g, dt, CONFIG), dt);
          }
          return g;
        };
        const a = simulate(nA);
        const b = simulate(nB);
        if (!a || !b) return; // skip cadences outside the clamp band
        // Velocity after total time is exactly gravity*total regardless of
        // cadence (below the cap), so this stays tight.
        assert.ok(Math.abs(a.vy - b.vy) < 1e-6);
        // Position differs by at most ~0.5*gravity*dtMax*total between cadences.
        const bound = 0.5 * CONFIG.GRAVITY * CONFIG.DT_MAX * total + 1;
        assert.ok(Math.abs(a.y - b.y) < bound, `dy ${Math.abs(a.y - b.y)} > ${bound}`);
      }
    ),
    RUNS
  );
});

// Feature: flappy-kiro, Property 10: Downward velocity never exceeds terminal velocity
test('Property 10: Downward velocity never exceeds terminal velocity', () => {
  fc.assert(
    fc.property(
      fc.double({ min: -2000, max: 2000, noNaN: true }),
      fc.array(fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true }), {
        minLength: 1,
        maxLength: 200,
      }),
      (vy0, dts) => {
        let g = { x: 0, y: 300, vy: vy0, w: 10, h: 10 };
        for (const dt of dts) {
          g = applyGravity(g, dt, CONFIG);
          assert.ok(g.vy <= CONFIG.MAX_FALL_SPEED);
        }
      }
    ),
    RUNS
  );
});
