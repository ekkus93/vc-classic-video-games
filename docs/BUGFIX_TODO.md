# Bugfix Remediation TODO

Companion task list to `docs/BUGFIX_SPEC.md`, which is the design source of truth for each item
below — read the corresponding spec section before starting a task. Source: full-codebase code
review against `docs/TODO.md`, conducted 2026-08-28.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `CR-` (code review) to keep them visually distinct from the
feature-phase `P<N>-<NNN>` IDs in `docs/TODO.md`. Commit messages for this work should use the
`CR-<NNN>: <description>` prefix, per the same convention `CLAUDE.md` documents for `P<N>-<NNN>`.

Recommended order: §1 first (these are real player-facing bugs, ranked roughly by severity/blast
radius), then §2 (cheap, low-risk test-coverage additions), then §3 (larger mechanical
refactors — do these once §1/§2 are stable so there's less in flight at once), then §4 (cleanup,
any order, can be interleaved).

---

## 1. Critical gameplay bugs

- [x] **CR-001 — Fix Jungle Quest room-transition deadlock**
  - Reorder the transition-check/clamp logic in `src/games/jungle-quest/simulation.ts` so the
    room-edge trigger can actually fire instead of being clamped back every frame. See
    `docs/BUGFIX_SPEC.md` §1.1 for the exact mechanism and design decision.
  - Acceptance: a test drives a transition via multiple frames of held movement input from a
    normal checkpoint-start position (not constructor injection past the threshold), and passes
    for at least the Fern Gate → next-room transition. All four rooms are reachable via chained
    real-input transitions in a test. `docs/P13_PLAYABLE_ACCEPTANCE.md`'s "reach a further room"
    item can be manually re-verified once this lands.

- [x] **CR-002 — Fix Jungle Quest ladder-end diagonal-input lock**
  - Gate ladder re-entry on the same mount-detection condition used for a fresh mount, not on
    `vertical !== 0` alone. See `docs/BUGFIX_SPEC.md` §1.2.
  - Acceptance: a test holds a diagonal (vertical + horizontal) input at a ladder's top and
    bottom end and asserts horizontal movement takes effect immediately after dismounting, without
    needing the vertical input released first.

- [x] **CR-003 — Fix River Hopper buffered-hop hazard/goal bypass**
  - Evaluate `resolveRiverSupport` and `resolveGoal` against the just-landed position before a
    buffered hop is allowed to chain into a new one. See `docs/BUGFIX_SPEC.md` §1.3.
  - Acceptance: a regression test reproduces the exact scenario found in review (river lane, no
    platform, buffered hop before landing) and asserts a `life-lost` event fires / life count
    decreases. A parallel test confirms a chained hop landing exactly on the goal row still emits
    goal-reached. Existing road-hazard-mid-chain test continues to pass unchanged (that path was
    already correct — use it as the behavioral parity reference).

- [x] **CR-004 — Fix pointer coordinates measured against the wrong DOM element**
  - Point `src/app/shell/use-shell-input.ts`'s pointer-coordinate pipeline at the actual
    `.game-screen` canvas element instead of the padded `app-shell` container. See
    `docs/BUGFIX_SPEC.md` §1.4.
  - Acceptance: a test (or a documented manual check, if DOM layout isn't practically testable in
    the current harness) confirms pointer coordinates at the canvas's visible corners/center map
    to the expected logical-space corners/center when the shell has non-zero padding. Missile
    Defense's cursor aims where the pointer visually is.

- [ ] **CR-005 — Resolve the viewport-scaling divergence (decision required)**
  - Either wire production canvas rendering through the tested
    `calculateViewport`/`presentFramebuffer` integer-scaling path, or formally retire that code as
    dead and document CSS-based scaling as the intended approach. See `docs/BUGFIX_SPEC.md` §1.5
    for the tradeoffs and the default recommendation (wire it through).
  - Acceptance: whichever direction is chosen, `docs/SPEC.md` and the P3-004/P3-005 acceptance
    text in `docs/TODO.md` accurately describe the shipped behavior, and either (a)
    `presentFramebuffer`/`LogicalFramebuffer` are exercised by the real render path with a test
    proving production output matches the unit-tested scaling algorithm, or (b) they are removed
    (or explicitly marked as test-only reference implementations) and the CSS-based approach has
    its own equivalent test coverage for the same viewport sizes `viewport.test.ts` already covers
    (incl. 1366×768).

