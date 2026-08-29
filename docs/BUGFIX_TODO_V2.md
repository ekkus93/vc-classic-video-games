# Bugfix Remediation TODO — round 2

Companion task list to `docs/BUGFIX_SPEC_V2.md`, which is the design source of truth for each item
below — read the corresponding spec section before starting a task. Source: code review of the
round-1 remediation (`docs/BUGFIX_TODO.md`), conducted 2026-08-28 against `master` at `a2caab1`.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `CR2-` (code review, round 2) so they stay distinct from both the
feature-phase `P<N>-<NNN>` IDs and round 1's `CR-<NNN>`. Commit messages use the
`CR2-<NNN>: <description>` prefix.

Recommended order: §1 first (player-facing, ranked by blast radius), then §2, then §3. Do
CR2-009 (the Jungle Quest reformat) last of all, once nothing else is in flight in those files.
Two tasks are `[!]` pending a decision the spec records a default for; confirm or override the
default, flip the marker to `[ ]`, and proceed.

---

## 1. Player-facing bugs

- [x] **CR2-001 — Make Deep Digger high scores visible in the launcher** (a13f53b)
  - Submit `mode: "default"` from `src/games/deep-digger/module.ts`, matching the other nine
    games; difficulty scoping already happens in `PersistentScoreService`. See spec §1.1.
  - Rewrite `score-submission.test.ts:25`, which currently enshrines the bug (`mode === "bore"`).
  - Acceptance: a test drives a Deep Digger run to game-over through the real module with a fake
    score service and asserts the submission's `mode` is `"default"`; an app-level test (or an
    extension of `launcher-scores.test.ts`) submits a Deep Digger score at a chosen difficulty and
    asserts the launcher's high-score query for that game and difficulty returns it. The commit
    message records that previously persisted Deep Digger scores are not migrated, and why.

- [x] **CR2-002 — Re-check support for landed Deep Digger rocks** (066dd77)
  - Run the support check for `"resting"` rocks exactly as for `"supported"` ones; reset
    `cellsFallen` in `landRock` after the `rock-landed` event. See spec §1.2.
  - Acceptance: three tests in `rock-timing.test.ts` — (a) rock A resting on rock B re-loosens and
    falls when B's support is dug out, and at no tick is A resting above an open cell with no rock
    beneath; (b) digging directly under a landed rock re-loosens it after the shake delay;
    (c) a rock's second landing scores only that fall's cells, with the `rock-landed` event's
    `cellsFallen` matching. Each fails against the pre-fix code. Existing `rock-timing` and
    `simulation` tests pass untouched.

- [x] **CR2-003 — Compute viewport scaling in device pixels** (d4f7ff6)
  - Size the present loop's backing store by `devicePixelRatio`, give `BrowserPointerAdapter` a
    matching `devicePixelRatio` option, and extract the sizing rule into a pure helper both use.
    See spec §1.3 for the end-to-end design.
  - Acceptance: `viewport.test.ts` covers 1366×768 at DPR 1, 1.25, 1.5, and 2 and asserts an
    integer device-pixel scale at each; `pointer.test.ts` covers a DPR-2 click mapping to the
    correct logical point with all DPR-1 cases unchanged; `App.test.ts` (or the present-loop
    test added in CR-005) asserts the backing store is resized to `round(client × dpr)`;
    `docs/SPEC.md`'s viewport section states that scaling is computed in device pixels.

- [x] **CR2-004 — Resolve Sun Shrine's mid-room tunnel end** — decided: option **A**, extend the
  floor to the room edge (spec §1.4). (178c646)
  - Apply the chosen option and add the interior-platform-end sweep to `world.test.ts` in the same
    change so the next unmarked drop announces itself.
  - Acceptance: holding right from Sun Shrine's tunnel entry for 4 s loses no life (A) or reaches a
    drop the renderer paints as open (B); the interior-end sweep passes for every room; the
    round-1 boundary sweep and world tests pass untouched; `JUNGLE_QUEST_DESIGN.md` describes the
    tunnel's east end.

