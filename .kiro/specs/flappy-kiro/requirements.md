# Requirements Document

## Introduction

Flappy Kiro is a retro, browser-based endless scroller game inspired by the classic Flappy Bird. The player guides a ghost character named "Ghosty" through a continuous series of vertical pipe gaps. Each flap lifts Ghosty upward, and gravity continuously pulls Ghosty down. The player scores a point for every pipe gap successfully passed, and the game ends when Ghosty collides with a pipe, the ground, or the top of the play area. The game presents a pixel-art aesthetic with a sky-blue background, green pipes, decorative cloud shapes, and a current-score and high-score display. The game uses the provided assets: `ghosty.png` for the character sprite, `jump.wav` for the flap action, and `game_over.wav` for the game-over event.

## Glossary

- **Game**: The complete Flappy Kiro browser application, including rendering, physics, input handling, scoring, and audio.
- **Ghosty**: The player-controlled ghost character that moves vertically within the play area.
- **Play_Area**: The bounded rectangular region in which Ghosty moves and pipes scroll, bounded by a top edge and a bottom edge (the ground).
- **Pipe_Pair**: A matched top pipe and bottom pipe separated by a vertical Pipe_Gap, through which Ghosty must pass.
- **Pipe_Gap**: The vertical opening between the top pipe and bottom pipe of a Pipe_Pair.
- **Ground**: The solid bottom boundary of the Play_Area.
- **Flap**: A player-initiated input action that applies an upward impulse to Ghosty.
- **Gravity**: The constant downward acceleration continuously applied to Ghosty.
- **Score**: The count of Pipe_Pairs the player has successfully passed in the current game session.
- **High_Score**: The highest Score achieved across game sessions, persisted in the browser.
- **Score_Display**: The on-screen text showing the current Score and the High_Score.
- **Ready_State**: The state before a game session begins, awaiting the player's first Flap.
- **Playing_State**: The state during active play, while Ghosty is alive and pipes are scrolling.
- **Game_Over_State**: The state after Ghosty collides, when play has stopped and a restart prompt is shown.
- **Audio_Engine**: The component responsible for playing sound effects.
- **Customization**: The set of player-selected visual options for Ghosty, consisting of a color and optional flair items.
- **Color_Palette**: A fixed, predefined set of selectable colors that can be applied to Ghosty.
- **Flair**: An optional decorative accessory rendered on Ghosty, organized into slots (for example, a hat slot and an accessory slot).
- **Flair_Slot**: A named category of Flair (for example, "hat" or "accessory") that can hold at most one Flair item at a time.
- **Distance_Traveled**: A measure of how far the player has progressed in the current session, increasing continuously while in the Playing_State, independent of the Score.
- **Best_Distance**: The greatest Distance_Traveled achieved across game sessions, persisted in the browser.
- **Distance_Marker**: An on-the-Ground visual indicator rendered at the Best_Distance position that scrolls toward the player as the game progresses.
- **Cloud**: A semi-transparent decorative shape rendered in the Play_Area background to create visual depth.
- **Parallax**: A depth effect in which background Clouds scroll horizontally at speeds slower than the Pipe_Pairs, with Clouds intended to appear farther away moving more slowly than Clouds intended to appear nearer.

## Requirements

### Requirement 1: Render the Game Scene

**User Story:** As a player, I want to see a retro pixel-art game scene, so that the game matches the intended visual style.

#### Acceptance Criteria

