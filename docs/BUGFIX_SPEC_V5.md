# Bugfix Remediation Spec — round 5

Design source of truth for `docs/BUGFIX_TODO_V5.md`.

Source: comprehensive code review conducted 2026-08-29 against `master` at
`cc6cfd1a92d3b145f7d7cc8305d3c8b1e36de677`, after validating the completed round-4 remediation
(`docs/BUGFIX_TODO_V4.md`, CR4-001 – CR4-005). Round 4 itself passed review: no CR4 task is being
reopened here. This round addresses six broader reliability findings discovered while reviewing the
rest of the application, with special emphasis on silent failure, unsafe fallback behavior, and
persistence correctness.

The findings are materially different from round 4's guard-quality issues. Three are production
runtime defects that can lose or misrepresent persisted state; two are silent/fail-open error paths;
one should be dismissed as cosmetic.

Priority order:

1. settings false-success and persistence ordering/concurrency;
2. score/game-storage diagnostics and silent failure removal;
3. explicit browser-preview/native-runtime separation;
4. WebAudio lifecycle rejection handling;
5. fail-closed asset discovery;
6. canonical documentation and cross-cutting enforcement.

Sections: §1 settings persistence semantics, §2 persistence concurrency, §3 game persistence
reporting, §4 native bridge/runtime-mode safety, §5 WebAudio lifecycle errors, §6 asset validation,
§7 cross-cutting failure-handling rules, §8 acceptance strategy.

---

## 1. Settings persistence must never report false success

### 1.1 Current defect

**Primary file:** `src/app/shell/controller.ts`

`ShellController.saveSettings()` currently catches validation or repository errors internally and
returns a fulfilled `Promise<void>`:

```ts
private async saveSettings(value: GlobalSettings): Promise<void> {
  try {
    const settings = parseGlobalSettings(value);
    await this.settingsRepository.save(settings);
    this.options.audio?.configure(settings.audio);
    this.patch({ settings, error: null });
  } catch (error) {
    this.patch({ error: `Settings were not saved: ${describeError(error)}` });
  }
}
```

Several callers are written as though failure still propagates.

`remapKeyboard()` awaits `saveSettings()`, then unconditionally clears the error, posts a success
status and returns `true`. A persistence failure therefore becomes a false success:

- the persistent store did not change;
- the controller settings snapshot did not change;
- the method returns `true`;
- the UI says the control was mapped;
- the error produced by `saveSettings()` is explicitly cleared.

This was reproduced with a store that rejects with `"disk full"`.

`resetControls()` has the same semantic error in weaker form: it posts `"Controls reset to
defaults"` after `saveSettings()` returns even if the save failed. The save error remains, so the
UI can display contradictory success and failure messages at once.

`setFullscreen()` also continues to the native fullscreen command after the settings save has
failed. That can make the runtime window state diverge from both the controller's accepted settings
snapshot and durable settings.

`setVolume()`, `setMuted()` and `setVisual()` do not currently post a success status, but they still
need an explicit contract so future callers cannot make the same mistake.

### 1.2 Intended behavior

A settings mutation has two outcomes at the controller boundary:

- **committed:** validation succeeded and the settings repository save completed; only then may the
  controller adopt the new settings snapshot, configure dependent services, post success state, or
  perform a dependent native action;
- **not committed:** validation or persistence failed; the controller keeps the previously accepted
  settings snapshot, exposes a user-visible nontechnical error, and returns a failure result to any
  caller that needs to decide whether to continue.

A failed durable save must never be represented as success merely because the failure was caught for
containment.

### 1.3 Design decision

Change `saveSettings()` from a swallow-and-resolve `Promise<void>` helper to an explicit result
contract. The preferred shape is:

```ts
private async saveSettings(value: GlobalSettings): Promise<boolean>
```

with:

- `true` only after parse + repository save + dependent audio configuration + state adoption have
  succeeded;
- `false` after the helper posts `Settings were not saved: …` and leaves the prior accepted settings
  snapshot in place.

A small typed result object is acceptable if implementation needs the parsed settings later, but a
fulfilled `void` promise after failure is not.

Caller rules:

- `remapKeyboard()` returns `true` and posts `"… mapped …"` only when `saveSettings()` succeeds;
  otherwise it returns `false` and does not clear the save error.
- `resetControls()` posts its success status only when the save succeeds.
- `setFullscreen()` invokes the native fullscreen adapter only after the preference save succeeds.
  If the native apply subsequently fails, retain the already-persisted desired preference and post
  the existing warning; that warning represents an apply failure, not a save failure.
