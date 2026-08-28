# P8 Missile Defense playable acceptance

Automated coverage is the primary correctness/lifecycle gate. Before merging a release candidate, perform these human-observable checks in the native app on the exact candidate commit.

- [ ] Launcher shows Missile Defense and opens its pre-game screen.
- [ ] Pointer aim tracks correctly at windowed and fullscreen scales, including letterboxing.
- [ ] Keyboard-only aim/fire/pause/restart/return works.
- [ ] Gamepad-only launcher -> game -> pause -> restart -> launcher works without pointer/keyboard input.
- [ ] Each live battery visibly displays finite ammo and firing reduces the selected battery count by one.
- [ ] Interceptors visibly travel to the reticle before a blast begins.
- [ ] Blasts visibly expand then contract; chained interceptions remain bounded under heavy action.
- [ ] Settlements and batteries visibly change when struck; settlement destruction persists across waves.
- [ ] Audio is audible after a trusted user gesture, mute silences effects, and no game-owned audio survives exit.
- [ ] Complete a game-over and verify the launcher remains recoverable.
- [ ] Perform at least five launch -> pause -> restart -> pause -> launcher cycles without duplicate input, accelerated simulation, stale reticle state, blank canvas, or leaked audio.

Acceptance record: not yet recorded.
