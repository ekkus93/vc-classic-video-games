# VC Classic Video Games — Implementation TODO

Canonical specification: `docs/SPEC.md`  
Target branch: `master`  
Primary platform: Debian/Ubuntu Chromebooks  

## 1. How to use this file

Tasks are intended to be completed in dependency order. Each task has a stable ID so implementation commits, reviews, and follow-up work can refer to it unambiguously.

Status convention:

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

A task should be marked complete only after its acceptance criteria pass. When implementation changes a material architectural decision, update both this file and `docs/SPEC.md` in the same change.

## 2. Phase map

| Phase | Scope |
| --- | --- |
| P0 | Repository and engineering foundation |
| P1 | Tauri 2 application shell |
| P2 | Core runtime and game-module contract |
| P3 | Rendering and timing |
| P4 | Input and controller subsystem |
| P5 | Audio, assets, persistence, and scores |
| P6 | Launcher, settings, pause, and shell UX |
| P7 | Space Rocks — Asteroids-inspired reference game |
| P8 | Missile Defense — Missile Command-inspired |
| P9 | River Hopper — Frogger-inspired |
| P10 | Maze Chase — Pac-Man-inspired |
| P11 | Bug Barrage — Centipede-inspired |
| P12 | Sky Riders — Joust-inspired |
| P13 | Jungle Quest — Pitfall!-inspired |
| P14 | Deep Digger — Dig Dug-inspired |
| P15 | Star Defender — Defender-inspired |
| P16 | Barrel Climber — Donkey Kong-inspired |
| P17 | Chromebook/appliance integration |
| P18 | Release hardening, QA, packaging, and documentation |

---

# P0 — Repository and engineering foundation

- [x] **P0-001 — Establish canonical project toolchain**
  - Choose and record supported Node/package-manager workflow and Rust toolchain policy.
  - Commit lockfiles/configuration required for reproducible installs.
  - Acceptance: clean checkout can install frontend and Rust dependencies without undocumented local setup.

- [x] **P0-002 — Scaffold formatting and linting policy**
  - Configure TypeScript/JavaScript formatting and linting.
  - Configure `cargo fmt` and Clippy expectations.
  - Acceptance: documented commands exist for format-check and lint-check; clean scaffold passes.

- [x] **P0-003 — Enable strict TypeScript configuration**
  - Use strict type checking.
  - Enable additional safe compiler checks where compatible with the chosen stack.
  - Acceptance: `typecheck` script passes with no ignored baseline errors.

- [x] **P0-004 — Establish unit-test infrastructure**
  - Add frontend/engine unit-test runner.
  - Add a minimal deterministic smoke test.
  - Confirm Rust tests run from repository commands.
  - Acceptance: both TypeScript and Rust test commands pass from clean checkout.

- [x] **P0-005 — Define source directory boundaries**
  - Create `src/app`, `src/engine`, `src/games`, and `src-tauri` organization consistent with the spec.
  - Add import aliases only where they improve clarity.
  - Acceptance: boundaries are documented and no game-specific code lives in shared runtime directories.

- [x] **P0-006 — Add asset/license provenance policy**
  - Create a machine-readable or documented attribution mechanism for third-party assets.
  - Add guidance forbidding copied ROM/assets/level data.
  - Acceptance: repository has a clear place/process to record each non-original asset license.

- [x] **P0-007 — Add bounded GitHub Actions CI**
  - Run formatting, lint, typecheck, unit tests, Rust fmt/Clippy/tests, and a production frontend build.
  - Add reasonable per-job timeouts.
  - Use lockfile/frozen dependency installs.
  - Acceptance: CI passes on `master` from a clean checkout and cannot run indefinitely.

- [x] **P0-008 — Add basic developer documentation**
  - Document install, dev-run, test, lint, and build commands.
  - Acceptance: a developer unfamiliar with the repository can start the app using only repository docs.

---

# P1 — Tauri 2 application shell

- [x] **P1-001 — Scaffold Tauri 2 + TypeScript frontend**
  - Create the Tauri 2 application.
  - Use a Vite-based TypeScript frontend.
  - Acceptance: `tauri dev` opens a functional application window.

