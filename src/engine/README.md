# Shared engine boundary

`src/engine` contains game-agnostic runtime contracts and utilities. Individual game modules consume this public surface rather than constructing native/global services or importing another game's internals.

The core runtime is organized around:

- `game/metadata.ts`: runtime validation for launcher-facing game metadata.
- `game/contracts.ts`: `GameModule` / `GameInstance` lifecycle API and the renderer boundary.
- `game/services.ts`: injected input, audio, assets, scores, storage, RNG, clock, and logging surfaces.
- `game/registry.ts`: declarative module registration with duplicate-ID rejection.
- `game/lifecycle.ts`: explicit lifecycle state machine.
- `game/runtime.ts`: single-active-game ownership and failure isolation.
- `runtime/fixed-step.ts`: bounded 60 Hz fixed-step simulation timing.
- `runtime/frame-loop.ts` and `runtime/game-loop-driver.ts`: one owned `requestAnimationFrame` chain with rendering decoupled from simulation updates.
- `render/logical-framebuffer.ts`: logical-resolution Canvas framebuffer and nearest-neighbor presentation.
- `render/viewport.ts`: aspect-preserving integer/fractional scaling plus pointer normalization.
- `render/renderer.ts`: Canvas 2D primitives exposed without DOM layout knowledge.
- `render/sprite-animation.ts`: simulation-time-driven deterministic animation.
- `math/`: shared vector, wrapping, and collision primitives.
- `testing/fake-services.ts` and `testing/fake-renderer.ts`: headless deterministic test doubles.

The per-frame runtime remains entirely in TypeScript/WebView code. No simulation or rendering path requires Tauri IPC, keeping gameplay deterministic, low-latency, and headlessly testable.
