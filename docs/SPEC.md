# VC Classic Video Games — Product and Engineering Specification

Status: Initial implementation specification  
Repository: `ekkus93/vc-classic-video-games`  
Primary target: Debian/Ubuntu Chromebooks  
Application framework: Tauri 2  

## 1. Purpose

VC Classic Video Games is a single, controller-first desktop application containing a curated collection of original retro arcade-style games. The application is intended to make converted Chromebooks feel like simple self-contained game consoles rather than general-purpose Linux computers that require users to configure emulators, ROM sets, BIOS files, per-game input mappings, or multiple launchers.

The first release will contain ten clean-room games inspired by the gameplay patterns of Pac-Man, Defender, Missile Command, Centipede, Frogger, Pitfall!, Asteroids, Joust, Dig Dug, and Donkey Kong. The project must use original source code, artwork, audio, names, level layouts, text, and other expressive content. The original commercial games are reference points for broad gameplay concepts, not source material to copy.

The core architectural principle is:

> Build one small game console and multiple game modules, not ten independent applications.

## 2. Goals

The project shall:

1. Provide one installable Tauri 2 application with one launcher and one shared runtime.
2. Be simple enough for a nontechnical user to operate entirely with a keyboard or common USB/Bluetooth gamepad.
3. Launch games without exposing Linux configuration, terminals, ROM management, or emulator settings.
4. Provide consistent controls, pause behavior, sound settings, high scores, and navigation across all games.
5. Run smoothly on modest Chromebook hardware under Debian or Ubuntu.
6. Preserve a deliberately retro low-resolution visual style while scaling cleanly to modern laptop displays.
7. Keep individual games isolated behind a stable module API so new games can be added cheaply.
8. Keep the real-time game loop in the frontend process and avoid per-frame Tauri IPC.
9. Use Rust/Tauri for native integration, persistence boundaries, packaging, and narrowly scoped operating-system functionality.
10. Support deterministic simulations where practical so gameplay logic can be tested reliably.
11. Be usable offline after installation.
12. Make development highly amenable to incremental/vibe-coded implementation without allowing each game to invent incompatible infrastructure.

## 3. Non-goals

The initial project is not intended to:

- emulate arcade, Atari, Nintendo, Namco, Williams, or other original hardware;
- load third-party ROMs;
- reproduce original game executable code;
- ship copyrighted sprites, sounds, music, fonts, logos, attract screens, maps, or level data from commercial games;
- reproduce original cabinet branding or trademarks as the product identity;
- provide online multiplayer;
- provide online accounts, cloud saves, leaderboards, telemetry, advertisements, or a store;
- require a network connection during normal play;
- become a general-purpose game engine before the ten launch games are complete;
- expose an unrestricted shell, arbitrary filesystem access, or arbitrary network access to game modules.

## 4. Legal and content policy

### 4.1 Clean-room implementation

All shipped gameplay code shall be newly authored for this repository. Developers may study publicly observable behavior and high-level descriptions of classic games, but shall not copy source code, decompiled code, ROM contents, proprietary data tables, or extracted assets.

### 4.2 Original expression

Each game shall use:

- an original title;
- original character and enemy designs;
- original sprites and animations;
- original sound effects and music;
- original level layouts and progression;
- original text and UI treatment.

The project may reproduce broad game mechanics and genre conventions while deliberately avoiding one-for-one copies of distinctive visual/audio expression and exact level layouts.

### 4.3 Third-party assets

Any third-party asset must have a license compatible with repository distribution. The repository shall maintain attribution/license records for all non-original assets. Prefer project-authored assets or permissively licensed assets.

### 4.4 Working names

The following names are temporary internal/product working names and may be changed before release:

| Inspiration | Working title |
| --- | --- |
| Pac-Man | Maze Chase |
| Defender | Star Defender |
| Missile Command | Missile Defense |
| Centipede | Bug Barrage |
| Frogger | River Hopper |
| Pitfall! | Jungle Quest |
| Asteroids | Space Rocks |
| Joust | Sky Riders |
| Dig Dug | Deep Digger |
| Donkey Kong | Barrel Climber |

The original commercial names may be used in developer documentation to describe inspiration, but should not be presented to users as the names of the shipped games.

## 5. Target platforms

### 5.1 Primary

- Debian on x86_64 Chromebooks converted from ChromeOS.
- Ubuntu on x86_64 Chromebooks converted from ChromeOS.

### 5.2 Secondary

The architecture should remain portable to other Tauri 2 desktop targets, but support is not required for the first release:

- Linux aarch64;
- Windows;
- macOS.

Tauri 2 mobile support is not a first-release requirement.

## 6. Technology stack

### 6.1 Application shell

- Tauri 2.x.
- Rust backend.
- Tauri capability/permission model with least privilege.

### 6.2 Frontend

- TypeScript in strict mode.
- Vite-based frontend build.
- React may be used for launcher/settings/high-score UI.
- React shall not own the real-time game simulation loop.
- HTML Canvas 2D is the baseline renderer.
- WebGL may be introduced later only when a measured need exists.
- Web Audio API is the baseline audio runtime.

