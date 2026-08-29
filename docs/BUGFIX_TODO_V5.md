# Bugfix Remediation TODO — round 5

Implementation checklist for `docs/BUGFIX_SPEC_V5.md`.

Source: comprehensive code review conducted 2026-08-29 against `master` at
`cc6cfd1a92d3b145f7d7cc8305d3c8b1e36de677`. Round 4 (`CR4-001` – `CR4-005`) was independently
reviewed and passed; this TODO does not reopen it.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `CR5-`. Commit messages use `CR5-<NNN>: <description>`.

Recommended order is the order below. CR5-002 and CR5-003 are two halves of the same persistence
concurrency guarantee: the TypeScript layer preserves application invocation order and the Rust
layer makes the native primitive safe against concurrent callers. Do not mark the concurrency
finding closed with only one half implemented.

---

## 1. Settings correctness

- [x] **CR5-001 — Make settings-save failure explicit and eliminate false-success callers**
  - **Primary files:** `src/app/shell/controller.ts`, `src/app/shell/controller.test.ts`.
  - Change private `saveSettings()` from a failure-swallowing fulfilled `Promise<void>` contract to
    an explicit success/failure result (`Promise<boolean>` preferred; an equivalent typed result is
    acceptable). See spec §1.
  - The helper returns success only after validation, repository save, dependent audio
    configuration and controller-state adoption have succeeded. On failure it keeps the prior
    accepted settings snapshot and posts `Settings were not saved: …`.
  - `remapKeyboard()`:
    - returns `true` only after a successful settings commit;
    - returns `false` on save failure;
    - does not post `"… mapped …"` on failure;
    - does not clear the save error on failure.
  - `resetControls()` posts `"Controls reset to defaults"` only after a successful commit.
  - `setFullscreen()` calls the native fullscreen adapter only after the preference save succeeds.
    A later native-apply failure retains the persisted desired preference and produces the existing
    warning; do not mislabel it as a settings-save failure.
  - `setVolume()`, `setMuted()` and `setVisual()` must not update `snapshot.settings` or configure
    audio with rejected values.
  - Add a rejecting settings-repository/store fixture and regression cases for remapping, reset,
    fullscreen, audio and visual settings.
  - **Acceptance:** with a simulated `disk full` save failure, remap returns `false`, binding remains
    unchanged, no success status is present, and the error remains visible; failed reset has no
    success status; failed fullscreen save makes zero native fullscreen calls; failed audio/visual
    saves leave accepted settings unchanged. Existing success-path tests stay green.
  - **Mutation:** restore the old swallow-and-resolve behavior or ignore a `false` result in each
    affected caller; the corresponding regression must fail.
  - **Validation:** focused strict TypeScript compile and all 12 controller tests pass. Independent
    mutations that made remap, fullscreen, or reset ignore a failed save were each killed by the
    new regression cases and reverted.

---

## 2. Persistence concurrency and ordering

- [x] **CR5-002 — Serialize `TauriJsonDocumentStore.save()` per logical document in invocation order**
  - **Primary files:** `src/engine/persistence/document-store.ts` and a new/existing
    `src/engine/persistence/document-store.test.ts`.
  - Maintain a per-key save queue keyed by `(document, gameId-or-empty)`.
  - The native invocation for save B on a key must not begin until earlier save A on the same key
    settles.
  - Rejection of A must not poison the queue; B still runs afterward.
  - Independent keys must not be unnecessarily serialized with each other.
  - Do not use debounce as the correctness mechanism.
  - Make queue cleanup safe: once a key's tail is fully settled and no newer work references it,
    remove stale queue bookkeeping rather than leaking one entry forever per game id.
  - **Acceptance:** a controllable fake `invoke` proves B stays unstarted while A is pending, then
    starts after A; the same is true when A rejects; an unrelated document/key can start while A is
    pending. Argument payloads and call order are asserted.
  - **Mutation:** bypass/remove the queue; the same-key overlap test must fail.
  - **Validation:** four focused document-store cases pass under strict TypeScript compilation:
    same-key ordering, rejection recovery, independent-key concurrency, and queue cleanup. The
    direct-invoke/no-queue mutation was killed by the same-key overlap case and reverted.

