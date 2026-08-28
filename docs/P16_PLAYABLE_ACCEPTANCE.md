# P16 Barrel Climber playable acceptance

This checklist records the remaining human-observable acceptance for **P16 — Barrel Climber**. Automated tests cover deterministic rules, module integration, controller-only routing, failure containment inherited from the shared runtime, and repeated lifecycle ownership; native visual/audio feel still requires a person on a built application.

## Automated preflight

The exact candidate must pass the repository's normal quality gates:

- frontend formatting and game-boundary lint;
- project metadata, asset-manifest, and attribution validation;
- strict TypeScript typecheck;
- complete frontend tests including P16 core, route, and lifecycle soak tests;
- production frontend build;
- Rust formatting, Clippy, and tests;
- native Tauri compile/smoke jobs available in CI.

## A. Keyboard-only playable path

- [ ] Select **Barrel Climber** from the launcher using only arrows/WASD plus Enter/Space.
- [ ] Start the default **Shift** difficulty and confirm the Copper Rise canvas renders gantries, ladders, the runner, goal beacon, and coil-drum hazard.
- [ ] Run left/right, mount a ladder with Up, climb to its upper platform, mount from above with Down, and dismount at the lower endpoint.
- [ ] Press Action 1 while grounded; the jump is responsive, clears a nearby rolling hazard when timed correctly, and visibly increments score only once for that hazard during the jump.
- [ ] Observe a coil drum roll to a platform edge, fall, and continue on a lower platform; observe at least one seeded ladder descent during normal play.
- [ ] Reach the LIFT goal, then verify progression into Glassworks and Night Crane without a window reload.
- [ ] Lose a non-final life and verify a safe stage respawn with no stale hazard overlap; lose the final life and verify the run ends cleanly.
- [ ] Press Escape to pause, Resume, then pause and Restart; verify a fresh seeded run with no stuck input/audio/effects.
- [ ] Pause and Return to launcher; relaunch Barrel Climber successfully without reloading the app.

## B. Gamepad-only path

- [ ] With a standard-mapped gamepad, navigate launcher -> pre-game -> Barrel Climber without keyboard/pointer input.
- [ ] Run, climb, jump, pause, resume, restart, and return to launcher using only the gamepad.
- [ ] Confirm no duplicate command/movement occurs after restart or reconnect.

## C. Audio/settings

- [ ] On a trusted first keyboard/gamepad gesture, shared audio becomes usable when enabled.
- [ ] Rolling, jump, vault, hit, and goal cues are audible and clearly distinct.
- [ ] Pausing stops the rolling loop; returning to the game does not create overlapping loops.
- [ ] Shared Mute makes the game silent without affecting play; unmuting restores audio without app restart.
- [ ] Returning to launcher leaves no game-owned audio playing.

## D. Visual/performance/lifecycle observation

- [ ] All three original stage layouts are readable at 1366x768 with nearest-neighbor scaling and legible HUD text.
- [ ] Perform at least five launcher -> game -> pause -> restart -> pause -> launcher cycles; observe no duplicate input, accelerated simulation, overlapping audio, blank canvas, stale pause state, or progressive slowdown.
- [ ] Play into a dense later level and confirm the hard 12-hazard bound remains responsive on target Chromebook-class hardware.

## Acceptance record

- Date: _not yet recorded_
- Candidate commit: _not yet recorded_
- Environment: _not yet recorded_
- Tester: _not yet recorded_
- CI run: _not yet recorded_
- Keyboard section: _not yet recorded_
- Gamepad section: _not yet recorded_
- Audio/settings section: _not yet recorded_
- Performance/lifecycle section: _not yet recorded_
- Overall result: _not yet recorded_
- Notes: _not yet recorded_
