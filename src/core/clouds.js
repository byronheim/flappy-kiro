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

/**
 * @returns {number} opacity within [CLOUD_OPACITY_MIN, CLOUD_OPACITY_MAX].
 * Biased toward the upper half of the range so clouds read as bright white
 * rather than translucent gray, while still satisfying Req 1.7.
 */
function randomOpacity(rng, config) {
  const lo = config.CLOUD_OPACITY_MIN;
  const hi = config.CLOUD_OPACITY_MAX;
  return lo + (0.55 + rng() * 0.45) * (hi - lo);
}

/**
 * Generate a random rounded-cloud shape: a cluster of overlapping circular
 * puffs. Positions/radii are expressed as fractions of the cloud's base size so
 * the renderer can scale them to any play area. This is pure data computed in
 * the core via the injected rng, keeping the renderer a plain draw. (Req 1.6)
 *
 * @returns {{ cx: number, cy: number, r: number }[]} puffs in [0,1]-ish space
 */
export function generateCloudShape(rng) {
  const puffs = [];

  // Organic cloud: start with a central base circle, then scatter satellite
  // puffs with their centers placed near the base's perimeter at RANDOM ANGLES
  // around the center. Radial placement gives variance in every direction, so
  // the cloud looks round and lumpy instead of a horizontal line.
  //
  // Coordinates are fractions of the cloud's base box, with the center at
  // (0.5, 0.5). A slight vertical squash keeps the underside flatter than the
  // top, which reads more like a real cloud resting on the air.
  const center = { x: 0.5, y: 0.5 };
  const baseR = 0.26 + rng() * 0.06;
  puffs.push({ cx: center.x, cy: center.y, r: baseR });

  // Satellite puffs ringed around the base. Each sits at a random angle, with
  // its center roughly on the base perimeter (distance ~= baseR), so it overlaps
  // the base heavily and merges into one body.
  const satellites = 5 + Math.floor(rng() * 3); // 5..7
  const vSquash = 0.72; // compress vertical offsets -> wider than tall, rounded
  for (let i = 0; i < satellites; i += 1) {
    const angle = rng() * Math.PI * 2; // full 360deg scatter
    const dist = baseR * (0.7 + rng() * 0.5); // near the perimeter, some in/out
    const r = baseR * (0.5 + rng() * 0.45); // smaller than the base
    const cx = center.x + Math.cos(angle) * dist;
    const cy = center.y + Math.sin(angle) * dist * vSquash;
    puffs.push({ cx, cy, r });
  }

  return puffs;
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
    // Nearer layers (higher index) render slightly larger for depth.
    scale: 0.7 + rng() * 0.6 + layer * 0.15,
    shape: generateCloudShape(rng),
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
