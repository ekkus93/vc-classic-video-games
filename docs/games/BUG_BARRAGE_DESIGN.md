# Bug Barrage — Clean-Room Gameplay and Visual Design

Status: P11 production design baseline
Canonical metadata: `src/games/bug-barrage/metadata.ts`
Canonical rule constants: `src/games/bug-barrage/design.ts`

## Product identity

**Bug Barrage** is an original single-player arcade defense game set in a geometric **signal garden**. The player pilots a compact **Ward** emitter inside the lower defense region while segmented circuit-bug chains traverse a field of destructible **signal pods**.

The broad segmented-shooter mechanic family is intentionally recognizable, but all shipped names, geometry, scoring, colors, wave formulas, field generation, sounds, and enemy behaviors are project-authored. No commercial sprites, level layouts, score tables, ROM data, audio, branding, or source code are used.

## Core run loop

1. A seeded wave creates a bounded field of signal pods and one segmented chain.
2. The Ward moves freely in the lower defense region using four-direction logical input.
3. Action 1 fires bounded upward spark shots with a fixed cooldown.
4. Chain segments travel horizontally. Wall or pod contact reverses horizontal direction and moves that segment one row vertically.
5. Destroying a segment awards points and turns the impact location into a signal pod when the field cap allows it.
6. Destroying a middle segment splits the survivors into independently simulated chains.
7. **Skimmers** roam the lower region and threaten the Ward. **Menders** cross the field and repair damaged signal pods.
8. Spark impacts damage pods, destroy roamers, and destroy chain segments using swept collision so fast waves cannot tunnel through targets.
9. Contact with a chain segment or roamer costs one shield. The Ward respawns with bounded protection while the wave state continues.
10. Clearing every chain segment awards a wave bonus and starts a denser/faster seeded wave.
11. The run ends at zero shields. Only the terminal game-over event submits the shared score.

## Field and topology

The logical framebuffer is 320×240. The Ward is constrained to y=176..228. Signal pods are generated from a project-authored lattice and shuffled by the shared seeded RNG. Pods have three health states and can be damaged by the player or repaired by Menders.

Chain traversal is simulation-first rather than render-driven. Motion is internally sub-stepped to a maximum three logical pixels per topology probe, so wall/pod direction changes remain stable as wave speed rises and after arbitrary pod destruction/repair.

## Scoring

| Event | Points |
| --- | ---: |
| Destroy chain head | 70 |
| Destroy other segment | 40 |
| Damage signal pod | 5 |
| Destroy signal pod | 25 |
| Destroy Skimmer | 120 |
| Destroy Mender | 180 |
| Clear wave | `360 + 80 * (wave - 1)` |

## Difficulty

| ID | Label | Segment speed | Initial pods | Initial segments | Roamer cadence |
| --- | --- | ---: | ---: | ---: | ---: |
| `garden` | Garden | 0.82× | 24 | 9 | 1.20× interval |
| `swarm` | Swarm | 1.00× | 30 | 11 | 1.00× interval |
| `outbreak` | Outbreak | 1.18× | 36 | 13 | 0.82× interval |

All profiles use the same deterministic rules. Wave progression increases segment speed, segment count, pod density, and roaming pressure within explicit hard caps.

## Entity/resource bounds

- projectiles: 7;
- field obstacles: 56;
- independent chains: 32;
- total chain segments: 40;
- roaming enemies: 6;
- transient effect particles: 72.

These limits are invariants checked by the simulation and covered by automated tests.

## Controls

| Logical action | Behavior |
| --- | --- |
| Left / Right | Move Ward horizontally |
| Up / Down | Move Ward vertically inside the lower region |
| Action 1 | Fire spark |
| Pause | Open shared pause overlay |

Keyboard and standard gamepad input both reach these logical actions through the shared input stack. Bug Barrage never reads browser key codes or the Gamepad API directly.

## Audio and rendering

All game visuals are renderer primitives: circles, polygons, lines, and rectangles. The signal-garden palette uses dark greens/blues, amber chain segments, teal player geometry, and distinct colors for Skimmers and Menders.

The five bundled WAV effects (`spark`, `segment`, `pod`, `hit`, `wave`) are original synthesized waveforms generated for this repository. They are routed exclusively through the shared audio service, so global mute, pause/resume, trusted-gesture unlock, and centralized teardown remain platform-owned.

## Clean-room constraints

- no extracted or traced commercial art;
- no sampled commercial audio;
- no copied maze/field/wave tables;
- no copied title lettering or branding;
- no source/decompiled/ROM-derived behavior tables;
- deterministic generation uses only project-owned algorithms and the shared RNG;
- bundled assets are project-authored and listed in the repository provenance record.
