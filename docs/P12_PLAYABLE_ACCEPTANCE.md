# P12 Sky Riders playable acceptance

This checklist records the remaining human-observable acceptance checks for the
Sky Riders implementation. Automated coverage exercises the same production game
module, shared input stack, shared renderer contract, score service, and lifecycle
host; these checks are deliberately limited to behavior best judged on a real
browser/Tauri surface with physical audio and controller hardware.

## Automated preflight

- [x] Deterministic movement, gravity, flap cadence, horizontal wrapping, and one-way platform landing are covered by core tests.
- [x] Altitude combat, lives, scoring, storm-seed recovery/reformation, wave progression, game-over, two-player terminal behavior, and seeded enemy decisions are covered by simulation tests.
- [x] Production keyboard and standard-gamepad mappings cover both local players.
- [x] Real module integration covers renderer use, pause/resume, restart/reset, score submission, score-persistence rejection containment, and update/render failure recovery through the shared host.
- [x] Controller-only launcher → pre-game → game → pause/restart → launcher routing is covered.
- [x] A 40-cycle launch/run/pause/resume/restart/exit soak proves one RAF chain and centralized audio/resource cleanup.

## Keyboard play

- [ ] Launch Sky Riders from the launcher using only the keyboard.
- [ ] Player 1 can steer left/right and flap; flap cadence feels discrete rather than continuously powered.
- [ ] A descending rider lands on platform tops without jitter or tunneling, while ascending riders pass upward through platforms.
- [ ] Crossing the horizontal edge wraps smoothly to the opposite side.
- [ ] Higher-altitude collisions defeat Storm Riders; near-level collisions visibly clash/bounce; lower collisions cost a life.
- [ ] Storm seeds can be collected for recovery points and visibly reform into a Storm Rider when left alone.
- [ ] Pause freezes gameplay, Resume continues cleanly, Restart resets the whole run, and Return to launcher works.

## Local two-player play

- [ ] Select two players before launch and confirm both riders appear with independent controls/lives.
- [ ] Player 2 keyboard steering/flap works simultaneously with Player 1.
- [ ] Losing one rider does not end the cooperative run while the other rider remains active.
- [ ] The run ends only after both players have exhausted their lives.

## Gamepad play

- [ ] Launch Sky Riders using only a standard gamepad, with no keyboard/mouse interaction.
- [ ] Left stick/D-pad steering and the primary action button flap correctly.
- [ ] With two connected standard gamepads, each pad controls its corresponding local player.
- [ ] Pause-menu navigation, restart, and return-to-launcher all work controller-only.

## Audio and mute

- [ ] A trusted keyboard/gamepad/pointer gesture unlocks browser audio before effects are needed.
- [ ] Flap, clash, defeat, hit, recovery, and wave-clear effects are audible and correspond to their events.
- [ ] Global mute silences Sky Riders immediately and unmute restores subsequent effects without duplicated playback.
- [ ] Pause/restart/exit leaves no stale or looping game-owned audio.

## Rendering and lifecycle

- [ ] The 320×240 logical scene scales cleanly in windowed and fullscreen modes.
- [ ] Platforms, riders, storm seeds, HUD, particles, and game-over overlay remain legible at supported scales.
- [ ] Repeatedly launch, restart, return to launcher, and launch again; input, rendering, timing, and audio remain responsive with no duplicated effects or accelerated simulation.
- [ ] Force or observe a recoverable runtime failure if a development hook is available; the shell returns to a usable launcher rather than a dead game screen.

## Acceptance record

Record the app build/commit, OS, input devices, and any observations when the
human-playable pass is performed. Any failure here should be treated as a P12
release blocker even if the automated suite remains green.
