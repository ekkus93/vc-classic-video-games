# Development

This guide is the detailed command reference for setting up, running, testing, and building VC Classic Video Games. Run commands from the repository root unless stated otherwise.

## Prerequisites

Use the exact Node/npm/Rust versions documented in `docs/TOOLCHAIN.md`:

| Tool | Required version | Repository pin |
| --- | --- | --- |
| Node.js | 24.20.0 | `.nvmrc` |
| npm | 11.19.0 | `package.json` |
| Rust | 1.98.0 | `rust-toolchain.toml` |

The repository also pins TypeScript, Vite, the Tauri CLI, and Rust Tauri crates through the committed lockfiles.

### Debian/Ubuntu native packages

Install the native packages required to compile and run Tauri 2:

```bash
sudo apt update
sudo apt install --no-install-recommends -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

CI additionally installs `xvfb` for headless desktop smoke tests; ordinary interactive development does not require it.

### Node.js and npm

The easiest supported setup uses `nvm`. If `nvm` is already installed:

```bash
nvm install
nvm use
node --version
npm --version
```

Expected output versions:

```text
v24.20.0
11.19.0
```

`.npmrc` enables strict engine checking, so an unsupported Node/npm version should fail dependency installation rather than silently producing a different environment.

### Rust

Install Rust with `rustup` if necessary. `rust-toolchain.toml` selects Rust `1.98.0` and the required `clippy` and `rustfmt` components automatically when Rust commands are run from this checkout.

Verify the selected toolchain:

```bash
rustc --version
cargo --version
rustup show active-toolchain
```

## Install project dependencies

From a clean checkout:

```bash
nvm use
npm ci
cargo fetch --locked
```

Both `package-lock.json` and `Cargo.lock` are committed. Use `npm ci` and Cargo's `--locked` mode for reproducible installs rather than regenerating dependency versions during ordinary development.

## Run the application

### Native Tauri application

For normal development, run:

```bash
npm run tauri:dev
```

Tauri automatically runs the configured Vite development server and opens the native desktop window. This is the normal way to exercise native persistence, fullscreen behavior, platform diagnostics, and other Tauri integration.

### Browser-only development preview

For frontend-only UI work:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:1420
```

Browser preview is an explicitly permitted **development-only** runtime mode. Because there is no Tauri bridge, it uses volatile in-memory document persistence. Settings, scores, and other persisted state in browser preview do not survive as native application data.

A native-required/production runtime does **not** silently downgrade to browser preview if the Tauri bridge is missing. Missing native integration in that mode is a startup error. Likewise, a present native bridge whose diagnostics fail is reported as a native-bridge error rather than being mislabeled as browser preview.

## Test and quality commands

### Recommended full local verification

When both Node and Rust toolchains and native dependencies are installed, run:

```bash
npm run format:check
npm run lint
npm run metadata:check
npm run assets:check
npm run typecheck
npm test
npm run build
```

This is the best local approximation of the repository's CI quality gates.

### Formatting

Check all frontend and Rust formatting:

```bash
npm run format:check
```

Check them separately:

```bash
npm run format:check:frontend
npm run format:check:rust
```

To apply formatting changes:

```bash
npm run format
```

### Linting

Run the frontend lint policy, game-boundary checks, and Rust Clippy:

```bash
npm run lint
```

Or run the two sides independently:

```bash
npm run lint:frontend
npm run lint:rust
```

Rust Clippy is configured to fail on warnings.

### Metadata and asset validation

Check application metadata consistency:

```bash
npm run metadata:check
```

Validate asset manifests, files, and attribution policy:

```bash
npm run assets:check
```

Asset discovery fails closed: an unexpected filesystem/discovery error is a validation failure rather than being interpreted as an empty asset set.

### TypeScript

Run strict TypeScript checking without emitting files:

```bash
npm run typecheck
```

### Tests

Run the complete frontend and Rust test suites:

```bash
npm test
```

Run only deterministic frontend tests:

```bash
npm run test:frontend
```

Run only Rust tests:

```bash
npm run test:rust
```

## Build commands

There are three useful build levels; they are intentionally distinct.

### Production frontend bundle only

```bash
npm run build
```

This performs a TypeScript typecheck and creates the Vite production frontend in `dist/`. It does **not** build the native desktop executable or installer packages.

### Native executable without package/bundle artifacts

```bash
npm run tauri:build -- --no-bundle
```

This runs the frontend production build through Tauri and compiles the native release executable, but skips creation of `.deb`/AppImage package artifacts. This is useful for a faster native compile check.

For a debug native compile similar to the CI Tauri smoke-test build:

```bash
npm run tauri:build -- --debug --no-bundle
```

### Distributable desktop packages

```bash
npm run tauri:build
```

The current Tauri configuration produces Linux bundle targets for:

- Debian `.deb`
- AppImage

Release build output is under `target/release/`; packaged artifacts are placed under Tauri's bundle subdirectories there.

## Source boundaries

- `src/app`: launcher/shell UI.
- `src/engine`: shared game-agnostic runtime and utilities.
- `src/games/<game-id>`: isolated game modules.
- `src-tauri`: Rust/native boundary.
- `assets`: shared asset provenance records; game-specific assets normally live with the owning game.

Games must not import another game's internals. Shared behavior belongs in the engine only when it is intentionally reusable.

## Native diagnostics and failure recovery

The launcher calls two narrowly scoped Rust commands at startup: `diagnostic_ping` and `platform_info`.

Runtime behavior is explicit:

- native Tauri runtime + healthy bridge: reports the native platform and diagnostic status;
- explicit Vite browser development preview: reports browser-preview mode and uses in-memory persistence;
- native runtime + failed diagnostics: reports a native-bridge error;
- native-required runtime + missing bridge: fails startup rather than silently switching to volatile storage.

Development builds provide explicit recovery probes:

- `?injectStartupFailure=1` exercises the startup fallback view.
- `?injectRenderFailure=1` exercises the React error boundary.

The probes are ignored in production builds.

The native security model is documented in `docs/TAURI_SECURITY.md`.

## CI

`.github/workflows/ci.yml` runs three jobs on pushes to `master` and pull requests:

1. **Frontend quality**
   - pinned Node/npm setup;
   - `npm ci`;
   - frontend formatting and lint;
   - metadata and asset validation;
   - TypeScript checking;
   - frontend tests;
   - production frontend build.
2. **Rust quality**
   - frontend context build required by Tauri macros;
   - Linux native dependencies;
   - pinned Rust 1.98.0 with Clippy/rustfmt;
   - `cargo fetch --locked`;
   - Rust formatting, Clippy, and tests.
3. **Tauri shell**
   - native dependency/toolchain setup;
   - `tauri build --debug --no-bundle`;
   - release-CSP smoke launch under Xvfb;
   - `tauri dev` smoke launch under Xvfb.

CI uses lockfile-based installs and the pinned toolchains. A local `npm run build` is therefore only one part of the complete CI acceptance surface.