- [x] **P1-002 — Add launcher UI framework boundary**
  - Add React for application UI if retained as the chosen shell framework.
  - Keep game simulation/rendering outside React state/render cycles.
  - Acceptance: launcher component renders and Canvas runtime can update independently.

- [x] **P1-003 — Define application identity and metadata**
  - Set app identifier, product name, version source, icons/placeholders, and Linux metadata.
  - Acceptance: built binary/package reports the intended app identity consistently.

- [x] **P1-004 — Configure Tauri capabilities with least privilege**
  - Start with minimal capabilities.
  - Do not enable unrestricted shell, arbitrary filesystem, or unrestricted network access.
  - Acceptance: capability files are explicit and reviewed against `docs/SPEC.md`.

- [x] **P1-005 — Add restrictive content-security policy**
  - Permit bundled application assets and required local execution only.
  - Avoid remote scripts/content.
  - Acceptance: dev/release app runs under the configured CSP without broad wildcard exceptions.

- [x] **P1-006 — Implement Rust command module structure**
  - Create coarse-grained command modules for persistence/platform operations.
  - Do not add per-frame commands.
  - Acceptance: example typed command round-trip succeeds and input is validated.

- [x] **P1-007 — Add platform information command**
  - Expose narrowly scoped OS/architecture/app-version information needed by diagnostics.
  - Acceptance: launcher diagnostics can show platform metadata without shell execution.

- [x] **P1-008 — Add global application error handling**
  - Add top-level frontend error boundary and Rust-side initialization error reporting.
  - Acceptance: an injected startup/UI failure produces a recoverable diagnostic view rather than a blank window.

---

# P2 — Core runtime and game-module contract

- [x] **P2-001 — Define `GameMetadata` schema**
  - Include ID, title, description, version, player counts, input kinds, logical resolution, difficulties, controls, and asset manifest.
  - Acceptance: invalid or duplicate metadata is rejected during development/test validation.

- [x] **P2-002 — Define `GameModule` and `GameInstance` interfaces**
  - Implement the lifecycle contract from the spec.
  - Acceptance: a dummy game can be created, started, updated, rendered, paused, reset, and destroyed through only the public API.

- [x] **P2-003 — Define `GameServices` dependency surface**
  - Input, audio, assets, scores, storage, RNG, clock, logger.
  - Acceptance: game modules receive services by injection and do not directly construct native/global implementations.

- [x] **P2-004 — Implement game registry**
  - Register modules declaratively.
  - Detect duplicate IDs.
  - Acceptance: launcher can enumerate registered metadata without game-specific branches.

- [x] **P2-005 — Implement runtime lifecycle state machine**
  - States: unloaded/loading/ready/running/paused/game-over/error as appropriate.
  - Acceptance: illegal transitions fail predictably and are unit tested.

- [x] **P2-006 — Implement active-game ownership**
  - Only one active game instance in release 1.
  - Destroy prior instance before replacing it.
  - Acceptance: repeated switching never leaves two update/render loops active.

- [x] **P2-007 — Add game error isolation**
  - Catch startup/update/render failures where feasible.
  - Stop/destroy the failing game and return to a recoverable shell view.
  - Acceptance: injected dummy-game exception does not permanently break the launcher.

- [x] **P2-008 — Add game test harness**
  - Provide fake services, deterministic clock, and seeded RNG.
  - Acceptance: game logic can advance in unit tests without real Tauri, Canvas display, or audio hardware.

- [x] **P2-009 — Enforce game isolation boundaries**
  - Add lint/import rules or equivalent checks preventing one game from importing another game's internals.
  - Acceptance: intentional cross-game import fails the relevant quality gate.

---

# P3 — Rendering and timing

- [x] **P3-001 — Implement fixed-step simulation loop**
  - Default 60 Hz simulation.
  - Acceptance: synthetic timing tests verify expected update counts.

- [x] **P3-002 — Bound frame catch-up behavior**
  - Clamp large deltas and cap fixed updates per rendered frame.
  - Reset accumulator appropriately.
  - Acceptance: a simulated multi-second stall cannot produce an unbounded update burst.

