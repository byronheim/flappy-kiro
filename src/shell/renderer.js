// Shell: draw the world to a 2D canvas context. Reads the world, never mutates
// it. Draw order establishes depth (Req 1.6). (Req 1, 2.3, 7.3-7.4, 9.5, 10.2)
//
// Design "Rendering Approach".
import { States } from '../core/stateMachine.js';
import { resolveAppearance } from '../core/theme.js';

const PLACEHOLDER_COLOR = '#e0e0e0';

// Cache of tinted sprite canvases, keyed by color+size, so the per-frame hot
// path reuses one offscreen canvas per color instead of re-tinting every frame.
const tintCache = new Map();

/**
 * Produce a sprite tinted to `color`, masked to the sprite's own alpha so the
 * transparent area around Ghosty stays transparent (no colored box). The tint
 * is applied on an offscreen canvas where only the sprite's pixels are opaque,
 * so 'source-atop' affects just the sprite shape - unlike compositing straight
 * onto the main canvas, where the whole scene behind is already opaque.
 *
 * Returns the sprite image itself if an offscreen canvas can't be created
 * (e.g. a non-browser/test context), so rendering degrades gracefully.
 *
 * @param {CanvasImageSource} sprite
 * @param {string} color  CSS color
 * @param {number} w  target pixel width
 * @param {number} h  target pixel height
 * @returns {CanvasImageSource}
 */
export function getTintedSprite(sprite, color, w, h) {
  const key = `${color}@${w}x${h}`;
  const cached = tintCache.get(key);
  if (cached && cached.sprite === sprite) return cached.canvas;

  if (typeof document === 'undefined' || !document.createElement) return sprite;
  let off;
  try {
    off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    if (!octx) return sprite;
    octx.imageSmoothingEnabled = false;
    // 1) Draw the sprite; only its opaque pixels become opaque on the offscreen.
    octx.drawImage(sprite, 0, 0, w, h);
    // 2) Composite the color over just those pixels. 'source-atop' keeps the
    //    sprite's alpha mask; partial alpha preserves the sprite's shading.
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = 0.55;
    octx.fillStyle = color;
    octx.fillRect(0, 0, w, h);
  } catch {
    return sprite; // any canvas failure: fall back to the untinted sprite
  }
  tintCache.set(key, { sprite, canvas: off });
  return off;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} world
 * @param {object} assets  { sprite?: CanvasImageSource, spriteLoaded: boolean }
 * @param {object} [config]  effective config (for pipe cap sizing); optional
 * @param {{ colorId?: string, environmentId?: string }} [appearance]  player theme
 */
