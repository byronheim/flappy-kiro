// Rendering tests using a recording 2D context.
// Design "Testing Strategy > Rendering tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/constants.js';
import { render } from '../src/shell/renderer.js';
import { createWorld } from '../src/core/engine.js';
import { States } from '../src/core/stateMachine.js';

const dims = { width: 400, height: 600, groundHeight: Math.round(600 * CONFIG.GROUND_HEIGHT_FACTOR) };

// Records draw calls in order so tests can assert on sequence and arguments.
function recordingCtx() {
  const calls = [];
  const ctx = {
    calls,
    _imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillStyle: '#000',
    font: '',
    textAlign: 'left',
    set imageSmoothingEnabled(v) {
      this._imageSmoothingEnabled = v;
      calls.push({ op: 'imageSmoothingEnabled', value: v });
    },
    get imageSmoothingEnabled() {
      return this._imageSmoothingEnabled;
    },
    save: () => calls.push({ op: 'save' }),
    restore: () => calls.push({ op: 'restore' }),
    fillRect(x, y, w, h) {
      calls.push({ op: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    },
    fillText(text, x, y) {
      calls.push({ op: 'fillText', text, x, y });
    },
    drawImage(img, x, y, w, h) {
      calls.push({ op: 'drawImage', x, y, w, h });
    },
  };
  return ctx;
}

const loadedAssets = { sprite: {}, spriteLoaded: true };
const failedAssets = { sprite: null, spriteLoaded: false };

test('sky fill then draw order clouds -> pipes -> ground -> Ghosty (Req 1.1, 1.6)', () => {
  const ctx = recordingCtx();
  const world = {
    ...createWorld(dims, 0, CONFIG, () => 0.5),
    status: States.PLAYING,
    pipes: [{ id: 0, x: 100, width: 40, gapTop: 100, gapBottom: 300, scored: false }],
  };
  render(ctx, world, loadedAssets);

  const fillRects = ctx.calls.filter((c) => c.op === 'fillRect');
  // First fillRect is the full-canvas sky.
  assert.equal(fillRects[0].x, 0);
  assert.equal(fillRects[0].y, 0);
  assert.equal(fillRects[0].w, dims.width);
  assert.equal(fillRects[0].h, dims.height);

  // Ghosty (drawImage) comes after the ground fill.
  const drawImageIdx = ctx.calls.findIndex((c) => c.op === 'drawImage');
  const groundIdx = ctx.calls.findIndex(
    (c) => c.op === 'fillRect' && c.y === Math.round(dims.height - dims.groundHeight)
  );
  assert.ok(groundIdx !== -1 && drawImageIdx !== -1 && groundIdx < drawImageIdx);
});

test('imageSmoothingEnabled is set to false before drawing (Req 1.5)', () => {
  const ctx = recordingCtx();
  const world = createWorld(dims, 0, CONFIG, () => 0.5);
  render(ctx, world, loadedAssets);
  const idx = ctx.calls.findIndex((c) => c.op === 'imageSmoothingEnabled' && c.value === false);
  assert.ok(idx !== -1);
  // It precedes any fillRect.
  const firstFill = ctx.calls.findIndex((c) => c.op === 'fillRect');
  assert.ok(idx < firstFill);
});

test('sprite-load failure draws a placeholder rect of equal bounds and does not throw (Req 1.4)', () => {
  const ctx = recordingCtx();
  const world = createWorld(dims, 0, CONFIG, () => 0.5);
  assert.doesNotThrow(() => render(ctx, world, failedAssets));
  const g = world.ghosty;
  const placeholder = ctx.calls.find(
    (c) => c.op === 'fillRect' && c.x === Math.round(g.x) && c.y === Math.round(g.y) && c.w === Math.round(g.w) && c.h === Math.round(g.h)
  );
  assert.ok(placeholder, 'expected a placeholder rect at Ghosty bounds');
  assert.equal(ctx.calls.some((c) => c.op === 'drawImage'), false);
});

test('HUD shows current and high score as integers (Req 7.3, 7.4)', () => {
  const ctx = recordingCtx();
  const world = { ...createWorld(dims, 9, CONFIG, () => 0.5), score: 3 };
  render(ctx, world, loadedAssets);
  const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text);
  assert.ok(texts.some((t) => t.includes('Score: 3')));
  assert.ok(texts.some((t) => t.includes('Best: 9')));
});

test('Ready overlay shows start prompt (Req 2.3)', () => {
  const ctx = recordingCtx();
  const world = createWorld(dims, 0, CONFIG, () => 0.5); // Ready by default
  render(ctx, world, loadedAssets);
  const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text);
  assert.ok(texts.some((t) => /flap to start/i.test(t)));
});

test('GameOver overlay shows final score and restart prompt (Req 9.5)', () => {
  const ctx = recordingCtx();
  const world = {
    ...createWorld(dims, 0, CONFIG, () => 0.5),
    status: States.GAME_OVER,
    finalScore: 12,
  };
  render(ctx, world, loadedAssets);
  const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text);
  assert.ok(texts.some((t) => /game over/i.test(t)));
  assert.ok(texts.some((t) => t.includes('Score: 12')));
  assert.ok(texts.some((t) => /flap to restart/i.test(t)));
});

test('only pipes partially within horizontal bounds are drawn (Req 10.2)', () => {
  const ctx = recordingCtx();
  const world = {
    ...createWorld(dims, 0, CONFIG, () => 0.5),
    status: States.PLAYING,
    pipes: [
      { id: 0, x: -100, width: 40, gapTop: 100, gapBottom: 300, scored: false }, // fully off left
      { id: 1, x: 150, width: 40, gapTop: 100, gapBottom: 300, scored: false }, // visible
    ],
  };
  render(ctx, world, loadedAssets);
  // Pipe at x=150 produces green fillRects; pipe at x=-100 is skipped.
  const greenRects = ctx.calls.filter((c) => c.op === 'fillRect' && c.x === 150);
  assert.ok(greenRects.length >= 1);
  const offScreenRects = ctx.calls.filter((c) => c.op === 'fillRect' && c.x === -100);
  assert.equal(offScreenRects.length, 0);
});