- `setVolume()`, `setMuted()` and `setVisual()` leave the existing public return type unless a caller
  actually needs a boolean. Their failed saves remain visible through controller state and must not
  update the accepted settings snapshot.
- `saveSettings()` must not clear an unrelated warning/status on failure. Success may clear the
  settings error it owns, consistent with existing controller message semantics.

### 1.4 Required tests

Add rejecting-settings-repository coverage in `src/app/shell/controller.test.ts`.

At minimum assert:

1. failed `remapKeyboard()` returns `false`, does not change the binding, does not post a success
   status, and leaves an error containing the persistence failure;
2. failed `resetControls()` does not post `"Controls reset to defaults"` and leaves the prior input
   settings intact;
3. failed fullscreen preference save does **not** call the native fullscreen adapter;
4. failed volume/mute/visual saves do not change `snapshot.settings` or configure audio with the
   rejected values;
5. successful versions of the same operations retain their existing behavior.

Mutation check: restore the old swallow-and-resolve behavior or make each caller ignore a `false`
result; the corresponding regression test must fail.

---

## 2. Persistence must be correct under concurrent callers

### 2.1 Current defect: one shared Rust temp pathname

**Files:**

- `src-tauri/src/persistence.rs`
- `src/engine/persistence/document-store.ts`

The native save path uses atomic replacement:

```text
write .<filename>.tmp -> sync file -> rename temp over destination
```

That is sound for a single writer, but every concurrent save of the same logical document uses the
same temporary pathname. Two overlapping writers therefore race on one file. A direct stress probe
against `save_json_document()` reproduced failed saves consistently: with two same-document writers,
one normally succeeds while the other fails after its shared temp path is renamed away; larger
writer counts produce correspondingly more failures.

The UI can reach this state naturally. Settings controls call async save operations without waiting
for prior control events to finish, so rapid slider/toggle input can overlap writes.

### 2.2 Correctness requirements

Persistence must guarantee all of the following:

1. two concurrent saves to the same logical document do not contend for one temporary pathname;
2. ordinary application callers observe **invocation order** for saves to the same logical document
   — an older request must not complete after and overwrite a newer request merely because native
   execution was scheduled differently;
3. saves to independent logical documents need not block each other;
4. a successful save remains atomic from the reader's point of view: readers see the previous full
   document or the new full document, never a partially written one;
5. an individual failed save cleans up only its own temporary artifact and cannot delete another
   writer's work;
6. the fix applies to `settings`, `scores`, and each namespaced `game-state` document, not just the
   settings UI that exposed the race.

The logical serialization key is:

```text
(document, gameId-or-empty)
```

### 2.3 Design decision: ordered TypeScript queue + backend collision safety

Use defense in depth rather than relying on one layer's scheduling assumptions.

#### TypeScript/document-store layer

`TauriJsonDocumentStore.save()` shall serialize saves per logical key in JavaScript invocation
order. A per-key promise tail/queue is sufficient. The next native `save_json_document` invocation
for a key must not begin until the previous one for that key has settled, whether the previous save
fulfilled or rejected. A rejected operation must not poison the queue permanently; later saves must
still run.

This is the layer that can most directly preserve the order in which application code called
`save()`. It also gives deterministic semantics independent of Tauri command scheduling.

Do **not** use debounce as the correctness mechanism. A UI debounce can be added later as a
performance optimization, but rapid callers must remain correct even with zero debounce.

#### Rust/native layer

`save_json_document()` must independently cease using a temp-file strategy that is unsafe when the
function is called concurrently. Acceptable implementations include:

- per-path native locking around the atomic write/rename sequence; or
- unique per-attempt temp paths plus native serialization/versioning sufficient to preserve the
  command contract.

A single process-global save mutex is acceptable for this small application if it keeps the code
simple and the measured overhead is negligible, although per-document locking is preferable because
independent game-state/scores/settings writes need not block each other.

Unique temp names **alone are insufficient** as the application-level ordering guarantee: they stop
filesystem collisions but still permit an older write to rename after a newer write. The TypeScript
queue above is therefore required even if native code also uses unique temp files.

### 2.4 Required tests

#### `TauriJsonDocumentStore`

Add direct tests for the store (create `src/engine/persistence/document-store.test.ts` if necessary)
with a controllable fake `invoke`:

