# P14 Deep Digger — Playable Acceptance

This checklist records P14-specific release evidence. Shared shell behavior follows the Space Rocks reference architecture.

## Automated acceptance covered by repository tests

- Original 24×16 Copper Lattice format, authored provenance marker, bounded spawn tables.
- Digging immediately changes collision/navigation topology and awards deterministic score.
- BFS returns an empty route on disconnected tunnel graphs rather than hanging.
- Disconnected stalkers enter seeded, reproducible solid-material phase traversal.
- Pressure line has three visible stages, deterministic decay, defeat scoring, and tunnel/range blocking.
- Excavation can arm falling rocks; fall cadence, landing, crush resolution, and score are deterministic.
- Lives, terminal game-over freeze, wave scoring, bounded enemy/rock progression, and run reset are covered.
- Score submission is terminal-only, once per run, difficulty-scoped, and rejected persistence is contained.
- Audio goes through shared asset IDs; transient effects are bounded and destroyed cleanly.
- Real module consumes shared input/RNG/audio/renderer services and survives repeated lifecycle cycles.
- Controller-only launcher → pre-game → game → pause → restart → launcher routing is exercised against the real module.
- Real shell lifecycle soak repeats 25 launch/restart/exit cycles while asserting one RAF callback and no retained game/audio ownership.

## Human playable checks before final release integration

These checks require a real browser/Tauri surface and physical input/audio environment and should be repeated after P14 is reconciled with the then-current `master`:

- Keyboard: verify directional excavation, Action 1 pressure line, pause/resume/restart/launcher exit.
- Standard gamepad: verify D-pad/stick movement, Action 1, pause, and controller-only shell navigation.
- Visual readability: verify earth bands, tunnels, phase state, pressure rings, falling-rock warning, HUD, and game-over overlay at 1366×768 scaling.
- Audio: verify first trusted gesture unlocks effects, mute/global volume apply immediately, pause behaves through the shared audio service, and exit leaves silence.
- Gameplay feel: confirm Survey/Bore/Mantle pacing, rock warning readability, pressure risk/reward, respawn fairness, and depth progression are enjoyable.
- Persistence: finish a run and confirm the difficulty-scoped high score is visible after returning to the launcher; repeat with an injected/real persistence failure if available.

## Shared platform note

P14 requires no new shared-platform API. One backward-compatible registry defect fix is included: `GameRegistry` now preserves an existing module `resolveAssetUrl` callback during metadata validation, because production preload launches the registry-returned module. Without that preservation, both Space Rocks and Deep Digger can lose their bundled-asset resolver.
