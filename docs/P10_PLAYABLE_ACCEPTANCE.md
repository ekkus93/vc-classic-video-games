# P10 Maze Chase playable acceptance

This checklist records the human-observable acceptance for **P10 — Maze Chase**. The automated suite exercises the production module and shared shell, but the final native pass should still confirm presentation, controller feel, audio, and repeated lifecycle behavior in the Tauri application.

Do not record a manual pass until the exact candidate commit has green automated validation and all applicable rows below have been exercised against that same commit.

## Automated preflight

The exact candidate should pass the repository's standard formatting, lint, metadata, asset/provenance, TypeScript, frontend test, production build, Rust, and native Tauri checks.

P10-specific automated coverage verifies the original maze topology, smooth grid interpolation, buffered turns, tunnel wrapping, deterministic navigation personalities, phase scheduling, seeded frightened routing, bounded power state, collectibles and bonus timing, lives, score submission and rejection containment, level progression, keyboard/gamepad input, controller-only shell routing, renderer lifecycle ownership, repeated launch/restart/exit soak, and update/render failure recovery.

## A. Keyboard-only playable path — required

- [ ] Select **Maze Chase** from the launcher using only keyboard navigation and enter the pre-game screen.
- [ ] Start a run and verify the Circuit Garden maze, runner, four geometric sentinels, pellets, and power items render correctly.
- [ ] Move with arrows/WASD. Movement should be smooth between grid centers rather than snapping tile-to-tile.
- [ ] Press a perpendicular direction shortly before an intersection and verify the turn is buffered and executes at the first legal junction.
- [ ] Traverse the horizontal edge tunnel and verify movement crosses the boundary smoothly.
- [ ] Collect a power item and verify sentinels reverse, become visually vulnerable, and can be captured only during the bounded override period.
- [ ] Clear enough collectibles for the timed diamond bonus to appear; collect it once and verify the score increases.
- [ ] Lose a nonterminal life and verify remaining collectible progress is preserved while actors reset with brief protection.
- [ ] Clear all standard and power collectibles and verify the next level starts with restored collectibles and increased speed.
- [ ] Lose the final life and verify the run reaches game over and submits only the terminal score.
- [ ] Pause, resume, restart, and return to launcher through the shared pause UI; no stale movement or audio should remain.

## B. Gamepad-only path — required when a standard gamepad is available

- [ ] From the launcher, use only D-pad/left stick and standard buttons to select Maze Chase and start a run.
- [ ] Move and buffer turns through the gamepad mappings without keyboard or pointer input.
- [ ] Open Pause with the standard pause/start action, resume, then restart using only the gamepad.
- [ ] Pause again and return to the launcher using only the gamepad.
- [ ] Hot-plug/reconnect if practical and verify no duplicate movement or menu activation occurs.

## C. Audio, mute, and recovery — required

- [ ] On the first trusted keyboard/gamepad interaction, audio becomes usable without requiring a pointer click.
- [ ] Pellet, power, sentinel capture, player hit, bonus, and level-clear effects are audible when sound is enabled.
- [ ] Toggle Mute in shared settings; Maze Chase remains playable and silent. Unmute and verify effects return without restarting the app.
- [ ] Exit after active gameplay and verify no game-owned audio continues on the launcher.
- [ ] If a recoverable runtime error is intentionally injected in a development build, the shell returns to the launcher rather than leaving a dead canvas.

## D. Repeated lifecycle observation — required

- [ ] Perform at least five launcher -> Maze Chase -> pause -> restart -> pause -> launcher cycles without reloading the application.
- [ ] No cycle develops duplicate input, accelerated simulation, blank rendering, stuck pause state, stale controls, overlapping audio, or progressively slower transitions.

## Acceptance record

- Date: _not yet recorded_
- Candidate commit: _not yet recorded_
- Environment: _not yet recorded_
- Tester: _not yet recorded_
- CI run: _not yet recorded_
- Keyboard-only section A: _not yet recorded_
- Gamepad section B: _not yet recorded_
- Audio/recovery section C: _not yet recorded_
- Repeated lifecycle section D: _not yet recorded_
- Overall result: _not yet recorded_
- Notes: _not yet recorded_
