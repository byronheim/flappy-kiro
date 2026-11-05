// Pure pipe generation, scrolling, and recycling. Randomness enters only via
// the injected rng; this module never calls Math.random directly (Req 5).
//
// Design "Components and Interfaces > pipes.js".

/**
 * @typedef {{ width: number, height: number, groundHeight: number }} Dims
 */

/** @returns {number} horizontal pipe scroll speed in px/s. */
export function pipeSpeed(dims, config) {
  return config.PIPE_SPEED_FACTOR * dims.width;
}

/**
 * Generate a new pipe pair whose left edge is at leftEdgeX. The gap height is
 * fixed at 2.5 * Ghosty height; the gap's vertical position is chosen via rng
 * within the legal band: gap top >= 0.1*height from the top, gap bottom >=
 * 0.1*height above the ground. (Req 5.3, 5.4)
 *
 * @param {Dims} dims
 * @param {() => number} rng   returns a float in [0,1)
 * @param {number} leftEdgeX
 * @param {object} config
 * @param {number} ghostyHeight
 * @param {number} id
 * @returns {object} PipePair
 */
export function generatePipe(dims, rng, leftEdgeX, config, ghostyHeight, id) {
  const groundTop = dims.height - dims.groundHeight;

  // Requested gap height and margins (Req 5.3, 5.4). The tunable ranges keep
  // the stacked worst case comfortably within the play area, but we still clamp
  // defensively so no config combination can ever produce an unplayable gap
  // (one that collapses to zero span or overflows the ground). The core must
  // never emit a pipe whose gap extends below groundTop.
  let gapHeight = config.PIPE_GAP_GHOSTY_MULTIPLE * ghostyHeight; // Req 5.4
  let margin = config.PIPE_GAP_MARGIN_FACTOR * dims.height; // Req 5.3

  // Guarantee room for the gap plus both margins plus a small placement span.
  // If the requested geometry would not fit, first shrink the margin, then the
  // gap itself, so gapBottom always stays at or above groundTop.
  const MIN_SPAN = Math.min(40, groundTop * 0.05); // desired vertical variety
  // Largest margin that still leaves the gap + a minimal span to fit.
  const maxMarginForGap = (groundTop - gapHeight - MIN_SPAN) / 2;
  if (margin > maxMarginForGap) margin = Math.max(0, maxMarginForGap);
  // If even a zero-margin placement can't fit the gap, shrink the gap.
  const maxGap = groundTop - 2 * margin - MIN_SPAN;
  if (gapHeight > maxGap) gapHeight = Math.max(ghostyHeight, maxGap);

  // The gap top may range from `margin` down to `groundTop - margin - gapHeight`.
  const minGapTop = margin;
  const maxGapTop = groundTop - margin - gapHeight;
  const span = Math.max(0, maxGapTop - minGapTop);
  const gapTop = minGapTop + rng() * span;
  const gapBottom = gapTop + gapHeight;

  return {
    id,
    x: leftEdgeX,
    width: config.PIPE_WIDTH_FACTOR * dims.width,
    gapTop,
    gapBottom,
    scored: false,
  };
}

/**
 * Scroll all pipes left by pipeSpeed*dt and append new pairs so the horizontal
 * distance between the left edges of consecutive generated pairs equals
 * 0.5*width (Req 5.1, 5.2). Returns new state (does not mutate inputs).
 *
 * @returns {{ pipes: object[], nextPipeId: number, distanceSincePipe: number }}
 */
export function updatePipes(pipes, dims, dt, rng, config, ghostyHeight, nextPipeId, distanceSincePipe) {
  const dx = pipeSpeed(dims, config) * dt; // Req 5.1
  const spacing = config.PIPE_SPACING_FACTOR * dims.width; // Req 5.2

  const result = pipes.map((p) => ({ ...p, x: p.x - dx }));
  let id = nextPipeId;

  if (result.length === 0) {
    // Seed the first pipe just off the right edge.
    result.push(generatePipe(dims, rng, dims.width, config, ghostyHeight, id));
    id += 1;
  } else {
    // Spawn new pipes on a fixed lattice: each new pipe's left edge is exactly
    // `spacing` to the right of the current rightmost pipe. We add as many as
    // needed so a pipe always sits at or beyond the right edge, which keeps the
    // left-edge distance between consecutive generated pairs equal to `spacing`
    // by construction (Req 5.2) regardless of frame cadence.
    let rightmost = result.reduce((m, p) => (p.x > m.x ? p : m), result[0]);
    while (rightmost.x < dims.width) {
      const newPipe = generatePipe(dims, rng, rightmost.x + spacing, config, ghostyHeight, id);
      result.push(newPipe);
      id += 1;
      rightmost = newPipe;
    }
  }

  // distanceSincePipe retained in the signature for the engine's world shape;
  // placement no longer depends on it, so we simply track cumulative scroll.
  return { pipes: result, nextPipeId: id, distanceSincePipe: distanceSincePipe + dx };
}

/**
 * Remove pairs whose right edge has scrolled past the left edge of the play
 * area (Req 5.5). Returns a new array.
 */
export function cullPipes(pipes) {
  return pipes.filter((p) => p.x + p.width >= 0);
}
