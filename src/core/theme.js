// Pure core: the single source of visual theming data and its validation.
// Holds the Color_Palette (Req 11) and the set of Environments (Req 16) as
// plain, frozen data, plus pure lookup/validation helpers. No DOM, Canvas,
// storage, or randomness - the shell reads this data to drive rendering and
// persists the player's selection.
//
// Design "Extension pattern": new visual state rides on existing seams. These
// are presentation choices only; they never touch physics, collision, or
// scoring, so the simulation core stays color-blind and deterministic.

/**
 * @typedef {object} ColorOption
 * @property {string} id     stable identifier persisted to storage
 * @property {string} label  human-readable name for the UI
 * @property {string} color  CSS color applied as a tint to Ghosty
 */

/**
 * @typedef {object} Environment
 * @property {string} id         stable identifier persisted to storage
 * @property {string} label      human-readable name for the UI
 * @property {string} sky        background fill behind everything
 * @property {string} ground     ground strip fill
 * @property {string} pipe       pipe column fill
 * @property {string} pipeCap    pipe cap fill (the wider lip at the gap)
 * @property {string} cloud      decorative cloud fill
 * @property {string} hud        HUD / overlay text color
 */

// --- Ghosty Color_Palette (Req 11.1) -----------------------------------------
// A fixed, predefined set. The first entry is the default (Req 11.5). Ghosty's
// sprite is tinted toward the chosen color; 'ghost' leaves the sprite untinted.
export const COLOR_PALETTE = Object.freeze([
  Object.freeze({ id: 'ghost', label: 'Ghost White', color: '#ffffff' }),
  Object.freeze({ id: 'blue', label: 'Blue', color: '#4a90e2' }),
  Object.freeze({ id: 'green', label: 'Green', color: '#4caf3e' }),
  Object.freeze({ id: 'pink', label: 'Pink', color: '#ff6fae' }),
  Object.freeze({ id: 'gold', label: 'Gold', color: '#f4c542' }),
  Object.freeze({ id: 'purple', label: 'Purple', color: '#9b59b6' }),
  Object.freeze({ id: 'red', label: 'Red', color: '#e8503a' }),
]);

export const DEFAULT_COLOR_ID = COLOR_PALETTE[0].id;

// --- Environments (Req 16) ---------------------------------------------------
// A fixed set of full scene palettes. The first entry (Sky) is the default and
// reproduces the original look exactly, so existing visuals are unchanged when
// no environment is selected.
export const ENVIRONMENTS = Object.freeze([
  Object.freeze({
    id: 'sky',
    label: 'Sky',
    sky: '#7ec4e6',
    ground: '#3a4652',
    pipe: '#4caf3e',
    pipeCap: '#2e7d22',
    cloud: '#ffffff',
    hud: '#ffffff',
  }),
  Object.freeze({
    id: 'forest',
    label: 'Forest',
    sky: '#2f5d3a', // deep green shade background
    ground: '#5a3a1e', // earthy brown ground
    pipe: '#6b4423', // brown trunks
    pipeCap: '#3f7d2e', // green tree tops
    cloud: '#ddeecc', // pale leafy haze
    hud: '#ffffff',
  }),
  Object.freeze({
    id: 'evilLair',
    label: 'Evil Lair',
    sky: '#0a0a0a', // black background
    ground: '#1c1c1c',
    pipe: '#b71c1c', // red pipes
    pipeCap: '#7f0f0f',
    cloud: '#3a1a1a', // smoky red haze
    hud: '#ff5252',
  }),
  Object.freeze({
    id: 'sunset',
    label: 'Sunset',
    sky: '#ff9e6d', // warm orange sky
    ground: '#4a2c3a',
    pipe: '#b5468a', // magenta pipes
    pipeCap: '#7d2e63',
    cloud: '#ffd9b0',
    hud: '#ffffff',
  }),
]);

export const DEFAULT_ENVIRONMENT_ID = ENVIRONMENTS[0].id;

/**
 * Look up a color option by id. Falls back to the default when the id is
 * unknown or missing (Req 11.5).
 * @param {string} [id]
 * @returns {ColorOption}
 */
export function resolveColor(id) {
  return COLOR_PALETTE.find((c) => c.id === id) || COLOR_PALETTE[0];
}

/**
 * Look up an environment by id. Falls back to the default when the id is
 * unknown or missing (Req 16).
 * @param {string} [id]
 * @returns {Environment}
 */
export function resolveEnvironment(id) {
  return ENVIRONMENTS.find((e) => e.id === id) || ENVIRONMENTS[0];
}

/** @param {string} [id] @returns {boolean} true if id is a palette member. */
export function isColorId(id) {
  return COLOR_PALETTE.some((c) => c.id === id);
}

/** @param {string} [id] @returns {boolean} true if id is a known environment. */
export function isEnvironmentId(id) {
  return ENVIRONMENTS.some((e) => e.id === id);
}

/**
 * Resolve a raw, possibly-invalid appearance selection into a concrete,
 * fully-populated appearance. Unknown or missing ids fall back to defaults so
 * rendering always has valid data (Req 11.5, 16).
 *
 * @param {{ colorId?: string, environmentId?: string }} [selection]
 * @returns {{ colorId: string, environmentId: string, color: ColorOption, environment: Environment }}
 */
export function resolveAppearance(selection) {
  const sel = selection || {};
  const color = resolveColor(sel.colorId);
  const environment = resolveEnvironment(sel.environmentId);
  return Object.freeze({
    colorId: color.id,
    environmentId: environment.id,
    color,
    environment,
  });
}