1. WHEN the Game loads, THE Game SHALL render the Play_Area as a rectangular canvas region filling the full width and height allocated to the Game, with a solid sky-blue background covering the entire Play_Area.
2. WHEN the Game loads, THE Game SHALL render a Ground strip spanning the full width of the Play_Area along its bottom edge, with a fixed height between 5% and 20% of the Play_Area height.
3. WHEN the Game loads, THE Game SHALL render Ghosty using the `ghosty.png` sprite asset, positioned fully within the Play_Area bounds and sized so that Ghosty's height is between 5% and 15% of the Play_Area height.
4. IF the `ghosty.png` sprite asset fails to load when the Game loads, THEN THE Game SHALL render Ghosty as a solid placeholder shape occupying the same bounds and SHALL continue rendering the remaining scene elements.
5. WHEN the Game renders a Pipe_Pair, THE Game SHALL render both the top pipe and the bottom pipe of the Pipe_Pair as green rectangular shapes with hard, non-antialiased pixel edges.
6. WHERE Clouds are enabled, THE Game SHALL render one or more Clouds positioned behind Ghosty and the Pipe_Pairs within the Play_Area background.
7. WHERE Clouds are enabled, THE Game SHALL render each Cloud as semi-transparent with an opacity between 20% and 80%, so that the sky-blue background remains partially visible through each Cloud.
8. WHILE the Game is in the Playing_State AND Clouds are enabled, THE Game SHALL scroll Clouds horizontally from the right edge toward the left edge at Parallax speeds that are slower than the Pipe_Pair scroll speed AND at least a fixed minimum Cloud scroll speed greater than 0, so that Clouds continue to move even when the Pipe_Pair scroll speed is very low.
9. WHERE Clouds are enabled AND more than one Cloud depth layer is present, THE Game SHALL scroll Clouds in a nearer depth layer faster than Clouds in a farther depth layer to produce a Parallax effect.
10. WHEN a Cloud has scrolled fully past the left edge of the Play_Area, THE Game SHALL remove or reposition that Cloud so that Clouds continue to populate the background.

### Requirement 2: Start the Game

**User Story:** As a player, I want the game to wait for my first input before starting, so that I can prepare before play begins.

#### Acceptance Criteria

1. WHEN the Game finishes loading all required assets, THE Game SHALL enter the Ready_State within 100 milliseconds.
2. WHILE the Game is in the Ready_State, THE Game SHALL hold Ghosty stationary at a fixed vertical position and SHALL NOT apply Gravity.
3. WHILE the Game is in the Ready_State, THE Game SHALL display a visible start prompt instructing the player to Flap to begin.
4. WHEN the player performs a Flap during the Ready_State, THE Game SHALL transition to the Playing_State within 100 milliseconds.
5. WHEN the Game transitions to the Playing_State, THE Game SHALL remove the start prompt from display.
6. IF the player performs any input other than a Flap during the Ready_State, THEN THE Game SHALL remain in the Ready_State and SHALL NOT transition to the Playing_State.

### Requirement 3: Flap Input

**User Story:** As a player, I want to flap Ghosty upward with a control, so that I can navigate through the pipes.

#### Acceptance Criteria

1. WHEN the player presses the spacebar down one time during the Playing_State, THE Game SHALL perform exactly one Flap and apply a single upward impulse to Ghosty.
2. WHILE the spacebar is held down after its initial press during the Playing_State, THE Game SHALL ignore operating-system key auto-repeat events and SHALL NOT perform any additional Flap until the spacebar is released and pressed again.
3. WHEN the player clicks or taps at a position within the bounds of the Play_Area during the Playing_State, THE Game SHALL perform exactly one Flap and apply a single upward impulse to Ghosty.
4. IF the player clicks or taps at a position outside the bounds of the Play_Area during the Playing_State, THEN THE Game SHALL NOT perform a Flap and SHALL NOT apply an upward impulse to Ghosty.
5. WHEN a Flap is performed during the Playing_State, THE Audio_Engine SHALL play the `jump.wav` sound effect exactly once per Flap.

### Requirement 4: Gravity and Vertical Movement

**User Story:** As a player, I want Ghosty to fall under gravity between flaps, so that the game provides a continuous challenge.

#### Acceptance Criteria