- call `save(settings, A)` then `save(settings, B)` without awaiting A;
- assert native invocation B is not started until A settles;
- after A settles, assert B starts and the two calls retain invocation order;
- make A reject and assert B still starts afterward;
- prove distinct keys are allowed to progress independently.

Mutation check: remove/bypass the per-key queue and make the fake first invocation remain pending;
the second invocation must then start early and fail the test.

#### Rust persistence

Add a deterministic same-document concurrency test. It must use a barrier or equivalent
synchronization so it genuinely overlaps multiple callers rather than merely launching threads and
hoping the scheduler races. Acceptance is stronger than "no panic":

- all intended save calls return successfully under the chosen native serialization contract;
- the final document is one complete submitted payload, never malformed/partial;
- no temp artifacts remain after success;
- failure cleanup cannot remove another writer's temp artifact.

Also keep the existing round-trip, traversal and stale-temp tests.

---

## 3. Score and game-storage failures must not disappear into no-op reporting

### 3.1 Current defect

**Primary files:**

- `src/app/shell/browser-game-services.ts`
- `src/engine/scores/score-committer.ts`
- `src/engine/scores/scores.ts`
- `src/engine/persistence/game-storage.ts`
- per-game module score-committer wiring

`ScoreCommitter` intentionally contains score-store failures so a full/corrupt/unavailable store
does not crash an otherwise playable game. That containment was explicitly reviewed in round 4 and
is retained.

Most games report the contained error through `services.logger.warn()` or
`services.logger.error()`. Space Rocks currently supplies no reporter and therefore uses
`ScoreCommitter`'s default no-op reporter.

Production `BrowserGameServices`, however, supplies this logger to every game:

```ts
const NOOP_LOGGER: GameLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
});
```

So the apparent reporting path is silent in production. A failed high-score submission can be:

```text
score save fails
 -> ScoreCommitter contains it
 -> game calls logger.warn/error
 -> NOOP_LOGGER discards it
 -> ScoreCommitter marks the run submitted and does not retry
 -> score is lost with no user warning and no diagnostic output
```

Space Rocks is even quieter because it does not provide the reporter at all.

There are two related silent recovery defaults:

- `ScoreRepository` defaults `reportRecovery` to a no-op when invalid persisted scores are ignored;
- `NamespacedGameStorageService` defaults `reportRecovery` to a no-op when invalid game state is
  ignored.

`BrowserGameServices` constructs both without a reporter, so corruption recovery inside a running
game can also be invisible.

### 3.2 What remains intentionally contained

Do **not** undo round 4's `ScoreCommitter` policy.

The following remain correct:

- a thrown/rejected score persistence operation is contained at the game's score-commit boundary;
- a reporter that itself throws is swallowed after best effort, because there is no further safe
  reporting layer inside `ScoreCommitter` and crashing gameplay due to a broken failure reporter
  defeats the containment boundary;
- a throwing game-supplied `readTerminalScore` remains outside containment and surfaces loudly as a
  programmer defect.

The defect is not that `ScoreCommitter` contains persistence errors. The defect is that its normal
production reporting destination is silent.

### 3.3 Intended behavior

For production game services:

1. diagnostic logger calls must reach a real sink — at minimum browser/Tauri console diagnostics;
   there must be no production `NOOP_LOGGER`;
2. score submission persistence failure produces one nonfatal, nontechnical shell message such as
   `"Your score could not be saved."`, while diagnostic output retains game/scope/error detail;
3. invalid score documents recovered to empty state produce a visible warning and diagnostic detail;
4. invalid namespaced game-state documents recovered to empty state produce a visible warning and
   diagnostic detail;
5. none of these errors crashes the active game merely because persistence is unavailable;
6. Space Rocks receives the same persistence-failure visibility as every other game without needing
   a bespoke one-off implementation;
7. reporting failure itself remains contained and must not recurse infinitely.

### 3.4 Design decision

Provide explicit diagnostics dependencies to `BrowserGameServices`; do not hide production
behavior in module-level no-op constants.

The implementation should have two conceptually separate channels:

- **diagnostic logging:** a real `GameLogger` implementation (`console` is the minimum acceptable
  sink in this round) used for developer/operator detail;
- **nonfatal persistence notification/recovery reporting:** a callback supplied by the shell/runtime
  that can post a generic warning to `ShellController` while logging the detailed underlying
  message/error.

Avoid making every future `GameLogger.warn()` automatically user-visible; a game may later use the
logger for benign diagnostics. Persistence notification should therefore be explicit at the
persistence-service boundary rather than inferred from arbitrary logger text.

