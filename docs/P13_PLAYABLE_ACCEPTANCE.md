# P13 Jungle Quest playable acceptance

## Automated evidence

- [x] Canonical registry exposes Jungle Quest beside Space Rocks.
- [x] Deterministic running, braking, jumping, ladder traversal, vine latch/swing/release.
- [x] Four connected rooms, collectibles, checkpoints, alternate tunnel route, and a true pit path.
- [x] Room transitions actually fire from held movement input, not only from injected start
      positions past the threshold, and all four rooms are reachable by chained real-input
      transitions (CR-001). Before that fix, the edge trigger was clamped back every frame and no
      room boundary could be crossed by playing, which is what this item had asserted.
- [x] A diagonal held at a ladder end applies horizontal movement immediately on dismount, without
      needing the vertical input released first (CR-002).
- [x] Walking back into an already-banked checkpoint room re-awards nothing and does not move the
      respawn point backward (CR-024).
- [x] Hazards, pit recovery, lives, respawn protection, timer, scoring, completion, and terminal states.
- [x] Terminal score submission occurs once; rejected persistence is contained.
- [x] Shared audio routing, bounded particles, and owned loop teardown.
- [x] Real module launch/pause/restart/exit and controller-only launcher route.
- [x] Repeated lifecycle soak checks one frame chain and cleanup.
- [x] Injected update/render failures transition to recoverable runtime error and release resources.

## Human playable checks before final integration

CR-025 re-verification (2026-08-28): the room-transition items below are the ones CR-001 made
unreachable, and they are now backed by the automated regression tests listed above. The remaining
boxes are unticked because they need a real browser/Tauri surface with physical input and audio,
not because they failed - they are left for the native-hardware pass, the same status every other
game carries in `docs/P18_RELEASE_ACCEPTANCE.md`. `docs/TODO.md`'s P13 markers were re-checked
against this and are accurate as they stand: P13-001 through P13-009 complete, P13-010 `[~]`
pending that pass.

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