1. WHILE the Game is in the Playing_State, THE Game SHALL continuously apply Gravity to Ghosty as a constant downward acceleration in the range of 800 to 2400 pixels per second squared.
2. WHILE the Game is in the Playing_State, THE Game SHALL update Ghosty's vertical position on each animation frame by integrating Ghosty's current vertical velocity over the elapsed frame time.
3. WHILE the Game is in the Playing_State, THE Game SHALL limit Ghosty's downward vertical velocity to a maximum of 1200 pixels per second.
4. WHEN an upward impulse is applied to Ghosty, THE Game SHALL set Ghosty's vertical velocity to a fixed upward value in the range of 300 to 700 pixels per second, and IF a requested upward impulse value falls outside that range, THEN THE Game SHALL clamp the value to the nearest boundary of the range before applying it.
5. WHEN the Game transitions from the Ready_State to the Playing_State, THE Game SHALL set Ghosty's vertical velocity to 0 pixels per second before Gravity is first applied.

### Requirement 5: Pipe Generation and Scrolling

**User Story:** As a player, I want an endless stream of pipes to navigate, so that the game continues indefinitely until I lose.

#### Acceptance Criteria

1. WHILE the Game is in the Playing_State, THE Game SHALL scroll all Pipe_Pairs horizontally from the right edge toward the left edge at a constant speed equal to 0.35 Play_Area widths per second.
2. WHILE the Game is in the Playing_State, THE Game SHALL generate new Pipe_Pairs such that the horizontal distance between the left edge of each Pipe_Pair and the left edge of the previously generated Pipe_Pair equals a fixed value of 0.5 times the Play_Area width.
3. WHEN a new Pipe_Pair is generated, THE Game SHALL place the top boundary of the Pipe_Gap no closer than 0.1 times the Play_Area height from the top edge of the Play_Area and the bottom boundary of the Pipe_Gap no closer than 0.1 times the Play_Area height above the Ground, selecting the vertical position at random within those bounds.
4. WHEN a new Pipe_Pair is generated, THE Game SHALL set the Pipe_Gap height to a fixed value equal to 2.5 times Ghosty's sprite height.
5. WHEN the right edge of a Pipe_Pair has scrolled past the left edge of the Play_Area, THE Game SHALL remove that Pipe_Pair from the scene.

### Requirement 6: Collision Detection

**User Story:** As a player, I want the game to end when Ghosty crashes, so that there is a clear consequence for failure.

#### Acceptance Criteria

1. IF the bounding box of Ghosty's rendered sprite contacts or overlaps the boundary of any pipe of a Pipe_Pair during the Playing_State, THEN THE Game SHALL transition to the Game_Over_State.
2. IF the bounding box of Ghosty's rendered sprite contacts or overlaps the top boundary of the Ground during the Playing_State, THEN THE Game SHALL transition to the Game_Over_State.
3. IF the bounding box of Ghosty's rendered sprite contacts or crosses the top edge of the Play_Area during the Playing_State, THEN THE Game SHALL transition to the Game_Over_State.
4. IF two or more collision conditions among criteria 1 through 3 are detected within the same animation frame during the Playing_State, THEN THE Game SHALL perform exactly one transition to the Game_Over_State.
5. WHILE the Game is in the Game_Over_State, THE Game SHALL NOT evaluate collision conditions and SHALL NOT perform any further transition to the Game_Over_State.

### Requirement 7: Scoring

**User Story:** As a player, I want to earn points for passing pipes, so that I can measure my performance.

#### Acceptance Criteria

1. WHEN the Game enters the Playing_State for a new session, THE Game SHALL set the Score to 0.
2. WHEN Ghosty's horizontal position first crosses the trailing (left) edge of a Pipe_Pair's Pipe_Gap during the Playing_State, THE Game SHALL increase the Score by exactly 1 and SHALL mark that Pipe_Pair as scored so that no further Score increase occurs for the same Pipe_Pair.
3. WHILE the Game is in the Playing_State, THE Score_Display SHALL show the current Score as a non-negative integer and SHALL update the shown value to match the current Score within one animation frame of any change to the Score.
4. THE Score_Display SHALL show the High_Score as a non-negative integer alongside the current Score.

