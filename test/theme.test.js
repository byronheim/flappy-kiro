// Property and example tests for the pure theme module (Color_Palette +
// Environments). Runs directly in Node; no DOM.
// Design "Correctness Properties > Property 21".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  COLOR_PALETTE,
  ENVIRONMENTS,
  DEFAULT_COLOR_ID,
  DEFAULT_ENVIRONMENT_ID,
  FLAIR_SLOTS,
  FLAIR_ITEMS,
  resolveColor,
  resolveEnvironment,
  resolveAppearance,
  resolveFlair,
  resolveFlairSelection,
  flairForSlot,
  isColorId,
  isEnvironmentId,
  isFlairId,
} from '../src/core/theme.js';

const RUNS = { numRuns: 100 };

const colorIds = COLOR_PALETTE.map((c) => c.id);
const envIds = ENVIRONMENTS.map((e) => e.id);

// Feature: flappy-kiro, Property 21: Appearance resolution always yields a valid, complete theme
test('Property 21: Appearance resolution always yields a valid, complete theme', () => {
  // Mix valid ids, unknown strings, and non-string junk for both fields.
  const idArb = fc.oneof(
    fc.constantFrom(...colorIds, ...envIds),
    fc.string(),
    fc.constant(undefined),
    fc.integer(),
  );
  fc.assert(
    fc.property(
      fc.record({ colorId: idArb, environmentId: idArb }, { withDeletedKeys: true }),
      (selection) => {
        const a = resolveAppearance(selection);
        // Color is always a palette member.
        assert.ok(colorIds.includes(a.colorId));
        assert.equal(a.color.id, a.colorId);
        assert.ok(COLOR_PALETTE.includes(a.color));
        // Environment is always a known environment.
        assert.ok(envIds.includes(a.environmentId));
        assert.equal(a.environment.id, a.environmentId);
        assert.ok(ENVIRONMENTS.includes(a.environment));

        // A valid id is preserved; an invalid/missing one falls back to default.
        if (typeof selection.colorId === 'string' && colorIds.includes(selection.colorId)) {
          assert.equal(a.colorId, selection.colorId);
        } else {
          assert.equal(a.colorId, DEFAULT_COLOR_ID);
        }
        if (typeof selection.environmentId === 'string' && envIds.includes(selection.environmentId)) {
          assert.equal(a.environmentId, selection.environmentId);
        } else {
          assert.equal(a.environmentId, DEFAULT_ENVIRONMENT_ID);
        }
      }
    ),
    RUNS
  );
});

test('the default environment reproduces the original sky look (Req 16.2)', () => {
  const env = resolveEnvironment(DEFAULT_ENVIRONMENT_ID);
  assert.equal(env.id, 'sky');
  assert.equal(env.sky, '#7ec4e6'); // original sky-blue
  assert.equal(env.pipe, '#4caf3e'); // original green pipe
  assert.equal(env.ground, '#3a4652'); // original ground
});

test('the palette and environment sets are non-empty and have a default member', () => {
  assert.ok(COLOR_PALETTE.length > 0);
  assert.ok(ENVIRONMENTS.length > 0);
  assert.ok(isColorId(DEFAULT_COLOR_ID));
  assert.ok(isEnvironmentId(DEFAULT_ENVIRONMENT_ID));
});

test('resolveColor / resolveEnvironment fall back to defaults on unknown ids (Req 11.5, 16.6)', () => {
  assert.equal(resolveColor('nope').id, DEFAULT_COLOR_ID);
  assert.equal(resolveColor(undefined).id, DEFAULT_COLOR_ID);
  assert.equal(resolveEnvironment('lava-world').id, DEFAULT_ENVIRONMENT_ID);
  assert.equal(resolveEnvironment(undefined).id, DEFAULT_ENVIRONMENT_ID);
});