Recommended wiring:

- allow `PersistentScoreService` (or an immediately adjacent wrapper) to receive a score-submit
  failure reporter; on submit failure it reports once and then rethrows so `ScoreCommitter` can
  retain its existing nonfatal containment semantics;
- pass a real `RecoveryReporter` to `ScoreRepository` and `NamespacedGameStorageService` from
  `BrowserGameServices`;
- inject a real `GameLogger` into `BrowserGameServices` instead of constructing a no-op logger;
- have `createDefaultShellRuntime()` bridge nonfatal persistence reports to a controller method
  designed for such warnings. The callback may close over `controller` exactly as the existing game
  failure callback does, provided events emitted before controller construction are still logged
  diagnostically rather than silently dropped.

A different implementation shape is acceptable if all acceptance properties above are met and no
production no-op sink remains.

### 3.5 Duplicate-reporting rule

A single persistence failure may traverse several layers. User-visible reporting must be
**deduplicated by architecture**, not by string matching. One score submission failure should not
produce two or three identical shell warnings because both the score service and a game-specific
logger callback reported it.

Diagnostic logging may contain more than one contextual line when useful, but the user-facing shell
message should be singular for one failure event.

### 3.6 Required tests

Add tests that prove:

- a score service failure invokes the nonfatal persistence reporter exactly once and still rejects to
  the `ScoreCommitter` boundary;
- `ScoreCommitter` contains that rejection as before;
- Space Rocks receives the same service-layer notification despite not supplying a game-level
  `reportError` callback;
- a corrupt scores document reaches the supplied `RecoveryReporter` and returns the documented empty
  score document;
- corrupt namespaced game-state reaches the supplied reporter and returns empty state;
- production/default `BrowserGameServices` wiring uses the injected real logger/reporter rather than
  a no-op implementation;
- a reporter that throws does not take down score handling (existing CR3/CR4 containment tests stay
  green).

Mutation check: replace the production logger/reporter with a no-op or omit the repository/storage
reporter; the new tests must fail.

---

## 4. Browser preview must be explicit; a broken native app must not silently become memory-only

### 4.1 Current defect

**Files:**

- `src/app/shell/default-controller.ts`
- `src/app/App.tsx`
- `src/native/commands.ts`

`createDefaultShellRuntime()` currently decides persistence solely by whether `hasNativeBridge()` is
true at that instant:

```ts
const documents = native
  ? new TauriJsonDocumentStore(invokeNative)
  : new MemoryJsonDocumentStore();
```

That fallback is useful for the intentional Vite browser-development preview. It is unsafe as an
unqualified production fallback: if a packaged Tauri build starts without the expected bridge, the
launcher can look functional while settings/scores/game state are held only in RAM and disappear on
restart.

`App.tsx` also collapses every `getPlatformInfo()`/`diagnosticPing()` failure into
`state: "preview"`, making an intentional browser preview indistinguishable from a broken native
bridge after startup.

### 4.2 Intended runtime states

Runtime mode must be explicit:

- **development browser preview:** native bridge is intentionally absent; memory persistence is
  allowed and the footer identifies browser preview;
- **native runtime:** native bridge is required; durable Tauri persistence is required;
- **native integration failure:** expected bridge/diagnostics are missing or broken; this is an error,
  not preview mode.

A packaged/production build must never silently select `MemoryJsonDocumentStore` because the bridge
is unavailable.

### 4.3 Design decision

Make preview permission an explicit input derived from the build/runtime environment, e.g.
`import.meta.env.DEV`, rather than inferring permission from bridge absence.

`createDefaultShellRuntime()` should receive an explicit mode/option such as:

```ts
{ allowBrowserPreview: boolean }
```

or an equivalent `"native-required" | "browser-preview-allowed"` enum.

Rules:

- bridge present -> use `TauriJsonDocumentStore` regardless of preview allowance;
- bridge absent + preview explicitly allowed -> use `MemoryJsonDocumentStore` and mark runtime as
  preview;
- bridge absent + preview not allowed -> throw a startup error. Let the existing startup/error
  boundary present the fatal state rather than constructing an ephemeral runtime.

The `App.tsx` diagnostic state must distinguish a failed native diagnostic from intentional preview.
It may add a `"native-error"` state or rely on an already-fatal startup path, but it must not label a
rejected native diagnostic call as `"browser preview"` when the runtime expected native operation.

### 4.4 Required tests

Add dependency-injected tests around default runtime selection without needing real Tauri globals.
At minimum prove:

