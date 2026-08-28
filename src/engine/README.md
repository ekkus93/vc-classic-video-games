# Shared engine boundary

`src/engine` contains game-agnostic runtime contracts and utilities. Individual game modules consume this public surface rather than constructing native/global services or importing another game's internals.

The P2 core is organized around:

- `game/metadata.ts`: runtime validation for launcher-facing game metadata.
- `game/contracts.ts`: `GameModule` / `GameInstance` lifecycle API.
- `game/services.ts`: injected input, audio, assets, scores, storage, RNG, clock, and logging surfaces.
- `game/registry.ts`: declarative module registration with duplicate-ID rejection.
- `game/lifecycle.ts`: explicit lifecycle state machine.
- `game/runtime.ts`: single-active-game ownership and failure isolation.
- `testing/fake-services.ts`: headless deterministic services for game tests.

Later phases add concrete browser/native implementations behind these interfaces. P2 intentionally avoids per-frame Tauri IPC and DOM/audio dependencies so core game logic remains headlessly testable.
