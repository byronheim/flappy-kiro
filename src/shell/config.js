// Shell (developer tooling): resolve the effective CONFIG by merging layers
// and validating/clamping every value. Never alters default-config behavior:
// with no overrides, the result is value-equal to constants.js.
//
// Precedence (later wins): defaults <- window.FLAPPY_CONFIG <- URL params <- live overrides.
//
// Design "Configuration and Tuning".
import { CONFIG as DEFAULTS } from '../core/constants.js';

// Fields the requirements fix exactly. Overrides are forced back to these.
const LOCKED = {
  PIPE_SPEED_FACTOR: 0.35,
  PIPE_SPACING_FACTOR: 0.5,
  PIPE_GAP_MARGIN_FACTOR: 0.1,
  PIPE_GAP_GHOSTY_MULTIPLE: 2.5,
  MAX_FALL_SPEED: 1200,
  DT_MIN: 0.016,
  DT_MAX: 0.1,
  CLOUD_OPACITY_MIN: 0.2,
  CLOUD_OPACITY_MAX: 0.8,
  RESTART_LOCKOUT_MS: 500,
};

// Range-valued fields: [min, max].
const RANGES = {
  GRAVITY: [800, 2400],
  FLAP_IMPULSE: [300, 700],
  GROUND_HEIGHT_FACTOR: [0.05, 0.2],
  GHOSTY_HEIGHT_FACTOR: [0.05, 0.15],
};

// Friendly URL aliases -> CONFIG keys.
const URL_ALIASES = {
  gravity: 'GRAVITY',
  flapImpulse: 'FLAP_IMPULSE',
  groundHeight: 'GROUND_HEIGHT_FACTOR',
  ghostyHeight: 'GHOSTY_HEIGHT_FACTOR',
  cloudMinSpeed: 'CLOUD_MIN_SPEED',
  pipeSpeed: 'PIPE_SPEED_FACTOR',
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

    // Locked: force to the exact required value regardless of the override.
    if (key in LOCKED) {
      out[key] = LOCKED[key];
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

  // Ensure locked fields are correct even if absent from the override.
  for (const key of Object.keys(LOCKED)) out[key] = LOCKED[key];

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
 * Resolve the effective CONFIG by merging defaults <- global <- URL params.
 * @param {{ global?: object, search?: string }} [sources]
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

  // Merge global then URL (URL wins), both clamped against the defaults.
  let cfg = clampConfig(DEFAULTS, global);
  cfg = clampConfig(cfg, parseSearch(search));
  return cfg;
}

/**
 * Re-resolve including live panel overrides applied last.
 * @param {object} liveOverrides
 * @param {{ global?: object, search?: string }} [sources]
 * @returns {object} frozen config
 */
export function withLiveOverrides(liveOverrides, sources) {
  const base = resolveConfig(sources);
  return clampConfig(base, liveOverrides);
}
