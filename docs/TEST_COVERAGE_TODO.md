# Test Coverage Remediation TODO

Source: a codebase-wide test-coverage sweep conducted 2026-08-29 against `master` at `5e8491d`,
cross-referencing every source file against what actually imports it from a `*.test.ts` file
(not just filename matching), then reading the flagged files directly to confirm each gap is real
rather than covered indirectly.

**No bug was found by this sweep.** Every task below closes a coverage gap in already-correct
code, except TC-003, which needs a small testability refactor (inject `fetch`/`AudioContext`
construction, mirroring a pattern this codebase already uses) before its branches can be exercised
at all.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `TC-` (test coverage), distinct from the feature-phase
`P<N>-<NNN>` IDs and the bugfix-round `CR<N>-<NNN>` IDs. Commit messages use the
`TC-<NNN>: <description>` prefix.

Recommended order: TC-004, TC-001, TC-005, TC-006, TC-002, then TC-003 last — everything before
TC-003 is pure test-writing against code that doesn't change; TC-003 is the one task that touches
production source and carries the most risk, so do it once the easier wins are banked and the
verification habit (mutate-and-watch-fail on every new test) is warmed up.

---

## TC-001 — Give Star Defender's split entity modules their own dedicated tests

**Why:** `src/games/star-defender/enemies.ts` and `inhabitants.ts` (split out of `simulation.ts`
in the immediately preceding round) have no test file of their own — they're exercised only
incidentally through `simulation.test.ts`. Every other game that splits an entity out of
`simulation.ts` gives it a dedicated test file with targeted scenarios distinct from the
full-integration tests in `simulation.test.ts` (`bug-barrage/roamers.ts` → `roamers.test.ts`,
`chains.ts` → `chains.test.ts`, `field.ts` → `field.test.ts`). This is the one place in the repo
where that established convention was skipped, and it left at least one real branch unhit: a
carried inhabitant reaching `playfieldTop + 2` and being dropped as `"lost"` by altitude alone
(`enemies.ts`, inside `updateSnatcher`'s carrying branch) is a different code path from the one
`simulation.test.ts`'s `P15-007/P15-008` scenario exercises (the emergency burst destroying the
carrier), and nothing names or asserts the altitude-drop path directly.