export function render(ctx, world, assets, config = {}, appearance = {}) {
  const { dims } = world;
  const groundTop = dims.height - dims.groundHeight;

  // Resolve the player's chosen theme to concrete colors (Req 11, 16).
  const { color: ghostyColor, environment: env } = resolveAppearance(appearance);
  const SKY = env.sky;
  const GROUND_COLOR = env.ground;
  const PIPE_COLOR = env.pipe;
  const PIPE_CAP_COLOR = env.pipeCap;
  const CLOUD_COLOR = env.cloud;
  const TEXT_COLOR = env.hud;

  // Crisp pixel edges for all subsequent draws (Req 1.5).
  ctx.imageSmoothingEnabled = false;

  // 1) Sky fill - color comes from the active environment (Req 1.1, 16).
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, dims.width, dims.height);

  // 2) Clouds, farther layers first, semi-transparent (Req 1.6, 1.7).
  // Drawn as clusters of rounded puffs for a soft, varied look (Req 1.6).
  const clouds = [...world.clouds].sort((a, b) => a.layer - b.layer);
  const baseH = dims.height * 0.08;
  for (const cloud of clouds) {
    const scale = cloud.scale || 1;
    // Near-square box so the radial puff scatter (in shape space) keeps its
    // round proportions; the shape itself squashes vertically for a cloud look.
    const h = baseH * scale * 2.0;
    const w = h * 1.15;
    ctx.save();
    ctx.globalAlpha = cloud.opacity;
    ctx.fillStyle = CLOUD_COLOR;
    const puffs = cloud.shape || [{ cx: 0.5, cy: 0.5, r: 0.4 }];
    // Build all puffs as ONE path and fill once, so overlapping circles merge
    // into a single cohesive silhouette instead of stacking translucent seams.
    ctx.beginPath();
    for (const puff of puffs) {
      const px = cloud.x + puff.cx * w;
      const py = cloud.y + puff.cy * h;
      const pr = puff.r * h;
      ctx.moveTo(px + pr, py); // moveTo before arc so sub-paths don't connect
      ctx.arc(px, py, pr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // 3) Pipes: slender green columns with a wider cap at the gap end, only those
  // partially within horizontal bounds (Req 1.5, 10.2).
  const capW = (config.PIPE_CAP_WIDTH_FACTOR || 0.085) * dims.width;
  const capH = (config.PIPE_CAP_HEIGHT_FACTOR || 0.04) * dims.height;
  for (const pipe of world.pipes) {
    if (pipe.x + pipe.width < 0 || pipe.x > dims.width) continue;
    const x = Math.round(pipe.x);
    const w = Math.round(pipe.width);
    // Center the wider cap over the column.
    const capX = Math.round(pipe.x - (capW - pipe.width) / 2);
    const cw = Math.round(capW);
    const ch = Math.round(capH);

    // Top pipe column (0 -> gapTop) and its cap at the bottom end.
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(x, 0, w, Math.round(pipe.gapTop));
    ctx.fillStyle = PIPE_CAP_COLOR;
    ctx.fillRect(capX, Math.round(pipe.gapTop - ch), cw, ch);

    // Bottom pipe column (gapBottom -> ground) and its cap at the top end.
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(x, Math.round(pipe.gapBottom), w, Math.round(groundTop - pipe.gapBottom));
    ctx.fillStyle = PIPE_CAP_COLOR;
    ctx.fillRect(capX, Math.round(pipe.gapBottom), cw, ch);
  }

  // 4) Ground strip (Req 1.2).
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, Math.round(groundTop), dims.width, Math.round(dims.groundHeight));

  // 5) Ghosty: sprite if loaded, else a solid placeholder of equal bounds
  // (Req 1.3, 1.4). The chosen palette color tints the sprite (Req 11.2): the
  // default 'ghost' color leaves the sprite as-is; any other color tints only
  // the sprite's own pixels (not the transparent box around it) via an
  // offscreen canvas - see getTintedSprite.
  const g = world.ghosty;
  const gx = Math.round(g.x);
  const gy = Math.round(g.y);
  const gw = Math.round(g.w);
  const gh = Math.round(g.h);
  const tint = ghostyColor.id !== 'ghost' ? ghostyColor.color : null;
  if (assets && assets.spriteLoaded && assets.sprite) {
    const image = tint ? getTintedSprite(assets.sprite, tint, gw, gh) : assets.sprite;
    ctx.drawImage(image, gx, gy, gw, gh);
  } else {
    // Placeholder: fill directly with the chosen color (or neutral for ghost).
    ctx.fillStyle = tint || PLACEHOLDER_COLOR;
    ctx.fillRect(gx, gy, gw, gh);
  }

  // 6) HUD: current score and high score as integers, centered in the ground
  // footer bar to match the reference UI (Req 7.3, 7.4).
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Score: ${Math.floor(world.score)} | High: ${Math.floor(world.highScore)}`,
    dims.width / 2,
    Math.round(groundTop + dims.groundHeight / 2 + 7)
  );

  // 7) State overlays (Req 2.3, 9.5).
  ctx.textAlign = 'center';
  if (world.status === States.READY) {
    ctx.font = '24px monospace';
    ctx.fillText('Flap to start', dims.width / 2, dims.height / 2);
  } else if (world.status === States.GAME_OVER) {
    ctx.font = '28px monospace';
    ctx.fillText('Game Over', dims.width / 2, dims.height / 2 - 20);
    ctx.font = '20px monospace';
    ctx.fillText(`Score: ${Math.floor(world.finalScore)}`, dims.width / 2, dims.height / 2 + 10);
    ctx.fillText('Flap to restart', dims.width / 2, dims.height / 2 + 40);
  }
}
