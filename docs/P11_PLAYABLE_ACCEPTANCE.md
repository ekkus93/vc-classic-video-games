# P11 Bug Barrage playable acceptance

Automated tests cover deterministic rules, chain splitting, topology changes, swept collision, score submission, shell routing, lifecycle ownership, restart/exit, and hard entity bounds. The following remains the human-observable acceptance pass on a real browser/Tauri surface.

## Launcher and controls

- [ ] Select **Bug Barrage** from the launcher using keyboard only and start `swarm` difficulty.
- [ ] Repeat launcher selection and launch using only a standard gamepad.
- [ ] Verify left/right/up/down move the Ward only inside the lower defense region.
- [ ] Hold Action 1 and verify spark fire is rate-limited and never grows without bound.

## Gameplay

- [ ] Verify chain segments reverse and step rows when contacting walls and signal pods.
- [ ] Destroy a middle chain segment and visually confirm the surviving groups continue independently.
- [ ] Damage signal pods and observe a Mender repair a damaged pod.
- [ ] Observe Skimmers crossing the lower region and verify contact costs one shield.
- [ ] Clear a wave and verify the next wave is denser/faster while gameplay remains stable.
- [ ] Lose all shields and verify the terminal score appears in shared high scores after returning to the launcher.

## Shared platform behavior

- [ ] Pause and resume during active movement; simulation and audio remain suspended while paused.
- [ ] Toggle shared Mute and verify Bug Barrage remains fully playable and silent.
- [ ] Restart from the pause overlay and verify no stale projectiles, bugs, input, timing, or audio remain.
- [ ] Return to launcher and relaunch without refreshing the app.
- [ ] Perform at least five launch → pause → restart → pause → launcher cycles without duplicate frame loops, stale canvas state, or accumulating audio.