- [x] **P3-003 — Implement `requestAnimationFrame` render driver**
  - Decouple render cadence from fixed simulation updates.
  - Acceptance: runtime performs one owned RAF chain and cancels/halts it cleanly.

- [x] **P3-004 — Implement game logical framebuffer**
  - Default 320x240; support declared alternate logical sizes.
  - Acceptance: dummy landscape and portrait games both render through the same runtime.

- [x] **P3-005 — Implement aspect-preserving viewport scaling**
  - Prefer integer nearest-neighbor scale.
  - Fractional nearest-neighbor fallback.
  - Letterbox/pillarbox without stretching.
  - Acceptance: tests cover common Chromebook viewport sizes including 1366x768.

- [x] **P3-006 — Normalize pointer coordinates into game space**
  - Account for letterboxing and scale.
  - Acceptance: corners/center map correctly under integer and fractional scaling.

- [x] **P3-007 — Implement baseline renderer abstraction**
  - Canvas 2D target with primitives/sprites/text required by launch games.
  - Acceptance: games do not need direct knowledge of DOM layout or CSS scaling.

- [x] **P3-008 — Add sprite animation utility**
  - Fixed-step/time-based animation independent of monitor refresh rate.
  - Acceptance: deterministic animation-frame tests pass.

- [x] **P3-009 — Add common math/collision primitives**
  - Vector helpers, AABB, circle tests, wrapping coordinates, segment intersection as justified.
  - Acceptance: edge/corner collision cases have unit tests.

- [x] **P3-010 — Add pause/suspend timing behavior**
  - Freeze simulation and clear stale accumulated delta.
  - Acceptance: resume after synthetic long suspension does not jump the game forward.

---

# P4 — Input and controller subsystem

- [x] **P4-001 — Define logical action schema**
  - Up/down/left/right/action1/action2/start/pause/back.
  - Acceptance: game code can depend on action states without raw key codes.

- [x] **P4-002 — Implement keyboard input provider**
  - Track held, pressed-edge, and released-edge state.
  - Acceptance: key repeat from the OS does not create duplicate press edges.

- [x] **P4-003 — Implement default player mappings**
  - Player 1 and Player 2 mappings from the spec.
  - Acceptance: no default conflicts prevent intended two-player play.

- [x] **P4-004 — Implement Gamepad API provider**
  - Standard mappings, polling, connect/disconnect.
  - Acceptance: mocked gamepad tests cover buttons, D-pad, and axes.

- [x] **P4-005 — Implement analog dead zones**
  - Normalize stick directions to logical input.
  - Acceptance: center noise does not trigger movement; full movement reaches expected normalized values.

- [x] **P4-006 — Implement player-to-gamepad assignment**
  - Stable assignment for active session.
  - Acceptance: two connected pads can independently control two logical players.

- [x] **P4-007 — Implement pointer service**
  - Mouse/touchpad motion and click/button abstraction in logical game coordinates.
  - Acceptance: Missile Defense test module can aim/fire without reading raw DOM events.

- [x] **P4-008 — Implement configurable mappings**
  - Settings model and remapping UI hooks.
  - Acceptance: remapped mappings round-trip through the injected settings-store boundary; P5 wires that boundary to durable Tauri-backed persistence.

- [x] **P4-009 — Implement conflict detection and reset defaults**
  - Acceptance: UI identifies invalid conflicts and can restore known-good mappings.

- [x] **P4-010 — Ensure controller-only shell navigation**
  - Launcher/pre-game/pause/settings critical flows.
  - Acceptance: automated routing tests cover launcher/pre-game/running/paused/settings controller-only commands; P6/P7 repeat the end-to-end manual launch/pause/restart/exit flow once those screens and a playable game exist.

---

# P5 — Audio, assets, persistence, and scores

- [x] **P5-001 — Implement shared Web Audio service**
  - One-shot, loop, stop, master/music/SFX buses.
  - Acceptance: dummy game can play/stop effects and all game-owned audio stops on destroy.