- [x] **CR5-003 — Make native atomic saves safe under concurrent callers**
  - **Primary files:** `src-tauri/src/persistence.rs` and native tests in the same module (plus
    command wiring only if the chosen lock needs application state).
  - Remove the assumption that every writer may safely use the same `.<file>.tmp` pathname.
  - Add native serialization/collision protection for the full write -> sync -> rename critical
    section. Per-document locking is preferred; a small process-global save mutex is acceptable if
    it materially simplifies the implementation and is documented.
  - If unique temp names are used, cleanup must remove only the current attempt's temp file.
  - Preserve atomic reader semantics and all current validation/path-traversal protections.
  - Do **not** claim unique temp names alone satisfy ordered-write semantics; CR5-002 remains
    required to preserve JavaScript invocation order.
  - Add a deterministic concurrency test using a barrier or equivalent synchronization rather than
    scheduler luck.
  - **Acceptance:** concurrent same-document saves do not fail due to temp-file races; all returned
    successes correspond to complete payloads; the final file is valid and equals one complete
    submitted payload; no temp files remain; existing round-trip, path-traversal and stale-temp
    tests stay green.
  - **Mutation:** restore the shared `.settings.json.tmp`/equivalent single-temp behavior without
    locking; the concurrency test must fail.
  - **Validation:** all four standalone native persistence tests pass with the supplied Rust 1.95
    toolchain, including a barrier-forced overlapping same-document save. Restoring the original
    shared `.settings.json.tmp` + `File::create` behavior makes that test fail on the competing
    rename and was reverted.

---

## 3. Eliminate silent game persistence failures

- [x] **CR5-004 — Replace production no-op game logging and wire explicit persistence diagnostics**
  - **Primary files:** `src/app/shell/browser-game-services.ts`,
    `src/app/shell/default-controller.ts`, `src/engine/scores/scores.ts`,
    `src/engine/persistence/game-storage.ts`, relevant tests, and only the per-game module files
    actually required by the final wiring.
  - Preserve `ScoreCommitter`'s CR4 containment contract. Do **not** make score-store failures crash
    active gameplay, and do not swallow a throwing `readTerminalScore` programmer defect.
  - Delete/retire production `NOOP_LOGGER`. `BrowserGameServices` receives a real `GameLogger`
    dependency; the default runtime supplies a real diagnostic sink (browser/Tauri console is the
    minimum acceptable sink this round).
  - Add an explicit nonfatal persistence reporting channel from game services to the shell. It must
    not infer persistence failures by parsing arbitrary logger strings.
  - Score-submit failures:
    - produce one generic user-visible warning such as `Your score could not be saved.`;
    - retain game/scope/error detail in diagnostics;
    - still reject into `ScoreCommitter`, which contains the failure as before;
    - work for Space Rocks even though Space Rocks currently supplies no `ScoreCommitter`
      reporter.
  - Supply a real `RecoveryReporter` to the `ScoreRepository` and
    `NamespacedGameStorageService` instances created by `BrowserGameServices` so invalid stored
    scores/game state are not silently discarded.
  - Deduplicate user-visible reporting architecturally: one persistence event -> one shell warning,
    even if contextual diagnostic logging occurs in multiple layers.
  - Reporter failure must not recursively crash or loop. Existing `ScoreCommitter` tests covering a
    throwing reporter remain green.
  - Add focused tests for score-submit failure, corrupt score recovery, corrupt game-state recovery,
    Space Rocks/service-layer reporting, and production BrowserGameServices wiring.
  - **Acceptance:** no production `NOOP_LOGGER` remains; a failing score store generates exactly one
    shell nonfatal warning plus diagnostic detail and does not crash the run; Space Rocks gets the
    same behavior; corrupt score/game-state recovery invokes the supplied recovery reporter;
    existing score-committer containment tests pass unchanged.
  - **Mutation:** replace the real logger/reporter with no-ops or omit the recovery reporter; the
    new tests must fail.
  - **Validation:** `browser-game-services.test.ts` passes 14 focused cases. Score-save failure
    produces exactly one persistence notice while preserving the original rejection; corrupt score
    and game-state recovery both report; a broken shell reporter is bounded. Focused strict
    compilation also covers the default runtime and all constructor call sites. No-op score
    reporter, no-op recovery reporter, and no-op game logger mutations were each killed and
    reverted.

---

## 4. Remove unsafe native-to-memory fallback

