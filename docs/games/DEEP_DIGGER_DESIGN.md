# Deep Digger — Clean-Room Game Design

Deep Digger is an original tunnel-action game built for the VC Classic Video Games shared runtime. Its commercial inspiration is limited to broad genre mechanics described in `docs/SPEC.md`; this design, naming, scoring, layout, visual vocabulary, audio, and source code are project-authored.

## Original setting and visual language

The player is a **lattice surveyor** working downward through the **Copper Lattice**, a 24×16 earth grid. The player is rendered as a cyan survey suit with a yellow helmet band. Enemies are green **stalkers** that can temporarily become violet phased forms. Unstable stone is rendered as angular copper-colored rock. Earth bands shift from clay-orange to plum with depth.

The first layout is a project-authored branching tunnel lattice. It is intentionally not a transcription of any commercial level, maze, sprite, score table, or timing table.

## Rules

- Logical framebuffer: 320×240.
- Earth field: 24×16 cells, 10 pixels per cell, offset below the HUD.
- One player, keyboard or standard gamepad through shared logical actions.
- Directional movement is cell-based and fixed-step deterministic.
- Entering a solid adjacent cell carves it and changes tunnel topology in that same simulation update.
- Every newly carved earth cell awards 2 points.
- Stalkers normally use breadth-first search over current tunnel topology.
- If no tunnel path reaches the player, a stalker may enter a temporary phased state and cross solid earth without carving it. Seeded RNG only breaks equal-axis phase choices.
- The pressure line travels along open tunnel cells in the player's facing direction. A stalker needs three pressure hits before the stage timer decays to be defeated.
- Pressure defeat begins at 250 points and increases by 25 points per completed depth.
- Embedded rocks become unstable as soon as the cell below them is excavated. After a difficulty-scaled shake delay, they fall one cell at a deterministic cadence through open tunnel cells.
- Falling rocks can crush stalkers for 500 points. Rock landing adds 20 points per fallen cell.
- The run begins with three lives. Contact with a stalker or falling rock removes one life; nonterminal hits respawn the surveyor with a short invulnerability window.
- Clearing all stalkers awards a depth bonus (400 + 100 per prior depth), rebuilds the authored lattice, increases bounded enemy/rock pressure, and preserves score/lives.
- Enemy count is capped at 8, rocks at 5, and transient visual particles at 56.
- A score is submitted exactly once when the final life ends. Persistence rejection is logged and contained without breaking the shell.

## Difficulty profiles

- **Survey** — 3 initial stalkers, slower tunnel movement, longer phase cooldown, longer rock warning.
- **Bore** — 4 initial stalkers and baseline timings.
- **Mantle** — 5 initial stalkers, faster pursuit/phasing, shorter rock warning.

Wave progression adds one stalker every two waves and one rock every three waves, never exceeding the hard entity caps.

## Controls

- Up / Down / Left / Right — move and excavate.
- Action 1 — fire the pressure line.
- Pause — shared pause overlay (resume, restart, controls, sound, launcher exit).

Keyboard/gamepad mapping, pause routing, mute, trusted-gesture audio activation, fixed-step timing, renderer ownership, score storage, error recovery, and launcher navigation remain shared-platform responsibilities.

## Assets and provenance

Deep Digger uses geometric Canvas primitives for all shipped visual expression. Its six WAV effects (`dig`, `pump`, `defeat`, `rock`, `hit`, `wave`) are synthesized specifically for this project from simple generated waveforms and are declared `original: true` in the game asset manifest. No third-party or extracted commercial assets are used.