- [x] **P5-002 — Handle audio user-gesture restrictions**
  - Acceptance: shared audio uses explicit lazy unlock/resume on user interaction; P6/P7 exercise the end-to-end first-launch gesture path in the real shell/game flow.

- [x] **P5-003 — Define asset-manifest schema**
  - IDs, paths, type, optional sprite metadata.
  - Acceptance: duplicate IDs and missing required fields fail validation.

- [x] **P5-004 — Implement asset preloader/cache**
  - Load required game assets before `READY`.
  - Acceptance: missing required asset produces game-specific recoverable error.

- [x] **P5-005 — Add CI asset-manifest validator**
  - Verify referenced files and metadata.
  - Acceptance: intentional missing asset fails CI validation.

- [x] **P5-006 — Define versioned settings schema**
  - Audio, visual, input, fullscreen, gamepad assignment/preferences.
  - Acceptance: parser rejects invalid values and supplies safe defaults.

- [x] **P5-007 — Implement Rust atomic JSON persistence**
  - Safe app-data path, temporary write, replacement.
  - Acceptance: unit tests cover successful write/read and interrupted/corrupt-file recovery behavior where feasible.

- [x] **P5-008 — Define/version score schema**
  - Game ID, mode/difficulty, score, initials/name, timestamp, tie ordering.
  - Acceptance: score validation rejects invalid game IDs and malformed entries.

- [x] **P5-009 — Implement score submission/query commands**
  - Default top 10 per game/mode.
  - Acceptance: deterministic ordering/tie tests pass.

- [x] **P5-010 — Implement per-game storage abstraction**
  - Namespaced optional progression/save data.
  - Acceptance: game A cannot overwrite game B through the service API.

- [x] **P5-011 — Add corrupt persistence recovery UX**
  - Safe defaults + recoverable warning/reporting boundary.
  - Acceptance: deliberately corrupted settings/scores/game state recover to safe data and emit a warning; P6 surfaces those warnings in launcher UI.

- [x] **P5-012 — Add asset attribution validation**
  - Acceptance: non-original asset fixture without required attribution is rejected.

---

# P6 — Launcher, settings, pause, and shell UX

- [ ] **P6-001 — Build registry-driven game browser**
  - Render title/art/description/player count/high score from metadata.
  - Acceptance: adding dummy registry entry automatically adds a launcher card.

- [ ] **P6-002 — Build controller/keyboard focus navigation**
  - Acceptance: every launcher game can be selected without pointer input.

- [ ] **P6-003 — Build pre-game screen**
  - Start, difficulty, player count, controls/help, high scores.
  - Acceptance: options are metadata-driven where applicable.

- [ ] **P6-004 — Implement game launch transition**
  - Loading/ready/error UI.
  - Acceptance: game launch does not reload the Tauri window.

- [ ] **P6-005 — Implement global pause overlay**
  - Resume/restart/controls/sound/return to launcher.
  - Acceptance: simulation and game-owned audio pause correctly.

- [ ] **P6-006 — Implement restart flow**
  - Acceptance: restart produces a clean new run with no stale entities/input/timers.

- [ ] **P6-007 — Implement return-to-launcher flow**
  - Acceptance: active game is destroyed and launcher becomes interactive immediately.

- [ ] **P6-008 — Build global settings screen**
  - Volume/mute, fullscreen, controls, gamepads, visual toggles.
  - Acceptance: settings persist and apply without requiring manual file editing.

- [ ] **P6-009 — Build high-score views**
  - Per-game and optional collection-wide view.
  - Acceptance: scores display by correct game/mode/difficulty.

- [ ] **P6-010 — Add accessible status/error messaging**
  - Focus, contrast, non-color-only state, keyboard operation.
  - Acceptance: shell UX passes documented keyboard-only manual checklist.

- [ ] **P6-011 — Add fullscreen/startup preference**
  - Acceptance: fullscreen preference is remembered and failure to enter fullscreen remains recoverable.

---

# P7 — Space Rocks (Asteroids-inspired reference game)

- [ ] **P7-001 — Define original visual/gameplay design and metadata**
  - Original title treatment, objects, scoring, difficulty, controls.
  - Acceptance: no copied original assets or level data.

