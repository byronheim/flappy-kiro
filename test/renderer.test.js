// Rendering tests using a recording 2D context.
// Design "Testing Strategy > Rendering tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/constants.js';
import { render, getTintedSprite } from '../src/shell/renderer.js';
import { createWorld } from '../src/core/engine.js';
import { States } from '../src/core/stateMachine.js';
import { resolveEnvironment } from '../src/core/theme.js';

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
    globalCompositeOperation: 'source-over',
    beginPath() {
      calls.push({ op: 'beginPath' });
    },
    moveTo(x, y) {
      calls.push({ op: 'moveTo', x, y });
    },
    arc(x, y, r, start, end) {
      calls.push({ op: 'arc', x, y, r, start, end });
    },
    closePath() {
      calls.push({ op: 'closePath' });
    },
    fill() {
      calls.push({ op: 'fill' });
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
  assert.ok(texts.some((t) => t.includes('High: 9')));
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

// --- Environment theming (Req 16) --------------------------------------------

test('default (no appearance) renders the original sky-blue background (Req 16.2)', () => {
  const ctx = recordingCtx();
  const world = createWorld(dims, 0, CONFIG, () => 0.5);
  render(ctx, world, loadedAssets);
  const sky = ctx.calls.find((c) => c.op === 'fillRect' && c.x === 0 && c.y === 0 && c.w === dims.width && c.h === dims.height);
  assert.ok(sky);
  assert.equal(sky.fillStyle, '#7ec4e6');
});

test('selecting an environment recolors sky, pipes and ground (Req 16.3)', () => {
  const ctx = recordingCtx();
  const world = {
    ...createWorld(dims, 0, CONFIG, () => 0.5),
    status: States.PLAYING,
    pipes: [{ id: 0, x: 120, width: 40, gapTop: 100, gapBottom: 300, scored: false }],
  };
  const evil = resolveEnvironment('evilLair');
  render(ctx, world, loadedAssets, CONFIG, { environmentId: 'evilLair' });

  const sky = ctx.calls.find((c) => c.op === 'fillRect' && c.x === 0 && c.y === 0 && c.w === dims.width && c.h === dims.height);
  assert.equal(sky.fillStyle, evil.sky);

  // The pipe column uses the environment's pipe color.
  const pipeRect = ctx.calls.find((c) => c.op === 'fillRect' && c.x === 120 && c.fillStyle === evil.pipe);
  assert.ok(pipeRect, 'expected a pipe rect in the environment pipe color');

  // The ground strip uses the environment's ground color.
  const groundRect = ctx.calls.find(
    (c) => c.op === 'fillRect' && c.y === Math.round(dims.height - dims.groundHeight) && c.fillStyle === evil.ground
  );
  assert.ok(groundRect, 'expected the ground in the environment ground color');
});

test('a non-default Ghosty color draws the sprite and never paints a colored box over the scene (Req 11.2)', () => {
  const ctx = recordingCtx();
  const world = { ...createWorld(dims, 0, CONFIG, () => 0.5), status: States.PLAYING };
  render(ctx, world, loadedAssets, CONFIG, { colorId: 'red' });

  const g = world.ghosty;
  // Ghosty is drawn as an image (tint is applied offscreen, masked to the
  // sprite's own alpha - never as a full-rectangle fill on the main canvas).
  const sprite = ctx.calls.find(
    (c) => c.op === 'drawImage' && c.x === Math.round(g.x) && c.y === Math.round(g.y) &&
      c.w === Math.round(g.w) && c.h === Math.round(g.h)
  );
  assert.ok(sprite, 'expected Ghosty drawn as an image');

  // Crucially: no fillRect spanning the whole sprite box (that was the bug - a
  // tinted square around the avatar).
  const box = ctx.calls.find(
    (c) => c.op === 'fillRect' && c.x === Math.round(g.x) && c.y === Math.round(g.y) &&
      c.w === Math.round(g.w) && c.h === Math.round(g.h)
  );
  assert.equal(box, undefined, 'must not paint a colored box over the sprite region');
});

test('the default ghost color draws the sprite untinted (Req 11.5)', () => {
  const ctx = recordingCtx();
  const world = { ...createWorld(dims, 0, CONFIG, () => 0.5), status: States.PLAYING };
  render(ctx, world, loadedAssets, CONFIG, { colorId: 'ghost' });
  const g = world.ghosty;
  const sprite = ctx.calls.find(
    (c) => c.op === 'drawImage' && c.x === Math.round(g.x) && c.y === Math.round(g.y)
  );
  assert.ok(sprite, 'expected the sprite drawn');
  // No fill rect exactly over the sprite bounds.
  const box = ctx.calls.find(
    (c) => c.op === 'fillRect' && c.x === Math.round(g.x) && c.y === Math.round(g.y) &&
      c.w === Math.round(g.w) && c.h === Math.round(g.h)
  );
  assert.equal(box, undefined);
});

test('placeholder (sprite failed) uses the chosen color when not ghost (Req 1.4, 11.2)', () => {
  const ctx = recordingCtx();
  const world = createWorld(dims, 0, CONFIG, () => 0.5);
  render(ctx, world, failedAssets, CONFIG, { colorId: 'blue' });
  const g = world.ghosty;
  const placeholder = ctx.calls.find(
    (c) => c.op === 'fillRect' && c.x === Math.round(g.x) && c.y === Math.round(g.y) &&
      c.w === Math.round(g.w) && c.h === Math.round(g.h)
  );
  assert.ok(placeholder);
  assert.equal(placeholder.fillStyle, '#4a90e2');
});

test('getTintedSprite tints on an isolated offscreen canvas using source-atop (Req 11.2)', () => {
  // Fake an offscreen canvas whose 2D context records its operations, so we can
  // assert the tint is masked to the sprite (source-atop) rather than painted
  // as a full rectangle over an opaque scene.
  const octx = {
    ops: [],
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '#000',
    drawImage(img, x, y, w, h) { this.ops.push({ op: 'drawImage', x, y, w, h }); },
    fillRect(x, y, w, h) {
      this.ops.push({ op: 'fillRect', x, y, w, h, gco: this.globalCompositeOperation, alpha: this.globalAlpha });
    },
  };
  const fakeCanvas = { width: 0, height: 0, getContext: () => octx };
  const prevDoc = globalThis.document;
  globalThis.document = { createElement: (tag) => (tag === 'canvas' ? fakeCanvas : {}) };
  try {
    const sprite = { marker: 'sprite' };
    const result = getTintedSprite(sprite, '#123456', 32, 32);
    // Returns the offscreen canvas (not the raw sprite).
    assert.equal(result, fakeCanvas);
    assert.equal(fakeCanvas.width, 32);
    assert.equal(fakeCanvas.height, 32);
    // Sprite drawn first, then the color composited with source-atop.
    assert.deepEqual(octx.ops[0], { op: 'drawImage', x: 0, y: 0, w: 32, h: 32 });
    const fill = octx.ops.find((o) => o.op === 'fillRect');
    assert.ok(fill);
    assert.equal(fill.gco, 'source-atop');
    assert.ok(fill.alpha > 0 && fill.alpha < 1); // partial so sprite shading reads
  } finally {
    globalThis.document = prevDoc;
  }
});

test('getTintedSprite falls back to the sprite when no document is available', () => {
  const prevDoc = globalThis.document;
  // eslint-disable-next-line no-undef
  delete globalThis.document;
  try {
    const sprite = { marker: 'sprite' };
    assert.equal(getTintedSprite(sprite, '#654321', 32, 32), sprite);
  } finally {
    globalThis.document = prevDoc;
  }
});
