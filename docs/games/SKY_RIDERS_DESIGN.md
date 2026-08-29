# Sky Riders — Clean-Room Gameplay and Visual Design

Status: P12 implementation baseline
Canonical metadata: `src/games/sky-riders/metadata.ts`
Canonical rule constants: `src/games/sky-riders/design.ts`

## 1. Product identity

**Sky Riders** is an original aerial arena game about momentum, timed wingbeats, platform landings, and altitude contests against autonomous mounted opponents. The game uses a broad classic flap-and-duel mechanic family, but its arena geometry, names, scoring, silhouettes, colors, wave rules, AI, and audio are project-authored.

The player rides a compact mechanical sky-mount called a **Kitewing**. Opponents are **Storm Riders**. Defeated opponents leave a glowing **storm seed** that must be collected before it reforms into a new opponent.

No commercial cabinet art, sprites, source code, score table, arena layout, sound, animation data, or level/wave table is used.

## 2. Arena and visual language

Sky Riders targets the shared 320×240 logical framebuffer. The first arena, **Cloudbreak Steps**, is code-authored from four simple platforms:

- a full-width lower landing shelf;
- a left mid-height ledge;
- a right mid-height ledge at a different elevation;
- a narrow high central ledge.

Horizontal movement wraps at the left/right edges. The full-width lower shelf acts as the arena floor. Platforms are one-way landing surfaces: a descending rider whose feet cross a platform top is snapped to that top with zero vertical velocity. This crossing rule is the canonical anti-jitter landing rule.

Kitewings and Storm Riders use solid project-authored geometric silhouettes. The player mounts use cyan/gold and violet/mint accents; Storm Riders use warm red/orange accents. Storm seeds are small faceted diamonds. Background clouds are deterministic code-authored geometry.

## 3. Controls and local multiplayer

Sky Riders supports one-player and two-player local cooperative runs through the shared logical input service.

| Logical action | Behavior |
| --- | --- |
| Left / Right | Accelerate horizontally; momentum persists after release |
| Action 1 | One discrete upward flap impulse when the flap cadence gate is ready |
| Pause | Open the shared pause overlay |

Player 1 uses the configured player-1 keyboard/gamepad bindings. Player 2 uses the existing player-2 keyboard/gamepad bindings. Gameplay code never reads raw keyboard codes or Gamepad API state.

Two-player mode is cooperative: players share score and wave progression, retain separate reserve counts, do not defeat each other on contact, and may both collect storm seeds. A run ends when every participating player has exhausted reserves.

## 4. Physics

The physics model is deterministic for fixed input steps:

- gravity continuously increases downward velocity while airborne;
- left/right input accelerates horizontal velocity toward a fixed cap;
- horizontal drag gradually reduces velocity when input is released;
- Action 1 applies a fixed upward impulse and starts a short flap cooldown;
- a flap input received during cooldown is ignored;
- horizontal position wraps through the arena edges;
- downward velocity is capped to keep platform crossing stable at the fixed simulation step.

Because flaps are discrete and cadence-gated, the timing of successive presses materially changes altitude and trajectory.

## 5. Combat rule

Rider combat is resolved only when a player and Storm Rider overlap and neither participant has spawn protection.

The canonical altitude rule compares rider-center Y coordinates (smaller Y is higher):

- if one rider is at least **4 logical pixels** higher than the other, the higher rider wins;
- if the height difference is less than 4 pixels, the collision is a tie and both riders receive a
  deterministic separating bounce. The bounce sets, rather than adds to, both velocities, and the
  pair stays inside the overlap threshold for several frames while it separates, so a tie bounce
  applies only to a pair that is not already moving apart along the bounce axis. One collision
  therefore produces one bounce; a pair that closes again under its own power (an enemy turning
  back into the player before they finish separating) is a new collision and bounces again;
- no random value is consulted when deciding the winner.

A player victory removes that Storm Rider and awards the canonical defeat score. An enemy victory costs the player one reserve and respawns the player with temporary protection if reserves remain.

## 6. Storm-seed recovery mechanic

Every defeated Storm Rider creates exactly one storm seed. Seeds fall under gravity, settle on platforms using the same top-crossing rule, and remain collectible for a fixed recovery window.

- collecting a seed awards a recovery bonus and permanently removes that defeated opponent from the current wave;
- if the timer expires, the seed reforms into one Storm Rider at its current location;
- seed and enemy counts are hard-bounded by the maximum wave population.

A wave clears only when no Storm Riders and no storm seeds remain.

## 7. Waves, scoring, and difficulty

Project-owned scoring:

| Event | Points |
| --- | ---: |
| Defeat Storm Rider | `100 + 20 × (wave - 1)` |
| Collect storm seed | 175 |
| Clear wave | `400 + 100 × (wave - 1)` |

Difficulty profiles change initial enemy pressure and AI speed while retaining the same physics and combat rules:

| ID | Label | Wave-one enemies | Enemy speed scale |
| --- | --- | ---: | ---: |
| `breeze` | Breeze | 2 | 0.88× |
| `squall` | Squall | 3 | 1.00× |
| `tempest` | Tempest | 4 | 1.12× |

Wave population increases gradually and is capped at eight active/recoverable opponents. Enemy spawn choices and AI decision cadence use the shared seeded RNG, so a fixed seed and input stream reproduce the same run.

## 8. Audio and lifecycle

All audio is newly synthesized for this repository and routed only through the shared `AudioService`. Effects cover flap, altitude clash, enemy defeat, player hit, storm-seed collection, and wave completion. Global mute, pause, trusted-gesture unlock, and audio-context ownership remain platform responsibilities.

The game owns only its simulation and bounded transient visual-effect state. Restart reconstructs the run from the same seed through the shared host, while exit/destroy releases game state and relies on the runtime's centralized `stopAll()` cleanup.

## 9. Clean-room/content constraints

- no ROM, decompiled code, source, extracted level data, or commercial assets are used;
- no exact commercial arena, scoring table, enemy table, or title treatment is reproduced;
- all geometry is generated by project code;
- all bundled audio is synthesized specifically for this repository and declared original in the asset manifest/provenance registry;
- gameplay randomness comes only from the shared seeded RNG service.
