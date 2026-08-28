# Asset and clean-room content policy

The project recreates broad classic-game mechanics with newly authored code and expressive content. It does not ship ROM-derived material or copied commercial game assets.

## Forbidden source material

Do not add:

- ROMs, ROM fragments, decompiled/disassembled code, or data extracted from them;
- copied sprites, tiles, animations, fonts, logos, cabinet art, sound effects, or music;
- exact commercial level/map data copied or extracted from an original game;
- third-party assets whose distribution rights are unknown or incompatible with this repository.

Publicly observable gameplay behavior and general game mechanics may be used as design references. Shipped titles, artwork, audio, text, and level expression must be original or properly licensed.

## Original project assets

Assets authored specifically for this project do not need an entry in `assets/ATTRIBUTION.json`, but their source files should be retained when practical.

## Third-party assets

Before adding a third-party asset, record an object in `assets/ATTRIBUTION.json` with:

- `path`: repository-relative shipped asset path;
- `title`: human-readable asset name;
- `creator`: author/creator name;
- `source`: canonical source URL or provenance description;
- `license`: SPDX identifier when one exists, otherwise the exact license name;
- `licenseUrl`: canonical license URL when applicable;
- `modified`: whether the project modified the asset;
- `notes`: optional attribution or modification notes required by the license.

The initial file is intentionally empty. P5 adds automated attribution validation once asset manifests exist.
