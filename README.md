# VC Classic Video Games

A controller-first Tauri 2 desktop application containing ten original retro arcade-style games. The project uses one shared launcher, game runtime, input system, persistence layer, and native shell rather than ten standalone applications or a ROM emulator.

The primary development target is Debian/Ubuntu Linux, including Chromebooks converted from ChromeOS.

## Included games

- Space Rocks
- Deep Digger
- Barrel Climber
- River Hopper
- Star Defender
- Maze Chase
- Bug Barrage
- Missile Defense
- Jungle Quest
- Sky Riders

The games are clean-room originals inspired by broad classic arcade mechanics. Commercial names are design references only; shipped titles, code, artwork, audio, and level data are original to this project.

## Documentation

- [Product and engineering specification](docs/SPEC.md)
- [Implementation TODO](docs/TODO.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Canonical toolchain](docs/TOOLCHAIN.md)
- [Asset and clean-room policy](docs/ASSET_POLICY.md)
- [Tauri security model](docs/TAURI_SECURITY.md)

## Development quick start

### 1. Set up the development environment

Use the exact toolchain versions pinned by the repository:

- Node.js `24.20.0` (`.nvmrc`)
- npm `11.19.0` (`package.json`)
- Rust `1.98.0` (`rust-toolchain.toml`)

On Debian/Ubuntu, install the native Tauri dependencies:

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

Install [nvm](https://github.com/nvm-sh/nvm) and [rustup](https://rustup.rs/) if they are not already installed, then from the repository root run:

```bash
nvm install
nvm use
node --version
npm --version

rustc --version
cargo --version

npm ci
cargo fetch --locked
```

The expected Node/npm versions are `v24.20.0` and `11.19.0`. Rust commands issued from this checkout automatically select Rust `1.98.0` through `rust-toolchain.toml`.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the detailed setup and command reference.

### 2. Run the app

Run the actual Tauri desktop application during development with:

```bash
npm run tauri:dev
```

This starts Vite and opens the native desktop window.

For frontend-only UI work, an explicit browser development preview is available:

```bash
npm run dev
```

Then open `http://127.0.0.1:1420`.

Browser preview is intentionally different from the desktop application: it uses volatile in-memory persistence because the Tauri native bridge is absent. A native/production build does **not** silently fall back to browser-preview persistence if the native bridge is missing.

### 3. Run tests and quality checks

The normal complete local verification sequence is:

```bash
npm run format:check
npm run lint
npm run metadata:check
npm run assets:check
npm run typecheck
npm test
npm run build
```

`npm test` runs both the frontend deterministic test suite and the Rust test suite.

Individual test commands are also available:

```bash
npm run test:frontend
npm run test:rust
```

### 4. Build the app

Build only the production frontend bundle with:

```bash
npm run build
```

Compile the native Tauri application without creating installer/package artifacts with:

```bash
npm run tauri:build -- --no-bundle
```

Build the distributable desktop packages with:

```bash
npm run tauri:build
```

The configured Linux bundle targets are Debian `.deb` and AppImage packages. Build output is written under `target/release/` and its bundle subdirectories.