## 2. Latent correctness

- [x] **CR2-005 — Contain synchronous throws in `ScoreCommitter`** (c167a79)
  - Wrap the `submit` call so a synchronous throw reaches `reportError` like a rejection does;
    `submitted` stays set either way. See spec §2.1.
  - Acceptance: a test with a `ScoreService` whose `submit` throws synchronously asserts `handle`
    returns normally, the reporter is called exactly once, and a second terminal frame does not
    retry. Existing `score-committer.test.ts` and all ten per-game score-submission tests pass
    untouched.

- [ ] **CR2-006 — Rename `emergencyClearedWaveThisUpdate` to what it checks**
  - Rename to `emergencyFiredThisUpdate` and correct the comment. See spec §2.2.
  - Acceptance: no behavior change; both CR-006 tests pass untouched.

- [ ] **CR2-007 — Decide and document Maze Chase's compound-tick ordering** — decided: keep
  hit-then-clear (spec §2.3).
  - Add one sentence to `MAZE_CHASE_DESIGN.md` and a comment at the
    `resolveCollisions`/`resolveLevelClear` call site explaining the order is deliberate.
  - Acceptance: the design doc states the ordering; the CR-014 tests assert it; `simulation.ts`
    says at the call site why the order is what it is.

- [ ] **CR2-008 — Remove the dead `"shaking"` branch from the per-tick rock contact check**
  - Check `"falling"` only; explain in the comment why shaking rocks need no check. See spec §2.4.
  - Acceptance: a test asserts a player walking into a shaking rock's cell is blocked and not hit;
    CR-010's test passes untouched.

## 3. Code quality

- [ ] **CR2-009 — Reformat Jungle Quest to one statement per line** — do this last.
  - Mechanical reformat of every `src/games/jungle-quest/*.ts` and `*.test.ts` to the style the
    other games use. No identifier, expression, or statement-order changes. See spec §3.1.
  - Acceptance: the commit touches only Jungle Quest files; `npm run test` passes before and after
    with the same test count; `git diff --stat` for the commit shows no file outside that
    directory.

- [ ] **CR2-010 — Share the burst-style type**
  - Export `ParticleBurstStyle = Omit<ParticleBurst, "x" | "y">` from the engine; delete the four
    local `BurstStyle`/`Burst` interfaces. See spec §3.2.
  - Acceptance: type-only change; all effects tests pass untouched; `grep -r "interface Burst"
    src/games` returns nothing.

- [ ] **CR2-011 — Move Jungle Quest room drawing into `render.ts`**
  - Move the draw helpers and `drawSealedPassages` out of `module.ts`; the CR-001 render test
    imports from `render.ts`. May be folded into CR2-009. See spec §3.3.
  - Acceptance: `module.ts` exports only the module; the render test passes; the game renders
    identically (the existing lifecycle/render tests pass untouched).

- [ ] **CR2-012 — Cache the pointer-bounds element**
  - Resolve `canvas.game-viewport` once per game-screen mount instead of per pointer event and per
    `viewport()` call; keep the `?? surface` fallback. See spec §3.4.
  - Acceptance: no behavior change; the CR-004 pointer test passes untouched; a test asserts the
    query runs once across many pointer events on one mounted screen.

- [ ] **CR2-013 — Pin CR-015's tie-clash count exactly**
  - Replace `clashes <= 2` with the exact count the fixed seed produces, with a comment naming the
    seed and the cause of the second clash. See spec §3.5.
  - Acceptance: the test asserts an exact count and still fails against the pre-CR-015 code.

---

## Cross-cutting acceptance

- `npm run lint`, `npm run test`, and `npm run build` pass after every individual task and after
  the full set.
- Every task in §1 and §2 adds a regression test that fails against the pre-fix code and passes
  against the post-fix code — verify this locally before committing, by reverting the fix and
  watching the test fail, not by inspection.
- Commit messages use `CR2-<NNN>: <description>`.
- The two `[!]` tasks are not started until their decision is confirmed; the default in the spec
  is the recommendation, not the decision.
