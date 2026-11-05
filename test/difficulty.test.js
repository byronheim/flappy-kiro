// Tests for the difficulty presets and their integration with config resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as DEFAULTS } from '../src/core/constants.js';
import {
  Difficulties,
  DEFAULT_DIFFICULTY,
  isDifficulty,
  configForDifficulty,
} from '../src/core/difficulty.js';
import { resolveConfig } from '../src/shell/config.js';

test('Normal difficulty equals the defaults (constants.js)', () => {
  const cfg = configForDifficulty(Difficulties.NORMAL);
  for (const key of Object.keys(DEFAULTS)) {
    assert.deepEqual(cfg[key], DEFAULTS[key], `key ${key}`);
  }
});

test('default difficulty is Normal', () => {
  assert.equal(DEFAULT_DIFFICULTY, Difficulties.NORMAL);
});

test('each preset returns a frozen full config of the constants shape', () => {
  for (const name of Object.values(Difficulties)) {
    const cfg = configForDifficulty(name);
    assert.ok(Object.isFrozen(cfg));
    assert.deepEqual(Object.keys(cfg).sort(), Object.keys(DEFAULTS).sort());
  }
});

test('Easy is more forgiving than Hard across the key parameters', () => {
  const easy = configForDifficulty(Difficulties.EASY);
  const hard = configForDifficulty(Difficulties.HARD);
  // Wider gaps on Easy.
  assert.ok(easy.PIPE_GAP_GHOSTY_MULTIPLE > hard.PIPE_GAP_GHOSTY_MULTIPLE);
  // Slower scroll on Easy.
  assert.ok(easy.PIPE_SPEED_FACTOR < hard.PIPE_SPEED_FACTOR);
  // Gentler gravity on Easy.
  assert.ok(easy.GRAVITY < hard.GRAVITY);
  // More spacing between pipes on Easy.
  assert.ok(easy.PIPE_SPACING_FACTOR > hard.PIPE_SPACING_FACTOR);
});

test('tunable fields stay within their requirement ranges for every preset', () => {
  for (const name of Object.values(Difficulties)) {
    const cfg = configForDifficulty(name);
    assert.ok(cfg.GRAVITY >= 800 && cfg.GRAVITY <= 2400, `${name} gravity`);
    assert.ok(cfg.FLAP_IMPULSE >= 300 && cfg.FLAP_IMPULSE <= 700, `${name} flap`);
  }
});

test('isDifficulty validates names', () => {
  assert.equal(isDifficulty('easy'), true);
  assert.equal(isDifficulty('nope'), false);
  assert.equal(isDifficulty(undefined), false);
});

test('unknown difficulty falls back to the default', () => {
  const cfg = configForDifficulty('bogus');
  assert.deepEqual(cfg, configForDifficulty(DEFAULT_DIFFICULTY));
});

test('resolveConfig uses a difficulty base; tunable fields layer over it, invariants stay locked', () => {
  // A tunable gameplay override applies over the difficulty base (new behavior).
  const cfg = resolveConfig({ difficulty: Difficulties.HARD, global: { PIPE_SPEED_FACTOR: 0.3 } });
  assert.equal(cfg.PIPE_SPEED_FACTOR, 0.3);
  // Another tunable field within range also applies over the base.
  const cfg2 = resolveConfig({ difficulty: Difficulties.HARD, global: { GRAVITY: 2100 } });
  assert.equal(cfg2.GRAVITY, 2100);
  // True invariants still can't be moved, even with a difficulty base.
  const cfg3 = resolveConfig({ difficulty: Difficulties.HARD, global: { RESTART_LOCKOUT_MS: 10, DT_MAX: 1 } });
  const hard = configForDifficulty(Difficulties.HARD);
  assert.equal(cfg3.RESTART_LOCKOUT_MS, hard.RESTART_LOCKOUT_MS);
  assert.equal(cfg3.DT_MAX, hard.DT_MAX);
});

test('difficulty can be selected via a URL param', () => {
  const cfg = resolveConfig({ search: '?difficulty=easy' });
  assert.equal(cfg.PIPE_GAP_GHOSTY_MULTIPLE, configForDifficulty(Difficulties.EASY).PIPE_GAP_GHOSTY_MULTIPLE);
});
