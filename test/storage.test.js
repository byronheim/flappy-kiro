// Property and example tests for the storage shell with a stubbed localStorage.
// Design "Correctness Properties > Property 19" and "Example and edge-case tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CONFIG } from '../src/core/constants.js';
import {
  loadHighScore,
  saveHighScore,
  loadAppearance,
  saveAppearance,
  APPEARANCE_KEY,
} from '../src/shell/storage.js';
import { COLOR_PALETTE, ENVIRONMENTS, resolveAppearance } from '../src/core/theme.js';

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

// --- Appearance persistence (Req 11.3/11.4, 16) ------------------------------

const colorIds = COLOR_PALETTE.map((c) => c.id);
const envIds = ENVIRONMENTS.map((e) => e.id);

// Feature: flappy-kiro, Property 22: Appearance persistence round-trips valid selections
test('Property 22: Appearance persistence round-trips valid selections', () => {
  fc.assert(
    fc.property(fc.constantFrom(...colorIds), fc.constantFrom(...envIds), (colorId, environmentId) => {
      const store = makeStore({});
      saveAppearance({ colorId, environmentId }, store);
      const loaded = loadAppearance(store);
      assert.equal(loaded.colorId, colorId);
      assert.equal(loaded.environmentId, environmentId);
      // And it resolves back to the very same selection.
      const a = resolveAppearance(loaded);
      assert.equal(a.colorId, colorId);
      assert.equal(a.environmentId, environmentId);
    }),
    RUNS
  );

  // Corrupt/non-JSON stored values load as an empty selection -> defaults.
  fc.assert(
    fc.property(fc.string(), (junk) => {
      const store = makeStore({ [APPEARANCE_KEY]: junk });
      const loaded = loadAppearance(store);
      // Either it parsed to a valid partial, or it's empty; in all cases
      // resolveAppearance yields a complete valid theme and never throws.
      assert.doesNotThrow(() => resolveAppearance(loaded));
      const a = resolveAppearance(loaded);
      assert.ok(colorIds.includes(a.colorId));
      assert.ok(envIds.includes(a.environmentId));
    }),
    RUNS
  );
});

test('missing appearance key loads as empty selection (Req 11.5, 16.6)', () => {
  const store = makeStore({});
  assert.deepEqual(loadAppearance(store), {});
});

test('corrupt appearance JSON loads as empty and does not throw', () => {
  const store = makeStore({ [APPEARANCE_KEY]: '{not json' });
  assert.doesNotThrow(() => loadAppearance(store));
  assert.deepEqual(loadAppearance(store), {});
});

test('saveAppearance setItem throwing is swallowed', () => {
  const store = makeStore({}, { throwOnSet: true });
  assert.doesNotThrow(() => saveAppearance({ colorId: 'blue', environmentId: 'forest' }, store));
});

test('loadAppearance ignores non-string id fields', () => {
  const store = makeStore({ [APPEARANCE_KEY]: JSON.stringify({ colorId: 42, environmentId: 'forest' }) });
  const loaded = loadAppearance(store);
  assert.equal(loaded.colorId, undefined);
  assert.equal(loaded.environmentId, 'forest');
});
