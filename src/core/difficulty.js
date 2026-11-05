// Difficulty presets. A sanctioned configuration layer (distinct from the
// dev-only override clamp in shell/config.js): each preset deliberately tunes
// the gameplay parameters that define a difficulty - pipe gap, scroll speed,
// gravity, flap velocity, pipe spacing - producing a full config of the
// constants.js shape. This is a first-class game feature, so it is allowed to
// set fields that stray dev overrides are not.
//
// Presets are expressed as multipliers/values over the defaults so they stay in
// sync if the defaults change.
import { CONFIG as DEFAULTS } from './constants.js';

export const Difficulties = Object.freeze({
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
});

export const DEFAULT_DIFFICULTY = Difficulties.NORMAL;

// Per-preset parameter overrides. NORMAL leaves the defaults untouched so the
// baseline matches the original spec behavior exactly.
const PRESETS = {
  [Difficulties.EASY]: {
    GRAVITY: 1100, // gentler fall
    FLAP_IMPULSE: 430, // softer flap to match the gentler gravity
    MAX_FALL_SPEED: 900,
    PIPE_SPEED_FACTOR: 0.26, // slower scroll
    PIPE_SPACING_FACTOR: 0.6, // more room between pipes
    PIPE_GAP_GHOSTY_MULTIPLE: 4.0, // wider gaps (within [1.5, 4.0])
  },
  [Difficulties.NORMAL]: {
    // Baseline: identical to the defaults.
  },
  [Difficulties.HARD]: {
    GRAVITY: 2000, // snappier, heavier fall
    FLAP_IMPULSE: 560, // stronger flap needed to counter it
    MAX_FALL_SPEED: 1400,
    PIPE_SPEED_FACTOR: 0.46, // faster scroll
    PIPE_SPACING_FACTOR: 0.42, // pipes come more often
    PIPE_GAP_GHOSTY_MULTIPLE: 2.4, // tighter gaps
  },
};

/**
 * @param {string} name  one of Difficulties.*
 * @returns {boolean}
 */
export function isDifficulty(name) {
  return Object.values(Difficulties).includes(name);
}

/**
 * Resolve a difficulty name to a frozen, full config object of the constants.js
 * shape. Unknown names fall back to the default difficulty.
 *
 * @param {string} [name]
 * @returns {object} frozen config
 */
export function configForDifficulty(name) {
  const key = isDifficulty(name) ? name : DEFAULT_DIFFICULTY;
  const overrides = PRESETS[key] || {};
  return Object.freeze({ ...DEFAULTS, ...overrides });
}