### 6.3 Real-time architecture

The game update/render path shall execute entirely within the webview under normal operation:

```text
Tauri / Rust
  ├── persistence
  ├── platform integration
  ├── application lifecycle
  └── optional appliance integration

Webview / TypeScript
  ├── React launcher UI
  ├── settings and score UI
  └── game runtime
      ├── fixed-step simulation
      ├── input abstraction
      ├── Canvas rendering
      ├── Web Audio
      └── game modules
```

No game shall perform Tauri `invoke` calls from its per-frame `update` or `render` methods.

## 7. Repository layout

The target layout is:

```text
/
├── docs/
│   ├── SPEC.md
│   └── TODO.md
├── src/
│   ├── app/
│   │   ├── launcher/
│   │   ├── settings/
│   │   ├── scores/
│   │   └── components/
│   ├── engine/
│   │   ├── runtime/
│   │   ├── input/
│   │   ├── audio/
│   │   ├── assets/
│   │   ├── rendering/
│   │   ├── collision/
│   │   ├── tilemap/
│   │   ├── math/
│   │   ├── random/
│   │   └── persistence/
│   ├── games/
│   │   ├── space-rocks/
│   │   ├── missile-defense/
│   │   ├── river-hopper/
│   │   ├── maze-chase/
│   │   ├── bug-barrage/
│   │   ├── sky-riders/
│   │   ├── jungle-quest/
│   │   ├── deep-digger/
│   │   ├── star-defender/
│   │   └── barrel-climber/
│   └── test/
├── src-tauri/
│   ├── capabilities/
│   ├── src/
│   │   ├── commands/
│   │   ├── persistence/
│   │   ├── platform/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/
│   └── assets/
├── package.json
└── ...
```

Game-specific assets should live with or under the owning game rather than in an undifferentiated global asset directory unless they are genuinely shared.

## 8. Game module contract

### 8.1 Registration

Every game shall export a `GameModule` that can be registered without special-case launcher code.

Conceptual API:

```ts
export interface GameModule {
  metadata: GameMetadata;
  create(services: GameServices): GameInstance;
}

export interface GameInstance {
  start(options: GameStartOptions): void | Promise<void>;
  update(dtSeconds: number): void;
  render(renderer: GameRenderer): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
}
```

Optional interfaces may provide state serialization, replay/debug information, or game-specific diagnostics. These must not be mandatory for simple games.

### 8.2 Metadata

Each game shall provide data equivalent to:

```ts
interface GameMetadata {
  id: string;
  title: string;
  description: string;
  version: number;
  players: readonly number[];
  supportedInputs: readonly InputKind[];
  logicalWidth: number;
  logicalHeight: number;
  defaultDifficulty: DifficultyId;
  difficulties: readonly DifficultyDefinition[];
  controls: readonly ControlDescription[];
  assetManifest: string;
}
```

The launcher shall build game cards, help text, player choices, and control summaries from metadata rather than hard-coded per-game branches.

### 8.3 Services

Games shall receive shared services by dependency injection:

```ts
interface GameServices {
  input: InputService;
  audio: AudioService;
  assets: AssetService;
  scores: ScoreService;
  storage: GameStorageService;
  rng: RandomService;
  clock: GameClock;
  logger: GameLogger;
}
```

A game module shall not import another game's internals.

## 9. Game lifecycle

The runtime shall maintain an explicit lifecycle:

```text
UNLOADED
  -> LOADING
  -> READY
  -> RUNNING
  -> PAUSED
  -> RUNNING
  -> GAME_OVER
  -> READY/UNLOADED

Any state -> ERROR -> UNLOADED
```

Requirements:

- Only one game instance is active in release 1.
- Starting a new game destroys the previous instance.
- Pausing stops simulation advancement.
- Leaving a game releases timers, event listeners, audio nodes, asset references that require release, and animation handles owned by the game.
- Returning to the launcher shall not require reloading the Tauri window.
- A game crash/error must return the user to a recoverable launcher error screen rather than leave a blank window.

## 10. Simulation and timing

### 10.1 Fixed timestep

Gameplay simulation shall use a fixed simulation step, normally 60 Hz:

```text
simulation step = 1 / 60 second
render cadence = requestAnimationFrame cadence
```

The runtime shall accumulate elapsed wall-clock time and execute bounded fixed updates. It shall clamp unusually large elapsed intervals caused by suspend, debugger stops, window moves, or system stalls.

Recommended baseline:

- fixed step: 16.666666... ms;
- maximum accepted frame delta: 250 ms;
- maximum simulation updates per rendered frame: 5;
- discard excess accumulated time after the bound rather than enter a spiral of death.

### 10.2 Determinism

Game logic should avoid direct use of `Math.random()` and wall-clock time. Shared seeded RNG and clock services shall be used so tests can reproduce a run from seed/input sequences where practical.

### 10.3 Pause/suspend

On pause or application suspension:

- game simulation must not advance;
- input edge state must be cleared safely;
- audio must pause/mute appropriately;
- the accumulator must be reset on resume to prevent catch-up bursts.

