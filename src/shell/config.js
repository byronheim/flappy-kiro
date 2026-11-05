// Shell (developer tooling): resolve the effective CONFIG by merging layers
// and validating/clamping every value. Never alters default-config behavior:
// with no overrides, the result is value-equal to constants.js.
//
// Precedence (later wins): defaults <- window.FLAPPY_CONFIG <- URL params <- live overrides.
//
// Design "Configuration and Tuning".
import { CONFIG as DEFAULTS } from '../core/constants.js';
import { configForDifficulty, isDifficulty } from '../core/difficulty.js';

// True invariants: dev-facing overrides (global object, URL params, live panel)
// may not change these, and they are forced back to the BASE config's value.
// These are correctness/safety guards, not game-feel knobs:
//   - DT_MIN/DT_MAX: the frame-time clamp that stops a stall or a backgrounded
//     tab from teleporting Ghosty through a wall.
//   - CLOUD_OPACITY_MIN/MAX: keeps the sky visible through clouds (Req 1.7).
//   - RESTART_LOCKOUT_MS: the post-crash input lockout (Req 9.6).
// The base is normally constants.js, but a sanctioned game feature (e.g. a
// difficulty preset) may supply a different base; locking is relative to that
// base. (Design "Configuration and Tuning")
const LOCKED_KEYS = [
  'DT_MIN',
  'DT_MAX',
  'CLOUD_OPACITY_MIN',
  'CLOUD_OPACITY_MAX',
  'RESTART_LOCKOUT_MS',
];

// Range-valued fields: [min, max]. Overrides are clamped into the range. The
// gameplay fields below were previously locked to spec-fixed values; they are
// now freely tunable within sensible ranges so the game is configurable, while
// clamping still guarantees an override can never produce an invalid state.
// Note on the vertical-geometry fields (ground, ghosty height, gap margin, gap
// multiple): their maxima are chosen so that even stacked at their extremes the
// pipe gap still fits the play area with placement variety to spare. The budget
// is `2*margin + gapMultiple*ghostyHeight` against `height - groundHeight`; with
// these bounds the worst case leaves ~50px of span (generatePipe also clamps
// defensively as a final guard). Widening any of these maxima risks an
// unplayable gap, so they are deliberately conservative.
const RANGES = {
  GRAVITY: [800, 2400],
  FLAP_IMPULSE: [300, 700],
  GROUND_HEIGHT_FACTOR: [0.05, 0.18],
  GHOSTY_HEIGHT_FACTOR: [0.05, 0.12],
  // Newly tunable gameplay parameters:
  PIPE_SPEED_FACTOR: [0.1, 0.8], // play-area widths per second
  PIPE_SPACING_FACTOR: [0.3, 1.0], // * play-area width between pipe pairs
  PIPE_GAP_MARGIN_FACTOR: [0.05, 0.15], // * play-area height, top & bottom
  PIPE_GAP_GHOSTY_MULTIPLE: [1.5, 3.5], // gap height = N * Ghosty height
  MAX_FALL_SPEED: [600, 1800], // px/s cap on downward velocity
};

// Friendly URL aliases -> CONFIG keys.
const URL_ALIASES = {
  gravity: 'GRAVITY',
  flapImpulse: 'FLAP_IMPULSE',
  groundHeight: 'GROUND_HEIGHT_FACTOR',
  ghostyHeight: 'GHOSTY_HEIGHT_FACTOR',
  cloudMinSpeed: 'CLOUD_MIN_SPEED',
  pipeSpeed: 'PIPE_SPEED_FACTOR',
  pipeSpacing: 'PIPE_SPACING_FACTOR',
  gapMargin: 'PIPE_GAP_MARGIN_FACTOR',
  gapMultiple: 'PIPE_GAP_GHOSTY_MULTIPLE',
  maxFallSpeed: 'MAX_FALL_SPEED',
};

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Clamp/lock a raw partial onto a base config. Pure and reusable by tests.
 * Unknown keys and malformed values are ignored (never applied raw).
 *
 * @param {object} base   a full config of the constants.js shape
 * @param {object} rawPartial
 * @returns {object} a frozen config of the same shape
 */
export function clampConfig(base, rawPartial) {
  const out = { ...base };
  const partial = rawPartial || {};

  for (const key of Object.keys(partial)) {
    if (!(key in DEFAULTS)) continue; // unknown key ignored

    // Locked: force back to the base value regardless of the override. The base
    // defines the authoritative value (constants.js by default, or a difficulty
    // preset), so a stray dev override cannot move it.
    if (LOCKED_KEYS.includes(key)) {
      out[key] = base[key];
      continue;
    }

    const value = Number(partial[key]);
    if (Number.isNaN(value) || !Number.isFinite(value)) continue; // malformed ignored

    if (key in RANGES) {
      const [min, max] = RANGES[key];
      out[key] = clamp(value, min, max);
    } else if (key === 'CLOUD_MIN_SPEED') {
      out[key] = value > 0 ? value : base[key]; // must be > 0
    } else {
      // Other numeric keys not explicitly tunable: ignore to be safe.
      continue;
    }
  }

  // Locked fields always keep the base value even if absent from the override.
  for (const key of LOCKED_KEYS) out[key] = base[key];

  return Object.freeze(out);
}

/** Parse URL query params into a raw partial keyed by CONFIG names. */
function parseSearch(search) {
  const partial = {};
  if (!search) return partial;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  for (const [rawKey, rawVal] of params) {
    const key = URL_ALIASES[rawKey] || rawKey;
    partial[key] = rawVal;
  }
  return partial;
}

/**
 * Resolve the difficulty base config. Priority: an explicit `difficulty`
 * source, else a `difficulty` URL param, else the default difficulty (Normal,
 * which equals constants.js).
 */
function resolveBase(src) {
  if (src.difficulty && isDifficulty(src.difficulty)) {
    return configForDifficulty(src.difficulty);
  }
  const search =
    src.search || (typeof location !== 'undefined' && location.search) || '';
  if (search) {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const d = params.get('difficulty');
    if (d && isDifficulty(d)) return configForDifficulty(d);
  }
  return DEFAULTS;
}

/**
 * Resolve the effective CONFIG by merging base <- global <- URL params, where
 * base is the difficulty preset (defaults to Normal = constants.js).
 * @param {{ global?: object, search?: string, difficulty?: string }} [sources]
 * @returns {object} frozen config
 */
export function resolveConfig(sources) {
  const src = sources || {};
  const global =
    src.global ||
    (typeof window !== 'undefined' && window.FLAPPY_CONFIG) ||
    {};
  const search =
    src.search ||
    (typeof location !== 'undefined' && location.search) ||
    '';

  const base = resolveBase(src);
  // Merge global then URL (URL wins), both clamped against the difficulty base.
  let cfg = clampConfig(base, global);
  cfg = clampConfig(cfg, parseSearch(search));
  return cfg;
}

/**
 * Re-resolve including live panel overrides applied last.
 * @param {object} liveOverrides
 * @param {{ global?: object, search?: string, difficulty?: string }} [sources]
 * @returns {object} frozen config
 */
export function withLiveOverrides(liveOverrides, sources) {
  const base = resolveConfig(sources);
  return clampConfig(base, liveOverrides);
}
