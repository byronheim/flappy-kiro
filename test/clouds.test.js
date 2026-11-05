// Property-based tests for cloud opacity, parallax speeds, and recycling.
// Design "Correctness Properties > Property 1, 2, 3".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import {
  generateCloud,
  seedClouds,
  updateClouds,
  cloudLayerSpeed,
} from '../src/core/clouds.js';
import { pipeSpeed } from '../src/core/pipes.js';

const RUNS = { numRuns: 100 };

const dimsArb = fc.record({
  width: fc.integer({ min: 200, max: 1200 }),
  height: fc.integer({ min: 300, max: 1000 }),
}).map((d) => ({ ...d, groundHeight: Math.round(d.height * CONFIG.GROUND_HEIGHT_FACTOR) }));

// Feature: flappy-kiro, Property 1: Cloud opacity stays semi-transparent
test('Property 1: Cloud opacity stays semi-transparent', () => {
  fc.assert(
    fc.property(dimsArb, fc.double({ min: 0, max: 0.9999, noNaN: true }), fc.integer({ min: 0, max: 1 }), (dims, r, layer) => {
      const cloud = generateCloud(dims, () => r, CONFIG, layer, false);
      assert.ok(cloud.opacity >= CONFIG.CLOUD_OPACITY_MIN - 1e-9);
      assert.ok(cloud.opacity <= CONFIG.CLOUD_OPACITY_MAX + 1e-9);
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 2: Parallax cloud speeds are positive, bounded, and depth-ordered
test('Property 2: Parallax cloud speeds are positive, bounded, and depth-ordered', () => {
  fc.assert(
    fc.property(dimsArb, (dims) => {
      const speeds = CONFIG.CLOUD_LAYER_FACTORS.map((_, layer) => cloudLayerSpeed(layer, dims, CONFIG));
      const ps = pipeSpeed(dims, CONFIG);
      for (const s of speeds) {
        assert.ok(s > 0);
        assert.ok(s >= CONFIG.CLOUD_MIN_SPEED - 1e-9);
      }
      // A nearer layer (higher index) is strictly faster than a farther one,
      // except where both are pinned to the CLOUD_MIN_SPEED floor (still move).
      for (let i = 1; i < speeds.length; i += 1) {
        assert.ok(speeds[i] >= speeds[i - 1]);
      }
      // Each layer strictly slower than the pipes whenever the factor keeps it
      // below pipe speed; the min-speed floor could in theory exceed a tiny
      // pipe speed, so only assert strict-less when not floored.
      CONFIG.CLOUD_LAYER_FACTORS.forEach((factor, layer) => {
        if (factor * ps > CONFIG.CLOUD_MIN_SPEED) {
          assert.ok(speeds[layer] < ps);
        }
      });
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 3: Clouds never remain fully off the left edge
test('Property 3: Clouds never remain fully off the left edge', () => {
  fc.assert(
    fc.property(dimsArb, fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true }), (dims, dt) => {
      const clouds = seedClouds(dims, () => 0.5, CONFIG, 3);
      const count = clouds.length;
      // Advance many frames to force some clouds off the left edge.
      let state = clouds;
      for (let f = 0; f < 500; f += 1) {
        state = updateClouds(state, dims, dt, () => 0.5, CONFIG);
      }
      assert.equal(state.length, count);
      const width = dims.width * 0.2;
      for (const c of state) {
        // Still intersects or is to the right of the play area.
        assert.ok(c.x + width >= 0);
      }
    }),
    RUNS
  );
});