## 11. Rendering

### 11.1 Logical resolution

The default game logical resolution is 320x240. The runtime shall support a game-declared logical framebuffer size so portrait-oriented games may use an explicitly approved alternate such as 240x320.

### 11.2 Scaling

- Preserve aspect ratio.
- Prefer integer nearest-neighbor scaling when the display permits it.
- Fall back to fractional nearest-neighbor scaling when necessary to maximize usable space on lower-resolution screens.
- Letterbox/pillarbox rather than stretch.
- Keep HUD text readable on common 1366x768 Chromebook panels.
- CSS and canvas configuration shall disable smoothing for pixel-art assets unless a particular asset explicitly requires smoothing.

Mechanism (CR-005): each game renders into an offscreen, logical-resolution `LogicalFramebuffer`.
A shell-owned present loop blits that framebuffer onto the visible canvas every frame via
`presentFramebuffer`, which computes scale/letterbox placement through `calculateViewport` (the
integer-preferred/fractional-fallback algorithm this section describes) rather than relying on
CSS to stretch a logical-resolution canvas. The present loop is its own RAF chain, owned and
torn down by the shell alongside the renderer it feeds -- a distinct concern from a game's own
fixed-step/render driver loop (§10) and from the shell's input-polling RAF chain, the same way
each of those is independently started and cancelled by the effect that owns it.

