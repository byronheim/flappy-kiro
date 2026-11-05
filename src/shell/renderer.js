// Shell: draw the world to a 2D canvas context. Reads the world, never mutates
// it. Draw order establishes depth (Req 1.6). (Req 1, 2.3, 7.3-7.4, 9.5, 10.2)
//
// Design "Rendering Approach".
import { States } from '../core/stateMachine.js';

const SKY = '#7ec4e6';
const GROUND_COLOR = '#3a4652';
const PIPE_COLOR = '#4caf3e';
const PIPE_CAP_COLOR = '#2e7d22';
const CLOUD_COLOR = '#ffffff';
const PLACEHOLDER_COLOR = '#e0e0e0';
const TEXT_COLOR = '#ffffff';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} world
 * @param {object} assets  { sprite?: CanvasImageSource, spriteLoaded: boolean }
 * @param {object} [config]  effective config (for pipe cap sizing); optional
 */
export function render(ctx, world, assets, config = {}) {
  const { dims } = world;
  const groundTop = dims.height - dims.groundHeight;

  // Crisp pixel edges for all subsequent draws (Req 1.5).
  ctx.imageSmoothingEnabled = false;

  // 1) Sky-blue fill (Req 1.1).
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, dims.width, dims.height);

  // 2) Clouds, farther layers first, semi-transparent (Req 1.6, 1.7).
  // Drawn as clusters of rounded puffs for a soft, varied look (Req 1.6).
  const clouds = [...world.clouds].sort((a, b) => a.layer - b.layer);
  const baseH = dims.height * 0.08;
  for (const cloud of clouds) {
    const scale = cloud.scale || 1;
    const h = baseH * scale;
    const w = h * 2.2; // clouds are wider than tall
    ctx.save();
    ctx.globalAlpha = cloud.opacity;
    ctx.fillStyle = CLOUD_COLOR;
    const puffs = cloud.shape || [{ cx: 0.5, cy: 0.5, r: 0.4 }];
    for (const puff of puffs) {
      const px = cloud.x + puff.cx * w;
      const py = cloud.y + puff.cy * h;
      const pr = puff.r * h;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // 5) Ghosty: sprite if loaded, else a solid placeholder of equal bounds (Req 1.3, 1.4).
  const g = world.ghosty;
  if (assets && assets.spriteLoaded && assets.sprite) {
    ctx.drawImage(assets.sprite, Math.round(g.x), Math.round(g.y), Math.round(g.w), Math.round(g.h));
  } else {
    ctx.fillStyle = PLACEHOLDER_COLOR;
    ctx.fillRect(Math.round(g.x), Math.round(g.y), Math.round(g.w), Math.round(g.h));
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