- [ ] **CR-006 — Fix Star Defender free Emergency Burst refund**
  - Suppress the wave-clear charge refund specifically when the wave clear was caused by the
    emergency action that just fired. See `docs/BUGFIX_SPEC.md` §1.6.
  - Acceptance: a test presses the emergency burst against a full wave and asserts the charge
    count decreases by exactly 1 and does not recover, even though the wave clears. A separate
    existing/updated test confirms an ordinary combat-caused wave clear still refunds a charge as
    designed (if that refund-on-clear behavior is otherwise intentional — confirm with
    `docs/games/*` design doc for Star Defender before removing it wholesale).

- [ ] **CR-007 — Fix Barrel Climber simultaneous vault+hit**
  - Make the hit check the single source of truth per hazard per frame; derive the vault
    condition as a strict subset of "not intersecting." See `docs/BUGFIX_SPEC.md` §1.7.
  - Acceptance: a new test places the player at narrow (~1-2px) clearance over a hazard and
    asserts exactly one outcome occurs (vault credit *or* hit, never both) in a single `update()`
    call. Existing generous-clearance vault test continues to pass unchanged.

- [ ] **CR-008 — Fix Deep Digger wave-clear discarding in-flight rocks**
  - Preserve `"shaking"`/`"falling"` rocks across `resolveWaveClear` instead of unconditionally
    repopulating rock state. See `docs/BUGFIX_SPEC.md` §1.8 for the two acceptable resolution
    strategies (let it finish falling, or explicitly settle-and-event it).
  - Acceptance: a test kills the last enemy while a rock is mid-fall and asserts the rock's
    outcome (landing effect and/or score) is not silently lost — either it continues to resolve
    normally after the wave populates, or an explicit settlement event fires for it. The `53cff23`
    test fixture that was edited to avoid this interaction should be revisited: either restore its
    original two-rock/one-enemy shape now that the race is fixed, or add a new dedicated fixture
    for the race case rather than leaving it permanently avoided.

- [ ] **CR-009 — Fix Deep Digger falling-rock same-column overlap**
  - Change `isRockAt`'s exclusion to per-rock (only the calling rock's own vacated cell), not a
    blanket exclusion of all falling rocks. See `docs/BUGFIX_SPEC.md` §1.9.
  - Acceptance: a test places two rocks in the same column (matching the shipped `ROCK_SPAWNS`
    column-18 pair) with both falling simultaneously, and asserts they never occupy the same cell
    at the same simulated tick.

- [ ] **CR-010 — Fix Deep Digger rock/player contact only checked on cell-change ticks**
  - Run the player-contact check every tick a rock is `"falling"`/`"shaking"` and occupying a
    cell. See `docs/BUGFIX_SPEC.md` §1.10.
  - Acceptance: a test has the player walk into a falling rock's cell during one of its idle
    ticks between fall steps (not on the tick the rock just moved there) and asserts contact is
    detected.

## 2. Test-coverage gaps

- [ ] **CR-011 — Add tests for `GameMetadata` duplicate-value rejection (P2-001)**
  - Acceptance: tests assert rejection for duplicate player counts, duplicate input kinds, and
    duplicate difficulties, alongside the existing duplicate-ID/malformed-field tests in
    `src/engine/game/metadata.test.ts`.

- [ ] **CR-012 — Add tests for score-entry validation rejection paths (P5-008)**
  - Acceptance: tests call `parseScoreEntry`/`parseScoreDocument` directly with an invalid
    `gameId` and with a malformed entry, asserting `ScoreValidationError` is thrown in each case.

- [ ] **CR-013 — Add test for Bug Barrage `maxChains` split-fallback boundary (P11-008)**
  - Acceptance: a test drives chain count to `maxChains` and exercises the fallback branch at
    `simulation.ts:399`, asserting `assertBounds()` does not throw and the entity count stays at
    or under the cap.