test('every environment defines all palette slots as strings (Req 16.1)', () => {
  for (const env of ENVIRONMENTS) {
    for (const slot of ['sky', 'ground', 'pipe', 'pipeCap', 'cloud', 'hud']) {
      assert.equal(typeof env[slot], 'string', `${env.id}.${slot}`);
      assert.ok(env[slot].length > 0);
    }
  }
});

test('color ids are unique and environment ids are unique', () => {
  assert.equal(new Set(colorIds).size, colorIds.length);
  assert.equal(new Set(envIds).size, envIds.length);
});

// --- Flair (Req 12) ----------------------------------------------------------

const flairIds = FLAIR_ITEMS.map((f) => f.id);

// Feature: flappy-kiro, Property 25: Flair resolution respects slots and validates membership
test('Property 25: Flair resolution respects slots and validates membership', () => {
  const idArb = fc.oneof(
    fc.constantFrom(...flairIds),
    fc.string(),
    fc.constant(undefined),
    fc.integer(),
  );
  // Build a raw selection keyed by arbitrary slot names (valid and invalid).
  const slotArb = fc.constantFrom(...FLAIR_SLOTS, 'bogusSlot');
  fc.assert(
    fc.property(fc.dictionary(slotArb, idArb), (selection) => {
      const resolved = resolveFlairSelection(selection);
      // Every known slot is present; no extra slots leak in.
      assert.deepEqual(Object.keys(resolved).sort(), [...FLAIR_SLOTS].sort());
      for (const slot of FLAIR_SLOTS) {
        const item = resolved[slot];
        if (item !== null) {
          // A returned item is a real item and belongs to the slot it is under.
          assert.ok(FLAIR_ITEMS.includes(item));
          assert.equal(item.slot, slot);
          // It matches the requested id only when that id was a valid member of this slot.
          const requested = selection[slot];
          assert.equal(item.id, requested);
        } else {
          // Empty slot: the requested id (if any) was unknown or wrong-slot.
          const requested = selection[slot];
          const valid = typeof requested === 'string' && flairForSlot(slot).some((f) => f.id === requested);
          assert.equal(valid, false);
        }
      }
    }),
    RUNS
  );
});

test('every flair item belongs to exactly one known slot (Req 12.1)', () => {
  for (const item of FLAIR_ITEMS) {
    assert.ok(FLAIR_SLOTS.includes(item.slot), `${item.id} slot`);
    assert.equal(typeof item.kind, 'string');
  }
  assert.equal(new Set(flairIds).size, flairIds.length); // unique ids
});

test('flairForSlot returns only that slot’s items; resolveFlair/isFlairId validate', () => {
  for (const slot of FLAIR_SLOTS) {
    for (const item of flairForSlot(slot)) assert.equal(item.slot, slot);
  }
  assert.equal(resolveFlair('nope'), null);
  assert.equal(isFlairId('baseballCap'), true);
  assert.equal(isFlairId('nope'), false);
});

test('a wrong-slot id resolves that slot to empty (Req 12.7)', () => {
  // 'necktie' is a neck item; placing it in the hat slot must not apply it.
  const resolved = resolveFlairSelection({ hat: 'necktie' });
  assert.equal(resolved.hat, null);
});

test('resolveAppearance carries validated flair and persistable flairIds (Req 12.4)', () => {
  const a = resolveAppearance({ flair: { hat: 'cowboyHat', neck: 'scarfRed' } });
  assert.equal(a.flair.hat.id, 'cowboyHat');
  assert.equal(a.flair.neck.id, 'scarfRed');
  assert.deepEqual(a.flairIds, { hat: 'cowboyHat', neck: 'scarfRed' });
  // Idempotent: re-resolving a resolved appearance preserves flair.
  const b = resolveAppearance(a);
  assert.deepEqual(b.flairIds, { hat: 'cowboyHat', neck: 'scarfRed' });
});

test('missing or empty flair resolves every slot to null (Req 12.8)', () => {
  const a = resolveAppearance({});
  assert.equal(a.flair.hat, null);
  assert.equal(a.flair.neck, null);
  assert.deepEqual(a.flairIds, { hat: null, neck: null });
});
