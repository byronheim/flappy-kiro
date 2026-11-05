// Pure engine: the step() orchestrator and world factory. Given a world, dt,
// intents, an injected rng, and the effective config, it returns a new world
// plus a list of effects (playSound, persistHighScore). It never touches the
// DOM, window, Math.random, or localStorage.
//
// Design "Architecture > Data flow per frame", "Components and Interfaces > engine.js".
import { States, advanceState, checkCollision } from './stateMachine.js';
import { applyGravity, integrate, applyFlap } from './physics.js';
import { updatePipes, cullPipes } from './pipes.js';
import { updateScore } from './scoring.js';
import { seedClouds, updateClouds } from './clouds.js';

/** @returns {number} Ghosty's height resolved from the play area. */
function ghostyHeight(dims, config) {
  return dims.height * config.GHOSTY_HEIGHT_FACTOR;
}

/**
 * Create a fresh Ready-state world sized to the given play area.
 * @param {{width:number,height:number,groundHeight:number}} dims
 * @param {number} highScore
 * @param {object} config
 * @param {() => number} [rng]
 * @returns {object} World
 */
export function createWorld(dims, highScore, config, rng = Math.random) {
  const h = ghostyHeight(dims, config);
  const w = h; // square sprite bounds
  const ghosty = {
    x: dims.width * 0.25,
    y: dims.height * config.GHOSTY_START_Y_FACTOR,
    vy: 0,
    w,
    h,
  };
  return {
    status: States.READY,
    dims,
    ghosty,
    pipes: [],
    clouds: seedClouds(dims, rng, config),
    score: 0,
    highScore,
    finalScore: 0,
    distanceSincePipe: 0,
    gameOverElapsed: 0,
    nextPipeId: 0,
  };
}

/**
 * Advance the world by dt seconds given player intents.
 * @returns {{ state: object, effects: object[] }}
 */
export function step(state, dt, intents, rng, config) {
  const effects = [];

  // 1) State transitions (Ready->Playing, GameOver timers/restart).
  const transition = advanceState(state, intents, dt, config);
  let world = transition.world;

  // Clouds drift in every live state for ambiance; they are pure and cheap.
  // (Only meaningful motion occurs while time advances.)
  if (world.status === States.PLAYING) {
    // 2) Flap impulse (only a flap that did NOT start the game produces an impulse).
    let ghosty = world.ghosty;
    if (intents.flap && !transition.startedPlaying) {
      ghosty = applyFlap(ghosty, config);
      effects.push({ type: 'playSound', name: 'jump' }); // Req 3.5
    }

    // 3) Physics: gravity + integration.
    ghosty = integrate(applyGravity(ghosty, dt, config), dt);

    // 4) Pipes: scroll, spawn, cull.
    const pu = updatePipes(
      world.pipes,
      world.dims,
      dt,
      rng,
      config,
      ghosty.h,
      world.nextPipeId,
      world.distanceSincePipe
    );
    const pipesCulled = cullPipes(pu.pipes);

    // 5) Clouds parallax.
    const clouds = updateClouds(world.clouds, world.dims, dt, rng, config);

    // 6) Scoring.
    const scored = updateScore(world.score, ghosty, pipesCulled);

    world = {
      ...world,
      ghosty,
      pipes: scored.pipes,
      clouds,
      score: scored.score,
      nextPipeId: pu.nextPipeId,
      distanceSincePipe: pu.distanceSincePipe,
    };

    // 7) Collision -> GameOver (exactly one transition). (Req 6.1-6.4)
    const col = checkCollision(world, config);
    world = col.world;
    if (col.enteredGameOver) {
      effects.push({ type: 'playSound', name: 'gameOver' }); // Req 9.1
      if (world.score > world.highScore) {
        world = { ...world, highScore: world.score }; // Req 8.1
        effects.push({ type: 'persistHighScore', value: world.highScore }); // Req 8.2
      }
    }
  }

  return { state: world, effects };
}