- [ ] **P7-002 — Implement ship rotation/thrust/inertia**
  - Acceptance: facing and velocity remain independent; deterministic motion test passes.

- [ ] **P7-003 — Implement screen wrapping**
  - Ship/projectiles/rocks as appropriate.
  - Acceptance: objects cross all boundaries seamlessly.

- [ ] **P7-004 — Implement projectile system**
  - Fire cadence, lifetime, bounded count.
  - Acceptance: holding fire cannot create unbounded projectiles.

- [ ] **P7-005 — Implement asteroid/rock generation and splitting**
  - Large -> smaller hazards using seeded RNG.
  - Acceptance: fixed seed produces fixed split result.

- [ ] **P7-006 — Implement collisions, lives, invulnerability window**
  - Acceptance: spawn protection prevents immediate unavoidable repeat death.

- [ ] **P7-007 — Implement score/wave progression**
  - Acceptance: clearing wave advances difficulty and score submission occurs only at valid game end.

- [ ] **P7-008 — Add original audio/visual effects**
  - Acceptance: effects use shared services and clean up on exit.

- [ ] **P7-009 — Add comprehensive core-rule tests**
  - Motion, wrapping, splits, collisions, scoring.
  - Acceptance: tests run headlessly.

- [ ] **P7-010 — Reference-game lifecycle soak test**
  - Repeated start/pause/restart/exit cycles.
  - Acceptance: no duplicate RAF/input/audio listeners or material memory growth.

---

# P8 — Missile Defense (Missile Command-inspired)

- [ ] **P8-001 — Define original battlefield layout/assets/rules**
- [ ] **P8-002 — Implement logical-space targeting cursor**
- [ ] **P8-003 — Implement defensive launch sites and finite ammunition**
- [ ] **P8-004 — Implement interceptor travel to target point**
- [ ] **P8-005 — Implement bounded expanding/contracting explosions**
- [ ] **P8-006 — Implement enemy missile trajectories and target selection**
- [ ] **P8-007 — Implement blast interception and chain reactions**
- [ ] **P8-008 — Implement city/base destruction and wave resolution**
- [ ] **P8-009 — Implement gamepad-only aiming controls**
- [ ] **P8-010 — Add scoring/difficulty/audio/tests and playable acceptance pass**
  - Acceptance for P8 phase: pointer scaling, finite ammo, target destruction, bounded explosions, gamepad-only play, complete game-over loop all pass.

---

# P9 — River Hopper (Frogger-inspired)

- [ ] **P9-001 — Define original lane/stage design**
- [ ] **P9-002 — Implement discrete player hop movement and buffered input**
- [ ] **P9-003 — Implement generic moving-lane model**
- [ ] **P9-004 — Implement road hazards/collision**
- [ ] **P9-005 — Implement river hazards and moving support platforms**
- [ ] **P9-006 — Implement carried-player platform displacement**
- [ ] **P9-007 — Implement goal/home slots and round completion**
- [ ] **P9-008 — Implement timer/pressure, lives, scoring, difficulty**
- [ ] **P9-009 — Add multiple original lane patterns/stages**
- [ ] **P9-010 — Add deterministic lane/collision tests and playable acceptance pass**
  - Acceptance for P9 phase: boundary collisions, platform carrying, goal persistence, original layouts, complete rounds all pass.

---

# P10 — Maze Chase (Pac-Man-inspired)

- [ ] **P10-001 — Create original maze format and first original maze**
- [ ] **P10-002 — Implement grid movement with smooth interpolation**
- [ ] **P10-003 — Implement buffered intersection turns**
- [ ] **P10-004 — Implement pellets/special power items/bonus item**
- [ ] **P10-005 — Implement enemy navigation graph**
- [ ] **P10-006 — Implement four distinct deterministic targeting personalities**
- [ ] **P10-007 — Implement behavioral phase scheduler**
- [ ] **P10-008 — Implement vulnerable/frightened enemy state and collision reversal**
- [ ] **P10-009 — Implement lives, score, level completion, difficulty progression**
- [ ] **P10-010 — Add original art/audio plus AI/navigation/rule tests**
- [ ] **P10-011 — Complete playable acceptance pass**
  - Acceptance: original maze, buffered turns, distinct enemy strategies, bounded power state, collectible clear/advance, game-over/restart all work.

