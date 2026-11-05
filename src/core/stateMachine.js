// Pure state machine: Ready <-> Playing <-> GameOver transitions and timers.
// Handles status transitions only; physics/pipes/scoring run in the engine
// while Playing. (Req 2, 6, 9)
//
// Design "Game Loop and State Machine Design".
import { hasCollision } from './collision.js';

export const States = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
});

/**
 * Reset Ghosty to the fixed Ready-state start position, stationary. (Req 2.2)
 * @returns {object} a new Ghosty
 */
export function readyGhosty(ghosty, dims, config) {
  return {
    ...ghosty,
    y: dims.height * config.GHOSTY_START_Y_FACTOR,
    vy: 0,
  };
}

/**
 * Advance only the status (and status-entry side effects on the world) based on
 * intents, elapsed dt, and collision. Returns a new world and whether a flap was
 * "consumed" by a transition (so the engine does not also apply an impulse).
 *
 * @returns {{ world: object, startedPlaying: boolean, enteredGameOver: boolean }}
 */
export function advanceState(world, intents, dt, config) {
  const { status } = world;

  if (status === States.READY) {
    if (intents.flap) {
      // Ready -> Playing: zero velocity, reset score, clear prompt. (Req 2.4, 2.5, 4.5, 7.1)
      const ghosty = { ...world.ghosty, vy: 0 };
      return {
        world: { ...world, status: States.PLAYING, ghosty, score: 0 },
        startedPlaying: true,
        enteredGameOver: false,
      };
    }
    // Non-flap input keeps Ready. (Req 2.6)
    return { world, startedPlaying: false, enteredGameOver: false };
  }

  if (status === States.PLAYING) {
    // Collision is evaluated by the engine after physics; see engine.step.
    return { world, startedPlaying: false, enteredGameOver: false };
  }

  // GAME_OVER: accumulate the lockout timer; a flap after the lockout restarts.
  if (status === States.GAME_OVER) {
    const elapsed = world.gameOverElapsed + dt * 1000;
    const base = { ...world, gameOverElapsed: elapsed };
    if (intents.flap && elapsed >= config.RESTART_LOCKOUT_MS) {
      // Reset to Ready: clear pipes, reset Ghosty, no impulse. (Req 9.7, 9.8, 9.9, 9.10)
      return {
        world: {
          ...base,
          status: States.READY,
          pipes: [],
          ghosty: readyGhosty(world.ghosty, world.dims, config),
          gameOverElapsed: 0,
        },
        startedPlaying: false,
        enteredGameOver: false,
      };
    }
    // Before the lockout, or no flap: stay in GameOver. (Req 9.6)
    return { world: base, startedPlaying: false, enteredGameOver: false };
  }

  return { world, startedPlaying: false, enteredGameOver: false };
}

/**
 * Evaluate collision for the Playing state and produce the GameOver transition.
 * A single boolean guarantees exactly one transition even for simultaneous
 * conditions (Req 6.4).
 *
 * @returns {{ world: object, enteredGameOver: boolean }}
 */
export function checkCollision(world, config) {
  if (world.status !== States.PLAYING) {
    return { world, enteredGameOver: false };
  }
  if (hasCollision(world.ghosty, world.pipes, world.dims)) {
    return {
      world: {
        ...world,
        status: States.GAME_OVER,
        finalScore: world.score, // Req 9.4
        gameOverElapsed: 0,
      },
      enteredGameOver: true,
    };
  }
  return { world, enteredGameOver: false };
}
