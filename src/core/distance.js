// Pure core: best-distance tracking for the ground marker (Req 13). Distance is
// measured in the same units as pipe/ground scroll (pixels of world travel), so
// it maps directly to a screen offset in the renderer. No DOM, storage, or rng.
//
// Design "Extension Points > Best-distance ground marker".
import { pipeSpeed } from './pipes.js';

/**
 * @typedef {object} DistanceState
 * @property {number} distanceTraveled       world-space pixels travelled this session
 * @property {boolean} markerReached          one-shot: best-distance marker crossed this session
 * @property {number} markerHighlightElapsed  ms since the highlight began (0 until reached)
 */

/**
 * Advance distance-tracking for one Playing-state frame.
 *
 * - `distanceTraveled` grows by `pipeSpeed * dt`, independent of score (Req 13.1).
 * - When `distanceTraveled` first reaches `bestDistance` (and best > 0), the
 *   marker is "reached": set the one-shot flag exactly once and start the
 *   highlight timer (Req 13.4). The marker is never moved or removed; it keeps
 *   scrolling, which the renderer handles via the distance offset.
 * - While reached, accumulate the highlight timer so the renderer can show a
 *   brief, time-boxed highlight.
 *
 * @param {DistanceState} state  the relevant slice of the world
 * @param {number} dt            clamped seconds
 * @param {number} bestDistance  the stored best distance for this session
 * @param {{width:number}} dims
 * @param {object} config
 * @returns {{ state: DistanceState, reachedNow: boolean }}
 */
export function updateDistance(state, dt, bestDistance, dims, config) {
  const distanceTraveled = state.distanceTraveled + pipeSpeed(dims, config) * dt;

  // First crossing of a positive best distance this session (Req 13.4).
  const crossingNow =
    !state.markerReached && bestDistance > 0 && distanceTraveled >= bestDistance;

  const markerReached = state.markerReached || crossingNow;
  const markerHighlightElapsed = markerReached
    ? state.markerHighlightElapsed + dt * 1000
    : 0;

  return {
    state: { distanceTraveled, markerReached, markerHighlightElapsed },
    reachedNow: crossingNow,
  };
}

/**
 * On entering GameOver, compute the new best distance and whether it changed.
 * Best becomes the session distance only when it strictly exceeds the stored
 * best (Req 13.5).
 *
 * @param {number} sessionDistance
 * @param {number} priorBest
 * @returns {{ bestDistance: number, improved: boolean }}
 */
export function resolveBestDistance(sessionDistance, priorBest) {
  if (sessionDistance > priorBest) {
    return { bestDistance: sessionDistance, improved: true };
  }
  return { bestDistance: priorBest, improved: false };
}