### Requirement 8: High Score Persistence

**User Story:** As a player, I want my best score to be remembered, so that I can try to beat it across sessions.

#### Acceptance Criteria

1. WHEN the Game enters the Game_Over_State AND the Score is greater than the stored High_Score, THE Game SHALL set the High_Score to the Score.
2. WHEN the High_Score changes, THE Game SHALL persist the updated High_Score value to browser local storage within 1 second.
3. IF persisting the High_Score to browser local storage fails, THEN THE Game SHALL retain the current in-memory High_Score for the remainder of the session and continue gameplay without interruption.
4. WHEN the Game loads, THE Game SHALL read the High_Score from browser local storage and set the in-memory High_Score to the retrieved value.
5. IF no High_Score is stored when the Game loads, THEN THE Game SHALL set the High_Score to 0.
6. IF the High_Score value read from browser local storage is missing, non-numeric, negative, or not an integer, THEN THE Game SHALL set the High_Score to 0.

### Requirement 9: Game Over and Restart

**User Story:** As a player, I want clear feedback when I lose and an easy way to try again, so that I can keep playing.

#### Acceptance Criteria

1. WHEN the Game enters the Game_Over_State, THE Audio_Engine SHALL play the `game_over.wav` sound effect exactly once, without looping.
2. WHEN the Game enters the Game_Over_State, THE Game SHALL stop scrolling all Pipe_Pairs so that every Pipe_Pair remains at its horizontal position held at the moment of entry.
3. WHEN the Game enters the Game_Over_State, THE Game SHALL stop applying Gravity to Ghosty and SHALL hold Ghosty stationary.
4. WHEN the Game enters the Game_Over_State, THE Game SHALL capture the current Score as the final Score and SHALL NOT change the final Score while the Game remains in the Game_Over_State.
5. WHILE the Game is in the Game_Over_State, THE Game SHALL display a game-over message showing the final Score and a restart prompt.
6. WHILE the Game is in the Game_Over_State AND fewer than 500 milliseconds have elapsed since the Game entered the Game_Over_State, THE Game SHALL ignore all Flap inputs.
7. WHILE the Game is in the Game_Over_State AND at least 500 milliseconds have elapsed since the Game entered the Game_Over_State, WHEN the player performs a Flap, THE Game SHALL reset Ghosty to the starting position.
8. WHILE the Game is in the Game_Over_State AND at least 500 milliseconds have elapsed since the Game entered the Game_Over_State, WHEN the player performs a Flap, THE Game SHALL remove all Pipe_Pairs from the scene.
9. WHILE the Game is in the Game_Over_State AND at least 500 milliseconds have elapsed since the Game entered the Game_Over_State, WHEN the player performs a Flap, THE Game SHALL transition to the Ready_State.
10. WHILE the Game is in the Game_Over_State, THE Game SHALL NOT apply an upward impulse to Ghosty in response to a Flap.

### Requirement 10: Game Loop and Rendering Cadence

**User Story:** As a player, I want smooth continuous motion, so that the game feels responsive and playable.

#### Acceptance Criteria

1. WHILE the Game is in the Playing_State, THE Game SHALL update physics and redraw the Play_Area once per animation frame at a target cadence of 60 frames per second, and SHALL maintain a sustained cadence of at least 30 frames per second.
2. WHILE the Game is in the Playing_State, THE Game SHALL render Ghosty, every Pipe_Pair at least partially within the horizontal bounds of the Play_Area, the Ground, and the Score_Display on each animation frame.
3. WHILE the Game is in the Playing_State, THE Game SHALL advance Ghosty's position, Gravity, and Pipe_Pair scrolling using the elapsed time since the previous animation frame, so that the on-screen motion speed of Ghosty and Pipe_Pairs stays constant across frame intervals ranging from 16 milliseconds to 100 milliseconds.
4. IF the browser tab or window hosting the Game becomes hidden during the Playing_State, THEN THE Game SHALL pause physics updates and SHALL resume them from the paused state when the tab or window becomes visible again, without advancing Ghosty or Pipe_Pairs by the hidden interval.

