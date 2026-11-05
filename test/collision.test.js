// Collision tests. Collision is a pure-core concern over Ghosty's own bounds;
// decorative flair (hats, scarves) lives only in the shell renderer and must
// never affect collision (Req 6, Req 12 clarification).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aabbOverlap, hasCollision } from '../src/core/collision.js';

const dims = { width: 400, height: 600, groundHeight: 60 };

test('aabbOverlap is a plain geometric test over the two boxes', () => {
  assert.equal(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }), false);
});

test('the collision box equals Ghosty’s own bounds — flair above/left does not extend it', () => {
  // A pipe pair with a gap. Ghosty fits inside the gap with only a hair of
  // clearance above and below its OWN bounds. A hat would stick out the top and
  // a scarf tail out the left; if either were part of the hitbox, this would
  // collide. It must not, because collision uses only ghosty.{x,y,w,h}.
  const ghosty = { x: 100, y: 200, w: 30, h: 30 };
  const pipes = [
    {
      id: 0,
      x: 95, // overlaps Ghosty horizontally
      width: 40,
      gapTop: 199, // 1px above Ghosty's top
      gapBottom: 231, // 1px below Ghosty's bottom (200 + 30)
      scored: false,
    },
  ];
  assert.equal(hasCollision(ghosty, pipes, dims), false);

  // Sanity: shrinking the gap to touch Ghosty's actual bounds DOES collide,
  // proving the box is exactly Ghosty's bounds (not smaller either).
  const tightPipes = [{ ...pipes[0], gapTop: 205 }]; // now intrudes into Ghosty
  assert.equal(hasCollision(ghosty, tightPipes, dims), true);
});

test('hasCollision ignores any extra fields on the ghosty object (e.g. appearance/flair)', () => {
  // Even if a caller stuffed decorative data onto the ghosty-like object, only
  // x/y/w/h are read. A safe-positioned Ghosty stays alive regardless.
  const decorated = {
    x: 100, y: 250, w: 30, h: 30,
    flair: { hat: 'cowboyHat', neck: 'scarfRed' }, // ignored by collision
    hatHeight: 999, scarfLength: 999, // ignored
  };
  const noPipes = [];
  assert.equal(hasCollision(decorated, noPipes, dims), false);
});
