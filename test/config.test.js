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

test('locked fields cannot be changed by any override', () => {
  const cfg = resolveConfig({
    global: {
      PIPE_SPEED_FACTOR: 0.9,
      PIPE_SPACING_FACTOR: 0.1,
      PIPE_GAP_MARGIN_FACTOR: 0.5,
      PIPE_GAP_GHOSTY_MULTIPLE: 9,
      MAX_FALL_SPEED: 50,
      RESTART_LOCKOUT_MS: 10,
    },
    search: '?pipeSpeed=0.4',
  });
  assert.equal(cfg.PIPE_SPEED_FACTOR, 0.35);
  assert.equal(cfg.PIPE_SPACING_FACTOR, 0.5);
  assert.equal(cfg.PIPE_GAP_MARGIN_FACTOR, 0.1);
  assert.equal(cfg.PIPE_GAP_GHOSTY_MULTIPLE, 2.5);
  assert.equal(cfg.MAX_FALL_SPEED, 1200);
  assert.equal(cfg.RESTART_LOCKOUT_MS, 500);
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