1. bridge present -> Tauri store/runtime path;
2. bridge absent + preview allowed -> memory preview path;
3. bridge absent + preview forbidden -> startup creation rejects/throws loudly;
4. a native diagnostic failure is not transformed into a `"browser preview"` status;
5. existing browser-development workflow remains supported.

Mutation check: restore unconditional `native ? Tauri : Memory`; the production-mode missing-bridge
test must fail.

---

## 5. WebAudio suspend/resume rejections must be observed

### 5.1 Current defect

**Files:**

- `src/engine/audio/audio-service.ts`
- `src/engine/audio/audio-service.test.ts`

`pauseAll()` and `resumeAll()` currently discard promises returned by WebAudio:

```ts
void this.context.suspend();
void this.context.resume();
```

If either promise rejects, the service has no explicit failure policy. Depending on browser/runtime
behavior this can produce an unhandled rejection, leave the shell believing audio was paused while
it is still playing, or leave resumed gameplay silent.

`unlock()` already returns/awaits its resume promise and is outside this finding.

### 5.2 Interface constraint

`AudioService.pauseAll()` and `AudioService.resumeAll()` are currently synchronous `void` methods used
from synchronous game/shell lifecycle code. This round does **not** require converting the entire
audio/game-host interface to async merely to observe these promises.

### 5.3 Design decision

Give `SharedWebAudioService` an explicit nonfatal lifecycle-error reporter, injected similarly to its
existing buffer/context dependencies. `pauseAll()` and `resumeAll()` may remain `void`, but each
fire-and-forget promise must end in a `.catch(...)` that reports the failure.

Requirements:

- no rejecting WebAudio promise is left unobserved;
- the reporter receives operation context (`suspend` vs `resume`) and the underlying error;
- the reporter itself must not turn an audio failure into an unhandled rejection. If it can throw,
  guard that terminal failure explicitly and document why;
- default production construction supplies a real diagnostic reporter; a silent default is not
  acceptable at the production boundary;
- test fakes may supply no-op reporters intentionally when the test is not about diagnostics.

A user-visible warning is optional for a single audio lifecycle failure in this round; diagnostic
visibility is mandatory. If a shell warning is added, keep it nonfatal and avoid repeated warning
spam on every lifecycle transition.

### 5.4 Required tests

Extend `FakeAudioContext` so `suspend()` and `resume()` can reject.

Assert:

- rejected `pauseAll()` is caught and reported once;
- rejected `resumeAll()` is caught and reported once;
- the service methods themselves do not synchronously throw merely because the later promise
  rejects;
- successful suspend/resume still performs exactly one browser operation;
- a throwing lifecycle reporter cannot create a second unhandled failure path.

Mutation check: remove the `.catch(...)` from either operation; the corresponding test must fail
rather than merely generating process-level noise.

---

## 6. Asset-manifest discovery must fail closed on filesystem errors

### 6.1 Current defect

**Files:**

- `scripts/validate-assets.mjs`
- `scripts/validate-assets.test.mjs`

`collectManifests()` currently catches every `readdir()` failure and returns an empty result:

```js
try {
  entries = await readdir(directory, { withFileTypes: true });
} catch {
  return result;
}
```

That treats all of these as equivalent to "there are no manifests":

- required directory missing;
- permission denied;
- I/O error;
- malformed/unreadable filesystem state;
- any unexpected Node filesystem exception.

For a validation command whose purpose is to stop bad assets from shipping, that is a fail-open
policy.

### 6.2 Design decision

For this repository, `src/games` is a required source tree. Therefore `collectManifests()` should
not suppress `readdir()` failures at all. Remove the broad catch and allow filesystem failures to
reject `validateRepository()`/the CLI.

Do not special-case `ENOENT` for `src/games`: absence of the game's source tree is a repository
validation failure, not an optional state.

If a future optional directory is added, catch only that explicitly documented condition at that
specific call site; do not reinstate a broad recursive catch.

### 6.3 Required tests

Extend `scripts/validate-assets.test.mjs` with repository-level fixtures:

- a minimal valid attribution document but no `src/games` directory -> `validateRepository(root)`
  must reject;
- a valid empty `src/games` directory -> validation may succeed (there are genuinely zero
  manifests);
- existing missing-asset and attribution fail-closed tests continue to pass.

Do not depend on Unix permission bits for the primary regression test because CI or containers may
run as a privileged user. A missing required directory is deterministic on every platform.