---

# P11 — Bug Barrage (Centipede-inspired)

- [ ] **P11-001 — Define original field, enemies, scoring, and art direction**
- [ ] **P11-002 — Implement player lower-region movement/shooting**
- [ ] **P11-003 — Implement obstacle/mushroom-like field objects**
- [ ] **P11-004 — Implement segmented chain traversal**
- [ ] **P11-005 — Implement direction/row changes from field topology**
- [ ] **P11-006 — Implement chain splitting after segment destruction**
- [ ] **P11-007 — Implement secondary roaming enemies**
- [ ] **P11-008 — Implement wave speed/density progression with hard entity bounds**
- [ ] **P11-009 — Add chain/topology/high-speed collision tests**
- [ ] **P11-010 — Complete playable acceptance pass**

---

# P12 — Sky Riders (Joust-inspired)

- [ ] **P12-001 — Define original arenas/riders/enemies/art**
- [ ] **P12-002 — Implement gravity/horizontal momentum**
- [ ] **P12-003 — Implement discrete flap impulse/cadence**
- [ ] **P12-004 — Implement stable platform collision/landing**
- [ ] **P12-005 — Implement enemy rider AI**
- [ ] **P12-006 — Implement deterministic altitude-based combat resolution**
- [ ] **P12-007 — Implement defeated-enemy object/recovery mechanic**
- [ ] **P12-008 — Implement waves/scoring/difficulty**
- [ ] **P12-009 — Implement local two-player mode or document explicit deferral decision**
- [ ] **P12-010 — Add physics/combat tests and playable acceptance pass**

---

# P13 — Jungle Quest (Pitfall!-inspired)

- [ ] **P13-001 — Define original connected-room world**
- [ ] **P13-002 — Implement platformer kinematic controller**
- [ ] **P13-003 — Implement jump/gravity/landing rules**
- [ ] **P13-004 — Implement ladders/elevation transitions**
- [ ] **P13-005 — Implement vine/swing or equivalent traversal mechanic**
- [ ] **P13-006 — Implement hazards/pits and respawn/checkpoint behavior**
- [ ] **P13-007 — Implement room transitions preserving canonical player state**
- [ ] **P13-008 — Implement collectibles, scoring, optional timer/pressure**
- [ ] **P13-009 — Implement alternate/secondary traversal route layer**
- [ ] **P13-010 — Add movement/transition/world tests and playable acceptance pass**

---

# P14 — Deep Digger (Dig Dug-inspired)

- [ ] **P14-001 — Define original earth grid/level format/art**
- [ ] **P14-002 — Implement diggable terrain and tunnel carving**
- [ ] **P14-003 — Update collision/navigation topology immediately after digging**
- [ ] **P14-004 — Implement enemy tunnel pathfinding**
- [ ] **P14-005 — Implement enemy solid-material traversal/equivalent special state**
- [ ] **P14-006 — Implement multi-stage pump/pressure-style attack mechanic**
- [ ] **P14-007 — Implement falling rock/object physics and triggers**
- [ ] **P14-008 — Implement score/waves/difficulty**
- [ ] **P14-009 — Add disconnected-graph, topology, falling-object, attack-state tests**
- [ ] **P14-010 — Complete playable acceptance pass**

---

# P15 — Star Defender (Defender-inspired)

