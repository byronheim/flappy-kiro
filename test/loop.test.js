// Example/edge test for the frame loop's visibility pause and dt clamping.
// Design "Testing Strategy > Example and edge-case tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/constants.js';
import { createWorld } from '../src/core/engine.js';
import { States } from '../src/core/stateMachine.js';
import { startLoop } from '../src/shell/loop.js';

// Controllable requestAnimationFrame + document stub.
function makeEnv() {
  let nextId = 1;
  const pending = new Map();
  const docListeners = new Map();
  const doc = {
    hidden: false,
    addEventListener: (type, fn) => {
      const arr = docListeners.get(type) || [];
      arr.push(fn);
      docListeners.set(type, arr);
    },
    removeEventListener: (type, fn) => {
      const arr = docListeners.get(type) || [];
      docListeners.set(type, arr.filter((f) => f !== fn));
    },
    dispatch: (type) => {
      for (const fn of docListeners.get(type) || []) fn();
    },
  };
  const env = {
    document: doc,
    requestAnimationFrame: (fn) => {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => pending.delete(id),
  };
  // Advance exactly one queued frame at the given timestamp.
  const tick = (timestamp) => {
    // Grab the most recently scheduled callback (the loop reschedules itself).
    const entries = [...pending.entries()];
    if (entries.length === 0) return;
    const [id, fn] = entries[entries.length - 1];
    pending.delete(id);
    fn(timestamp);
  };
  return { env, doc, tick };
}

function harness() {
  const dims = { width: 400, height: 600, groundHeight: Math.round(600 * CONFIG.GROUND_HEIGHT_FACTOR) };
  let world = { ...createWorld(dims, 0, CONFIG, () => 0.5), status: States.PLAYING, ghosty: { x: 100, y: 300, vy: 0, w: 60, h: 60 } };
  const rendered = [];
  return {
    dims,
    getState: () => world,
    setState: (w) => { world = w; },
    input: { drain: () => ({ flap: false }) },
    render: (w) => rendered.push({ y: w.ghosty.y }),
    audio: { play: () => {} },
    storage: { saveHighScore: () => {} },
    getConfig: () => CONFIG,
    rng: () => 0.5,
    rendered,
    peek: () => world,
  };
}

test('visibility pause: a hidden->visible cycle does not advance using the hidden interval (Req 10.4)', () => {
  const { env, doc, tick } = makeEnv();
  const h = harness();
  const loop = startLoop({ ...h, env });

  tick(1000); // first frame: establishes lastTimestamp, no sim advance
  const yAfterFirst = h.peek().ghosty.y;

  // Hide the tab, then let a long interval pass while hidden.
  doc.hidden = true;
  doc.dispatch('visibilitychange');
  tick(1016);
  tick(6000); // 5s elapsed while hidden
  const yWhileHidden = h.peek().ghosty.y;
  assert.equal(yWhileHidden, yAfterFirst, 'no advance while hidden');

  // Become visible again; the next frame must NOT apply the 5s hidden gap.
  doc.hidden = false;
  doc.dispatch('visibilitychange');
  tick(6016); // re-establishes lastTimestamp (no advance this frame)
  const yAfterResume = h.peek().ghosty.y;
  assert.equal(yAfterResume, yAfterFirst, 'resume frame re-syncs the clock, no huge dt');

  // A normal ~16ms frame now advances by a small clamped dt only.
  tick(6032);
  const yAfterNormal = h.peek().ghosty.y;
  assert.ok(yAfterNormal > yAfterResume, 'advances after resume');
  // The advance corresponds to a single clamped frame, not 5 seconds of fall.
  assert.ok(yAfterNormal - yAfterResume < 50, 'advance is one clamped frame, not the hidden interval');

  loop.stop();
});

test('dt is clamped to DT_MAX for a long frame', () => {
  const { env, tick } = makeEnv();
  const h = harness();
  const loop = startLoop({ ...h, env });

  tick(0); // establish clock
  tick(100000); // a 100s gap in one frame
  const g = h.peek().ghosty;
  // One clamped step: vy increased by gravity*DT_MAX only.
  assert.ok(Math.abs(g.vy - CONFIG.GRAVITY * CONFIG.DT_MAX) < 1e-6);
  loop.stop();
});
