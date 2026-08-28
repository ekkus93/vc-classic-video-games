# P7 Space Rocks playable acceptance

This checklist closes the human-observable acceptance for **P7 — Space Rocks** and the game-dependent obligations deferred from P4, P5, and P6.

Do not record a pass until the exact candidate commit has fully green CI and all required rows below pass in the native Tauri application.

## Automated preflight

The exact candidate must pass:

- frontend formatting and linting, including game-isolation boundaries;
- asset and attribution validation;
- strict TypeScript typecheck;
- the complete frontend test suite, including P7 core rules and lifecycle soak;
- production frontend build;
- Rust formatting, Clippy, and tests;
- native Tauri compile;
- bundled release-CSP smoke test;
- `tauri dev` Xvfb smoke test.

The automated P7-010 soak repeatedly launches the real `SPACE_ROCKS_MODULE`, advances rendering/simulation, pauses, resumes, restarts, and exits. It must prove that only one RAF callback is retained while active and that exit leaves no active game or game-owned audio.

## Manual environment

1. Check out the exact candidate commit recorded below.
2. Start the native development app with `npm run tauri:dev`.
3. Begin with audio unmuted at an audible volume.
4. For section A, use only the keyboard after the app appears. Do not use the mouse/touchpad/touchscreen/gamepad.
5. For section B, connect a standard USB/Bluetooth gamepad if one is available for this acceptance run.

## A. Keyboard-only playable path — required

These rows are the P7 execution of the game-dependent Section E that was deferred from `docs/P6_KEYBOARD_ONLY_CHECKLIST.md`.

- [ ] From the launcher, select **Space Rocks** using only arrows/WASD and `Enter`/`Space`. The pre-game screen receives a visible current focus target.
- [ ] Navigate Start, player count, difficulty, high scores, controls/settings, and Back using only the keyboard. Focus remains visible and no pointer is required.
- [ ] Start Space Rocks. The canvas displays the project-authored star field, Kestrel ship, and faceted rocks rather than a blank/static game surface.
- [ ] Rotate, thrust, and fire using the displayed logical controls. Facing can change while existing momentum continues independently.
- [ ] On the first trusted keyboard interaction, game audio becomes usable; thrust and firing produce audible project-owned effects when audio is enabled.
- [ ] Press `Escape` to pause. The game simulation visibly freezes and the shared pause menu receives visible keyboard focus.
- [ ] Navigate Resume, Restart, Controls, Sound, and Return to launcher using only the keyboard.
- [ ] Choose Restart. A fresh Space Rocks run appears with no stale projectile/rock/effect state or stuck input/audio.
- [ ] Pause again and choose Return to launcher. The launcher becomes immediately usable with visible focus and no stale game audio.
- [ ] Launch Space Rocks a second time without reloading the Tauri window. It starts and plays normally.

## B. Gamepad-only shell/game route — required when a standard gamepad is available

This closes the P4-010 real-game follow-up. If the acceptance environment genuinely has no standard gamepad, record that fact explicitly rather than marking these rows passed.

- [ ] Connect the gamepad before launch or hot-plug it while the launcher is open; the app remains responsive.
- [ ] Use only D-pad/left stick and gamepad buttons to select Space Rocks and start a run.
- [ ] Rotate/thrust/fire through the gamepad mappings without keyboard or pointer input.
- [ ] Open Pause with Start/Pause, navigate to Restart, and restart the run using only the gamepad.
- [ ] Open Pause again and Return to launcher using only the gamepad.
- [ ] No duplicate movement/menu activation occurs after restart or after hot-plug/reconnect.

## C. Audio/settings/recovery — required

- [ ] With audio enabled, thrust/firing/collision/wave effects are audible and no loop continues after pause/exit.
- [ ] Toggle Mute in shared settings; Space Rocks remains fully playable and silent.
- [ ] Unmute and verify effects return without restarting the application.
- [ ] Return to launcher after gameplay; the launcher remains responsive and no game-owned sound continues.

## D. Short repeated lifecycle observation — required

The deterministic automated soak is the primary leak gate. This short human pass checks for visible/audible symptoms that a headless test cannot observe.

- [ ] Perform at least five consecutive launcher -> Space Rocks -> pause -> restart -> pause -> launcher cycles without reloading the application.
- [ ] No cycle develops duplicate input, accelerating simulation, overlapping thrust loops, blank canvas, stale pause UI, or progressively slower launcher/game transitions.

## Acceptance record

- Date: _not yet recorded_
- Candidate commit: _not yet recorded_
- Environment: _not yet recorded_
- Tester: _not yet recorded_
- CI run: _not yet recorded_
- Keyboard-only section A: _not yet recorded_
- Gamepad section B: _not yet recorded_
- Audio/settings section C: _not yet recorded_
- Repeated lifecycle section D: _not yet recorded_
- Overall result: _not yet recorded_
- Notes: _not yet recorded_
