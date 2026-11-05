// Shell: draw the world to a 2D canvas context. Reads the world, never mutates
// it. Draw order establishes depth (Req 1.6). (Req 1, 2.3, 7.3-7.4, 9.5, 10.2)
//
// Design "Rendering Approach".
import { States } from '../core/stateMachine.js';
import { resolveAppearance } from '../core/theme.js';

const PLACEHOLDER_COLOR = '#e0e0e0';
// Best-distance marker colors (theme-independent so it stays visible on any
// environment). The highlight color is a bright pulse on first reaching it.
const MARKER_COLOR = '#f5f5f5';
const MARKER_FLAG_COLOR = '#ffca28';
const MARKER_HIGHLIGHT_COLOR = '#ffffff';

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
 * Draw a single Flair item over Ghosty's bounds. Each `kind` has a small shape
 * routine; all coordinates are derived from the sprite box so flair scales with
 * Ghosty and stays aligned in every state (Req 12.4). A null item draws nothing
 * (empty slot; Req 12.8). Pure drawing - never mutates world state.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/theme.js').FlairItem|null} item
 * @param {number} x sprite left
 * @param {number} y sprite top
 * @param {number} w sprite width
 * @param {number} h sprite height
 */
function drawFlairItem(ctx, item, x, y, w, h) {
  if (!item) return;
  const c = item.colors || {};
  const r = (n) => Math.round(n);

  switch (item.kind) {
    case 'baseballCap': {
      // Dome across the top of the head + a brim pointing right (facing).
      const capH = h * 0.26;
      ctx.fillStyle = c.cap || '#d23b3b';
      ctx.fillRect(r(x + w * 0.12), r(y - capH * 0.3), r(w * 0.72), r(capH));
      // Brim.
      ctx.fillStyle = c.brim || '#b02e2e';
      ctx.fillRect(r(x + w * 0.62), r(y + capH * 0.45), r(w * 0.5), r(capH * 0.35));
      break;
    }
    case 'beanie': {
      // Rounded body with a cuff band and a little pom on top.
      const bodyH = h * 0.3;
      ctx.fillStyle = c.body || '#2f7d4f';
      ctx.fillRect(r(x + w * 0.14), r(y - bodyH * 0.35), r(w * 0.72), r(bodyH));
      ctx.fillStyle = c.cuff || '#1f5c39';
      ctx.fillRect(r(x + w * 0.1), r(y + bodyH * 0.4), r(w * 0.8), r(bodyH * 0.32));
      // Pom.
      ctx.fillStyle = c.pom || '#f2f2f2';
      ctx.beginPath();
      ctx.arc(r(x + w * 0.5), r(y - bodyH * 0.45), Math.max(2, r(w * 0.1)), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cowboyHat': {
      // Wide brim + a crown; a band across the crown base.
      const crownH = h * 0.26;
      const brimY = y + crownH * 0.35;
      ctx.fillStyle = c.felt || '#8a5a2b';
      // Brim (wider than the head).
      ctx.fillRect(r(x - w * 0.18), r(brimY), r(w * 1.36), r(h * 0.1));
      // Crown.
      ctx.fillRect(r(x + w * 0.2), r(y - crownH * 0.4), r(w * 0.6), r(crownH));
      // Band.
      ctx.fillStyle = c.band || '#4a2f16';
      ctx.fillRect(r(x + w * 0.2), r(brimY - h * 0.05), r(w * 0.6), r(h * 0.05));
      break;
    }
    case 'necktie': {
      // Knot just under the chin + a tapering tie down the front.
      const cx = x + w * 0.5;
      const knotW = w * 0.2;
      const knotY = y + h * 0.62;
      ctx.fillStyle = c.knot || '#1a2566';
      ctx.fillRect(r(cx - knotW / 2), r(knotY), r(knotW), r(h * 0.12));
      // Tie body: a downward triangle.
      ctx.fillStyle = c.tie || '#283593';
      ctx.beginPath();
      ctx.moveTo(r(cx - knotW / 2), r(knotY + h * 0.12));
      ctx.lineTo(r(cx + knotW / 2), r(knotY + h * 0.12));
      ctx.lineTo(r(cx), r(knotY + h * 0.4));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'scarf': {
      // A band around the neck plus a long tail streaming to the left (the
      // direction Ghosty travels from), giving a sense of motion.
      const neckY = y + h * 0.6;
      const bandH = h * 0.16;
      ctx.fillStyle = c.scarf || '#d6372f';
      // Neck band.
      ctx.fillRect(r(x + w * 0.1), r(neckY), r(w * 0.8), r(bandH));
      // Streaming tail: a few stepped segments trailing left and down.
      const tailW = w * 0.55;
      ctx.fillRect(r(x - tailW * 0.4), r(neckY + bandH * 0.2), r(tailW), r(bandH * 0.8));
      ctx.fillRect(r(x - tailW * 0.9), r(neckY + bandH * 0.7), r(tailW * 0.8), r(bandH * 0.7));
      break;
    }
    default:
      break;
  }
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

  // 4b) Best-distance ground marker (Req 13.3/13.4). Only while Playing and a
  // positive best distance exists. The marker lives at the best-distance point
  // in world space; since Ghosty's screen x is fixed and the world scrolls
  // left, its screen x is ghostyX + (bestDistance - distanceTraveled), so it
  // scrolls toward the player at the same rate as pipes and the ground.
  if (world.status === States.PLAYING && world.bestDistance > 0) {
    const markerScreenX = world.ghosty.x + (world.bestDistance - world.distanceTraveled);
    const mw = Math.max(2, Math.round((config.MARKER_WIDTH_FACTOR || 0.012) * dims.width));
    const mh = Math.round((config.MARKER_HEIGHT_FACTOR || 0.5) * dims.groundHeight);
    const mx = Math.round(markerScreenX - mw / 2);
    // Only draw when at least partially within horizontal bounds (Req 10.2).
    if (mx + mw >= 0 && mx <= dims.width) {
      // A brief highlight pulse right after the player first reaches it.
      const highlightMs = config.MARKER_HIGHLIGHT_MS || 900;
      const highlighting = world.markerReached && world.markerHighlightElapsed <= highlightMs;
      // Post sits on the ground: a thin pennant pole plus a flag near the top.
      const poleTop = Math.round(groundTop - mh);
      ctx.fillStyle = highlighting ? MARKER_HIGHLIGHT_COLOR : MARKER_COLOR;
      ctx.fillRect(mx, poleTop, mw, Math.round(groundTop) - poleTop);
      // Pennant flag to the right of the pole top.
      const flagH = Math.max(3, Math.round(mh * 0.35));
      const flagW = Math.max(4, Math.round(mw * 2.5));
      ctx.fillStyle = highlighting ? MARKER_HIGHLIGHT_COLOR : MARKER_FLAG_COLOR;
      ctx.fillRect(mx + mw, poleTop, flagW, flagH);
    }
  }

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

  // 5b) Flair: hats and neckwear drawn over Ghosty, positioned relative to the
  // sprite bounds so they render in every state Ghosty appears (Req 12.4). An
  // empty slot draws nothing (Req 12.8).
  const flair = resolveAppearance(appearance).flair;
  drawFlairItem(ctx, flair.neck, gx, gy, gw, gh); // neck first (under the hat)
  drawFlairItem(ctx, flair.hat, gx, gy, gw, gh);

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
