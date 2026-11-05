// Shell: translate raw keyboard/pointer events into a minimal Intents buffer
// drained once per frame. Event hygiene (auto-repeat suppression, bounds
// checks, same-frame collapse) lives here so the core sees plain booleans.
// (Req 3)
//
// Design "Input Handling".

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ drain: () => {flap: boolean}, destroy: () => void }}
 */
export function createInput(canvas, keyTarget) {
  // Capture the keyboard event target once (defaults to the global window in a
  // browser). Keeping a reference means add/remove use the same target even if
  // the global changes, which also makes the module testable without globals.
  const keys = keyTarget || (typeof window !== 'undefined' ? window : undefined);
  let flapQueued = false;
  let spaceHeld = false;

  const queueFlap = () => {
    // Collapse multiple same-frame flaps into a single intent.
    flapQueued = true;
  };

  const onKeyDown = (event) => {
    const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (!isSpace) return;
    // Ignore OS auto-repeat (Req 3.2).
    if (event.repeat) return;
    // A pressed flag guards against repeats that slip past event.repeat.
    if (spaceHeld) return;
    spaceHeld = true;
    queueFlap(); // Req 3.1
  };

  const onKeyUp = (event) => {
    const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (isSpace) spaceHeld = false;
  };

  const withinBounds = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
  };

  const onPointer = (event) => {
    // Pointer within the Play_Area bounds flaps; outside is ignored (Req 3.3, 3.4).
    const cx = event.clientX ?? (event.touches && event.touches[0] && event.touches[0].clientX);
    const cy = event.clientY ?? (event.touches && event.touches[0] && event.touches[0].clientY);
    if (cx === undefined || cy === undefined) return;
    if (withinBounds(cx, cy)) queueFlap();
  };

  if (keys) {
    keys.addEventListener('keydown', onKeyDown);
    keys.addEventListener('keyup', onKeyUp);
  }
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('touchstart', onPointer);

  return {
    drain() {
      const intents = { flap: flapQueued };
      flapQueued = false;
      return intents;
    },
    destroy() {
      if (keys) {
        keys.removeEventListener('keydown', onKeyDown);
        keys.removeEventListener('keyup', onKeyUp);
      }
      canvas.removeEventListener('pointerdown', onPointer);
      canvas.removeEventListener('touchstart', onPointer);
    },
  };
}

/**
 * Pure helper exposed for property testing: does a pointer at (x, y) relative to
 * a rect of the given size fall within the Play_Area? (Req 3.3, 3.4)
 */
export function pointerInBounds(x, y, width, height) {
  return x >= 0 && x <= width && y >= 0 && y <= height;
}