- [x] **CR5-005 — Make browser preview an explicit development mode and require native persistence in production**
  - **Primary files:** `src/app/shell/default-controller.ts`, `src/app/App.tsx`,
    `src/native/commands.ts` as needed, plus new/focused runtime-selection tests.
  - Introduce an explicit runtime/preview option (`allowBrowserPreview` or equivalent) derived from
    the build/runtime environment rather than treating absence of `window.__TAURI__` as permission
    to use volatile storage.
  - Runtime selection rules:
    - bridge present -> `TauriJsonDocumentStore`;
    - bridge absent + preview explicitly allowed -> `MemoryJsonDocumentStore`;
    - bridge absent + preview forbidden -> throw/fail startup; do not construct an ephemeral shell.
  - Keep the intentional Vite browser-development workflow working.
  - `App.tsx` must not convert rejected `getPlatformInfo()`/`diagnosticPing()` calls into
    `Native bridge: browser preview` when native mode was expected. Distinguish intentional preview
    from native integration failure, or make the latter fatal before this status is rendered.
  - Prefer dependency injection for tests instead of mutating global `window.__TAURI__` state when
    practical.
  - **Acceptance:** tests cover the three runtime-selection branches and native diagnostic failure;
    a production/native-required missing bridge is visibly fatal/non-preview; only explicitly
    allowed development preview uses memory persistence.
  - **Mutation:** restore `hasNativeBridge() ? Tauri : Memory`; the native-required missing-bridge
    test must fail.
  - **Validation:** three runtime-selection tests and three native-status tests pass under focused
    strict compilation. Native mode uses `TauriJsonDocumentStore`, explicitly allowed preview uses
    memory, and native-required missing bridge fails closed. Native diagnostic rejection is an
    explicit error state rather than preview. Both the unconditional memory-fallback mutation and
    the diagnostic-error -> preview mutation were killed and reverted.

---

## 5. Observe WebAudio lifecycle promise failures

- [x] **CR5-006 — Add an explicit rejection policy for `pauseAll()` / `resumeAll()`**
  - **Primary files:** `src/engine/audio/audio-service.ts`,
    `src/engine/audio/audio-service.test.ts`, and default service construction in
    `src/app/shell/browser-game-services.ts` if needed for production diagnostics.
  - Keep the public `AudioService.pauseAll()` / `resumeAll()` methods synchronous unless a broader
    async interface change is independently justified; this task does not require one.
  - Add a lifecycle-error reporter dependency to `SharedWebAudioService` (or equivalent explicit
    terminal handler).
  - Every fire-and-forget `context.suspend()` / `context.resume()` promise must end in an explicit
    rejection handler. No `void` of a potentially rejecting browser promise may remain without such
    a terminal policy.
  - Reporter receives operation context (`suspend`/`resume`) and underlying error.
  - Default production construction supplies a real diagnostic reporter; test-only fakes may be
    no-op intentionally.
  - Guard a reporter that itself throws so an audio failure cannot create a second unhandled
    failure path; document this terminal swallow locally.
  - Extend the fake audio context to inject suspend/resume rejection and add regression tests.
  - **Acceptance:** rejecting suspend and resume are each reported exactly once with operation
    context, do not become unhandled rejections, and do not synchronously throw from the `void`
    lifecycle methods; successful behavior remains unchanged.
  - **Mutation:** remove either promise rejection handler; the corresponding test must fail.
  - **Validation:** all 15 focused audio-service cases pass under strict TypeScript compilation,
    including rejected suspend, rejected resume, and a lifecycle reporter that itself throws. The
    production BrowserGameServices integration compiles and its 14 focused tests remain green.
    Removing the suspend reporting path or the resume reporting path was independently killed and
    reverted.

---

## 6. Make asset discovery fail closed

- [x] **CR5-007 — Stop treating `readdir()` failure as “no manifests”**
  - **Primary files:** `scripts/validate-assets.mjs`, `scripts/validate-assets.test.mjs`.
  - Remove the broad catch in recursive manifest discovery. `src/games` is required; a missing or
    unreadable source tree must reject validation rather than returning an empty manifest list.
  - Do not special-case `ENOENT` for the repository's required `src/games` root.
  - Keep the behavior that an **existing empty** `src/games` directory contains zero manifests and
    is therefore valid with respect to manifest enumeration.
  - Add deterministic repository-level fixtures:
    - valid attribution + missing `src/games` -> reject;
    - valid attribution + existing empty `src/games` -> enumeration succeeds;
    - existing attribution/missing-asset/undeclared-original tests continue to pass.
  - Do not use permission-bit denial as the primary regression fixture because root/container CI
    can make that nondeterministic.
  - **Acceptance:** validation now propagates unexpected filesystem discovery failures; the CLI
    exits nonzero on missing required game tree; normal repository validation still passes.
  - **Mutation:** restore `catch { return result; }`; the missing-root regression must fail.
  - **Validation:** repository validator tests and normal repository validation pass. A fixture with
    valid attribution but no `src/games` rejects through both `validateRepository()` and the CLI;
    creating an empty `src/games` then succeeds. Restoring the broad discovery catch was killed by
    the missing-root regression and reverted.