Scaling is computed in device pixels, not CSS pixels (CR2-003). `calculateViewport`'s
integer-scale guarantee only holds in whatever unit its physical-size argument is expressed in; a
canvas backing store sized in CSS pixels is itself rescaled onto the panel by the browser's own,
non-integer compositing scale on any display where `devicePixelRatio` is not 1 (1.25x and 1.5x are
common Chromebook settings), which defeats the guarantee where it actually matters. The present
loop therefore sizes the visible canvas's backing store via `devicePhysicalSize(cssSize,
devicePixelRatio)` (`round(cssSize * devicePixelRatio)`, floored at one device pixel) every frame
-- not only on resize, since `devicePixelRatio` itself changes under browser zoom without firing a
resize event -- and calls `calculateViewport`/`presentFramebuffer` against that device-pixel size.
The pointer path (§12.5) is sized identically, for the same reason: `floor()` is not linear in
`devicePixelRatio`, so quantizing the render viewport and the pointer viewport independently, in
different units, can pick different integer scales at the same CSS size.

**Known trade-off at fractional DPR (CR3-007):** computing the integer scale in device pixels
rather than CSS pixels changes how much of the panel the game fills at a fractional
`devicePixelRatio` -- accepted deliberately, since it is exactly what "prefer integer
nearest-neighbor scaling" above asks for once quantization happens in the unit that actually
reaches the panel. At a 1366x768 CSS viewport, against a 320x240 logical framebuffer:

| DPR | device px per logical px (after) | CSS px per logical px (before) | CSS px per logical px (after) | on-screen game size |
| --- | --- | --- | --- | --- |
| 1 | 3 | 3 | 3 | unchanged (960x720 CSS) |
| 1.25 | 4 | 3 | 3.2 | larger (960x720 → 1024x768 CSS) |
| 1.5 | 4 | 3 | 2.67 | **smaller** (960x720 → ≈853x640 CSS) |
| 2 | 6 | 3 | 3 | unchanged (960x720 CSS) |

The "before" column is DPR-independent because the pre-CR2-003 code fed `calculateViewport` CSS
pixels directly (`floor(min(1366/320, 768/240)) = 3` at every DPR). At 1.5x -- a common Chromebook
setting -- the game now occupies noticeably less of the panel in exchange for each logical pixel
landing on an exact 4 device pixels instead of a non-integer 4.5; decided as option A over
reopening the integer-scaling preference P3-005 already settled. Verified arithmetically against
the real `calculateViewport`/`devicePhysicalSize`; the visual check on physical 1.25x/1.5x hardware
is a `docs/P18_RELEASE_ACCEPTANCE.md` human item, not settled here.

### 11.3 Frame ownership

Each game draws only into the game surface supplied by the runtime. Launcher UI overlays such as pause, confirm-exit, and global notifications are owned by the application shell.

### 11.4 Retro presentation

Retro styling is intentional, but the project shall not simulate CRT effects by default. Optional scanline, phosphor, or curvature effects may be added later and must be disabled on hardware that cannot maintain the frame target.

## 12. Input system

### 12.1 Abstract actions

Games shall consume logical actions, not raw browser key codes:

```text
UP
DOWN
LEFT
RIGHT
ACTION_1
ACTION_2
START
PAUSE
BACK
```

Additional actions must be justified by a game requirement and added through the input schema rather than directly reading keys.

### 12.2 Devices

Release 1 shall support:

- Chromebook keyboard;
- common standard-mapped USB/Bluetooth gamepads through the browser Gamepad API;
- mouse/touchpad pointer for games where aiming is useful.

Touchscreen support is desirable but not required for the first release.

### 12.3 Default keyboard mappings

Launcher:

- Arrow keys or WASD: navigate.
- Enter/Space: select.
- Escape/Backspace: back.

Player 1 baseline:

- Arrow keys: movement.
- Z or Space: Action 1.
- X or Left Shift: Action 2.
- Enter: Start.
- Escape: Pause/Back.

Player 2 baseline for games that support local multiplayer:

- WASD: movement.
- F: Action 1.
- G: Action 2.

Mappings shall be configurable before final release. Conflict detection must prevent two actions in the same active profile from becoming unintentionally ambiguous.

### 12.4 Gamepads

- Detect connect/disconnect while the app is running.
- Prefer standard Gamepad API mapping.
- Allow player assignment.
- Provide dead-zone handling for analog sticks.
- Convert D-pad and left stick to the same directional logical actions unless a game explicitly requests analog motion.
- Do not require a mouse to select or launch a game when a gamepad is connected.

### 12.5 Pointer input

Missile Defense and any future cursor-target game may request a pointer service. The pointer service shall normalize coordinates into logical game-space coordinates and shall not expose screen-size-specific behavior to the game.

Physical pointer coordinates are measured against the actual visible game canvas, not an outer
container with its own padding/chrome (CR-004), and are scaled into device pixels by the same
`devicePixelRatio` the present loop uses to size the canvas backing store, before being mapped
through `calculateViewport`'s output (CR2-003). Both must agree in unit and in the physical size
fed to `calculateViewport`, not merely each independently produce a plausible result: because the
viewport's integer scale is a `floor()`, computing it separately in CSS pixels for pointer input
and in device pixels for rendering can quantize to a different whole-number scale at the same CSS
size, which would misalign where a click resolves from where the frame it clicked on was actually
drawn.

## 13. Audio

The shared audio system shall provide:

- master volume;
- sound-effects volume;
- music volume;
- mute;
- one-shot effects;
- looped effects/music;
- per-game channel cleanup on destruction;
- safe handling of browser/WebView user-gesture audio restrictions.

Games shall address audio through asset IDs rather than constructing paths ad hoc.

The default application must remain usable with audio disabled.

`pauseAll()` and `resumeAll()` remain synchronous lifecycle calls, but any underlying WebAudio
`suspend()`/`resume()` promise must terminate in an explicit rejection handler. Rejection is
nonfatal and goes to a real diagnostic reporter with operation context (`suspend` or `resume`); a
reporter that itself throws is a final-boundary failure and is contained rather than becoming a
second unhandled rejection.

## 14. Assets

### 14.1 Asset manifests

Each game shall declare its assets in a manifest so the runtime can preload required assets and detect missing references before gameplay begins.

### 14.2 Supported assets

Initial supported types:

- PNG/WebP sprite sheets;
- optionally SVG for non-pixel launcher art;
- WAV/OGG audio as supported by the target webview;
- JSON level/map data;
- project-owned bitmap or web fonts where licensing permits.

### 14.3 Validation

Development/CI tooling shall validate:

- referenced files exist;
- IDs are unique;
- dimensions/metadata required by the manifest are valid;
- third-party attribution data is present where required;
- the required `src/games` discovery tree is readable. Discovery errors fail validation closed;
  only an existing, successfully-read empty game directory means “zero manifests.”

## 15. Collision, tile maps, and shared gameplay primitives

The common engine should provide only primitives demonstrated by at least one launch game.

Expected reusable primitives include:

- AABB collision;
- circle collision;
- segment/ray intersection where needed;
- spatial grid helpers;
- tile-map loading/querying;
- grid-to-world conversions;
- wrapping coordinates;
- simple kinematic movement;
- sprite animation clocks;
- object pools for short-lived projectiles/particles if profiling justifies them;
- breadth-first/A*-style grid pathfinding for maze/tunnel games;
- small finite-state-machine helpers.

Do not build a general ECS or physics engine unless requirements from multiple games clearly justify it.

## 16. Persistence

### 16.1 Ownership

Persistent storage shall be owned by the Rust/Tauri side or by a narrowly scoped frontend abstraction backed by approved Tauri commands. Game modules do not receive arbitrary filesystem paths.

### 16.2 Data

Persist at least:

- global settings;
- input mappings;
- per-game high scores;
- per-game difficulty preferences;
- optional unlocked/progression state;
- optional game-specific saves only when a game needs them.

### 16.3 Format

Initial persistence may use versioned JSON files. Every persisted root object must contain a schema version. Writes shall be atomic where practical: write/flush a temporary file and replace the prior file.

Frontend Tauri document saves are ordered per logical persistence key `(document, gameId-or-empty)`.
Save B for one key must not invoke native persistence until earlier save A for that same key has
settled; A rejecting must not poison B, and unrelated keys may proceed concurrently. Native atomic
saves must also be collision-safe under direct concurrent callers: each save attempt owns its own
exclusively-created temporary file, cleans up only that file on failure, and atomically renames a
complete payload into place. Unique temp files provide collision safety; frontend serialization is
what preserves application invocation order.

Corrupt data shall not prevent the application from launching. Invalid files shall be quarantined or ignored with a visible recoverable warning and safe defaults. Every production settings, scores, or game-state repository is constructed with a real recovery reporter; recovery must not silently discard corrupt data.

### 16.4 High scores

The shared score service shall support:

- game ID;
- game mode/difficulty ID;
- numeric score;
- optional short player initials/name;
- timestamp;
- deterministic tie ordering;
- configurable top-N list, default 10 per game/mode.

Games may submit scores but shall not directly rewrite the global score database.

#### 16.4.1 Shared `ScoreCommitter`

Every game submits its run score through the same shared committer in
`src/engine/scores/score-committer.ts`, rather than reimplementing the submission guard per game:

- `ScoreCommitter<TEvent>` holds the submit-once flag. The first frame whose events carry the
  game's terminal event submits; every later frame is ignored until `reset()` starts a new run.
- The submit promise is deliberately not awaited, and a rejection never reaches gameplay: it is
  routed to the game-supplied `reportError` handler, keeping a failing score store inside the
  game's own boundary.
- In the default runtime, the shared persistent score service reports the failed save exactly once
  through the shell persistence channel before rethrowing the same failure to `ScoreCommitter`.
  The shell shows a generic nontechnical warning (`Your score could not be saved.`) while the real
  game logger retains game identity and the underlying error. This service-level reporting is
  mandatory and therefore covers games whose optional game-level `ScoreCommitter` reporter is
  absent.
- `terminalScoreOfType(type)` builds the terminal-score reader. A game supplies only the name of
  its own terminal event (most use `"game-over"`; Jungle Quest uses `"run-ended"`), and the type
  parameter is constrained to event-union members that actually carry a numeric `score`.

Each game's `src/games/<name>/score-submission.ts` is a thin subclass that names its terminal
event and keeps the game-specific class and error-handler type names its module and tests use.

#### 16.4.2 Shared `ParticleBurstField`

Games that draw particle bursts drive the shared bounded field in
`src/engine/effects/particle-burst.ts` rather than reimplementing the age/velocity/cap loop:

- a burst fans `count` particles around a rotating ring phase, each at a quantized fraction of the
  burst speed, and the requested count is a request -- `maxParticles` wins, so a burst into a full
  field is trimmed or dropped and the population never grows unbounded;
- bursts consume no randomness, so a replayed run draws the same particles;
- the ring phase, jitter constants, and cap are per-game configuration, which is what keeps each
  game's existing look intact through the extraction.

Eight games use it (Barrel Climber, Bug Barrage, Deep Digger, Jungle Quest, Maze Chase, River
Hopper, Space Rocks, Star Defender). Missile Defense draws no particles. Sky Riders keeps its own
implementation: it caps by dropping the oldest particles rather than refusing new ones, and phases
its ring in radians rather than turns, so it is a different burst model rather than a copy of this
one. Star Defender uses the shared field but draws the particles itself, against its scrolling
camera.

## 17. Launcher and shell UX

### 17.1 Startup

Normal startup enters the game launcher. The launcher displays all registered games and must be usable without a mouse.

Runtime mode is explicit. A present Tauri bridge selects native mode and durable
`TauriJsonDocumentStore` persistence. Browser preview may select `MemoryJsonDocumentStore` only
when the build explicitly allows development preview. A native-required/production build with no
bridge fails startup; it must never silently downgrade durable storage to volatile memory. Native
diagnostic-command failure is reported as a native integration error and is never relabeled as
“browser preview.”

### 17.2 Game card

Each game card should expose:

- title;
- original project artwork/icon;
- one-line description;
- number of supported players;
- high score summary;
- primary launch action.

### 17.3 Pre-game screen

Before launch, the application may show:

- Start;
- player count when applicable;
- difficulty;
- control reminder;
- high scores;
- optional help/how-to-play.

### 17.4 Pause menu

Global pause overlay:

- Resume;
- Restart;
- Controls;
- Sound settings;
- Return to launcher.

Destructive actions such as abandoning an active run should require confirmation when accidental activation is plausible.

### 17.5 Settings

Global settings shall include:

- master/music/SFX volumes;
- fullscreen/windowed mode where appropriate;
- input remapping;
- gamepad assignment;
- optional visual effects;
- reset-to-defaults.

A settings mutation is successful only after validation and durable repository save succeed. A
contained save failure keeps the previously accepted settings snapshot, leaves a visible
`Settings were not saved: …` error, and must not post a success status, clear that error, configure
dependent audio with rejected values, or perform a dependent native fullscreen change. Callers
that need to continue conditionally receive an explicit success/failure result rather than a
fulfilled `void` promise after failure.

## 18. Tauri/Rust boundary

### 18.1 Responsibilities

Rust/Tauri owns:

- application boot/lifecycle;
- configuration and score persistence;
- safe path resolution;
- packaging metadata;
- platform integration;
- optional appliance-mode operations;
- structured logging sink where appropriate.

TypeScript owns:

- launcher state/UI;
- game registry;
- input normalization;
- real-time simulation;
- rendering;
- audio scheduling;
- gameplay logic.

### 18.2 Commands

Tauri commands must be coarse-grained and non-frame-critical, such as:

- `load_settings`;
- `save_settings`;
- `load_scores`;
- `submit_score`;
- `load_game_state`;
- `save_game_state`;
- `get_platform_info`.

No command may accept arbitrary shell strings or unrestricted filesystem paths from a game module.

## 19. Security model

The application is offline-first and should need very few native privileges.

Requirements:

- Use Tauri 2 capabilities with least privilege.
- Disable shell execution in the normal game runtime.
- Do not grant arbitrary filesystem read/write access to the webview.
- Do not grant unrestricted HTTP/network access.
- Use a restrictive Content Security Policy compatible with bundled assets.
- Treat save/config data as untrusted input during parsing.
- Validate all data crossing the Tauri command boundary.
- Avoid dynamic remote code or remote scripts.
- Bundle runtime assets locally.

Optional system shutdown/reboot functionality for appliance deployments must be isolated behind a separately reviewed platform integration and must not imply general shell access.

## 20. Logging and error handling

### 20.1 Logging

Provide structured levels:

- error;
- warn;
- info;
- debug in development builds.

Avoid frame-by-frame logging in production.

### 20.2 Error boundaries

- React launcher UI shall have a top-level error boundary.
- Runtime shall catch game-module startup/update/render failures where technically possible, stop the affected game, and return to a recoverable error view.
- Persistence errors shall show a nontechnical user message while retaining diagnostic detail in logs.
- Missing required game assets shall prevent only that game from starting when possible, not crash the entire launcher.

Canonical failure-handling rules:

- Containment must never become false success. If an operation fails but remains nonfatal, callers
  and UI state must still know it failed.
- Production error boundaries must have a real reporter/log sink. A no-op may appear in a test
  fixture or as an optional secondary game callback, but it may not be the default runtime's sole
  destination for a recoverable production failure.
- Durable-to-volatile and native-to-preview fallbacks are allowed only when an explicit runtime
  mode permits them; absence/failure of an expected native integration is an error, not preview.
- Every deliberately fire-and-forget promise whose underlying operation can reject must have an
  explicit terminal rejection policy.
- Development/CI validators fail closed on unexpected filesystem/discovery errors.
- Persistence APIs are correct under concurrent callers: same-key application saves preserve
  invocation order and native temp-file handling cannot collide.
- Recoverable environmental failures (disk/store/logger/audio lifecycle) may be contained to keep
  gameplay usable; programmer defects in game-owned logic should surface loudly rather than be
  silently converted into missing behavior.
- A bare terminal swallow is permitted only when all useful reporting boundaries have already
  failed or when it intentionally preserves the primary failure; every such swallow must carry a
  local rationale. `ScoreCommitter` swallowing a throw from its own error reporter is the
  canonical example: escaping or recursively reporting would recreate the failure it is designed
  to contain.

## 21. Performance targets

Primary target is modest Chromebook hardware.

Release acceptance targets:

- 60 simulation updates/second under normal gameplay.
- Rendering should sustain display refresh up to 60 Hz for all launch games on the reference low-end Chromebook.
- No unbounded entity, particle, timer, or listener growth during a 30-minute soak test.
- Game-to-launcher transition should be effectively immediate after already-loaded UI assets.
- Normal gameplay must not depend on network latency.
- Avoid unnecessary large textures; preserve low-resolution asset discipline.
- Memory must return near baseline after repeatedly launching/exiting games; leaks across game instances are release blockers.

Performance budgets may be made more precise after a reference Chromebook is selected and measured.

## 22. Accessibility and usability

The retro aesthetic does not override basic usability.

Requirements:

- Launcher controls must have keyboard focus indicators.
- Menu text must meet practical contrast/readability requirements.
- Essential state must not be communicated by color alone.
- Provide master volume/mute.
- Offer reduced-flash or reduced-effects settings if any game introduces frequent flashes.
- Do not rely on hover-only interactions.
- All global launcher/settings flows must be operable with keyboard alone.
- Game-specific control instructions shall be visible before or during play.

## 23. Packaging and Chromebook deployment

### 23.1 Packages

The project shall support a normal Linux desktop package for development/release. Preferred release artifacts:

- Debian `.deb` package;
- AppImage if compatibility testing is satisfactory.

### 23.2 Desktop integration

Installable builds should provide:

- application icon;
- desktop entry;
- correct app identifier;
- launcher name;
- clean uninstall behavior.

### 23.3 Appliance mode

A later appliance profile may configure a Chromebook to:

```text
Power on
  -> Debian/Ubuntu boot
  -> automatic user login
  -> VC Classic Video Games fullscreen launcher
