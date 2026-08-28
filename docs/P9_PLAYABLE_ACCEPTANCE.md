# P9 River Hopper playable acceptance

This checklist closes the human-observable acceptance for **P9 — River Hopper**. The automated suite is the primary correctness and ownership gate; these rows cover native rendering, real-device input, audio, settings, and repeated-play behavior that headless tests cannot fully observe.

Do not record a pass until the exact candidate commit has fully green CI and all required rows below pass in the native Tauri application.

## Automated preflight

The exact candidate must pass:

- frontend formatting and linting, including game-isolation boundaries;
- metadata and asset/provenance validation;
- strict TypeScript typecheck;
- the complete frontend test suite, including P9 deterministic lane/collision rules and lifecycle soak;
- production frontend build;
- Rust formatting, Clippy, and tests;
- native Tauri compile/smoke checks;
- `git diff --check`.

The automated P9 soak repeatedly launches the real `RIVER_HOPPER_MODULE`, advances the fixed-step loop, pauses, resumes, restarts, and exits. It must retain exactly one RAF callback while active, clear stale input on restart, and leave no active game or game-owned audio after exit.

## A. Keyboard playable path — required

- [ ] From the launcher, select **River Hopper** using only keyboard navigation and open its pre-game screen.
- [ ] Start a one-player run on each difficulty at least once; the canvas shows the original river/road layout, moving hazards/platforms, five beacon goals, HUD, and player runner.
- [ ] Use the displayed directional controls to make discrete one-cell/lane hops. A held key must not create duplicate fixed-step hops; a fresh press must create exactly one hop.
- [ ] Buffer a direction during a hop and confirm the next hop begins after landing rather than interrupting the current hop.
- [ ] Cross road lanes and verify vehicle overlap costs one life and respawns at the start bank.
- [ ] Land on a moving river platform and verify the runner visibly inherits its horizontal displacement.
- [ ] Miss all platforms in a river lane and verify the water hazard costs one life.
- [ ] Allow a platform to carry the runner beyond a side bank and verify the boundary hazard costs one life rather than wrapping the player.
- [ ] Reach a beacon goal and verify it remains visibly filled while the runner respawns for the next crossing.
- [ ] Attempt an already-filled beacon and a gap between beacons; each must cost one life without clearing previously filled goals.
- [ ] Fill all five beacons in one round. The round bonus is awarded, goals reset, and the next original stage layout becomes active.
- [ ] Continue into later rounds and verify traffic/platform pressure increases and the timer pressure tightens.
- [ ] Lose the final life and verify the run ends once with a stable final score.

## B. Gamepad-only route — required when a standard gamepad is available

If the acceptance environment has no standard gamepad, record that explicitly rather than marking these rows passed.

- [ ] Use only D-pad/left stick and gamepad buttons to select River Hopper, configure the pre-game screen, and start a run.
- [ ] Directional gamepad input performs the same discrete/buffered hops as keyboard input.
- [ ] Open Pause with the standard pause/start control, Resume, then Restart using only the gamepad.
- [ ] Pause again and Return to launcher using only the gamepad.
- [ ] No duplicate movement/menu activation or stale held direction remains after restart or return to launcher.

## C. Audio, mute, pause, and recovery — required

- [ ] On the first trusted user gesture, audio becomes usable without requiring a mouse-only action.
- [ ] With audio enabled, ambient current plus hop, impact, splash, goal, and round effects are audible and correspond to the correct events.
- [ ] Pause freezes gameplay and shared audio; Resume continues both without creating a second ambient loop.
- [ ] Toggle Mute in shared settings; River Hopper remains fully playable and silent. Unmute restores audio without restarting the application.
- [ ] Restart removes old transient effects/input/timing state and starts one replacement ambient loop.
- [ ] Return to launcher releases all River Hopper audio and leaves the launcher responsive.

## D. Rendering and repeated lifecycle observation — required

- [ ] Resize the window through representative display sizes; logical geometry remains aligned and collision behavior still matches visible lane/platform positions.
- [ ] Perform at least five consecutive launcher -> River Hopper -> pause -> restart -> pause -> launcher cycles without reloading the application.
- [ ] No cycle develops duplicate input, accelerating simulation, overlapping ambient audio, blank/stale canvas content, stuck pause state, or progressively slower transitions.
- [ ] Launch River Hopper again after the repeated cycles; it starts as a clean new run.

## Acceptance record

- Date: _not yet recorded_
- Candidate commit: _not yet recorded_
- Environment: _not yet recorded_
- Tester: _not yet recorded_
- CI run: _not yet recorded_
- Keyboard section A: _not yet recorded_
- Gamepad section B: _not yet recorded_
- Audio/settings section C: _not yet recorded_
- Rendering/lifecycle section D: _not yet recorded_
- Overall result: _not yet recorded_
- Notes: _not yet recorded_
