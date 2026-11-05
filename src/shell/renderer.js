// Shell: draw the world to a 2D canvas context. Reads the world, never mutates
// it. Draw order establishes depth (Req 1.6). (Req 1, 2.3, 7.3-7.4, 9.5, 10.2)
//
// Design "Rendering Approach".
import { States } from '../core/stateMachine.js';

const SKY = '#6ec6ff';
const GROUND_COLOR = '#c8a24a';
const PIPE_COLOR = '#2fbf4f';
const CLOUD_COLOR = '#ffffff';
const PLACEHOLDER_COLOR = '#e0e0e0';
const TEXT_COLOR = '#ffffff';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} world
 * @param {object} assets  { sprite?: CanvasImageSource, spriteLoaded: boolean }
 */
export function render(ctx, world, assets) {
  const { dims } = world;
  const groundTop = dims.height - dims.groundHeight;

  // Crisp pixel edges for all subsequent draws (Req 1.5).
  ctx.imageSmoothingEnabled = false;

  // 1) Sky-blue fill (Req 1.1).
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, dims.width, dims.height);

  // 2) Clouds, farther layers first, semi-transparent (Req 1.6, 1.7).
  const clouds = [...world.clouds].sort((a, b) => a.layer - b.layer);
  const cloudW = dims.width * 0.2;
  const cloudH = dims.height * 0.08;
  for (const cloud of clouds) {
    ctx.save();
    ctx.globalAlpha = cloud.opacity;
    ctx.fillStyle = CLOUD_COLOR;
    ctx.fillRect(Math.round(cloud.x), Math.round(cloud.y), Math.round(cloudW), Math.round(cloudH));
    ctx.restore();
  }

  // 3) Pipes: green rectangles, only those partially within horizontal bounds (Req 1.5, 10.2).
  ctx.fillStyle = PIPE_COLOR;
  for (const pipe of world.pipes) {
    if (pipe.x + pipe.width < 0 || pipe.x > dims.width) continue;
    const x = Math.round(pipe.x);
    const w = Math.round(pipe.width);
    // Top pipe: from 0 to gapTop.
    ctx.fillRect(x, 0, w, Math.round(pipe.gapTop));
    // Bottom pipe: from gapBottom to the ground.
    ctx.fillRect(x, Math.round(pipe.gapBottom), w, Math.round(groundTop - pipe.gapBottom));
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

  // 6) HUD: current score and high score as integers (Req 7.3, 7.4).
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${Math.floor(world.score)}`, 12, 28);
  ctx.fillText(`Best: ${Math.floor(world.highScore)}`, 12, 52);

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
