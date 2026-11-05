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
  loadBestDistance,
  saveBestDistance,
} from '../src/shell/storage.js';
import { COLOR_PALETTE, ENVIRONMENTS, FLAIR_SLOTS, FLAIR_ITEMS, flairForSlot, resolveAppearance } from '../src/core/theme.js';

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

// --- Flair persistence (Req 12.5, 12.6, 12.8, 12.9) --------------------------

// Feature: flappy-kiro, Property 26: Flair persistence round-trips valid selections and clears empties
test('Property 26: Flair persistence round-trips valid selections and clears empties', () => {
  // For each slot, pick either an item id from that slot or null (clear).
  const slotArb = (slot) => fc.oneof(fc.constant(null), fc.constantFrom(...flairForSlot(slot).map((f) => f.id)));
  const selArb = fc.record(Object.fromEntries(FLAIR_SLOTS.map((s) => [s, slotArb(s)])));

  fc.assert(
    fc.property(selArb, (flair) => {
      const store = makeStore({});
      saveAppearance({ colorId: 'ghost', environmentId: 'sky', flair }, store);
      const loaded = loadAppearance(store);
      const resolved = resolveAppearance(loaded);
      for (const slot of FLAIR_SLOTS) {
        if (flair[slot] == null) {
          assert.equal(resolved.flair[slot], null); // cleared slot stays empty (Req 12.8)
        } else {
          assert.equal(resolved.flair[slot].id, flair[slot]); // round-trips (Req 12.5, 12.6)
        }
      }
    }),
    RUNS
  );

  // Corrupt stored value -> all slots empty (Req 12.9).
  fc.assert(
    fc.property(fc.string(), (junk) => {
      const store = makeStore({ [CONFIG.HIGH_SCORE_KEY]: '0' });
      store._map.set('flappyKiro.appearance', junk);
      const resolved = resolveAppearance(loadAppearance(store));
      for (const slot of FLAIR_SLOTS) assert.equal(resolved.flair[slot], null);
    }),
    RUNS
  );
});

test('clearing a flair slot persists as empty and does not resurrect on load (Req 12.8)', () => {
  const store = makeStore({});
  saveAppearance({ colorId: 'ghost', environmentId: 'sky', flair: { hat: 'beanie', neck: 'scarfBlue' } }, store);
  // Now clear the hat.
  saveAppearance({ colorId: 'ghost', environmentId: 'sky', flair: { hat: null, neck: 'scarfBlue' } }, store);
  const resolved = resolveAppearance(loadAppearance(store));
  assert.equal(resolved.flair.hat, null);
  assert.equal(resolved.flair.neck.id, 'scarfBlue');
});

test('loadAppearance keeps only string flair ids; non-string ids are dropped', () => {
  const store = makeStore({
    [APPEARANCE_KEY]: JSON.stringify({ colorId: 'ghost', environmentId: 'sky', flair: { hat: 7, neck: 'scarfRed' } }),
  });
  const loaded = loadAppearance(store);
  const resolved = resolveAppearance(loaded);
  assert.equal(resolved.flair.hat, null);
  assert.equal(resolved.flair.neck.id, 'scarfRed');
});

// --- Best distance persistence (load half of Property 24; Req 13.6, 13.7) ----

// Feature: flappy-kiro, Property 24: Best distance load validates, and improvement persists
test('Property 24 (load): best distance load validates its input', () => {
  fc.assert(
    fc.property(fc.string(), (stored) => {
      const store = makeStore({ [CONFIG.BEST_DISTANCE_KEY]: stored });
      const result = loadBestDistance(CONFIG, store);
      const n = Number(stored);
      if (stored !== '' && Number.isFinite(n) && n > 0) {
        assert.equal(result, n);
      } else {
        // Empty, non-finite, negative, and both signed zeros all load as 0.
        assert.equal(result, 0);
      }
    }),
    RUNS
  );

  // Arbitrary finite numbers (including floats) serialized as strings.
  fc.assert(
    fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
      const store = makeStore({ [CONFIG.BEST_DISTANCE_KEY]: String(value) });
      const result = loadBestDistance(CONFIG, store);
      // Both +0 and -0 normalize to 0; otherwise a positive value round-trips.
      assert.equal(result, value > 0 ? value : 0);
    }),
    RUNS
  );
});

test('a valid stored best distance loads, including floats (Req 13.6)', () => {
  const store = makeStore({ [CONFIG.BEST_DISTANCE_KEY]: '1234.5' });
  assert.equal(loadBestDistance(CONFIG, store), 1234.5);
});

test('missing best distance loads 0 (Req 13.7)', () => {
  const store = makeStore({});
  assert.equal(loadBestDistance(CONFIG, store), 0);
});

test('negative or non-numeric best distance loads 0 (Req 13.7)', () => {
  assert.equal(loadBestDistance(CONFIG, makeStore({ [CONFIG.BEST_DISTANCE_KEY]: '-5' })), 0);
  assert.equal(loadBestDistance(CONFIG, makeStore({ [CONFIG.BEST_DISTANCE_KEY]: 'abc' })), 0);
});

test('saveBestDistance writes the value and swallows failures (Req 13.5)', () => {
  const store = makeStore({});
  saveBestDistance(42.5, CONFIG, store);
  assert.equal(store._map.get(CONFIG.BEST_DISTANCE_KEY), '42.5');
  const throwing = makeStore({}, { throwOnSet: true });
  assert.doesNotThrow(() => saveBestDistance(10, CONFIG, throwing));
});
