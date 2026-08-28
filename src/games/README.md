# Game-module boundary

Each shipped game will live in its own child directory under `src/games`.

Games may depend on public contracts from `src/engine`, but one game must not import another game's internals. Shared behavior should move into an intentionally designed engine service or utility rather than being copied between games.
