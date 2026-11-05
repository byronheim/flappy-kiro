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
  resolveColor,
  resolveEnvironment,
  resolveAppearance,
  isColorId,
  isEnvironmentId,
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