### Requirement 14: Configurable Gameplay and Difficulty Modes

**User Story:** As a player, I want to adjust the game's difficulty and tune its gameplay parameters, so that I can make the game easier or harder to suit my skill.

_Note on prior requirements: the specific gameplay values fixed in Requirements 4 and 5 (Gravity, flap impulse, max fall speed, pipe scroll speed, pipe spacing, gap margin, and gap height multiple) are now the **default** values of configurable parameters rather than immutable constants. With no configuration applied, the Game behaves exactly as Requirements 1–10 specify; the criteria below add the ability to deliberately change them within bounded ranges. The frame-time clamp (Req 10.3), cloud opacity bounds (Req 1.7), and restart lockout (Req 9.6) remain fixed invariants and are not configurable._

#### Acceptance Criteria

1. THE Game SHALL provide three difficulty modes — Easy, Normal, and Hard — each defining a named set of gameplay parameters (at minimum: Gravity, flap impulse, max fall speed, Pipe_Pair scroll speed, Pipe_Pair spacing, and Pipe_Gap height).
2. THE Normal difficulty SHALL use parameter values equal to the defaults specified in Requirements 4 and 5, so that Normal behaves exactly as the initial version.
3. THE Easy difficulty SHALL be more forgiving than Hard across its parameters: wider Pipe_Gap, greater Pipe_Pair spacing, slower scroll speed, and gentler Gravity.
4. WHEN the player selects a difficulty mode, THE Game SHALL apply that mode's parameters and SHALL start a fresh Ready_State so the new parameters take effect from the next session.
5. THE Game SHALL allow gameplay parameters to be configured within bounded ranges, and THE Game SHALL clamp any configured value to its allowed range so that a configuration can never produce an invalid game state.
6. WHILE no difficulty mode or configuration is explicitly selected, THE Game SHALL default to Normal difficulty with the Requirements 1–10 default values.
7. THE Game SHALL keep the frame-time clamp, cloud opacity bounds, and restart lockout fixed and SHALL NOT allow them to be changed by player- or URL-supplied configuration.

### Requirement 15: Play Area Aspect

**User Story:** As a player, I want a wide view of the scene, so that a side-scroller gives me enough room to see approaching pipes.

#### Acceptance Criteria

1. THE Game SHALL present the Play_Area in a wide (landscape) aspect ratio suited to a horizontally scrolling game.
2. WHERE the Play_Area dimensions change, THE Game SHALL resolve all size- and distance-related parameters relative to the Play_Area dimensions so that gameplay scales consistently with the view size.

### Requirement 16: Environment Themes

**User Story:** As a player, I want to choose the scene's environment, so that I can play against different backdrops such as a forest or an evil lair instead of only the default sky.

#### Acceptance Criteria

1. THE Game SHALL provide a fixed set of predefined selectable Environments, each defining a full scene palette (background, ground, pipe, pipe cap, cloud, and HUD colors).
2. THE Game SHALL include a default Environment that reproduces the original sky-blue background with green pipes, so that selecting no Environment leaves the default look unchanged.
3. WHEN the player selects an Environment, THE Game SHALL render the background, Ground, Pipe_Pairs, Clouds, and HUD using that Environment's palette.
4. WHEN the player selects an Environment, THE Game SHALL persist the selected Environment to browser local storage.
5. WHEN the Game loads, THE Game SHALL read the persisted Environment from browser local storage and apply it.
6. IF no Environment is stored when the Game loads, OR the stored Environment is not a member of the predefined set, THEN THE Game SHALL apply the default Environment.

## Future Enhancements

