# Missile Defense — Clean-Room Gameplay and Visual Design

Status: P8 implementation baseline

Missile Defense is an original single-player fixed-screen defense game. The player protects six Meridian settlements with three hilltop interceptor batteries. The implementation uses the broad public-domain gameplay idea of target-point interception but does not reproduce commercial branding, cabinet graphics, exact scoring, layouts, wave tables, audio, or source data.

## Battlefield and rules

The 320x240 logical battlefield has six settlements and three batteries on a low ground line. A logical-space reticle is controlled either by the shared pointer service or the same directional logical actions used by keyboard/gamepad. Action 1 fires one interceptor from the nearest live battery that still has ammunition.

Each battery begins a wave with finite ammunition. Interceptors travel visibly to their selected target; they do not create an immediate hit-scan blast. On arrival they create a bounded skyburst that expands to a fixed maximum radius and then contracts to zero. Hostile missiles inside a live blast are removed and can seed a smaller chain blast. Both explosion and projectile populations have hard caps.

Hostile trajectories are generated from the shared seeded RNG. Each missile selects a currently live settlement or battery and flies linearly toward it. Impact permanently destroys a settlement for the current run or disables a battery for the current wave. The run ends when all settlements are destroyed.

At wave completion, surviving settlements, unused ammunition, and a deterministic wave bonus contribute to score. Settlement damage persists. Batteries are repaired between waves to avoid a surviving run becoming permanently unable to fire; their reload includes a small bounded carryover derived from unused ammunition.

## Original audiovisual treatment

The visual identity uses a dark teal sky, geometric mint settlements, ochre triangular batteries, coral hostile trails, and ring-shaped cyan/gold skybursts. Five short synthesized WAV effects are generated specifically for this repository and declared original in the project attribution registry.

## Controls

- Pointer movement: absolute logical-space aim.
- Directional actions: reticle aim for keyboard and standard gamepad.
- Action 1: launch one interceptor.
- Pause: shared shell pause/restart/return flow.

Game code does not read raw DOM events or the browser Gamepad API.
