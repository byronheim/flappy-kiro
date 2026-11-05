// Shell: the only module that touches localStorage. The engine expresses
// persistence as a `persistHighScore` effect; this module performs the write.
// (Req 8)
//
// Design "Persistence (Local Storage)".

/**
 * Resolve the storage backend: prefer an injected store (for tests), else the
 * browser's localStorage, else null when unavailable.
 */
function resolveStore(store) {
  if (store) return store;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Read and validate the high score. Returns a non-negative integer, or 0 when
 * the value is missing, non-numeric, negative, or not an integer.
 * (Req 8.4, 8.5, 8.6)
 *
 * @param {object} config
 * @param {Storage} [store]  injectable for tests
 * @returns {number}
 */
export function loadHighScore(config, store) {
  const s = resolveStore(store);
  if (!s) return 0;
  let raw;
  try {
    raw = s.getItem(config.HIGH_SCORE_KEY);
  } catch {
    return 0;
  }
  if (raw === null || raw === undefined || raw === '') return 0; // Req 8.5
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0; // Req 8.6
  return n;
}

/**
 * Persist the high score. On any failure (quota, disabled storage, private
 * mode) swallow the error so the in-memory value is kept and gameplay
 * continues uninterrupted. (Req 8.2, 8.3)
 *
 * @param {number} value
 * @param {object} config
 * @param {Storage} [store]  injectable for tests
 */
export function saveHighScore(value, config, store) {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(config.HIGH_SCORE_KEY, String(value));
  } catch {
    // Keep the in-memory value; do not interrupt gameplay. (Req 8.3)
  }
}

// --- Appearance (Ghosty color + environment) persistence (Req 11.3/11.4, 16) -
// The selection is stored as a small JSON blob under its own key. Validation
// of the ids themselves lives in core/theme.js (resolveAppearance); this module
// only guards the raw I/O and JSON parsing so a corrupt value can never throw.
export const APPEARANCE_KEY = 'flappyKiro.appearance';

/**
 * Read the persisted appearance selection. Returns the raw { colorId,
 * environmentId } partial, or an empty object when the value is missing or
 * unparseable - callers resolve/validate it through theme.resolveAppearance,
 * which supplies defaults (Req 11.5, 16).
 *
 * @param {Storage} [store]  injectable for tests
 * @returns {{ colorId?: string, environmentId?: string }}
 */
export function loadAppearance(store) {
  const s = resolveStore(store);
  if (!s) return {};
  let raw;
  try {
    raw = s.getItem(APPEARANCE_KEY);
  } catch {
    return {};
  }
  if (raw === null || raw === undefined || raw === '') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out = {};
      if (typeof parsed.colorId === 'string') out.colorId = parsed.colorId;
      if (typeof parsed.environmentId === 'string') out.environmentId = parsed.environmentId;
      return out;
    }
    return {};
  } catch {
    return {}; // corrupt JSON -> defaults applied downstream
  }
}

/**
 * Persist the appearance selection. Swallows any failure so a storage error
 * never interrupts the UI (mirrors saveHighScore). (Req 11.3, 16)
 *
 * @param {{ colorId?: string, environmentId?: string }} selection
 * @param {Storage} [store]  injectable for tests
 */
export function saveAppearance(selection, store) {
  const s = resolveStore(store);
  if (!s) return;
  const payload = {
    colorId: selection && selection.colorId,
    environmentId: selection && selection.environmentId,
  };
  try {
    s.setItem(APPEARANCE_KEY, JSON.stringify(payload));
  } catch {
    // Keep the in-memory selection; do not interrupt. (mirrors Req 8.3)
  }
}
