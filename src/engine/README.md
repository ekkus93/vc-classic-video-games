# Shared engine boundary

`src/engine` contains game-agnostic runtime contracts and utilities. Individual game modules consume this public surface rather than constructing native/global services or importing another game's internals.

The core runtime is organized around:

- `game/metadata.ts`: runtime validation for launcher-facing game metadata.
- `game/contracts.ts`: `GameModule` / `GameInstance` lifecycle API and the renderer boundary.
- `game/services.ts`: injected input, audio, assets, scores, storage, RNG, clock, and logging surfaces.
- `game/registry.ts`: declarative module registration with duplicate-ID rejection.
- `game/lifecycle.ts`: explicit lifecycle state machine.
- `game/runtime.ts`: single-active-game ownership and failure isolation.
- `input/actions.ts`: canonical release-one logical action schema.
- `input/keyboard.ts`: browser keyboard state without OS-repeat edge duplication.
- `input/gamepad.ts`: standard Gamepad API polling, dead zones, and stable player assignment.
- `input/pointer.ts`: logical-space pointer input built on the shared viewport transform.
- `input/input-manager.ts`: combined keyboard/gamepad/pointer state exposed through `GameServices.input`.
- `input/settings.ts`: validated configurable mappings behind an injected persistence boundary.
- `input/shell-navigation.ts`: controller/keyboard shell commands independent of raw device codes.
- `runtime/fixed-step.ts`: bounded 60 Hz fixed-step simulation timing.
- `runtime/frame-loop.ts` and `runtime/game-loop-driver.ts`: one owned `requestAnimationFrame` chain with rendering decoupled from simulation updates.
- `render/logical-framebuffer.ts`: logical-resolution Canvas framebuffer and nearest-neighbor presentation.
- `render/viewport.ts`: aspect-preserving integer/fractional scaling plus pointer normalization.
- `render/renderer.ts`: Canvas 2D primitives exposed without DOM layout knowledge.
- `render/sprite-animation.ts`: simulation-time-driven deterministic animation.
- `math/`: shared vector, wrapping, and collision primitives.
- `testing/fake-services.ts` and `testing/fake-renderer.ts`: headless deterministic test doubles.

The per-frame runtime remains entirely in TypeScript/WebView code. No simulation, rendering, or input polling path requires Tauri IPC, keeping gameplay deterministic, low-latency, and headlessly testable. Durable input-setting persistence is intentionally supplied through the persistence layer implemented in P5 rather than directly by the input subsystem.
