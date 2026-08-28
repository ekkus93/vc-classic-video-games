# VC Classic Video Games

A controller-first Tauri 2 project for a collection of original retro arcade-style games, designed primarily for Debian/Ubuntu Chromebooks converted from ChromeOS.

The project is building one shared game-console runtime and launcher rather than ten standalone applications or a ROM emulator.

## Planned launch games

The first collection contains original clean-room games inspired by the broad mechanics of:

- Pac-Man
- Defender
- Missile Command
- Centipede
- Frogger
- Pitfall!
- Asteroids
- Joust
- Dig Dug
- Donkey Kong

Commercial names are design references only. Shipped games use original code, titles, artwork, audio, and level data.

## Documentation

- [Product and engineering specification](docs/SPEC.md)
- [Implementation TODO](docs/TODO.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Canonical toolchain](docs/TOOLCHAIN.md)
- [Asset and clean-room policy](docs/ASSET_POLICY.md)

## Foundation quick start

```bash
nvm install
nvm use
npm ci
cargo fetch --locked
npm run typecheck
npm run test:frontend
npm run test:rust
npm run build
```

See `docs/DEVELOPMENT.md` for the full command set. The P0 browser scaffold is temporary; P1 introduces the actual Tauri 2/Vite application shell.
