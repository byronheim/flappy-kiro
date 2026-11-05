// Shell: the frame loop. Drives the simulation via requestAnimationFrame, owns
// dt computation/clamping and the visibility pause so the pure core never reads
// a clock. (Req 7.3, 10.1, 10.3, 10.4)
//
// Design "Game Loop and State Machine Design > Frame loop".
import { step } from '../core/engine.js';
import { handleAudioEffects } from './audio.js';

/**
 * @param {object} deps
 * @param {() => object} deps.getState
 * @param {(world: object) => void} deps.setState
 * @param {{ drain: () => object }} deps.input
 * @param {(world: object) => void} deps.render
 * @param {{ play: Function }} deps.audio
 * @param {{ saveHighScore: Function }} deps.storage
 * @param {() => object} deps.getConfig
 * @param {() => number} [deps.rng]
 * @param {object} [deps.env]  injectable raf/doc for tests
 * @returns {{ stop: () => void }}
 */
export function startLoop(deps) {
  const {
    getState,
    setState,
    input,
    render,
    audio,
    storage,
    getConfig,
    rng = Math.random,
    env = {},
  } = deps;

  const raf = env.requestAnimationFrame || requestAnimationFrame;
  const caf = env.cancelAnimationFrame || (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : () => {});
  const doc = env.document || (typeof document !== 'undefined' ? document : undefined);

  let lastTimestamp = null;
  let hidden = false;
  let rafId = null;

  const onVisibility = () => {
    hidden = doc.hidden;
    // On return to visible, drop the hidden interval by resetting the clock.
    if (!hidden) lastTimestamp = null;
  };
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisibility);

  const applyEffects = (effects) => {
    handleAudioEffects(audio, effects);
    for (const effect of effects) {
      if (effect.type === 'persistHighScore') {
        storage.saveHighScore(effect.value, getConfig());
      } else if (effect.type === 'persistBestDistance' && storage.saveBestDistance) {
        storage.saveBestDistance(effect.value, getConfig());
      }
    }
  };

  const frame = (timestamp) => {
    rafId = raf(frame);

    if (hidden) {
      // Paused: do not advance the simulation (Req 10.4).
      lastTimestamp = null;
      return;
    }

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      // Still render the current (frozen) frame so the view is up to date.
      render(getState());
      return;
    }

    const config = getConfig();
    let dt = (timestamp - lastTimestamp) / 1000; // seconds
    lastTimestamp = timestamp;
    // Clamp dt to [DT_MIN, DT_MAX] (Req 10.3).
    if (dt < config.DT_MIN) dt = config.DT_MIN;
    if (dt > config.DT_MAX) dt = config.DT_MAX;

    const intents = input.drain();
    const { state, effects } = step(getState(), dt, intents, rng, config);
    setState(state);
    applyEffects(effects);
    render(state); // render every frame, score updates within one frame (Req 7.3)
  };

  rafId = raf(frame);

  return {
    stop() {
      if (rafId !== null) caf(rafId);
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
