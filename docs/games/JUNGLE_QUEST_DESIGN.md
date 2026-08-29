# Jungle Quest — clean-room design

Jungle Quest is an original single-player side-view expedition built specifically for this project. It uses only project-owned geometric rendering and synthesized audio; it does not copy level layouts, names, characters, art, music, or source from any existing game.

## Expedition layout

The run crosses four connected rooms at a fixed 320×240 logical resolution:

1. **Fern Gate** — starting checkpoint, raised ladder-accessed ledge, thorn hazard, Jade Seed, and a true jumpable chasm.
2. **Echo Hollow** — split surface route with a hanging vine plus a continuous lower tunnel route and the Sun Disc.
3. **Root Vault** — second checkpoint, tunnel/surface connection, hazard, and Root Crystal.
4. **Sun Shrine** — final route, Sky Amber, and the finish shrine.

The lower tunnel intentionally provides a continuous alternate route through the middle expedition
instead of making the vine the only viable traversal mechanic. It spans the two middle rooms and
no further: Fern Gate has no tunnel, so the tunnel's west end is a wall rather than a doorway.
A room boundary is only travelable when the room behind it has floor under the arrival point at
the height the player arrives at, so a boundary the player cannot be delivered safely through
holds them like the world edge instead of dropping them. To return west from the tunnel, climb
Echo Hollow's descent ladder back to the surface.

## Controls

- Left/right: run; while hanging from a vine, pump the swing.
- Up/down: enter and climb ladders.
- Action 1: jump; while hanging, release the vine.
- Action 2: grip/release a nearby vine.
- Pause: shared shell pause overlay, restart, settings, and return-to-launcher flow.

Keyboard and standard gamepad inputs are provided by the shared logical input service, exactly as for Space Rocks.

## Deterministic movement

Movement uses fixed constants for acceleration, friction, gravity, jump speed, climbing, and pendulum-like vine motion. No wall-clock time or unseeded random source participates in gameplay. Each run resets the shared seeded RNG even though the authored level itself does not currently consume randomness.

## Hazards and checkpoints

Contact hazards or falling completely below the room costs one life and subtracts a bounded score penalty. A surviving player respawns at the most recent checkpoint. Ordinary hazard contact receives a short respawn-protection window; falling out of the world always triggers recovery immediately so a protected player cannot remain below the level.

## Relics, completion, and score

Each relic may score once. Room/checkpoint progress awards a small bonus. The expedition completes only after all four relics are collected and the player reaches the Sun Shrine finish area. Completion adds a fixed bonus plus remaining-life and remaining-time bonuses. Runs also terminate on zero lives or time expiration. Only terminal run events are submitted to the shared score service, and persistence rejection is contained/logged rather than breaking gameplay.

## Runtime ownership

The game module owns only its simulation and transient effects. Rendering, input, audio, score persistence, fixed-step timing, pause/restart/exit, trusted audio unlock, renderer attachment, and failure recovery remain owned by the existing shared platform. Restart creates a fresh run and shell exit destroys game-owned effects/audio.

## Audio and visual provenance

All visuals are project-authored geometric primitives. The six WAV effects in `src/games/jungle-quest/audio/` are original programmatically synthesized tones created for Jungle Quest and declared `original: true` in its asset manifest.
