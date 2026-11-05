// Pure collision detection. AABB overlap of Ghosty vs pipes, ground, ceiling.
// A single boolean OR over all conditions guarantees simultaneous conditions
// count as one (Req 6.1-6.4). Functions never mutate their inputs.
//
// Design "Components and Interfaces > collision.js".

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */

/**
 * @returns {boolean} true if two axis-aligned boxes overlap or touch.
 */
export function aabbOverlap(a, b) {
  return (
    a.x <= b.x + b.w &&
    a.x + a.w >= b.x &&
    a.y <= b.y + b.h &&
    a.y + a.h >= b.y
  );
}

/**
 * Build the top and bottom pipe boxes for a pipe pair over the play area.
 * @returns {Box[]}
 */
function pipeBoxes(pipe, dims) {
  const top = { x: pipe.x, y: 0, w: pipe.width, h: pipe.gapTop };
  const bottom = {
    x: pipe.x,
    y: pipe.gapBottom,
    w: pipe.width,
    h: dims.height - pipe.gapBottom,
  };
  return [top, bottom];
}

/**
 * @returns {boolean} true if Ghosty hits any pipe, the ground, or the ceiling.
 * (Req 6.1, 6.2, 6.3, 6.4)
 */
export function hasCollision(ghosty, pipes, dims) {
  const box = { x: ghosty.x, y: ghosty.y, w: ghosty.w, h: ghosty.h };

  // Ceiling (top edge of play area). (Req 6.3)
  if (box.y <= 0) return true;

  // Ground (top boundary of the ground strip). (Req 6.2)
  const groundTop = dims.height - dims.groundHeight;
  if (box.y + box.h >= groundTop) return true;

  // Pipes. (Req 6.1)
  for (const pipe of pipes) {
    for (const pb of pipeBoxes(pipe, dims)) {
      if (aabbOverlap(box, pb)) return true;
    }
  }

  return false;
}