- [ ] **P15-001 — Define original wrapping world, terrain, enemy roster, objectives**
- [ ] **P15-002 — Implement canonical world-coordinate model**
- [ ] **P15-003 — Implement scrolling camera and seamless horizontal world wrap**
- [ ] **P15-004 — Implement player inertial flight and forward weapon**
- [ ] **P15-005 — Implement limited emergency/smart-bomb-like action**
- [ ] **P15-006 — Implement radar/minimap from canonical world state**
- [ ] **P15-007 — Implement ground inhabitants/objectives and enemy abduction**
- [ ] **P15-008 — Implement falling/catching/return rescue sequence**
- [ ] **P15-009 — Implement multiple bounded off-screen enemy behaviors**
- [ ] **P15-010 — Implement waves/scoring/difficulty and density limits**
- [ ] **P15-011 — Add camera/radar/wrap/rescue/off-screen simulation tests**
- [ ] **P15-012 — Complete target-hardware performance and playable acceptance pass**

---

# P16 — Barrel Climber (Donkey Kong-inspired)

- [ ] **P16-001 — Define original stage themes/layouts/hazards/art**
- [ ] **P16-002 — Reuse/refine platformer controller from Jungle Quest**
- [ ] **P16-003 — Implement ladder mounting, climbing, dismounting**
- [ ] **P16-004 — Implement rolling/falling hazard movement along platform geometry**
- [ ] **P16-005 — Implement hazard interaction with ladders/edges**
- [ ] **P16-006 — Implement responsive jump-over-hazard scoring/feedback**
- [ ] **P16-007 — Implement rescue/reach-goal objective and lives**
- [ ] **P16-008 — Build at least three original stage layouts/mechanical variations**
- [ ] **P16-009 — Implement level progression/scoring/difficulty**
- [ ] **P16-010 — Add ladder/platform/hazard tests**
- [ ] **P16-011 — Complete playable acceptance pass**

---

# P17 — Chromebook and appliance integration

- [ ] **P17-001 — Select/document reference Chromebook hardware**
  - CPU/GPU/RAM/display/OS/desktop environment.
  - Acceptance: performance claims in later tasks reference measured hardware.

- [ ] **P17-002 — Validate Debian installation/runtime dependencies**
  - Acceptance: clean supported Debian system can install and launch package with documented dependencies.

- [ ] **P17-003 — Validate Ubuntu installation/runtime dependencies**
  - Acceptance: clean supported Ubuntu system can install and launch package.

- [ ] **P17-004 — Validate keyboard mappings on Chromebook keyboard**
  - Acceptance: no required first-player control depends on absent function/numpad keys.

- [ ] **P17-005 — Validate common USB gamepad**
  - Acceptance: hot-plug, assignment, launcher navigation, and gameplay pass.

- [ ] **P17-006 — Validate Bluetooth gamepad where hardware permits**
  - Acceptance: reconnect/disconnect behavior is recoverable.

- [ ] **P17-007 — Implement optional launch-fullscreen/appliance preference**
  - Acceptance: app can start directly into controller-navigable launcher.

- [ ] **P17-008 — Document OS autologin/autostart appliance setup**
  - Keep desktop-environment-specific setup outside core app where possible.
  - Acceptance: documented reference setup boots to launcher without terminal interaction.

- [ ] **P17-009 — Evaluate controlled shutdown UI**
  - Design least-privilege integration using appropriate OS facilities.
  - Do not grant generic shell access.
  - Acceptance: either a reviewed safe implementation exists or feature is explicitly deferred.

- [ ] **P17-010 — Validate suspend/resume**
  - Acceptance: no simulation catch-up burst, stuck input, or permanently broken audio after resume.

- [ ] **P17-011 — Add appliance recovery guidance**
  - Document relaunch behavior after crash and how an administrator exits appliance mode.

---

# P18 — Release hardening, QA, packaging, and documentation

- [ ] **P18-001 — Complete all ten per-game release acceptance checklists**
  - Acceptance: every game satisfies `docs/SPEC.md` definition of playable.

- [ ] **P18-002 — Complete cross-game UX consistency audit**
  - Pause/restart/back/start, score submission, difficulty, control hints.
  - Acceptance: no game invents conflicting shell behavior without documented reason.

- [ ] **P18-003 — Complete clean-room/content audit**
  - Review names, levels, sprites, audio, fonts, text, and third-party assets.
  - Acceptance: no proprietary ROM-derived/copied material is knowingly shipped; attribution is complete.

