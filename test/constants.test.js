// Example tests for the DEFAULTS layer (constants.js).
// Design "Testing Strategy > Example and edge-case tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/constants.js';

test('GRAVITY default is within [800, 2400] (Req 4.1)', () => {
  assert.ok(CONFIG.GRAVITY >= 800 && CONFIG.GRAVITY <= 2400);
});

test('FLAP_IMPULSE default is within [300, 700] (Req 4.4)', () => {
  assert.ok(CONFIG.FLAP_IMPULSE >= 300 && CONFIG.FLAP_IMPULSE <= 700);
  assert.equal(CONFIG.FLAP_IMPULSE_MIN, 300);
  assert.equal(CONFIG.FLAP_IMPULSE_MAX, 700);
});

test('resolved ground height is within [5%, 20%] of play height (Req 1.2)', () => {
  const dims = { width: 400, height: 600, groundHeight: 0 };
  const groundHeight = CONFIG.GROUND_HEIGHT_FACTOR * dims.height;
  assert.ok(groundHeight >= 0.05 * dims.height && groundHeight <= 0.2 * dims.height);
});

test('resolved Ghosty height is within [5%, 15%] of play height (Req 1.3)', () => {
  const dims = { width: 400, height: 600, groundHeight: 0 };
  const ghostyHeight = CONFIG.GHOSTY_HEIGHT_FACTOR * dims.height;
  assert.ok(ghostyHeight >= 0.05 * dims.height && ghostyHeight <= 0.15 * dims.height);
});

test('exported CONFIG is frozen', () => {
  assert.ok(Object.isFrozen(CONFIG));
  assert.ok(Object.isFrozen(CONFIG.CLOUD_LAYER_FACTORS));
});