```

Appliance mode is deployment configuration, not a reason to couple the app to a particular desktop environment.

Potential optional appliance features:

- start fullscreen;
- hide desktop chrome as much as the window manager permits;
- return to launcher on game exit;
- controlled shutdown button;
- resilient relaunch after an unexpected app termination.

These features must remain optional so normal desktop users can run the application safely.

## 24. Testing strategy

### 24.1 TypeScript unit tests

Unit-test deterministic logic including:

- fixed-step runtime behavior;
- input state transitions;
- dead-zone mapping;
- coordinate scaling;
- collision helpers;
- tile queries;
- seeded RNG;
- score ordering;
- lifecycle transitions;
- per-game scoring and core rules.

### 24.2 Game simulation tests

Game logic should be factored so important rules can be advanced without a real Canvas or audio device. Tests may provide synthetic inputs and fixed seeds.

Examples:

- Space Rocks asteroid splits into expected children.
- Missile Defense blast destroys missiles only within its radius.
- River Hopper player inherits a moving platform's displacement.
- Maze Chase frightened enemies change collision outcome.
- Bug Barrage segment split creates independent chains.
- Deep Digger tunnel topology updates after digging.

### 24.3 Rust tests

Test:

- schema parsing/migration;
- path handling;
- atomic persistence behavior;
- score/config validation;
- platform command argument validation.

### 24.4 Integration/smoke tests

Automate at least:

- app frontend builds;
- game registry contains all required games;
- every game asset manifest resolves;
- every game can create/start/reset/destroy in a headless test harness where feasible;
- Tauri development/build configuration remains valid.

### 24.5 Manual acceptance

For each release candidate, test on a converted Chromebook with:

- keyboard only;
- at least one common USB gamepad;
- gamepad hot-plug;
- suspend/resume;
- fullscreen;
- repeated game switching;
- audio enabled/disabled;
- corrupted settings test;
- long-running soak session.

## 25. CI and quality gates

CI should be bounded, deterministic, and suitable for pull requests and pushes to `master`.

Required checks before release:

Frontend:

- dependency install from lockfile;
- formatting check;
- lint;
- TypeScript typecheck;
- unit tests;
- production frontend build.

Rust:

- `cargo fmt --check`;
- `cargo clippy` with warnings denied for project code;
- `cargo test`.

Cross-project:

- asset-manifest validation;
- license/attribution validation;
- Tauri configuration validation;
- Linux package/build smoke test when practical.

CI jobs must have reasonable timeouts and must not download or execute arbitrary remote game content.

## 26. Game requirements

The requirements below define the first playable scope. They describe broad mechanics, not exact replicas.

### 26.1 Space Rocks — Asteroids-inspired

Core mechanics:

- free rotation;
- thrust with inertia;
- screen-edge wrap;
- projectile firing;
- large rocks split into smaller rocks;
- collisions between ship/projectiles/rocks;
- lives, score, waves, increasing difficulty;
- original vector/pixel visual treatment.

Acceptance:

- ship momentum is independent of facing direction;
- wrap is seamless;
- destroying large hazards produces deterministic child hazards from the run seed;
- a complete score/lives/game-over loop works;
- restart and return-to-launcher are clean.

### 26.2 Missile Defense — Missile Command-inspired

Core mechanics:

- ground cities/targets and defensive launch sites;
- pointer or gamepad-controlled targeting cursor;
- finite defensive ammunition;
- interceptor projectile traveling toward target point;
- expanding/contracting blast radius;
- enemy missiles destroyed by blast intersection;
- chain reactions;
- wave scoring and resource carryover rules.

Acceptance:

- pointer coordinates map correctly at every display scale;
- each launch site has visible remaining ammunition;
- a city can be destroyed and affects end-of-wave state;
- explosions never become unbounded entities;
- gamepad-only play is possible.

### 26.3 River Hopper — Frogger-inspired

Core mechanics:

- discrete player hops between lanes/cells;
- road lanes with moving hazards;
- river lanes with moving safe platforms;
- player carried by occupied moving platforms;
- water/vehicle hazards;
- multiple home/goal slots;
- timer or pressure mechanic;
- increasingly difficult lane patterns.

Acceptance:

- collisions are deterministic at lane boundaries;
- river support is based on actual overlap, not visual guesswork;
- platform motion carries the player correctly;
- original lane layouts are used;
- completed home slots persist through the current round.

### 26.4 Maze Chase — Pac-Man-inspired

Core mechanics:

- grid maze with smooth corridor movement;
- pellets and special power items;
- four enemy agents with distinct targeting personalities;
- chase/scatter-like behavioral phases or equivalent original phase system;
- frightened/vulnerable enemy state;
- tunnel/edge transitions where used;
- bonus pickup;
- lives and score.

Acceptance:

- the maze layout is original;
- player turns can be buffered shortly before intersections;
- enemies use distinct deterministic targeting strategies;
- power-state collisions reverse normal danger semantics for a bounded period;
- all collectibles can be cleared and advance the level.

### 26.5 Bug Barrage — Centipede-inspired

Core mechanics:

- player motion within a lower play region;
- segmented enemy traversing a field of obstacles;
- obstacle contact changes segment direction/row;
- shooting a segment can split chains;
- destructible/repairable field obstacles;
- secondary roaming enemies;
- increasing waves and speed.

Acceptance:

- chain splitting produces independently simulated chains;
- segment navigation remains stable after arbitrary obstacle changes;
- projectile/object collision is consistent at high wave speed;
- object counts remain bounded.

### 26.6 Sky Riders — Joust-inspired

Core mechanics:

- horizontal movement;
- gravity and momentum;
- flap action providing discrete upward impulse;
- platforms;
- mounted/rider enemies;
- altitude-based collision victory rule;
- defeated enemies may produce collectible/recoverable objects;
- wave progression.

Acceptance:

- flap cadence materially affects trajectory;
- collision outcome is based on a documented deterministic height rule;
- platform landing is stable without jitter;
- at least one local two-player mode is supported before release or explicitly deferred in the release notes.

### 26.7 Jungle Quest — Pitfall!-inspired

Core mechanics:

- side-view platforming;
- run and jump;
- vines or equivalent swing mechanic;
- ladders/elevation changes;
- hazards and pits;
- connected screen/room world;
- collectibles/treasure;
- score and optional time pressure.

Acceptance:

- movement remains responsive at 60 Hz;
- jumps and landings are deterministic;
- room transitions cannot duplicate/destroy player state incorrectly;
- world layout is original;
- at least one alternate route or underground/secondary traversal layer exists.

### 26.8 Deep Digger — Dig Dug-inspired

Core mechanics:

- diggable earth grid;
- player-created tunnels;
- enemies using tunnel navigation;
- temporary enemy traversal through solid material or an original equivalent;
- pump/pressure-style multi-stage attack or an original mechanically similar risk/reward tool;
- falling rocks triggered by excavation;
- score and waves.

Acceptance:

- digging changes collision/navigation topology immediately;
- enemy route finding cannot hang on disconnected graphs;
- falling-object interactions are deterministic;
- attack stages have visible feedback;
- level generation/layout is original.

### 26.9 Star Defender — Defender-inspired

Core mechanics:

- horizontally scrolling continuous/wrapping world;
- inertial player craft;
- forward weapon;
- limited smart-bomb-like emergency action;
- radar/minimap showing off-screen threats;
- ground inhabitants/objectives;
- enemies that can abduct/carry objectives;
- player rescue of falling/abducted objectives;
- multiple enemy types and waves.

Acceptance:

- camera, world coordinates, and radar represent the same canonical world state;
- world wrap is seamless;
- off-screen simulation remains bounded and correct;
- rescue sequence works from abduction through falling/catch/return;
- game remains playable at target frame rate under maximum designed wave density.

### 26.10 Barrel Climber — Donkey Kong-inspired

Core mechanics:

- platform-and-ladder traversal;
- run, climb, and jump;
- rolling/falling hazards;
- enemy/hazard interactions with ladders/platform edges;
- rescue/reach-the-goal objective;
- multiple original stages using the shared platformer primitives;
- score/lives/level progression.

Acceptance:

- stage layouts are original and not direct copies;
- ladder mounting/dismounting is predictable;
- rolling hazards follow platform geometry without tunneling;
- jumping reliably clears hazards based on visible timing;
- at least three distinct stage layouts/mechanical variations exist for release 1 unless scope is revised explicitly.

## 27. Development order

The preferred implementation order is chosen to build reusable infrastructure incrementally:

1. Space Rocks.
2. Missile Defense.
3. River Hopper.
4. Maze Chase.
5. Bug Barrage.
6. Sky Riders.
7. Jungle Quest.
8. Deep Digger.
9. Star Defender.
10. Barrel Climber.

This ordering may change if implementation evidence shows a better dependency sequence, but changes should be recorded in `docs/TODO.md` rather than silently diverging.

## 28. Definition of playable

A game is not considered playable merely because its primary mechanic appears on screen. A launch game reaches playable status only when it has:

- start flow;
- complete input mapping;
- deterministic/bounded main loop;
- scoring or progress objective;
- loss/failure condition;
- game-over/completion state;
- restart;
- pause;
- return to launcher;
- required audio hooks, even if final assets are pending;
- original placeholder or final art sufficient to understand gameplay;
- automated tests for core rules;
- no known unbounded resource growth in a normal session.

## 29. Definition of release 1

Release 1 is complete when:

1. The application installs and launches on the reference Debian/Ubuntu Chromebook.
2. The launcher is fully keyboard and gamepad navigable.
3. All ten game modules meet their agreed release acceptance criteria.
4. Shared settings, audio, high scores, pause/restart, and return-to-launcher work consistently.
5. No shipped game uses proprietary ROM code/assets or copied original level data.
6. CI quality gates pass from a clean checkout.
7. A 30-minute game-switching soak test shows no material resource leak or runtime degradation.
8. Suspend/resume and gamepad hot-plug have been manually tested.
9. A `.deb` release artifact is produced; AppImage is produced if validated.
10. Installation/use instructions for a normal Linux desktop and an optional Chromebook appliance setup are documented.

## 30. Change control

This specification is the canonical statement of intended architecture and product behavior. Implementation may reveal better approaches. When a material requirement or architecture decision changes:

1. update `docs/SPEC.md`;
2. update affected tasks/acceptance criteria in `docs/TODO.md`;
3. make the change explicit in the implementing commit or pull request.

Avoid undocumented architectural drift, especially in input, persistence, game lifecycle, rendering, and Tauri security boundaries.
