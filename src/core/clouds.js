// Pure cloud generation and motion for the parallax background. Randomness
// enters only via the injected rng (Req 1.7-1.10).
//
// Design "Rendering Approach" (cloud motion computed in core), "Tunable constants".
import { pipeSpeed } from './pipes.js';

/**
 * Per-layer cloud scroll speed: at least CLOUD_MIN_SPEED (so clouds always move,
 * Req 1.8) yet derived from the layer factor * pipe speed. Factors are ascending
 * and < 1, so every layer is slower than the pipes and farther layers (lower
 * index) are slower than nearer ones (Req 1.9).
 *
 * @returns {number} px/s for the given layer index.
 */
export function cloudLayerSpeed(layer, dims, config) {
  const factor = config.CLOUD_LAYER_FACTORS[layer];
  return Math.max(config.CLOUD_MIN_SPEED, factor * pipeSpeed(dims, config));
}

/** @returns {number} opacity within [CLOUD_OPACITY_MIN, CLOUD_OPACITY_MAX]. */
function randomOpacity(rng, config) {
  const lo = config.CLOUD_OPACITY_MIN;
  const hi = config.CLOUD_OPACITY_MAX;
  return lo + rng() * (hi - lo);
}

/**
 * Create a single cloud on the given layer. If `offRight` is true, it is placed
 * just past the right edge (used when recycling).
 * @returns {object} Cloud
 */
export function generateCloud(dims, rng, config, layer, offRight = false) {
  const groundTop = dims.height - dims.groundHeight;
  const x = offRight ? dims.width + rng() * dims.width * 0.5 : rng() * dims.width;
  const y = rng() * groundTop * 0.6; // upper portion of the sky
  return {
    x,
    y,
    layer,
    speedFactor: config.CLOUD_LAYER_FACTORS[layer],
    opacity: randomOpacity(rng, config),
  };
}

/**
 * Seed an initial set of clouds spread across the layers.
 * @returns {object[]}
 */
export function seedClouds(dims, rng, config, perLayer = 2) {
  const clouds = [];
  for (let layer = 0; layer < config.CLOUD_LAYER_FACTORS.length; layer += 1) {
    for (let i = 0; i < perLayer; i += 1) {
      clouds.push(generateCloud(dims, rng, config, layer, false));
    }
  }
  return clouds;
}

/**
 * Scroll clouds left by their layer speed over dt. A cloud scrolled fully past
 * the left edge is repositioned to the right with a new y/opacity, preserving
 * the cloud count (Req 1.10). Returns a new array.
 */
export function updateClouds(clouds, dims, dt, rng, config) {
  return clouds.map((cloud) => {
    const speed = cloudLayerSpeed(cloud.layer, dims, config);
    let x = cloud.x - speed * dt;
    const width = dims.width * 0.2; // nominal cloud width for the off-screen test
    if (x + width < 0) {
      // Fully past the left edge: recycle to the right with fresh y/opacity.
      const recycled = generateCloud(dims, rng, config, cloud.layer, true);
      return recycled;
    }
    return { ...cloud, x };
  });
}
