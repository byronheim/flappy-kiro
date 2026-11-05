// Property-based tests for pipe generation, scrolling, and culling.
// Design "Correctness Properties > Property 11, 12, 13, 14".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import {
  generatePipe,
  updatePipes,
  cullPipes,
  pipeSpeed,
} from '../src/core/pipes.js';

const RUNS = { numRuns: 100 };

const dimsArb = fc.record({
  width: fc.integer({ min: 200, max: 1200 }),
  height: fc.integer({ min: 300, max: 1000 }),
}).map((d) => ({ ...d, groundHeight: Math.round(d.height * CONFIG.GROUND_HEIGHT_FACTOR) }));

const dtArb = fc.double({ min: CONFIG.DT_MIN, max: CONFIG.DT_MAX, noNaN: true });

function ghostyHeightOf(dims) {
  return dims.height * CONFIG.GHOSTY_HEIGHT_FACTOR;
}

// Feature: flappy-kiro, Property 11: Pipes scroll at a constant speed
test('Property 11: Pipes scroll at a constant speed', () => {
  fc.assert(
    fc.property(dimsArb, dtArb, fc.array(fc.double({ min: -100, max: 2000, noNaN: true }), { maxLength: 6 }), (dims, dt, xs) => {
      const gh = ghostyHeightOf(dims);
      const pipes = xs.map((x, i) => ({ id: i, x, width: 20, gapTop: 10, gapBottom: 80, scored: false }));
      const before = pipes.map((p) => p.x);
      const { pipes: after } = updatePipes(pipes, dims, dt, () => 0.5, CONFIG, gh, pipes.length, 0);
      const expectedDx = pipeSpeed(dims, CONFIG) * dt;
      // Each original pipe moved left by exactly expectedDx (match by id).
      for (let i = 0; i < pipes.length; i += 1) {
        const moved = after.find((p) => p.id === i);
        assert.ok(Math.abs((before[i] - moved.x) - expectedDx) < 1e-6);
      }
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 12: Generated pipes keep fixed spacing
test('Property 12: Generated pipes keep fixed spacing', () => {
  fc.assert(
    fc.property(dimsArb, fc.integer({ min: 1, max: 300 }), (dims, frames) => {
      const gh = ghostyHeightOf(dims);
      const spacing = CONFIG.PIPE_SPACING_FACTOR * dims.width;
      // Drive many frames from an empty field; the generator must keep every
      // pair of consecutive pipes exactly `spacing` apart at every instant.
      let state = { pipes: [], nextPipeId: 0, distanceSincePipe: 0 };
      const dt = CONFIG.DT_MAX;
      for (let f = 0; f < frames; f += 1) {
        state = updatePipes(state.pipes, dims, dt, () => 0.5, CONFIG, gh, state.nextPipeId, state.distanceSincePipe);
        // Sort by x and check adjacent left-edge gaps.
        const sorted = [...state.pipes].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i += 1) {
          const delta = sorted[i].x - sorted[i - 1].x;
          assert.ok(Math.abs(delta - spacing) < 1e-6, `delta ${delta} vs spacing ${spacing}`);
        }
      }
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 13: Pipe gaps respect margins and fixed height
test('Property 13: Pipe gaps respect margins and fixed height', () => {
  fc.assert(
    fc.property(dimsArb, fc.double({ min: 0, max: 0.9999, noNaN: true }), (dims, r) => {
      const gh = ghostyHeightOf(dims);
      const pipe = generatePipe(dims, () => r, dims.width, CONFIG, gh, 0);
      const margin = CONFIG.PIPE_GAP_MARGIN_FACTOR * dims.height;
      const groundTop = dims.height - dims.groundHeight;
      const gapHeight = CONFIG.PIPE_GAP_GHOSTY_MULTIPLE * gh;
      // Only assert when there's room for a legal gap.
      if (groundTop - 2 * margin - gapHeight >= -1e-9) {
        assert.ok(pipe.gapTop >= margin - 1e-6);
        assert.ok(pipe.gapBottom <= groundTop - margin + 1e-6);
      }
      assert.ok(Math.abs((pipe.gapBottom - pipe.gapTop) - gapHeight) < 1e-6);
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 27: Generated pipe gaps are always playable
test('Property 27: Generated pipe gaps are always playable', () => {
  // Build arbitrary configs across AND beyond the tunable ranges, to prove the
  // defensive clamp in generatePipe keeps every gap inside the play area.
  const cfgArb = fc.record({
    GROUND_HEIGHT_FACTOR: fc.double({ min: 0.05, max: 0.30, noNaN: true }), // beyond the 0.18 cap
    GHOSTY_HEIGHT_FACTOR: fc.double({ min: 0.05, max: 0.20, noNaN: true }), // beyond the 0.12 cap
    PIPE_GAP_MARGIN_FACTOR: fc.double({ min: 0.05, max: 0.30, noNaN: true }), // beyond the 0.15 cap
    PIPE_GAP_GHOSTY_MULTIPLE: fc.double({ min: 1.5, max: 5.0, noNaN: true }), // beyond the 3.5 cap
  });
  fc.assert(
    fc.property(dimsArb, cfgArb, fc.double({ min: 0, max: 0.9999, noNaN: true }), (dimsBase, over, r) => {
      const config = { ...CONFIG, ...over };
      const dims = { ...dimsBase, groundHeight: Math.round(dimsBase.height * config.GROUND_HEIGHT_FACTOR) };
      const groundTop = dims.height - dims.groundHeight;
      const gh = dims.height * config.GHOSTY_HEIGHT_FACTOR;
      const pipe = generatePipe(dims, () => r, dims.width, config, gh, 0);

      // The gap stays within [0, groundTop]: it never pokes above the ceiling
      // nor overflows into the ground strip.
      assert.ok(pipe.gapTop >= -1e-6, `gapTop ${pipe.gapTop}`);
      assert.ok(pipe.gapBottom <= groundTop + 1e-6, `gapBottom ${pipe.gapBottom} vs groundTop ${groundTop}`);
      // Both pipe segments have non-negative height.
      assert.ok(pipe.gapTop <= pipe.gapBottom, 'gapTop below gapBottom');
      assert.ok(groundTop - pipe.gapBottom >= -1e-6, 'bottom segment non-negative');
      // The gap itself is positive (a passable opening exists).
      assert.ok(pipe.gapBottom - pipe.gapTop > 0, 'gap has positive height');
    }),
    RUNS
  );
});

// Feature: flappy-kiro, Property 14: Off-screen pipes are culled
test('Property 14: Off-screen pipes are culled', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({ x: fc.double({ min: -500, max: 1000, noNaN: true }), width: fc.double({ min: 5, max: 100, noNaN: true }) }),
        { maxLength: 20 }
      ),
      (raw) => {
        const pipes = raw.map((p, i) => ({ id: i, ...p, gapTop: 10, gapBottom: 80, scored: false }));
        const kept = cullPipes(pipes);
        for (const p of pipes) {
          const offScreen = p.x + p.width < 0;
          const present = kept.some((k) => k.id === p.id);
          assert.equal(present, !offScreen);
        }
      }
    ),
    RUNS
  );
});
