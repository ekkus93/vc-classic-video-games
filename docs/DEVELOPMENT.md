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

`.github/workflows/ci.yml` runs bounded frontend, Rust, and native Tauri checks on pushes to `master` and pull requests. CI uses lockfile-based installs and the pinned toolchains.

## Native diagnostics and failure recovery

The launcher calls two narrowly scoped Rust commands at startup: `diagnostic_ping` and `platform_info`. When running only the browser frontend, the launcher degrades to a browser-preview status instead of treating the missing Tauri bridge as fatal.

Development builds provide explicit recovery probes:

- `?injectStartupFailure=1` exercises the startup fallback view.
- `?injectRenderFailure=1` exercises the React error boundary.

The probes are ignored in production builds.

The native security model is documented in `docs/TAURI_SECURITY.md`.

Application identity consistency can be checked without compiling Tauri:

```bash
npm run metadata:check
```

CI additionally smoke-launches both the `tauri build --debug --no-bundle` binary (release/bundled CSP path) and `tauri dev` (development CSP path) under Xvfb.
