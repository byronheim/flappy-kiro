// Single source of all DEFAULT values for Flappy Kiro (Req 1-10 numeric constants).
// This is the DEFAULTS layer the effective CONFIG is built from. The pure core
// reads the effective CONFIG it is handed; with no overrides it is value-equal
// to this object. All values are chosen within the ranges the requirements allow;
// where a requirement fixes a value exactly, that value is used.
//
// Lengths that scale with the play area are expressed as factors and resolved
// against Dims at runtime.

export const CONFIG = Object.freeze({
  // Scene (Req 1)
  GROUND_HEIGHT_FACTOR: 0.08, // Req 1.2: within [0.05, 0.20]
  GHOSTY_HEIGHT_FACTOR: 0.06, // Req 1.3: within [0.05, 0.15] (small ghost, matches reference)
  CLOUD_OPACITY_MIN: 0.2, // Req 1.7
  CLOUD_OPACITY_MAX: 0.8, // Req 1.7
  CLOUD_MIN_SPEED: 10, // Req 1.8: px/s > 0, floor independent of pipe speed
  CLOUD_LAYER_FACTORS: Object.freeze([0.2, 0.4]), // Req 1.9: farther layer slower than nearer

  // Physics (Req 4)
  GRAVITY: 1600, // Req 4.1: within [800, 2400] px/s^2
  MAX_FALL_SPEED: 1200, // Req 4.3: px/s cap on downward velocity
  FLAP_IMPULSE: 480, // Req 4.4: within [300, 700] px/s (applied as -480 vy)
  FLAP_IMPULSE_MIN: 300, // Req 4.4 clamp lower bound
  FLAP_IMPULSE_MAX: 700, // Req 4.4 clamp upper bound

  // Pipes (Req 5)
  PIPE_SPEED_FACTOR: 0.35, // Req 5.1: play-area widths per second
  PIPE_SPACING_FACTOR: 0.5, // Req 5.2: * play-area width
  PIPE_GAP_MARGIN_FACTOR: 0.1, // Req 5.3: * play-area height, top & bottom
  PIPE_GAP_GHOSTY_MULTIPLE: 3.0, // Req 5.4: gap = 3.0 * Ghosty height (smaller sprite -> wider relative gap)
  PIPE_WIDTH_FACTOR: 0.06, // slender pipe column width, * play-area width (matches reference)
  PIPE_CAP_WIDTH_FACTOR: 0.085, // pipe cap is wider than the column, * play-area width
  PIPE_CAP_HEIGHT_FACTOR: 0.04, // pipe cap height, * play-area height

  // Loop / timing (Req 10)
  TARGET_FPS: 60, // Req 10.1
  DT_MIN: 0.016, // Req 10.3: clamp lower bound (seconds)
  DT_MAX: 0.1, // Req 10.3: clamp upper bound (seconds)

  // Game over (Req 9)
  RESTART_LOCKOUT_MS: 500, // Req 9.6/9.7: ignore flaps for first 500 ms

  // Ready state
  GHOSTY_START_Y_FACTOR: 0.4, // Req 2.2: fixed vertical start, upper-middle

  // Persistence (Req 8)
  HIGH_SCORE_KEY: 'flappyKiro.highScore',
});
