// Property and example tests for the storage shell with a stubbed localStorage.
// Design "Correctness Properties > Property 19" and "Example and edge-case tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import { loadHighScore, saveHighScore } from '../src/shell/storage.js';

const RUNS = { numRuns: 100 };

function makeStore(initial = {}, { throwOnSet = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new Error('quota exceeded');
      map.set(k, String(v));
    },
    _map: map,
  };
}

// Feature: flappy-kiro, Property 19: High-score load validates its input
test('Property 19: High-score load validates its input', () => {
  fc.assert(
    fc.property(fc.string(), (stored) => {
      const store = makeStore({ [CONFIG.HIGH_SCORE_KEY]: stored });
      const result = loadHighScore(CONFIG, store);
      const n = Number(stored);
      if (stored !== '' && Number.isInteger(n) && n >= 0) {
        assert.equal(result, n);
      } else {
        assert.equal(result, 0);
      }
    }),
    RUNS
  );

  // Also cover arbitrary integers serialized as strings.
  fc.assert(
    fc.property(fc.integer(), (value) => {
      const store = makeStore({ [CONFIG.HIGH_SCORE_KEY]: String(value) });
      const result = loadHighScore(CONFIG, store);
      assert.equal(result, value >= 0 ? value : 0);
    }),
    RUNS
  );
});

test('a valid stored value loads (Req 8.4)', () => {
  const store = makeStore({ [CONFIG.HIGH_SCORE_KEY]: '42' });
  assert.equal(loadHighScore(CONFIG, store), 42);
});

test('missing key loads 0 (Req 8.5)', () => {
  const store = makeStore({});
  assert.equal(loadHighScore(CONFIG, store), 0);
});

test('setItem throwing is swallowed and does not throw (Req 8.3)', () => {
  const store = makeStore({}, { throwOnSet: true });
  assert.doesNotThrow(() => saveHighScore(10, CONFIG, store));
});

test('saveHighScore writes the value when storage works', () => {
  const store = makeStore({});
  saveHighScore(7, CONFIG, store);
  assert.equal(store._map.get(CONFIG.HIGH_SCORE_KEY), '7');
});
