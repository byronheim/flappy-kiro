// Pure scoring. Increment once per pipe whose trailing (left) edge Ghosty has
// just crossed; never score the same pipe twice (Req 7.2). Mutates nothing.
//
// Design "Components and Interfaces > scoring.js".

/**
 * @param {number} score  current score
 * @param {object} ghosty
 * @param {object[]} pipes
 * @returns {{ score: number, pipes: object[] }}
 */
export function updateScore(score, ghosty, pipes) {
  let newScore = score;
  const ghostyLeft = ghosty.x;

  const newPipes = pipes.map((pipe) => {
    if (pipe.scored) return pipe;
    const trailingEdge = pipe.x + pipe.width;
    // Ghosty has fully passed the pipe when its left edge crosses the pipe's
    // trailing (right) edge.
    if (ghostyLeft > trailingEdge) {
      newScore += 1;
      return { ...pipe, scored: true };
    }
    return pipe;
  });

  return { score: newScore, pipes: newPipes };
}
