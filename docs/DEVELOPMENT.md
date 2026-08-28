# Development

## Prerequisites

Use the exact versions documented in `docs/TOOLCHAIN.md`.

P0 has no Tauri/WebKitGTK dependency yet. Debian/Ubuntu native system packages will be documented when the Tauri 2 shell is introduced in P1.

## Install

```bash
nvm install
nvm use
npm ci
cargo fetch --locked
```

## Run the current frontend scaffold

```bash
npm run dev
```

Then open `http://127.0.0.1:1420`.

P0 intentionally uses a dependency-light browser scaffold. P1 replaces the development entry point with the Tauri 2/Vite application.

## Quality commands

Frontend formatting:

```bash
npm run format:check:frontend
```

Rust formatting:

```bash
npm run format:check:rust
```

Frontend lint policy:

```bash
npm run lint:frontend
```

Strict TypeScript:

```bash
npm run typecheck
```

Rust Clippy:

```bash
npm run lint:rust
```

Frontend deterministic tests:

```bash
npm run test:frontend
```

Rust tests:

```bash
npm run test:rust
```

Production frontend build:

```bash
npm run build
```

Run all format, lint, or test checks with `npm run format:check`, `npm run lint`, and `npm test` respectively when both Node and Rust toolchains are installed.

## Source boundaries

- `src/app`: launcher/shell UI.
- `src/engine`: shared game-agnostic runtime and utilities.
- `src/games/<game-id>`: isolated game modules.
- `src-tauri`: Rust/native boundary.
- `assets`: shared asset provenance records; game assets will normally live with the owning game.

Games must not import another game's internals. Shared behavior belongs in the engine only when it is intentionally reusable.

## CI

`.github/workflows/ci.yml` runs bounded frontend and Rust jobs on pushes to `master` and pull requests. CI uses lockfile-based installs and the pinned toolchains.