- [ ] **CR-014 — Add test for Maze Chase compound hit+level-clear ordering (P10)**
  - Acceptance: a dedicated fixture (isolated per `CLAUDE.md`'s fixed-timestep testing guidance)
    covers a move that both empties the last collectible and lands the player on a
    non-vulnerable enemy in the same tick, asserting the resulting state (life lost, then level
    clear, or whichever ordering is intended) is well-defined and doesn't corrupt entity/timer
    state.

- [ ] **CR-015 — Add Sky Riders population-invariant and tie-clash tests (P12)**
  - Acceptance: a runtime assertion (or an explicit code comment justifying its absence) guards
    `enemyState.length + stormSeedState.length <= maxEnemies` after every mutation path, not just
    at construction. A new multi-frame test covers a stationary tie-bounce to confirm riders don't
    re-clash before separating past the overlap threshold.

## 3. Architecture / duplication debt

- [ ] **CR-016 — Extract shared `ScoreCommitter` into `src/engine/`**
  - Migrate all 10 games' `score-submission.ts` to use it. See `docs/BUGFIX_SPEC.md` §3.1.
  - Acceptance: one shared implementation exists in `src/engine/`; all 10 games import it; no
    per-game `score-submission.ts` redefines the submit-once/rejection-containment logic; every
    existing per-game score-submission test continues to pass with import-path-only changes;
    `docs/SPEC.md` documents the new shared module.

- [ ] **CR-017 — Extract shared bounded particle-burst system into `src/engine/`**
  - Migrate applicable games' `effects.ts` to configure and drive it instead of reimplementing
    it. See `docs/BUGFIX_SPEC.md` §3.2.
  - Acceptance: one shared, configurable particle utility exists in `src/engine/`; each migrated
    game's visual output (burst count, velocity range, lifetime, bounds) is unchanged from before
    the refactor, verified by each game's existing effects tests continuing to pass; `docs/SPEC.md`
    documents the new shared module.

## 4. Minor issues

- [ ] **CR-018 — Make asset attribution validation fail-closed**
  - Require every asset manifest entry to declare `original` explicitly; fail validation if the
    field is missing, not just when it's `false`. See `docs/BUGFIX_SPEC.md` §4.
  - Acceptance: `npm run assets:check` fails on a manifest fixture that omits the `original`
    field entirely; a corresponding test is added to `scripts/validate-assets.test.mjs`.

- [ ] **CR-019 — Remove or adopt `GameSurface.tsx` dead code**
  - Acceptance: either the file is deleted (default direction) and nothing references it, or
    `App.tsx`'s inline canvas-mount logic is replaced with a use of this component and the
    existing app-level tests continue to pass either way.

- [ ] **CR-020 — Document or fix Maze Chase's player/enemy speed-cap asymmetry**
  - Acceptance: either a comment in `simulation.ts` explains why the player caps at `1.18` while
    enemies don't, or both caps are lifted into named constants in `design.ts` with matching
    values if the asymmetry was unintentional.

- [ ] **CR-021 — Consolidate duplicate P0-P3-area test files**
  - Acceptance: `registry-asset-resolver.test.ts` and `registry-assets.test.ts` are merged into
    one file with one accurate task-ID reference, keeping the better of the two coverage sets.

- [ ] **CR-022 — Update `docs/ASSET_POLICY.md` staleness**
  - Acceptance: the doc no longer claims the attribution file is "intentionally empty"; it
    reflects that `assets/ATTRIBUTION.json` is an active, populated record.

- [ ] **CR-023 — Fix Jungle Quest mislabeled test task-ID comments**
  - Acceptance: `src/games/jungle-quest/player.test.ts` (and any other mislabeled files found
    during the fix) have task-ID comments that match what each test actually covers.

- [ ] **CR-024 — Add regression test for Jungle Quest checkpoint re-entry scoring (post CR-001)**
  - Only actionable once CR-001 lands (the affected rooms were previously unreachable). See
    `docs/BUGFIX_SPEC.md` §1.1, "related lower-confidence issue."
  - Acceptance: a test walks the player backward between two differently-checkpointed rooms and
    asserts the checkpoint bonus is not re-awarded and the respawn point does not regress on
    backward re-entry — or, if backward re-entry turns out to be impossible by level geometry,
    the test documents why and this task is marked complete on that basis instead.

- [ ] **CR-025 — Correct `docs/TODO.md` P13 status once CR-001/CR-002 land**
  - `docs/TODO.md` currently marks P13-007/008/009 `[x]` despite CR-001 making their acceptance
    criteria unreachable through real input before this remediation. Once CR-001 and CR-002 are
    fixed and verified, re-run the relevant `docs/P13_PLAYABLE_ACCEPTANCE.md` manual checklist
    items and confirm `docs/TODO.md`'s P13 markers are now accurate (they should already read
    `[x]` correctly if the fix and its regression test are sufficient — this task is about
    re-verification and, if needed, correction, not a code change).
  - Acceptance: `docs/P13_PLAYABLE_ACCEPTANCE.md`'s room-transition-related manual items are
    re-checked (or explicitly left for a native-hardware pass per that doc's existing convention,
    matching every other game's `[~]` acceptance status), and any `docs/TODO.md` text that implied
    P13 was fully validated is corrected if it wasn't accurate.

---

## Cross-cutting acceptance

- `npm run lint`, `npm run test`, and `npm run build` pass after every individual task and after
  the full set.
- Every task in §1 and §2 adds a regression test that fails against the pre-fix code and passes
  against the post-fix code (verify this locally before committing — write the test first against
  the current buggy behavior if practical).
- Commit messages use `CR-<NNN>: <description>`.
