# Shared engine boundary

`src/engine` contains game-agnostic runtime services and deterministic utilities shared by multiple games.

Shared engine code must not import from `src/games`. Game-specific behavior belongs in the owning game module.
