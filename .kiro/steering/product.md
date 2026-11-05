# Product

Flappy Kiro is a retro, browser-based endless scroller inspired by Flappy Bird. The player guides a ghost character named "Ghosty" through a continuous stream of vertical pipe gaps. Each flap applies an upward impulse; gravity continuously pulls Ghosty down. A point is scored for every pipe gap passed, and the game ends when Ghosty hits a pipe, the ground, or the top of the play area.

## Experience goals

- Pixel-art aesthetic: sky-blue background, green pipes with hard non-antialiased edges, semi-transparent parallax clouds.
- Zero-friction play: open a single `index.html` in a browser and play. No install, build step, or runtime dependency.
- Keyboard (spacebar) and pointer (click/tap) input, with a current-score and high-score display.
- High score persisted locally across sessions.

## Assets

Game ships with fixed assets in `assets/`:
- `ghosty.png` — the character sprite (falls back to a placeholder shape if it fails to load).
- `jump.wav` — played once per flap.
- `game_over.wav` — played once, non-looping, on game over.

## Scope

The initial version covers the core game (Requirements 1–10 in the spec). Ghosty color/flair customization and a best-distance ground marker (Requirements 11–13) are future enhancements and out of scope for now.