---

## 7. Canonicalize the new failure-handling contract

- [x] **CR5-008 — Update `docs/SPEC.md` and audit remaining silent-looking production paths**
  - Depends on CR5-001 through CR5-007 so documentation records the final implementation rather
    than an intermediate design.
  - Add concise canonical rules from `BUGFIX_SPEC_V5.md` §7 covering:
    - no false success after contained failure;
    - no silent production reporter at an error boundary;
    - explicit-mode-only durable -> volatile/native -> preview fallback;
    - terminal rejection handling for fire-and-forget promises;
    - fail-closed validators;
    - ordered/concurrent persistence semantics;
    - environmental-failure containment vs programmer-defect surfacing;
    - documented terminal swallowing only at a genuine final boundary.
  - Record the final runtime-mode contract and persistence ordering guarantee in the architecture
    sections where future implementers will find them, not only in a bug-history appendix.
  - Perform a focused source audit of every production occurrence touched or introduced this round
    matching these patterns:

    ```text
    catch {
    => undefined
    void <promise>
    MemoryJsonDocumentStore
    RecoveryReporter
    GameLogger
    .tmp
    ```

  - For each remaining silent-looking construct, either prove it is test-only, point to its real
    reporter/mode/rejection policy, or add a local comment explaining the intentional terminal
    swallow. Do not mechanically remove justified catches.
  - Specifically preserve and document `ScoreCommitter`'s existing catch around a throwing error
    reporter as intentional final-boundary containment; it is not a V5 defect.
  - **Acceptance:** `docs/SPEC.md` and shipped code agree on all V5 guarantees; no production
    no-op error sink or accidental durable-to-memory fallback remains; every fire-and-forget async
    operation touched by V5 has a terminal rejection policy; every remaining bare swallow touched
    by V5 has a local rationale.
  - Documentation-only portions do not need new tests, but all tests covering the affected runtime
    behavior must already exist from CR5-001 through CR5-007 and remain green.
  - **Validation:** `docs/SPEC.md` now records the shipped V5 settings, persistence-concurrency,
    score-reporting, runtime-mode, audio lifecycle, asset-discovery, and canonical failure-handling
    contracts. The focused audit found no V5 production no-op sink or implicit memory fallback; all
    V5 fire-and-forget paths have explicit terminal rejection handling. Remaining V5 terminal
    catches document why they preserve the primary failure or bound a broken reporter.
    `GlobalSettingsRepository` now requires an explicit recovery reporter, and the queued-save
    rejection conversion is locally documented as queue bookkeeping rather than caller-error
    swallowing. Source formatter/lint/game-boundary/metadata/asset gates pass; focused strict
    persistence compilation plus all seven P5 persistence cases and four document-store queue cases
    pass.

---

## Cross-cutting acceptance

- [ ] **CR5-FINAL — Validate the complete round-5 remediation**
  - Run all frontend/repository gates:

    ```text
    npm run format:check
    npm run lint
    npm run metadata:check
    npm run assets:check
    npm run typecheck
    npm run test
    npm run build
    ```

  - Run all native gates with the repository-pinned Rust toolchain:

    ```text
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --locked -- -D warnings
    cargo test --workspace --locked
    ```

  - Run/confirm the Tauri compile, release-CSP smoke test and `tauri dev` smoke test represented by
    project CI.
  - Re-run the required mutations for every behavioral task and record in the task/commit evidence
    that the new regression actually fails when the defect is reintroduced:
    - CR5-001 false-success save contract;
    - CR5-002 same-key queue bypass;
    - CR5-003 shared-temp/native concurrency race;
    - CR5-004 no-op persistence reporting;
    - CR5-005 native-required -> memory fallback;
    - CR5-006 removed audio rejection handler;
    - CR5-007 broad manifest-discovery catch.
  - Verify no task is marked `[x]` merely because the implementation "looks right". Every artifact
    and mutation named by its acceptance must actually exist and have been exercised.
  - Verify no task silently changes unrelated game behavior, scoring rules, controls, rendering or
    asset content.
  - Final review should specifically search for new quiet failure paths introduced by the fixes
    themselves — especially catch-and-continue blocks, fallback stores, promise queues that swallow
    rejections, and reporter callbacks whose own failures are not bounded.
  - **Acceptance:** all quality gates pass; all seven behavioral mutation probes fail in the
    intended tests and are reverted; V5 docs match the shipped behavior; there are no known silent
    production persistence/error fallbacks remaining from this review.
