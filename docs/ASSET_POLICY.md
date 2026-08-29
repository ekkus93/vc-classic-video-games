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

Assets authored specifically for this project are recorded in `assets/ATTRIBUTION.json` as
`{ "path": ..., "original": true }`, with no licensing fields. Their source files should be
retained when practical. Every asset in a game manifest must state which it is: an entry that
omits `original` is rejected rather than assumed original, so an unclassified file cannot ship.

## Third-party assets

Before adding a third-party asset, record an object in `assets/ATTRIBUTION.json`. Validation
requires:

- `path`: repository-relative shipped asset path;
- `original`: `false`;
- `source`: canonical source URL or provenance description;
- `license`: SPDX identifier when one exists, otherwise the exact license name;
- `copyright`: the copyright holder as the license requires it to be stated.

Record as well, where they apply:

- `title`: human-readable asset name;
- `creator`: author/creator name;
- `licenseUrl`: canonical license URL when applicable;
- `modified`: whether the project modified the asset;
- `notes`: attribution or modification notes required by the license.

## Validation

`npm run assets:check` (part of the CI sequence) enforces this and fails the build on a violation.
It rejects an attribution entry or manifest asset that does not declare `original`, a duplicate
attribution path, a non-original entry missing `source`/`license`/`copyright`, a manifest asset
whose file is missing, and any manifest asset not marked original that has no matching attribution
record.

`assets/ATTRIBUTION.json` is an active, populated record, not a placeholder: it currently lists 32
assets, all of them project-original audio. Adding the first third-party asset means adding the
licensing fields above to its entry.
