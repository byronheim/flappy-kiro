// Pure physics for Ghosty: gravity, integration, and flap impulse.
// All functions return new objects and never mutate their inputs (Req 4).
//
// Design "Components and Interfaces > physics.js".

/**
 * Clamp a requested impulse into [FLAP_IMPULSE_MIN, FLAP_IMPULSE_MAX]. (Req 4.4)
 * @param {number} value
 * @param {object} config
 * @returns {number}
 */
export function clampImpulse(value, config) {
  const min = config.FLAP_IMPULSE_MIN;
  const max = config.FLAP_IMPULSE_MAX;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Apply gravity for dt seconds, then clamp downward velocity to MAX_FALL_SPEED.
 * (Req 4.1, 4.3)
 * @returns {object} a new Ghosty
 */
export function applyGravity(ghosty, dt, config) {
  let vy = ghosty.vy + config.GRAVITY * dt;
  if (vy > config.MAX_FALL_SPEED) vy = config.MAX_FALL_SPEED;
  return { ...ghosty, vy };
}

/**
 * Integrate position from velocity over dt seconds. (Req 4.2)
 * @returns {object} a new Ghosty
 */
export function integrate(ghosty, dt) {
  return { ...ghosty, y: ghosty.y + ghosty.vy * dt };
}

/**
 * Set vertical velocity to the clamped upward flap impulse (negative = up). (Req 4.4)
 * @returns {object} a new Ghosty
 */
export function applyFlap(ghosty, config) {
  const impulse = clampImpulse(config.FLAP_IMPULSE, config);
  return { ...ghosty, vy: -impulse };
}
