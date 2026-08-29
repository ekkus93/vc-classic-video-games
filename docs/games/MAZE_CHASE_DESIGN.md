# Maze Chase clean-room design

Maze Chase is an original grid-chase game that uses only the broad genre mechanics named in the project specification. The shipped maze, names, geometry, colors, scoring values, timing values, targeting rules, bonus treatment, and synthesized sounds were authored for this repository.

## Circuit Garden maze

The first maze is a 21-by-17 original layout stored as a small text grid in `src/games/maze-chase/maze.ts`. `#` is wall, `.` is a standard pickup, `o` is a power pickup, `P` is the runner start, `A` through `D` are the four sentinel starts, and `X` is the timed bonus spawn. The open horizontal edges on the middle row form a tunnel. Startup parsing verifies the special cells and connectivity of every collectible and actor start.

## Movement

Actors move from cell center to cell center and render by interpolation along the current edge. The player retains a requested turn for 0.22 seconds, so an input shortly before an intersection executes when that intersection is reached. Reversals are deterministic and corridor legality comes exclusively from the parsed maze graph.

## Sentinels

All navigation uses shortest-path distance on the same graph with deterministic tie ordering. During pursuit:

- Amber routes to the runner's current cell.
- Cyan routes toward a cell four spaces ahead of the runner.
- Lime attacks from a perpendicular side selected by the runner's half of the maze.
- Violet advances toward a short projection when distant, but retreats to its patrol region when the runner is close.

Patrol phases assign each sentinel a different corner region. The phase schedule alternates patrol and pursuit before ending in sustained pursuit. Phase transitions request a direction reversal.

## Power state, bonus, and progression

A power pickup activates a bounded vulnerability timer and requests sentinel reversal. Contact while vulnerable captures a sentinel and applies a bounded score multiplier; the sentinel is removed briefly before returning to its authored start. Outside that state, contact costs a life after respawn protection expires.

After enough normal collectibles have been cleared, a timed diamond bonus appears at the center marker. Clearing all standard and power collectibles awards a level bonus, rebuilds the collectible field, resets the phase schedule and actors, and increases speed. The runner and the sentinels share one level-speed ramp but stop at different caps: the sentinels keep gaining to the full cap while the runner plateaus lower, so the pursuit closes as levels go by. That widening gap is the difficulty curve, and the two caps are deliberately unequal. A run ends when all three lives are lost; only that terminal event submits the score.

## Presentation and provenance

The player and sentinels are renderer primitives rather than copied sprites. The six WAV effects are generated from simple oscillators/noise envelopes specifically for Maze Chase and are declared `original: true` in the game asset manifest. No third-party or commercial assets are used.
