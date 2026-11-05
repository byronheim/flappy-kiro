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

// --- Ghosty Flair (Req 12) ---------------------------------------------------
/**
 * @typedef {object} FlairItem
 * @property {string} id     stable identifier persisted to storage
 * @property {string} label  human-readable name for the UI
 * @property {string} slot   the Flair_Slot this item occupies ('hat' | 'neck')
 * @property {string} kind   how renderer.js should draw it
 * @property {object} [colors]  CSS colors the renderer uses for this item
 */

// The fixed Flair_Slots. Each slot holds at most one item at a time (Req 12.2).
export const FLAIR_SLOTS = Object.freeze(['hat', 'neck']);

// The predefined set of Flair items, each in exactly one slot (Req 12.1). The
// `kind` tells the renderer which shape routine to use; `colors` parameterize
// it. Positions are resolved against Ghosty's bounds at draw time, so items
// scale with the sprite and render in every state Ghosty appears (Req 12.4).
export const FLAIR_ITEMS = Object.freeze([
  // Hats
  Object.freeze({
    id: 'baseballCap', label: 'Baseball Cap', slot: 'hat', kind: 'baseballCap',
    colors: Object.freeze({ cap: '#d23b3b', brim: '#b02e2e' }),
  }),
  Object.freeze({
    id: 'beanie', label: 'Beanie', slot: 'hat', kind: 'beanie',
    colors: Object.freeze({ body: '#2f7d4f', cuff: '#1f5c39', pom: '#f2f2f2' }),
  }),
  Object.freeze({
    id: 'cowboyHat', label: 'Cowboy Hat', slot: 'hat', kind: 'cowboyHat',
    colors: Object.freeze({ felt: '#8a5a2b', band: '#4a2f16' }),
  }),
  // Neckwear
  Object.freeze({
    id: 'necktie', label: 'Necktie', slot: 'neck', kind: 'necktie',
    colors: Object.freeze({ tie: '#283593', knot: '#1a2566' }),
  }),
  Object.freeze({
    id: 'scarfRed', label: 'Red Scarf', slot: 'neck', kind: 'scarf',
    colors: Object.freeze({ scarf: '#d6372f' }),
  }),
  Object.freeze({
    id: 'scarfBlue', label: 'Blue Scarf', slot: 'neck', kind: 'scarf',
    colors: Object.freeze({ scarf: '#2f77d6' }),
  }),
]);

/** @param {string} [id] @returns {FlairItem|null} the item, or null if unknown. */
export function resolveFlair(id) {
  return FLAIR_ITEMS.find((f) => f.id === id) || null;
}

/** @param {string} [id] @returns {boolean} true if id is a known flair item. */
export function isFlairId(id) {
  return FLAIR_ITEMS.some((f) => f.id === id);
}

/** @param {string} slot @returns {FlairItem[]} items belonging to that slot. */
export function flairForSlot(slot) {
  return FLAIR_ITEMS.filter((f) => f.slot === slot);
}

/**
 * Resolve a raw flair selection (a slot->id map, possibly with unknown ids or
 * ids placed in the wrong slot) into a validated slot->FlairItem map. An
 * unknown id, or an id whose item does not belong to that slot, yields null for
 * that slot - i.e. empty (Req 12.7, 12.8). Every known slot is always present.
 *
 * @param {{ hat?: string, neck?: string }} [selection]
 * @returns {{ hat: FlairItem|null, neck: FlairItem|null }}
 */
export function resolveFlairSelection(selection) {
  const sel = selection || {};
  const out = {};
  for (const slot of FLAIR_SLOTS) {
    const item = resolveFlair(sel[slot]);
    out[slot] = item && item.slot === slot ? item : null;
  }
  return out;
}

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
 * rendering always has valid data (Req 11.5, 12.7, 16).
 *
 * `flairIds` is the persisted slot->id map; `flair` is the validated
 * slot->FlairItem map the renderer consumes (null = empty slot).
 *
 * @param {{ colorId?: string, environmentId?: string, flair?: { hat?: string, neck?: string } }} [selection]
 * @returns {{
 *   colorId: string, environmentId: string,
 *   color: ColorOption, environment: Environment,
 *   flairIds: { hat: string|null, neck: string|null },
 *   flair: { hat: FlairItem|null, neck: FlairItem|null }
 * }}
 */
export function resolveAppearance(selection) {
  const sel = selection || {};
  const color = resolveColor(sel.colorId);
  const environment = resolveEnvironment(sel.environmentId);
  // Accept either a raw `flair` slot->id map or an already-resolved
  // appearance's `flairIds`, so this function is idempotent: re-resolving a
  // resolved appearance (as the renderer does each frame) preserves flair.
  const flairSource = sel.flairIds || sel.flair;
  const flair = resolveFlairSelection(flairSource);
  const flairIds = {};
  for (const slot of FLAIR_SLOTS) flairIds[slot] = flair[slot] ? flair[slot].id : null;
  return Object.freeze({
    colorId: color.id,
    environmentId: environment.id,
    color,
    environment,
    flairIds: Object.freeze(flairIds),
    flair: Object.freeze(flair),
  });
}