- [ ] **TC-001a — Create `src/games/star-defender/enemies.test.ts`**
  - [ ] Test `createStarDefenderWave`: enemy-type selection follows `selector = (index + wave) % 6`
    (`< 3` snatcher, `< 5` stalker, else skimmer) for at least two different `wave` values so the
    `wave`-dependent offset is actually exercised, not just `index` in isolation.
  - [ ] Test `createStarDefenderWave`: enemy count matches `starDefenderWaveEnemyCount(wave,
    difficulty)` for at least one wave per difficulty tier (`patrol`/`frontier`/`siege`).
  - [ ] Test `createStarDefenderWave`: under a fixed seed, position/heading/phase are
    reproducible across two separate calls with the same seed (mirrors the seeded-determinism
    discipline `simulation.test.ts` already applies at the whole-simulation level).
  - [ ] Test `createStarDefenderWave`: `nextEnemyId` in the returned `StarDefenderWave` is
    `startId + count`, and ids assigned to the generated enemies are the contiguous range
    `[startId, startId + count)` with no gaps or reuse across two chained calls
    (`startId` of the second call = `nextEnemyId` of the first).
  - [ ] Test `updateStarDefenderEnemies` for a lone **stalker**: it turns to face the player
    across the world-wrap seam (reuse a fixture like `simulation.test.ts`'s `P15-009` seam case,
    but call the extracted function directly rather than going through the whole simulation) and
    closes vertical distance toward the player's `y` at the documented rate.
  - [ ] Test `updateStarDefenderEnemies` for a lone **skimmer**: horizontal position follows its
    fixed `heading` at `SKIMMER_SPEED`, and vertical position tracks the sinusoidal target
    `106 + sin(ageSeconds * 1.75 + phase) * 28` rather than snapping to it.
  - [ ] Test `updateSnatcher`'s **capture-radius boundary**: two fixtures placed just inside and
    just outside `SNATCHER_CAPTURE_RADIUS` of a grounded inhabitant at capture altitude — only the
    inside case starts an abduction (`"abduction-started"` event, inhabitant state becomes
    `"abducted"`, enemy's `carryingInhabitantId` set); the outside case does neither.
  - [ ] Test `updateSnatcher`'s **nearest-target selection**: three or more grounded inhabitants
    at different wrapped distances from the snatcher; assert it targets the nearest one, including
    a case where the nearest one is only nearest via the wrapped (short way around the seam)
    distance, not the naive absolute-value distance.
  - [ ] Test `updateSnatcher`'s **altitude-drop path** (the gap this task exists to close): a
    snatcher already carrying an inhabitant, stepped with a `dtSeconds` large enough to carry it
    to `y <= playfieldTop + 2` in one tick. Assert: an `"inhabitant-lost"` event fires; the
    inhabitant's state becomes `"lost"` at `y = playfieldTop`; the enemy's `carryingInhabitantId`
    and `targetInhabitantId` both become `null`; the enemy itself survives (it is not destroyed by
    losing its cargo this way, unlike the emergency-burst path).
  - [ ] Test `updateStarDefenderEnemies` with **no grounded inhabitants left**: a snatcher with no
    target roams at the documented `92` altitude and `0.7 × speedScale` horizontal rate rather than
    pursuing or idling at its previous position.
- [ ] **TC-001b — Create `src/games/star-defender/inhabitants.test.ts`**
  - [ ] Test `createInitialStarDefenderInhabitants`: produces exactly
    `STAR_DEFENDER_RUN_RULES.inhabitantCount` inhabitants, evenly spaced with jitter bounded by
    `± spacing * 0.14` (half of the `0.28` jitter factor) around each slot's center, and is
    reproducible under a fixed seed.
  - [ ] Test `updateStarDefenderInhabitants` for each state in isolation, each as its own case:
    - `"ground"`: `y` tracks `starDefenderTerrainY(x) - 3` every tick (terrain following).
    - `"abducted"`: passthrough — identical object returned, no score, no event.
    - `"falling"`: gravity accelerates `velocityY` by `FALL_GRAVITY * dtSeconds`; below the
      terrain-landing threshold it just falls further; at/past the threshold it emits
      `"inhabitant-lost"` and lands in state `"lost"` at the terrain line with `velocityY` reset.
    - `"carried"`: below the safe-return altitude threshold (`playerY < terrainY(x) - 19`) it
      tracks the player's position with `velocityY: 0`; at/past the threshold it emits
      `"inhabitant-returned"` with `STAR_DEFENDER_SCORING.safeReturn` points, returns
      `scoreDelta` equal to those points, and the inhabitant becomes `"ground"` at the terrain
      line.
    - `"lost"`: passthrough — identical object returned, no score, no event.
  - [ ] Test `updateStarDefenderInhabitants`'s `scoreDelta` sums correctly when **two** carried
    inhabitants both cross the return threshold in the same call (construct a multi-inhabitant
    fixture; this is the one place a naive implementation could double-count or drop a delta).
  - [ ] Test `resolveStarDefenderFallingCatches`'s **radius boundary**: two fixtures just inside
    and just outside `RESCUE_CATCH_RADIUS` of the player, only the falling inhabitant inside the
    radius is caught (`"inhabitant-caught"` event, `STAR_DEFENDER_SCORING.fallingCatch` points,
    state becomes `"carried"`); the outside one is untouched.
  - [ ] Test `resolveStarDefenderFallingCatches` ignores inhabitants in every state other than
    `"falling"` even when they are within the catch radius (e.g. a `"ground"` inhabitant standing
    where the radius check alone would otherwise match).
  - Acceptance: both new files exist and pass; `npm run test` count increases by roughly the
    number of new cases above; the altitude-drop path, the capture-radius boundary, and the
    multi-inhabitant `scoreDelta` summation are each confirmed to actually pin behavior by
    temporarily mutating the corresponding line in `enemies.ts`/`inhabitants.ts` (e.g. flip a
    comparison operator or a threshold constant) and watching the new test fail, then reverting —
    per this project's established verification discipline. The existing `simulation.test.ts`
    Star Defender cases (`P15-*`, `CR-006`) pass untouched.

## TC-002 — Unit-test `SharedWebAudioService`

**Why:** `src/engine/audio/audio-service.ts` (142 lines) has zero test files referencing it. Unlike
the DOM-canvas work this project deliberately leaves untested (no jsdom), this class was already
built for testability — its constructor takes an injectable `AudioContextFactory` and
`AudioBufferResolver`, the same structural-fake pattern used everywhere else in this codebase
(e.g. `FakeGameRenderer`). The gap is that nobody wrote the fake and the tests, not that the class
resists testing.

- [ ] **TC-002a — Build fakes**
  - [ ] A minimal fake object satisfying the subset of the real `AudioContext`/`GainNode`/
    `AudioBufferSourceNode` surface the class actually calls: `createGain()` (returns an object
    with a settable `.gain.value` and a `.connect()` that records what it connected to),
    `createBufferSource()` (returns an object with settable `.buffer`/`.loop`, a `.connect()`, an
    `.addEventListener("ended", ...)` that the test can trigger manually, and a `.start()`/
    `.stop()` that record calls), `.destination`, `.state` (mutable for the test), `.resume()`,
    and `.suspend()` (both settable to resolve and optionally to flip `.state`).
  - [ ] A fake `AudioBufferResolver` backed by a `Map<string, unknown>` the test can seed, so
    `getAudioBuffer` returns a canned marker "buffer" for known ids and `null` for unknown ones.
- [ ] **TC-002b — Volume and settings**
  - [ ] `configure()` with a non-finite volume (`NaN`, `Infinity`) throws `RangeError` for each of
    `masterVolume`/`musicVolume`/`effectsVolume` in turn.
  - [ ] `configure()` clamps out-of-range volumes (negative and `> 1`) into `[0, 1]`.
  - [ ] `configure({ muted: true, masterVolume: 0.8, ... })` sets the master gain's `.value` to
    `0` regardless of `masterVolume`, while `musicGain`/`sfxGain` still reflect
    `musicVolume`/`effectsVolume` unmuted (per `applySettings`'s asymmetric mute handling).
- [ ] **TC-002c — `unlock()`**
  - [ ] First call creates the context via the injected factory exactly once and wires
    `musicGain`/`sfxGain` → `masterGain` → `context.destination`, verified via the fake's recorded
    `.connect()` calls.
  - [ ] A second call does not invoke the factory again (idempotent context creation).
  - [ ] `isUnlocked` is `false` before the first `unlock()` and reflects `context.state ===
    "running"` afterward.
  - [ ] Calling `unlock()` when the fake context's `.state` is `"suspended"` calls `.resume()` and
    resolves once the fake flips `.state` to `"running"`.
- [ ] **TC-002d — Playback**
  - [ ] `playEffect`/`playLoop` are a no-op (no buffer source created) when `isUnlocked` is still
    `false`.
  - [ ] `playEffect`/`playLoop` are a no-op when the resolver returns `null` for the requested
    asset id, even once unlocked.
  - [ ] `playEffect(id)` creates a non-looping source connected to the `sfx` bus and starts it;
    `playLoop(id)` (default bus) creates a looping source connected to the `music` bus; a
    `playLoop(id, "sfx")` call explicitly routes to the `sfx` bus instead.
  - [ ] Triggering the fake source's recorded `"ended"` listener removes it from the internal
    active set (verified indirectly: a subsequent `stop(id)` for that id finds nothing to stop, or
    `stopAll()` afterward does not touch it).
  - [ ] `stop(assetId)` stops and removes only the source(s) matching that id, leaving a
    differently-id'd active source untouched.
  - [ ] `stopAll()` stops every active source and clears the active set.
  - [ ] `pauseAll()`/`resumeAll()` call `context.suspend()`/`context.resume()` only when the
    context is currently in the matching state (`"running"` for pause, `"suspended"` for resume) —
    calling `pauseAll()` twice in a row only suspends once.
  - Acceptance: `src/engine/audio/audio-service.test.ts` exists and passes; every case above is
    present; confirm at least the mute-override and the "no-op before unlock" cases actually pin
    behavior by a targeted mutation-and-revert, since those are the two easiest to get
    silently wrong. `npm run test` passes with the new file included.

## TC-003 — Make `BrowserGameServices.preload()` testable, then cover its branches

**Why:** `src/app/shell/browser-game-services.ts`'s `preload()` has eight-plus distinct
failure/skip paths around asset-manifest loading, and none of them are tested. Unlike its sibling
`SharedWebAudioService` in the same file, `preload()` calls the global `fetch` and constructs
`AudioContext` directly rather than through an injected factory, so as written it cannot be
exercised without a real browser. This is the same shape of problem this codebase has already
solved twice (`resizeCanvasToDevicePixels`, `createPointerBoundsResolver`): make the dependency
injectable, then the branch coverage becomes ordinary unit testing.

- [ ] **TC-003a — Inject `fetch` and the `AudioContext` factory**
  - Add a `fetch`-like parameter to `BrowserGameServices`'s constructor (a type such as
    `(input: string) => Promise<Response>`, or reuse a narrower structural interface exposing
    only `.ok`/`.status`/`.json()`/`.arrayBuffer()` if the real `Response` type is inconvenient to
    fake) defaulting to the global `fetch` so production behavior is unchanged.
  - `requireAudioContext`'s `new AudioContext()` already flows through the constructor-provided
    context indirectly via `SharedWebAudioService`'s own `AudioContextFactory` — thread the same
    factory (or a second one, if `preload()`'s `decodeAudioData` needs a context independent of
    playback timing) so `preload()` never calls `new AudioContext()` itself.
  - This is a pure refactor: no behavior change for real callers. Confirm the existing
    `space-rocks-route.test.ts`-style shell route tests (any route test that exercises a real
    module's asset preload through `BrowserGameServices`) pass untouched.
- [ ] **TC-003b — Add `browser-game-services.test.ts`**
  - [ ] `resolveAssetUrl === undefined` on the module throws, and the error message names the
    module's title.
  - [ ] `resolveAssetUrl(module.metadata.assetManifest)` returning `null` throws, naming the
    unresolvable manifest path.
  - [ ] A manifest fetch that resolves with `.ok === false` throws, and the error message includes
    the HTTP status.
  - [ ] A manifest entry marked `required: true` whose `resolveAssetUrl` returns `null` throws,
    naming the asset id.
  - [ ] A manifest entry marked `required: true` with `type !== "audio"` throws
    ("unsupported browser loader"), naming the asset id.
  - [ ] A manifest entry marked `required: false` with an unresolvable URL is silently skipped
    (no throw; the asset store does not contain that id afterward).
  - [ ] A manifest entry marked `required: false` whose fetch fails (`.ok === false`) is silently
    skipped the same way.
  - [ ] A manifest entry marked `required: true` whose audio fetch fails (`.ok === false`) throws,
    naming the asset id and the HTTP status.
  - [ ] Two manifest entries that resolve to the **same URL** decode audio data only once (assert
    the fake `fetch`/`decodeAudioData` was invoked a single time for that URL, and both asset ids
    end up mapped to buffers in the asset store).
  - [ ] A successful `create()` call assembles a `GameServices` whose `assets`/`audio` reflect the
    manifest that was just loaded (a light end-to-end check on top of the branch-level cases
    above).
  - Acceptance: every branch above is verified to fail against the pre-injection code shape by
    reverting TC-003a locally and confirming the new tests cannot even be constructed without a
    real browser (documented as the "before" state, not literally re-tested against broken code);
    each branch's own test is confirmed to actually catch a defect by commenting out or inverting
    that branch's condition in `preload()` and watching the corresponding test fail, then
    reverting. `npm run lint`, `npm run test`, and `npm run build` pass after both TC-003a and
    TC-003b.

## TC-004 — Unit-test `ShellGameInputBridge`

**Why:** `src/app/shell/input-bridge.ts` (57 lines) has zero test files referencing it, despite
having no DOM dependency at all — `InputService`/`PointerInputService` are plain interfaces, and
`StaticPointerInputService` is already a plain settable fake-friendly class. It has a real
invariant worth pinning directly: `detach(input)` only clears the delegate when `input` is the
*currently attached* instance, guarding against a stale detach call after a different input has
since attached.

- [x] **TC-004a — Create `src/app/shell/input-bridge.test.ts`**
  - [ ] Build a minimal fake `InputService` (settable `isHeld`/`wasPressed`/`wasReleased` return
    values or call-recording stubs, plus a `pointer` getter and a `reset()` that records whether
    it was called).
  - [ ] Before any `attach()`: `isHeld`/`wasPressed`/`wasReleased` all return `false` for any
    player/action, `attached` is `false`, and `pointer` returns the neutral fallback (`position:
    null`, `inside: false`, all three pointer-held/pressed/released flags `false`).
  - [ ] After `attach(fakeA)`: `isHeld`/`wasPressed`/`wasReleased`/`pointer` all delegate to
    `fakeA`, and `attached` is `true`.
  - [ ] `detach(fakeA)` while `fakeA` is attached clears the delegate — `attached` becomes `false`
    and behavior reverts to the pre-attach fallback state, including the pointer.
  - [ ] The stale-detach guard: `attach(fakeA)`, then `attach(fakeB)`, then `detach(fakeA)` — `
    fakeB` must remain attached (`attached` stays `true`, `isHeld` etc. still delegate to `fakeB`),
    proving the detach of the no-longer-current instance is a no-op.
  - [ ] `reset()` while attached calls `reset()` on the current delegate.
  - **Investigated and adjusted:** the original plan also asked to verify `reset()`'s internal
    `resetFallbackPointer()` call. That call is not independently testable — the fallback pointer
    is only ever set to the same fixed neutral snapshot (from here and from `detach()`), so
    nothing in this class can ever put it in a non-neutral state for `reset()` to clear. Confirmed
    by mutation: removing that call from `reset()` makes no test fail. Dropped rather than kept as
    a test that looks like it verifies something it structurally cannot.
  - Acceptance: the new file exists and passes; the stale-detach case is confirmed to actually
    catch a regression by temporarily removing the `if (this.delegate === input)` guard in
    `detach()` (making it unconditional) and watching that one test fail, then reverting; the
    delegate-reset-propagation case is confirmed the same way by removing `this.delegate?.reset()`
    from `reset()`. `npm run test` passes with the new file included.

## TC-005 — Extend `input-system.test.ts` for gamepad reassignment and 3–4 controller scenarios

**Why:** `src/engine/input/gamepad.ts`'s `GamepadAssignmentManager` is exercised today only for
the 2-controller case and only via the automatic `sync()` path. Its manual `assign()` method (what
a remapping UI would call) is never invoked by any test, and nothing exercises 3 or 4 simultaneous
controllers against `MAX_PLAYERS = 4`, or a disconnect/reconnect cycle. This project consolidates
input-subsystem tests into one file rather than one file per input source
(`actions.ts`/`gamepad.ts`/`keyboard.ts`/`mappings.ts` all route through
`src/engine/input/input-system.test.ts`), so new cases belong there, not in a new dedicated file.

- [ ] **TC-005a — Manual reassignment**
  - [ ] `GamepadAssignmentManager.assign(indexB, player1)` when `player1` is already assigned to
    `indexA`: afterward `playerForGamepad(indexA)` is `null`, `playerForGamepad(indexB)` is
    `player1`, and `gamepadForPlayer(player1)` returns `indexB` — the manual assignment evicts the
    player from its previous gamepad rather than creating a duplicate mapping.
  - [ ] A manual `assign()` survives the next `sync()` call as long as the assigned gamepad is
    still connected (auto-sync must not silently reassign a manually-placed gamepad to a different
    player).
- [ ] **TC-005b — Three and four simultaneous controllers**
  - [ ] `sync()` with 3 connected gamepads assigns three distinct players in ascending
    gamepad-index order; with 4 connected gamepads, all four `MAX_PLAYERS` slots are filled, each
    to a distinct player.
  - [ ] A 5th gamepad connecting while all 4 player slots are already taken receives no
    assignment (`playerForGamepad` for its index is `null`) and does not evict any existing
    assignment (`assignments()` is unchanged in length and content).
- [ ] **TC-005c — Disconnect and reconnect**
  - [ ] Disconnecting a previously-assigned gamepad (absent from the next `sync()`'s input array,
    or present with `connected: false`) frees its player slot — `assignments()` no longer includes
    it, and a different, newly-connecting gamepad can claim that now-free player.
  - [ ] Reconnecting the same gamepad index after a disconnect is treated as a fresh connection by
    `sync()` (assigned via `firstAvailablePlayer()`, not restored to its prior player) — assert
    whatever the actual current behavior is, since this documents an implicit design decision that
    isn't currently written down anywhere.
- [ ] **TC-005d — `reset()`**
  - [ ] `StandardGamepadInputProvider.reset()` clears `isHeld`/`wasPressed`/`wasReleased` for every
    previously-held action **and** clears all gamepad-to-player assignments (`assignments()`
    becomes empty), in one call.
  - Acceptance: new cases are added inside `src/engine/input/input-system.test.ts`'s existing
    `tests` array (not a new file), following its existing naming style; the reassignment-eviction
    case and the 5th-gamepad-rejection case are each confirmed to catch a defect via a targeted
    mutation of `assign()`/`sync()`/`firstAvailablePlayer()` and reverted afterward. The existing
    input-system cases pass untouched.

## TC-006 — Add a dedicated module-level test for Space Rocks

**Why:** Every other game has either a `module.test.ts` or (Sky Riders) a
`module.integration.test.ts` that drives its real `GameInstance` class directly — several also
check `update`/`render` failure isolation via `ActiveGameRuntime`. `src/games/space-rocks/
module.ts` (296 lines) has neither; it is only reached through `space-rocks-route.test.ts`, which
drives it through the full shell at the happy path (launch → pause → restart → exit) and never
reaches its validation, asset-resolution, or pre-launch-render branches.

- [ ] **TC-006a — Create `src/games/space-rocks/module.test.ts`**
  - [ ] "real module consumes shared input and renders headlessly": construct
    `SpaceRocksGameInstance` with `createFakeGameServices`, `start()` with one player, hold
    thrust/rotate/fire inputs across a few `update()` ticks, `render()` with `FakeGameRenderer`,
    and assert on an observable effect of each input (e.g. thrust engaging the effects system,
    fire producing a bolt in `simulation.bolts` indirectly via the instance's own state if
    exposed, or at minimum that `render()` completes without throwing while gameplay is active).
  - [ ] "module validates launch options": `start({ players: 2, ... })` throws ("Space Rocks
    supports exactly one player"); `start({ ..., difficulty: "not-a-real-difficulty" })` throws via
    `resolveDifficulty`.
  - [ ] "module resolves only owned assets": for every path listed in `assets.json`'s manifest,
    `SPACE_ROCKS_MODULE.resolveAssetUrl(path)` returns a non-null URL; for an arbitrary unknown
    path it returns `null`.
  - [ ] "pre-launch render draws the title screen": calling `render()` on a freshly constructed
    instance *before* `start()` draws the `"SPACE ROCKS"` title text branch (assert via
    `FakeGameRenderer`'s recorded draw calls) rather than throwing or attempting to draw gameplay
    state.
  - [ ] "pause/resume/restart/destroy remain safe across repeated lifecycle cycles": mirrors the
    equivalent case other games already have (e.g. Deep Digger's `module.test.ts`) — start, pause,
    resume, reset, destroy, destroy again (idempotent), with no throw and no leaked audio.
  - [ ] "real update/render failure is isolated by production runtime": wrap `SPACE_ROCKS_MODULE`
    in an `ActiveGameRuntime`, inject a failing `update` (e.g. a negative or non-finite `dtSeconds`
    if the simulation's own `requireDelta`-equivalent rejects it) and separately a
    `ThrowingRenderer` subclass of `FakeGameRenderer`, asserting the runtime transitions to
    `"error"` state, releases `activeGameId`, and stops owned audio in each case — mirroring
    `sky-riders/module.integration.test.ts`'s two equivalent cases exactly.
  - Acceptance: the new file exists, is named consistently with the majority convention
    (`module.test.ts`), and passes; `space-rocks-route.test.ts` continues to pass untouched;
    `npm run test` count increases by the number of new cases above.

---

## Cross-cutting acceptance

- `npm run lint`, `npm run test`, and `npm run build` pass after every individual task and after
  the full set.
- Every new test is confirmed to actually pin the behavior it claims to, not merely to pass: for
  each case that exercises a specific branch or boundary, temporarily mutate the corresponding
  source line (flip a comparison, invert a condition, change a threshold) and confirm the new test
  fails, then revert before committing — the same discipline this project's bugfix rounds already
  require for regression tests, applied here to coverage-only additions since there is no known
  bug to revert.
- New test files use this project's existing structural-fake pattern (a minimal object literal or
  small class satisfying just the interface under test) rather than introducing any new test
  dependency — no jsdom, no mocking library. Reuse an existing fake
  (`FakeGameRenderer`/`createFakeGameServices`/`SeededRandomService`) wherever the file under test
  already accepts one of those interfaces.
- A task is only marked `[x]` when every file and case named in its checklist exists and passes.
  If a specific sub-case turns out to be impractical or redundant with existing coverage once
  investigated, say so in this file and adjust the checklist rather than silently dropping it.
- Commit messages use the `TC-<NNN>: <description>` prefix, one task (or clearly separable
  sub-task) per commit, matching this project's established one-task-per-commit discipline.
- TC-003 is the only task with production-source risk; it is not started until TC-003a's injection
  refactor is committed and verified behavior-unchanged on its own, separately from TC-003b's new
  tests.
