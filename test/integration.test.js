// Integration and smoke tests.
// Design "Testing Strategy > Integration and smoke tests".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/constants.js';
import { createWorld, step } from '../src/core/engine.js';
import { States } from '../src/core/stateMachine.js';
import { resolveConfig } from '../src/shell/config.js';
import { loadHighScore, saveHighScore } from '../src/shell/storage.js';
import { createAudio, handleAudioEffects } from '../src/shell/audio.js';

const dims = { width: 400, height: 600, groundHeight: Math.round(600 * CONFIG.GROUND_HEIGHT_FACTOR) };

test('boot smoke: resolve config, create a Ready world with the stored high score (Req 2.1, 8.4)', () => {
  const store = (() => {
    const m = new Map([[CONFIG.HIGH_SCORE_KEY, '7']]);
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  })();

  const config = resolveConfig({ global: {}, search: '' });
  const high = loadHighScore(config, store);
  const world = createWorld(dims, high, config, () => 0.5);

  assert.equal(world.status, States.READY);
  assert.equal(world.highScore, 7);
  assert.equal(world.score, 0);
  assert.ok(world.clouds.length > 0);
});

test('dt clamp smoke: engine respects a dt clamped to the [16ms, 100ms] band (Req 10.1, 10.3)', () => {
  // The loop clamps dt; here we verify the engine produces bounded motion for
  // the clamp band endpoints.
  const base = { ...createWorld(dims, 0, CONFIG, () => 0.5), status: States.PLAYING, ghosty: { x: 100, y: 300, vy: 0, w: 60, h: 60 } };
  const slow = step(base, CONFIG.DT_MIN, { flap: false }, () => 0.5, CONFIG);
  const fast = step(base, CONFIG.DT_MAX, { flap: false }, () => 0.5, CONFIG);
  // More time => more fall within one step.
  assert.ok(fast.state.ghosty.y > slow.state.ghosty.y);
});

test('end-to-end scripted session: flap to start, pass a pipe, crash (Req 3.5, 7.2, 8.2, 9.1)', () => {
  // Recording audio element doubles.
  const playCounts = { jump: 0, gameOver: 0 };
  const makeEl = (name) => ({
    loop: true,
    currentTime: 0,
    play() {
      playCounts[name] += 1;
      return Promise.resolve();
    },
  });
  const audio = createAudio({ jump: makeEl('jump'), gameOver: makeEl('gameOver') });

  const store = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      _map: m,
    };
  })();
  const config = CONFIG;

  const rng = () => 0.5;
  let world = createWorld(dims, loadHighScore(config, store), config, rng);

  const drive = (dt, intents) => {
    const { state, effects } = step(world, dt, intents, rng, config);
    world = state;
    handleAudioEffects(audio, effects);
    for (const e of effects) {
      if (e.type === 'persistHighScore') saveHighScore(e.value, config, store);
    }
    return effects;
  };

  // 1) Flap to start: Ready -> Playing. Starting flap does not play a jump sound.
  drive(CONFIG.DT_MIN, { flap: true });
  assert.equal(world.status, States.PLAYING);
  assert.equal(playCounts.jump, 0);

  // 2) A flap during play produces exactly one jump sound (Req 3.5).
  drive(CONFIG.DT_MIN, { flap: true });
  assert.equal(playCounts.jump, 1);

  // 3) Manufacture a scored pipe behind Ghosty, then crash into the ground.
  //    Place a pipe whose trailing edge is just left of Ghosty so scoring fires.
  world = {
    ...world,
    pipes: [{ id: 1, x: world.ghosty.x - world.ghosty.w - 1, width: 1, gapTop: 10, gapBottom: dims.height, scored: false }],
  };
  // Drive one frame so scoring records the pass (no collision yet).
  drive(CONFIG.DT_MIN, { flap: false });
  assert.equal(world.score, 1, 'passing the pipe scored exactly once (Req 7.2)');

  // 4) Force a crash: drop Ghosty onto the ground.
  world = { ...world, ghosty: { ...world.ghosty, y: dims.height } };
  drive(CONFIG.DT_MIN, { flap: false });
  assert.equal(world.status, States.GAME_OVER);
  assert.equal(playCounts.gameOver, 1, 'exactly one game-over sound (Req 9.1)');

  // 5) High score persisted (Req 8.2): score 1 > initial 0.
  assert.equal(store._map.get(CONFIG.HIGH_SCORE_KEY), '1');
  assert.equal(world.highScore, 1);

  // Crashing again must not replay the game-over sound (Req 6.5).
  drive(CONFIG.DT_MIN, { flap: false });
  assert.equal(playCounts.gameOver, 1);
});
