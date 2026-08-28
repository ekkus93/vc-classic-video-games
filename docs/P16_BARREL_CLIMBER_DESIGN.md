# P16 Barrel Climber — Clean-Room Gameplay and Visual Design

Status: P16 implementation baseline
Canonical metadata: `src/games/barrel-climber/metadata.ts`
Canonical rules: `src/games/barrel-climber/design.ts`
Canonical stages: `src/games/barrel-climber/stages.ts`

## 1. Product identity

**Barrel Climber** is an original single-player scaffold-climbing arcade game set in the fictional **Copperline Tower**. The player is a compact maintenance runner ascending industrial gantries to reach a sequence of stranded service beacons while rolling **coil drums** spill through the structure.

The broad platform-and-ladder, jump-over-hazard mechanic family is intentionally recognizable as classic fixed-screen climbing gameplay. All shipped layouts, geometry, score values, character shapes, stage names, colors, audio, code, and progression rules are project-authored. No commercial level map, sprite, logo, sound, score table, ROM data, or source code is reproduced.

## 2. Visual language

The game uses the standard 320x240 logical framebuffer. Platforms are solid industrial gantries with a bright upper rail, short diagonal braces, narrow ladders, and high-contrast stage accents. The runner is rendered from simple filled geometric shapes: teal torso, warm face/helmet, magenta boots, and a small directional visor. Coil drums are compact circular hazards with a cross-spoke core rather than a copied barrel sprite.

Three stages deliberately use different platform offsets, ladder choices, palettes, and hazard descent probabilities:

1. **Copper Rise** — broad switchbacks introduce rolling edge drops and one high-probability hazard ladder near the top.
2. **Glassworks** — laterally offset decks create longer visible drops and two stronger hazard ladder routes.
3. **Night Crane** — narrower upper decks and more frequent ladder routing compress reaction time.

Each stage terminates at a project-authored service objective (`LIFT`, `VALVE`, or `CRANE`) on its upper deck.

## 3. Player controller

P16-002 calls for reuse/refinement of the Jungle Quest platformer controller. The authoritative P16 branch point contains Space Rocks but not the concurrently developed Jungle Quest branch, and P16 is prohibited from merging another parallel game branch. Therefore Barrel Climber implements the same reusable platformer concepts locally without introducing shared APIs or importing another game's internals.

The controller has three explicit modes:

- `grounded`: horizontal run constrained to the current platform;
- `airborne`: deterministic fixed-step jump arc with horizontal steering and one-way landing on the source gantry;
- `climbing`: X locks to the chosen ladder while vertical input moves between declared endpoints.

A ladder may be mounted upward from its bottom platform or downward from its top platform. Reaching either endpoint dismounts cleanly onto the connected platform. Jump uses the shared Action 1 pressed edge so held input cannot continuously retrigger takeoff.

## 4. Hazard model

Coil drums are hard-bounded to 12 active entities. A rolling drum follows the horizontal geometry of its current platform. At an exposed edge it enters a falling state, accelerates downward, and lands on the first lower platform whose horizontal span contains it. Selected ladders carry a project-owned hazard drop probability; a drum checks that probability only when crossing the ladder's X coordinate, using the injected seeded RNG. A successful choice transitions into a bounded ladder descent and dismounts onto the declared lower platform.

Difficulty scales rolling speed, spawn interval, spawn protection, and ladder-drop pressure. Level progression increases pressure under explicit speed/spawn caps. No `Math.random()` or wall-clock timing is used in game rules.

## 5. Objective, lives, and scoring

A run starts with three lives. Hazard contact outside spawn protection costs one life. A non-terminal hit resets the player to the current stage start, clears nearby hazards, and restores a bounded protection window. The final hit emits the sole terminal `game-over` event used for high-score submission.

Jumping fully above a nearby coil drum awards **120 points once per hazard per jump**. Reaching a stage beacon awards:

`700 + 140 * stageIndex + 90 * (level - 1)`

Clearing Night Crane wraps back to Copper Rise and increments the level. The run continues until all lives are exhausted.

## 6. Controls

| Logical action | Behavior |
| --- | --- |
| Left / Right | Run or steer during a jump |
| Up | Mount/climb upward on a nearby ladder |
| Down | Mount/climb downward on a nearby ladder |
| Action 1 | Jump / vault hazards |
| Pause | Open the shared pause overlay |

Keyboard and standard gamepad both arrive through the shared logical input service; the game reads no raw DOM key codes or Gamepad API state.

## 7. Audio and effects

Five short synthesized WAV assets are authored for this repository: rolling mechanism loop, jump chirp, vault confirmation, collision hit, and goal fanfare. The game routes them exclusively through the shared audio service. The rolling loop is explicitly stopped on pause, game over, reset, and destroy; the lifecycle host retains centralized `pauseAll`/`resumeAll`/`stopAll` ownership.

Transient geometric particles are deterministic and capped at 48. No gameplay entity or visual effect can grow without a hard bound.

## 8. Lifecycle and score ownership

`BARREL_CLIMBER_MODULE` follows the Space Rocks module pattern: reset the injected RNG from `GameStartOptions.seed`, construct one simulation/effects generation, read only logical input, render only through `GameRenderer`, submit score only from a terminal event, and release game-owned loop/effect state in `pause`/`destroy`. Rejected score persistence is caught and reported through the injected logger rather than escaping into the update path.

Launcher registration is one additive entry in `src/games/registry.ts`; no shared runtime, input, renderer, audio, persistence, lifecycle, or Tauri APIs are changed for P16.