- [ ] **P18-004 — Complete security/capability audit**
  - Tauri capabilities, CSP, command validation, filesystem/network/shell surface.
  - Acceptance: normal runtime has no unjustified broad native permission.

- [ ] **P18-005 — Complete dependency/license audit**
  - Acceptance: dependency and asset licenses are compatible and documented as required.

- [ ] **P18-006 — Run 30-minute game-switching soak test**
  - Repeatedly launch/play/pause/restart/exit games.
  - Acceptance: no material memory/resource growth or degraded responsiveness.

- [ ] **P18-007 — Run target-hardware performance pass**
  - Exercise worst-case designed wave/entity density in each game.
  - Acceptance: target reference Chromebook sustains intended gameplay cadence without systematic frame collapse.

- [ ] **P18-008 — Run gamepad hot-plug and two-player acceptance**
  - Acceptance: applicable games remain controllable and recover gracefully from disconnect.

- [ ] **P18-009 — Run corrupted-persistence acceptance**
  - Settings, scores, optional save data.
  - Acceptance: launcher remains usable and warns/reverts safely.

- [ ] **P18-010 — Run offline acceptance**
  - Disconnect network before launch.
  - Acceptance: all ten games, assets, settings, and scores work normally.

- [ ] **P18-011 — Produce and validate `.deb` artifact**
  - Acceptance: install, launch, upgrade-over-test-version, and uninstall are verified on target OS.

- [ ] **P18-012 — Produce/evaluate AppImage artifact**
  - Acceptance: retain as supported artifact only if target compatibility is satisfactory.

- [ ] **P18-013 — Finalize README**
  - Screenshots/art, supported platforms, install/run, controls, development, licensing, project philosophy.

- [ ] **P18-014 — Write Chromebook deployment guide**
  - Normal desktop installation plus optional appliance/autostart setup.

- [ ] **P18-015 — Write contributor/game-module guide**
  - How to add game #11 without bypassing runtime contracts.
  - Include metadata, services, lifecycle, assets, tests, and legal/content rules.

- [ ] **P18-016 — Tag Release 1 readiness commit**
  - Only after all required CI and manual acceptance evidence is recorded.

---

# 3. Cross-cutting invariants

These are not separate tasks; they apply continuously:

1. **No per-frame Tauri IPC.** Real-time update/render/input/audio stays in the webview.
2. **No raw key coupling in games.** Games consume logical actions through `InputService`.
3. **No game-owned arbitrary filesystem access.** Use scoped storage services.
4. **No remote runtime dependency.** Release gameplay works offline.
5. **No copied ROM code/assets/level data.** Use clean-room code and original expression.
6. **No unbounded frame catch-up.** Timing work is explicitly capped.
7. **No unbounded projectile/particle/enemy growth.** Every system has lifecycle and design bounds.
8. **One active game instance.** Start/exit/restart must cleanly release ownership.
9. **Deterministic logic where practical.** Use shared seeded RNG and test clock, not ad hoc `Math.random()`/wall clock.
10. **Controller-first shell.** A mouse may improve some games but is not required to operate the collection launcher.
11. **Shared behavior stays shared.** Games must not fork their own pause/settings/score/input infrastructure.
12. **Architecture changes update docs.** Material divergence requires edits to both `SPEC.md` and this TODO.

# 4. First implementation sequence

The recommended immediate sequence after this planning commit is:

1. P0-001 through P0-008.
2. P1-001 through P1-008.
3. P2-001 through P2-009.
4. P3-001 through P3-010.
5. P4-001 through P4-010.
6. P5 core services needed by the reference game.
7. P6 minimum launcher/pause flow.
8. P7 Space Rocks as the reference vertical slice.
9. Return to finish remaining P5/P6 polish exposed by the reference game.
10. Proceed through P8-P16 in order.
11. Continuously test on the reference Chromebook rather than deferring all hardware work to P17.
12. Complete P17/P18 release hardening only after all games are functionally complete.

The reference-game milestone should be treated as an architecture validation point. If Space Rocks reveals that the runtime contract, input abstraction, timing model, rendering API, or cleanup lifecycle is awkward, correct the shared architecture before implementing the remaining nine games.
