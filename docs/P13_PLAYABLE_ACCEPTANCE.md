# P13 Jungle Quest playable acceptance

## Automated evidence

- [x] Canonical registry exposes Jungle Quest beside Space Rocks.
- [x] Deterministic running, braking, jumping, ladder traversal, vine latch/swing/release.
- [x] Four connected rooms, collectibles, checkpoints, alternate tunnel route, and a true pit path.
- [x] Hazards, pit recovery, lives, respawn protection, timer, scoring, completion, and terminal states.
- [x] Terminal score submission occurs once; rejected persistence is contained.
- [x] Shared audio routing, bounded particles, and owned loop teardown.
- [x] Real module launch/pause/restart/exit and controller-only launcher route.
- [x] Repeated lifecycle soak checks one frame chain and cleanup.
- [x] Injected update/render failures transition to recoverable runtime error and release resources.

## Human playable checks before final integration

Run the production app with a keyboard and physical standard gamepad and verify:

- [ ] Launcher → Jungle Quest → pre-game → run works with keyboard only.
- [ ] The same complete route works with gamepad only.
- [ ] Run acceleration/braking and jump timing feel controllable at production frame rate.
- [ ] Ladder entry/climb/exit feels predictable from both directions.
- [ ] Echo Hollow vine can be gripped, pumped, and released to cross the surface gap.
- [ ] Echo Hollow lower tunnel remains a viable alternate route.
- [ ] Fern Gate chasm visibly behaves as a pit and respawns at the checkpoint.
- [ ] All four relics are visibly collectible exactly once.
- [ ] Contact hazards cost one life and do not repeatedly drain lives during protection.
- [ ] Reaching Sun Shrine without every relic does not complete the run.
- [ ] Reaching Sun Shrine with all relics completes the run and displays the terminal result.
- [ ] Timer expiration and final-life loss display terminal failure without freezing the shell.
- [ ] Pause freezes simulation and resume continues without a timing jump.
- [ ] Restart produces a clean run: lives, timer, score, relics, input edges, effects, and checkpoint reset.
- [ ] Return to launcher leaves the launcher immediately usable.
- [ ] Repeated launch/restart/exit does not duplicate animation loops or leave stale audio.
- [ ] First trusted keyboard/gamepad gesture unlocks audio using the existing shell behavior.
- [ ] Mute affects Jungle Quest through the shared audio service and remains consistent after restart.
- [ ] Jump/relic/hit/checkpoint/finish sounds are audible and the vine loop stops on release/pause/exit.
- [ ] Canvas scales cleanly with no obvious clipping at the logical edges.
- [ ] Score appears in the launcher high-score flow after a completed/failed terminal run.
