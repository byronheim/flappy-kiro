// Property and example tests for the input shell with synthetic DOM events.
// Design "Correctness Properties > Property 6" and "Example and edge-case tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { createInput, pointerInBounds } from '../src/shell/input.js';

const RUNS = { numRuns: 100 };

// A minimal fake event target used for both the canvas and the keyboard target.
function makeTarget(rect = { left: 0, top: 0, width: 400, height: 600 }) {
  const listeners = new Map();
  return {
    getBoundingClientRect: () => rect,
    width: rect.width,
    height: rect.height,
    addEventListener: (type, fn) => {
      const arr = listeners.get(type) || [];
      arr.push(fn);
      listeners.set(type, arr);
    },
    removeEventListener: (type, fn) => {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((f) => f !== fn));
    },
    dispatch: (type, event) => {
      for (const fn of listeners.get(type) || []) fn(event);
    },
  };
}

// Feature: flappy-kiro, Property 6: Pointer bounds decide flap eligibility
test('Property 6: Pointer bounds decide flap eligibility', () => {
  fc.assert(
    fc.property(
      fc.double({ min: -200, max: 600, noNaN: true }),
      fc.double({ min: -200, max: 800, noNaN: true }),
      (x, y) => {
        const width = 400;
        const height = 600;
        const canvas = makeTarget({ left: 0, top: 0, width, height });
        const input = createInput(canvas, makeTarget());
        canvas.dispatch('pointerdown', { clientX: x, clientY: y });
        const { flap } = input.drain();
        assert.equal(flap, pointerInBounds(x, y, width, height));
        input.destroy();
      }
    ),
    RUNS
  );
});

test('one keydown yields one flap (Req 3.1)', () => {
  const canvas = makeTarget();
  const keys = makeTarget();
  const input = createInput(canvas, keys);
  keys.dispatch('keydown', { code: 'Space', repeat: false });
  assert.equal(input.drain().flap, true);
  input.destroy();
});

test('auto-repeat keydown yields no extra flap until keyup+keydown (Req 3.2)', () => {
  const canvas = makeTarget();
  const keys = makeTarget();
  const input = createInput(canvas, keys);

  keys.dispatch('keydown', { code: 'Space', repeat: false }); // 1 flap
  assert.equal(input.drain().flap, true);

  keys.dispatch('keydown', { code: 'Space', repeat: true }); // auto-repeat ignored
  keys.dispatch('keydown', { code: 'Space', repeat: false }); // still held -> ignored
  assert.equal(input.drain().flap, false);

  keys.dispatch('keyup', { code: 'Space' });
  keys.dispatch('keydown', { code: 'Space', repeat: false }); // released then pressed -> 1 flap
  assert.equal(input.drain().flap, true);
  input.destroy();
});

test('one pointerdown inside bounds yields one flap (Req 3.3)', () => {
  const canvas = makeTarget({ left: 0, top: 0, width: 400, height: 600 });
  const input = createInput(canvas, makeTarget());
  canvas.dispatch('pointerdown', { clientX: 100, clientY: 100 });
  assert.equal(input.drain().flap, true);
  input.destroy();
});

test('drain clears the flap buffer', () => {
  const canvas = makeTarget();
  const keys = makeTarget();
  const input = createInput(canvas, keys);
  keys.dispatch('keydown', { code: 'Space', repeat: false });
  assert.equal(input.drain().flap, true);
  assert.equal(input.drain().flap, false);
  input.destroy();
});
