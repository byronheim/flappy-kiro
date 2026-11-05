// Example/edge tests for the config resolution shell (dev tooling).
// Design "Testing Strategy > Configuration resolution and clamping".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as DEFAULTS } from '../src/core/constants.js';
import { resolveConfig, clampConfig, withLiveOverrides } from '../src/shell/config.js';

test('default run equals pre-tuning behavior (value-equal to constants.js)', () => {
  const cfg = resolveConfig({ global: {}, search: '' });
  for (const key of Object.keys(DEFAULTS)) {
    assert.deepEqual(cfg[key], DEFAULTS[key], `key ${key}`);
  }
});

test('resolved config is frozen and has the same keys as constants.js', () => {
  const cfg = resolveConfig({ global: {}, search: '' });
  assert.ok(Object.isFrozen(cfg));
  assert.deepEqual(Object.keys(cfg).sort(), Object.keys(DEFAULTS).sort());
});

test('merge precedence: defaults <- global <- URL <- live', () => {
  const global = { GRAVITY: 900 };
  const search = '?gravity=1000';
  const base = resolveConfig({ global, search });
  assert.equal(base.GRAVITY, 1000); // URL wins over global

  const live = withLiveOverrides({ GRAVITY: 1200 }, { global, search });
  assert.equal(live.GRAVITY, 1200); // live wins over both
});

test('tunable clamping: gravity, ghosty height, flap impulse', () => {
  assert.equal(resolveConfig({ global: { GRAVITY: 99999 }, search: '' }).GRAVITY, 2400);
  assert.equal(resolveConfig({ global: { GRAVITY: 0 }, search: '' }).GRAVITY, 800);
  assert.equal(resolveConfig({ global: { GHOSTY_HEIGHT_FACTOR: 0.3 }, search: '' }).GHOSTY_HEIGHT_FACTOR, 0.15);
  assert.equal(resolveConfig({ global: { FLAP_IMPULSE: 100 }, search: '' }).FLAP_IMPULSE, 300);
  assert.equal(resolveConfig({ global: { FLAP_IMPULSE: 5000 }, search: '' }).FLAP_IMPULSE, 700);
});

test('invariant fields cannot be changed by any override', () => {
  // Only true safety/correctness invariants remain locked: the dt clamp band,
  // cloud opacity bounds, and the restart lockout.
  const cfg = resolveConfig({
    global: {
      DT_MIN: 0.5,
      DT_MAX: 2,
      CLOUD_OPACITY_MIN: 0,
      CLOUD_OPACITY_MAX: 1,
      RESTART_LOCKOUT_MS: 10,
    },
    search: '?difficulty=normal',
  });
  assert.equal(cfg.DT_MIN, DEFAULTS.DT_MIN);
  assert.equal(cfg.DT_MAX, DEFAULTS.DT_MAX);
  assert.equal(cfg.CLOUD_OPACITY_MIN, DEFAULTS.CLOUD_OPACITY_MIN);
  assert.equal(cfg.CLOUD_OPACITY_MAX, DEFAULTS.CLOUD_OPACITY_MAX);
  assert.equal(cfg.RESTART_LOCKOUT_MS, DEFAULTS.RESTART_LOCKOUT_MS);
});

test('previously-locked gameplay fields are now tunable within range', () => {
  // In-range values apply as given.
  const inRange = resolveConfig({
    global: {
      PIPE_SPEED_FACTOR: 0.5,
      PIPE_SPACING_FACTOR: 0.7,
      PIPE_GAP_GHOSTY_MULTIPLE: 3.0,
      MAX_FALL_SPEED: 1000,
    },
  });
  assert.equal(inRange.PIPE_SPEED_FACTOR, 0.5);
  assert.equal(inRange.PIPE_SPACING_FACTOR, 0.7);
  assert.equal(inRange.PIPE_GAP_GHOSTY_MULTIPLE, 3.0);
  assert.equal(inRange.MAX_FALL_SPEED, 1000);

  // Out-of-range values clamp to the nearest bound (never applied raw).
  const clamped = resolveConfig({
    global: {
      PIPE_SPEED_FACTOR: 9, // -> 0.8
      PIPE_GAP_MARGIN_FACTOR: 0.0001, // -> 0.05
      MAX_FALL_SPEED: 50, // -> 600
    },
  });
  assert.equal(clamped.PIPE_SPEED_FACTOR, 0.8);
  assert.equal(clamped.PIPE_GAP_MARGIN_FACTOR, 0.05);
  assert.equal(clamped.MAX_FALL_SPEED, 600);

  // URL aliases also work for the newly tunable fields.
  const viaUrl = resolveConfig({ search: '?pipeSpacing=0.9&gapMultiple=2.0' });
  assert.equal(viaUrl.PIPE_SPACING_FACTOR, 0.9);
  assert.equal(viaUrl.PIPE_GAP_GHOSTY_MULTIPLE, 2.0);
});

test('unknown keys are ignored', () => {
  const cfg = resolveConfig({ global: { wobble: 3 }, search: '?wiggle=5' });
  assert.ok(!('wobble' in cfg));
  assert.ok(!('wiggle' in cfg));
  // and nothing else changed
  assert.equal(cfg.GRAVITY, DEFAULTS.GRAVITY);
});

test('malformed/NaN values are never applied raw', () => {
  const cfg = resolveConfig({ global: { GRAVITY: 'not-a-number' }, search: '' });
  assert.equal(cfg.GRAVITY, DEFAULTS.GRAVITY);
  const cfg2 = resolveConfig({ global: {}, search: '?gravity=abc' });
  assert.equal(cfg2.GRAVITY, DEFAULTS.GRAVITY);
});

test('clampConfig is pure and reusable', () => {
  const out = clampConfig(DEFAULTS, { GRAVITY: 2000 });
  assert.equal(out.GRAVITY, 2000);
  assert.equal(DEFAULTS.GRAVITY, 1600); // base untouched
});
