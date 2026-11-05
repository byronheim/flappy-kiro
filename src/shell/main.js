// Shell: bootstrap. Loads assets, builds the effective config, reads the high
// score, creates the world, wires input/renderer/audio/storage/loop, mounts the
// dev tuning panel, and reaches Ready within 100ms of assets loading. (Req 1.4, 2.1, 8.4)
//
// Design "Module responsibilities > main.js", "Architecture".
import { createWorld } from '../core/engine.js';
import { DEFAULT_DIFFICULTY } from '../core/difficulty.js';
import { resolveConfig, withLiveOverrides } from './config.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { createInput } from './input.js';
import { render } from './renderer.js';
import { createAudio } from './audio.js';
import { startLoop } from './loop.js';
import { createTuningPanel } from './tuningPanel.js';

/** Load an image; resolve with { image, ok } so a failure never rejects. */
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ image: img, ok: true });
    img.onerror = () => resolve({ image: null, ok: false });
    img.src = src;
  });
}

/** Create an HTMLAudioElement for a sound asset (never throws). */
function loadAudio(src) {
  try {
    const el = new Audio();
    el.src = src;
    return el;
  } catch {
    return null;
  }
}

async function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const dims = {
    width: canvas.width,
    height: canvas.height,
    groundHeight: 0, // resolved below from the effective config
  };

  // Effective config, built from the chosen difficulty base plus any overrides.
  let difficulty = DEFAULT_DIFFICULTY;
  let config = resolveConfig({ difficulty });
  dims.groundHeight = Math.round(config.GROUND_HEIGHT_FACTOR * dims.height);

  // Load assets. Sprite failure falls back to a placeholder (Req 1.4).
  const [sprite, jump, gameOver] = await Promise.all([
    loadImage('assets/ghosty.png'),
    Promise.resolve(loadAudio('assets/jump.wav')),
    Promise.resolve(loadAudio('assets/game_over.wav')),
  ]);

  const assets = { sprite: sprite.image, spriteLoaded: sprite.ok };
  const audio = createAudio({ jump, gameOver });

  // High score from storage (Req 8.4).
  const highScore = loadHighScore(config);

  // Build the world (Ready state) and reach Ready immediately (Req 2.1).
  let world = createWorld(dims, highScore, config);

  const input = createInput(canvas);

  let liveOverrides = {};

  // Mount the dev tuning panel; edits re-resolve config live.
  const panel = createTuningPanel({
    defaults: config,
    onChange: (raw) => {
      liveOverrides = raw;
      config = withLiveOverrides(raw, { difficulty });
      // Keep ground height in sync with any live factor change.
      world = { ...world, dims: { ...world.dims, groundHeight: Math.round(config.GROUND_HEIGHT_FACTOR * dims.height) } };
      return config;
    },
  });
  const gearBtn = document.getElementById('gear-btn');
  if (gearBtn) gearBtn.addEventListener('click', () => panel.toggle());

  // Difficulty selector: switching rebuilds the config from the new base and
  // resets to a fresh Ready world so the new gap/speed/gravity take effect.
  const applyDifficulty = (name) => {
    difficulty = name;
    config = withLiveOverrides(liveOverrides, { difficulty });
    dims.groundHeight = Math.round(config.GROUND_HEIGHT_FACTOR * dims.height);
    world = createWorld(dims, world.highScore, config);
  };
  const diffBar = document.getElementById('difficulty-bar');
  if (diffBar) {
    diffBar.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-difficulty]');
      if (!btn) return;
      applyDifficulty(btn.dataset.difficulty);
      for (const b of diffBar.querySelectorAll('button[data-difficulty]')) {
        b.classList.toggle('active', b === btn);
      }
    });
  }

  startLoop({
    getState: () => world,
    setState: (w) => { world = w; },
    input,
    render: (w) => render(ctx, w, assets, config),
    audio,
    storage: { saveHighScore },
    getConfig: () => config,
  });
}

main();
