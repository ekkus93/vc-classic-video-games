# P15 Star Defender playable acceptance

This checklist records the remaining human-observable acceptance for **P15 — Star Defender**. Automated tests cover deterministic simulation, wrapped camera/radar math, rescue state transitions, bounded entity density, input routing, score-persistence containment, and repeated lifecycle ownership.

## Automated preflight

The exact candidate must pass formatting, frontend lint/game-boundary lint, metadata validation, asset/provenance validation, strict TypeScript typecheck, the full frontend test suite, production frontend build, Rust formatting/Clippy/tests, native Tauri compile/smoke checks where the validation environment supports them, and `git diff --check`.

## Keyboard/gamepad playable path

- [ ] Launch Star Defender from the registry-driven launcher with keyboard only, then repeat with a standard gamepad only.
- [ ] Verify left/right/up/down produce inertial flight rather than direct positional stepping and that Action 1 fires only forward.
- [ ] Cross the horizontal world seam in both directions; terrain, enemies, settlers, projectiles, camera motion, and radar remain continuous.
- [ ] Use Action 2 repeatedly; one held press spends only one charge and the HUD charge count never exceeds its cap.
- [ ] Observe a Snatcher take a settler, destroy the carrier, catch the falling settler, and return it to terrain. The radar and main view identify the same actors throughout.
- [ ] Pause, resume, restart, and return to launcher using both keyboard and gamepad paths. No stale movement, firing, audio, or duplicate simulation speed appears.

## Audio/settings/recovery

- [ ] With sound enabled, thrust, lance, emergency burst, impact, rescue, and wave effects are audible after a trusted input gesture.
- [ ] Toggle shared mute and verify gameplay continues silently; unmute without restarting the application.
- [ ] Exit during active thrust and verify no Star Defender loop remains audible.
- [ ] Confirm a forced runtime failure returns to a recoverable launcher rather than leaving a dead game surface.

## Performance/lifecycle observation

- [ ] On the selected reference Chromebook, sustain normal display refresh during a maximum-density wave (24 enemies plus bounded projectiles/effects).
- [ ] Perform at least five launcher -> Star Defender -> pause -> restart -> pause -> launcher cycles without visible slowdown, duplicate input, blank canvas, stale radar, or overlapping audio.

## Acceptance record

- Date: _not yet recorded_
- Candidate commit: _not yet recorded_
- Environment: _not yet recorded_
- Tester: _not yet recorded_
- CI run: _not yet recorded_
- Keyboard/gamepad path: _not yet recorded_
- Rescue path: _not yet recorded_
- Audio/settings: _not yet recorded_
- Target-hardware performance: _not yet recorded_
- Overall result: _not yet recorded_
