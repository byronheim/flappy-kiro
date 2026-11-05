// Shell: wrap the two sound assets as HTMLAudioElements and expose play(name).
// Driven only by effects forwarded from the loop; never called by the core.
// (Req 3.5, 9.1)
//
// Design "Audio".

/**
 * @param {{ jump: HTMLAudioElement, gameOver: HTMLAudioElement }} assets
 * @returns {{ play: (name: 'jump'|'gameOver') => void }}
 */
export function createAudio(assets) {
  const play = (name) => {
    const el = assets[name];
    if (!el) return;
    try {
      el.loop = false;
      // Reset so rapid re-triggers (e.g. fast flaps) each produce a sound.
      el.currentTime = 0;
      const result = el.play();
      // Swallow autoplay/promise rejections so gameplay is unaffected.
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch {
      // Ignore audio failures entirely.
    }
  };

  return { play };
}

/**
 * Forward a list of engine effects to the audio engine, playing the right
 * sound for each `playSound` effect. Other effect types are ignored here.
 */
export function handleAudioEffects(audio, effects) {
  for (const effect of effects) {
    if (effect.type === 'playSound') audio.play(effect.name);
  }
}
