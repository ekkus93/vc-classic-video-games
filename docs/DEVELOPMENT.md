# Development

## Prerequisites

Use the exact Node/npm/Rust versions documented in `docs/TOOLCHAIN.md`.

On Debian/Ubuntu, install the native packages required by Tauri 2:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

## Install

```bash
nvm install
nvm use
npm ci
cargo fetch --locked
```

## Run the Tauri application

```bash
npm run tauri:dev
```

This starts the Vite development server and opens the Tauri desktop window.

To run only the browser frontend during UI work:

```bash
npm run dev
```

Then open `http://127.0.0.1:1420`.

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

Compile the native Tauri application without creating a package:

```bash
npm run tauri:build -- --no-bundle
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

`.github/workflows/ci.yml` runs bounded frontend and Rust jobs on pushes to `master` and pull requests. CI uses lockfile-based installs and the pinned toolchains. Tauri-specific compile and launch checks are added as the application shell matures in P1.
