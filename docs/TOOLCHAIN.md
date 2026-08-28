# Canonical development toolchain

This repository pins its primary development toolchain so a clean checkout does not depend on undocumented machine-local versions.

## Required versions

| Tool | Version | Policy |
| --- | --- | --- |
| Node.js | 24.20.0 LTS | Exact project version; `.nvmrc` is authoritative for Node version managers. |
| npm | 11.19.0 | Exact package manager version recorded in `package.json`. |
| TypeScript | 5.9.2 | Exact dev dependency in `package-lock.json`. |
| Rust | 1.98.0 | Exact toolchain selected by `rust-toolchain.toml`. |
| Cargo | bundled with Rust 1.98.0 | Use the Cargo supplied by the pinned Rust toolchain. |
| rustfmt | Rust 1.98.0 component | Installed by `rustup` from `rust-toolchain.toml`. |
| Clippy | Rust 1.98.0 component | Installed by `rustup` from `rust-toolchain.toml`. |

Node 24 is the supported LTS line. The exact patch is pinned rather than using a floating `24` or `lts/*` selector. Rust is likewise pinned to an exact stable release rather than the moving `stable` channel.

## Bootstrap from a clean checkout

### Node.js and npm

Install Node.js using a version manager or distribution method that can provide the exact version in `.nvmrc`.

With `nvm`:

```bash
nvm install
nvm use
node --version
npm --version
npm ci
```

Expected versions are Node `v24.20.0` and npm `11.19.0`. `.npmrc` enables `engine-strict`, so unsupported versions fail dependency installation instead of silently creating a different environment.

### Rust

Install `rustup` using the official Rust installation method. Invoking Rust tools from this checkout selects `rust-toolchain.toml` automatically.

```bash
rustc --version
cargo --version
cargo fetch --locked
```

The P0 Rust crate deliberately has no external dependencies. P1 adds Tauri 2 dependencies and regenerates the committed application lockfile.

## Lockfile policy

- `package-lock.json` and `Cargo.lock` are committed.
- Clean/frozen installs use `npm ci` and Cargo `--locked`.
- Dependency upgrades update manifests and lockfiles together.
- Toolchain upgrades are explicit changes, not incidental side effects of feature work.