Mutation check: restore the broad `catch { return result; }`; the missing-required-directory test
must fail.

---

## 7. Cross-cutting failure-handling rules

Round 5 adds the following architectural rules to prevent recurrence of the same class of defect.
These should be summarized into the canonical `docs/SPEC.md` as part of CR5-008 after the code
changes have settled.

### 7.1 No false success after a contained failure

Catching an error to keep the application alive does not turn the operation into success. A caller
that needs to decide what happens next must receive an explicit success/failure result or a
rejection. User-facing success text and dependent side effects happen only after the operation's
required commit point succeeds.

### 7.2 No silent production reporter at an error boundary

A default no-op callback is acceptable in an isolated test fake. It is not acceptable as the
production destination for an error the architecture says is "reported". Production error paths
must reach a diagnostic sink; persistence failures/recoveries additionally need the documented
nonfatal user signal.

### 7.3 Fallbacks must be explicit modes, not accidental recovery

Durable -> volatile storage downgrade, native -> browser downgrade, security-policy downgrade, or
similar behavior-changing fallback is allowed only when the runtime mode explicitly opts into it.
Missing required production capability is an error.

### 7.4 Fire-and-forget promises require a terminal rejection policy

`void somePromise()` is acceptable only when the promise is known not to reject or the expression
already has a terminal rejection handler. Any async browser/native/persistence operation launched
without awaiting it must document where rejection is observed.

### 7.5 Validators fail closed

Validation tooling may skip only conditions explicitly documented as optional. Broad filesystem or
parse catches that convert unknown failure into "nothing to validate" are prohibited.

### 7.6 Concurrent persistence is part of the API contract

A persistence API callable more than once before prior work finishes must define ordering and
collision semantics. Atomic single-writer code is not sufficient evidence of concurrent safety.

### 7.7 Containment distinguishes environmental failure from programmer defects

Retain the round-4 distinction:

- environmental/external failures that a playable run should survive may be contained, but must be
  reported through a real sink;
- programmer defects in game-owned logic should surface loudly unless there is a separately
  documented containment boundary with a safe resting state.

### 7.8 Intentional terminal swallowing must be local and documented

A bare `catch {}` is not automatically wrong. It is acceptable only when the code is at the final
reporting/cleanup boundary and there is genuinely nowhere safer to propagate the error. The local
comment must name what failed, why propagation would be worse, and what observability remains.
`ScoreCommitter` swallowing a throwing error reporter is the model for this exception.

---

## 8. Acceptance strategy

### 8.1 Per-defect regression tests

Every behavior-changing CR5 task adds a regression test that fails when the original defect is
reintroduced. Verification is by mutation/reversion in the same development session, not by reading
the test and deciding it looks sufficient.

Required representative mutations:

- CR5-001: make `saveSettings()` swallow failure as fulfilled `void`, or ignore `false` in a caller;
- CR5-002: bypass the TypeScript per-key queue;
- CR5-003: restore one shared native temp pathname with no concurrency protection;
- CR5-004: restore `NOOP_LOGGER`/omit persistence reporters;
- CR5-005: restore unconditional missing-bridge -> memory fallback;
- CR5-006: remove a WebAudio rejection handler;
- CR5-007: restore broad manifest-directory catch.

### 8.2 Quality gates

After each individual task and after the full round:

```text
npm run format:check
npm run lint
npm run metadata:check
npm run assets:check
npm run typecheck
npm run test
npm run build
```

and the Tauri/native checks represented in CI must remain green:

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
Tauri compile / release-CSP smoke / tauri-dev smoke
```

### 8.3 Error-path review gate

Before marking the round complete, inspect every production occurrence introduced or touched by this
round of:

```text
catch {
catch (...)
=> undefined
void <promise>
MemoryJsonDocumentStore
RecoveryReporter default
GameLogger
.tmp
```

For each remaining silent-looking construct, either:

- prove it is test-only;
- point to the explicit reporter/rejection policy/mode gate that makes it non-silent; or
- document the intentional terminal-swallow rationale locally.

This is not a mandate to remove all catches or all no-op test fakes. It is a mandate that no
production failure path becomes invisible merely because it was convenient to contain.

### 8.4 Canonical documentation

After implementation is stable, update `docs/SPEC.md` with the lasting rules from §7 and any new
runtime-mode/persistence guarantees. `BUGFIX_SPEC_V5.md` remains the forensic design record for why
the rules exist; `SPEC.md` should state the final architecture without depending on the bug history.
