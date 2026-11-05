// Shell: bootstrap. Loads assets, builds the effective config, reads the high
// score, creates the world, wires input/renderer/audio/storage/loop, mounts the
// dev tuning panel, and reaches Ready within 100ms of assets loading. (Req 1.4, 2.1, 8.4)
//
// Design "Module responsibilities > main.js", "Architecture".
import { createWorld } from '../core/engine.js';
import { DEFAULT_DIFFICULTY } from '../core/difficulty.js';
import { resolveConfig, withLiveOverrides } from './config.js';
import {
  loadHighScore,
  saveHighScore,
  loadAppearance,
  saveAppearance,
  loadBestDistance,
  saveBestDistance,
} from './storage.js';
import { resolveAppearance } from '../core/theme.js';
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

  // Appearance (Ghosty color + environment) from storage, resolved to valid
  // ids with defaults applied (Req 11.4/11.5, 16).
  let appearance = resolveAppearance(loadAppearance());

  // Best distance from storage (Req 13.6).
  const bestDistance = loadBestDistance(config);

  // Build the world (Ready state) and reach Ready immediately (Req 2.1).
  let world = createWorld(dims, highScore, config, Math.random, bestDistance);

  const rawInput = createInput(canvas);

  // Start-dialog controller. While the dialog is visible the game is held in
  // Ready: real flaps (space/click) are swallowed so only "Flap Away!" starts
  // play. "Flap Away!" queues a single synthetic flap to transition Ready->Playing.
  const startDialog = document.getElementById('start-dialog');
  let dialogVisible = true;
  let queuedFlap = false;
  const showDialog = () => {
    dialogVisible = true;
    if (startDialog) startDialog.hidden = false;
  };
  const hideDialog = () => {
    dialogVisible = false;
    if (startDialog) startDialog.hidden = true;
  };

  // Input wrapper: the loop drains from here each frame.
  const input = {
    drain() {
      const intents = rawInput.drain();
      if (dialogVisible) {
        // Swallow real input while the dialog is up; the dialog owns the start.
        return { ...intents, flap: false };
      }
      if (queuedFlap) {
        queuedFlap = false;
        return { ...intents, flap: true };
      }
      return intents;
    },
  };

  let liveOverrides = {};

  // Mount the options dialog over the play area (inside the positioned stage).
  const stage = document.getElementById('stage');
  const panel = createTuningPanel({
    defaults: config,
    mount: stage || undefined,
    appearance: { colorId: appearance.colorId, environmentId: appearance.environmentId, flair: { ...appearance.flairIds } },
    onChange: (raw) => {
      liveOverrides = raw;
      config = withLiveOverrides(raw, { difficulty });
      // Keep ground height in sync with any live factor change.
      world = { ...world, dims: { ...world.dims, groundHeight: Math.round(config.GROUND_HEIGHT_FACTOR * dims.height) } };
      return config;
    },
    // Color/environment/flair picks apply live and persist (Req 11.2/11.3, 12.5, 16).
    onAppearanceChange: (sel) => {
      appearance = resolveAppearance(sel);
      saveAppearance({
        colorId: appearance.colorId,
        environmentId: appearance.environmentId,
        flair: { ...appearance.flairIds },
      });
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
    // Preserve the session's high score and best distance across the rebuild.
    world = createWorld(dims, world.highScore, config, Math.random, world.bestDistance);
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

  // "Flap Away!" closes the dialog and queues the first flap to start play.
  const flapAwayBtn = document.getElementById('flap-away');
  if (flapAwayBtn) {
    flapAwayBtn.addEventListener('click', () => {
      hideDialog();
      queuedFlap = true;
    });
  }

  // Watch state transitions so the dialog reappears whenever the game returns
  // to the Ready state (e.g. after a crash + restart).
  let prevStatus = world.status;
  const setState = (w) => {
    if (w.status === 'ready' && prevStatus !== 'ready') showDialog();
    prevStatus = w.status;
    world = w;
  };

  startLoop({
    getState: () => world,
    setState,
    input,
    render: (w) => render(ctx, w, assets, config, appearance),
    audio,
    storage: { saveHighScore, saveBestDistance },
    getConfig: () => config,
  });
}

main();