_The requirements in this section are out of scope for the initial release and are not part of the initial version of Flappy Kiro. They are documented here as future enhancements and will be addressed in a later iteration._

### Requirement 11: Ghosty Color Customization

**User Story:** As a player, I want to choose Ghosty's color from a palette, so that I can personalize my character.

#### Acceptance Criteria

1. THE Game SHALL provide a Color_Palette containing a fixed set of predefined selectable colors.
2. WHEN the player selects a color from the Color_Palette, THE Game SHALL apply that color to Ghosty's rendered sprite.
3. WHEN the player selects a color from the Color_Palette, THE Game SHALL persist the selected color to browser local storage.
4. WHEN the Game loads, THE Game SHALL read the persisted color selection from browser local storage and apply it to Ghosty.
5. IF no color selection is stored when the Game loads, OR the stored color is not a member of the Color_Palette, THEN THE Game SHALL apply a default color from the Color_Palette to Ghosty.

### Requirement 12: Ghosty Flair Customization

**User Story:** As a player, I want to add flair such as a hat or scarf to Ghosty, so that I can further personalize my character.

#### Acceptance Criteria

1. THE Game SHALL provide a predefined set of Flair items, each belonging to exactly one Flair_Slot.
2. THE Game SHALL allow at most one Flair item to be selected per Flair_Slot at any time.
3. WHEN the player selects a Flair item for a Flair_Slot that already holds a Flair item, THE Game SHALL replace the previously selected Flair item in that Flair_Slot with the newly selected Flair item.
4. WHILE a Flair item is selected for a Flair_Slot, THE Game SHALL render that Flair item on Ghosty positioned according to its Flair_Slot in every state where Ghosty is rendered.
5. WHEN the player changes the Flair selection for any Flair_Slot, THE Game SHALL persist the current Flair selections to browser local storage.
6. WHEN the Game loads, THE Game SHALL read the persisted Flair selections from browser local storage and apply them to Ghosty.
7. IF a persisted Flair selection references a Flair item that is not in the predefined set, THEN THE Game SHALL treat that Flair_Slot as empty.
8. WHEN the player clears the Flair selection for a Flair_Slot, THE Game SHALL render Ghosty without any Flair item in that Flair_Slot.
9. IF the Game is unable to read or apply the persisted Flair selections when the Game loads, THEN THE Game SHALL render Ghosty with no Flair in any Flair_Slot.

### Requirement 13: Best Distance Ground Marker

**User Story:** As a player, I want a marker on the ground showing my longest distance, so that I have a visible target to beat.

#### Acceptance Criteria

1. WHILE the Game is in the Playing_State, THE Game SHALL increase Distance_Traveled continuously based on the elapsed time since the previous animation frame, independent of the Score.
2. WHEN the Game enters the Playing_State for a new session, THE Game SHALL set Distance_Traveled to 0.
3. WHILE the Game is in the Playing_State AND the Best_Distance is greater than 0, THE Game SHALL render a Distance_Marker on the Ground at the horizontal position corresponding to the Best_Distance, scrolling it toward the left edge at the same speed as the Ground and Pipe_Pairs.
4. WHEN Ghosty's horizontal position first crosses the horizontal position of the Distance_Marker during the Playing_State, THE Game SHALL display a brief visual highlight exactly once for that session indicating the player has reached the Best_Distance, SHALL NOT display the highlight again during the same session, and SHALL leave the Distance_Marker in place so that it continues scrolling past.
5. WHEN the Game enters the Game_Over_State AND the session's Distance_Traveled is greater than the stored Best_Distance, THE Game SHALL set the Best_Distance to the session's Distance_Traveled and SHALL persist the Best_Distance to browser local storage.
6. WHEN the Game loads, THE Game SHALL read the Best_Distance from browser local storage.
7. IF no Best_Distance is stored when the Game loads, OR the stored Best_Distance is missing, non-numeric, or negative, THEN THE Game SHALL set the Best_Distance to 0.
