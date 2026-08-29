# Bugfix Remediation TODO — round 3

Companion task list to `docs/BUGFIX_SPEC_V3.md`, which is the design source of truth for each item
below — read the corresponding spec section before starting a task. Source: code review of the
round-2 remediation (`docs/BUGFIX_TODO_V2.md`), conducted 2026-08-29 against `master` at `bac782a`.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `CR3-`, distinct from the feature-phase `P<N>-<NNN>` IDs and from
rounds 1 (`CR-<NNN>`) and 2 (`CR2-<NNN>`). Commit messages use the `CR3-<NNN>: <description>` prefix.

This round is deliberately small. Round 2's substantive fixes were re-verified and hold up; what
remains is one correctness gap, one acceptance criterion round 2 marked complete without meeting,
and four record/consistency items. Recommended order: §1, then §2, then §3 (any order), then §4.
One task is `[!]` pending a decision the spec records a default for; confirm or override it, flip
the marker to `[ ]`, and proceed.

---

## 1. Correctness

- [x] **CR3-001 — Contain a throwing `reportError` in `ScoreCommitter`**
  - Wrap every `reportError` invocation on both the synchronous and the rejection path, and
    swallow a throw from the reporter itself. Do not change the ten game handlers. See spec §1.1.
  - Acceptance: a test with a `ScoreService` that throws synchronously *and* a reporter that
    throws asserts `handle` returns normally; a matching test on the rejection path asserts the
    same and that nothing escapes as an unhandled rejection. Both fail against the pre-fix code —
    verify by reverting the fix and watching them fail, not by inspection. The four existing
    `score-committer.test.ts` cases and all ten per-game score-submission tests pass untouched.

## 2. Test-coverage gaps

- [x] **CR3-002 — Test the present loop's backing-store resize (unmet CR2-003 criterion)**
  - Extract `resizeCanvasToDevicePixels(canvas, devicePixelRatio)` into `src/app/shell/`, taking a
    minimal structural canvas type and returning whether it resized; make `App.tsx`'s present loop
    a thin caller. Mirrors `createPointerBoundsResolver` (CR2-012). Do **not** add jsdom — see
    spec §2.1 for why that is rejected rather than merely unnecessary.
  - Acceptance: tests assert the backing store is set to `round(client × dpr)` at DPR 1, 1.25, 1.5
    and 2; that an already-correct canvas is not written to (asserted via both the returned flag
    and an assignment spy, not inferred); that a zero-sized box floors at one device pixel; and
    that a DPR change alone, with an unchanged CSS box, triggers a resize — the browser-zoom case
    the present loop's own comment claims to handle and nothing currently verifies. `App.tsx`
    keeps no arithmetic of its own. The CR2-003 viewport and pointer tests pass untouched.

## 3. Consistency and staleness

- [x] **CR3-003 — Remove the redundant `Math.max` from the pointer path's sizing**
  - `use-shell-input.ts` pre-floors the CSS size before calling `devicePhysicalSize`, which already
    floors at one device pixel; `App.tsx` does not. One flooring rule, in one place. See spec §3.1.
  - Acceptance: both call sites pass the raw CSS size; a test asserts the render and pointer sizing
    expressions agree for every combination of DPR ∈ {1, 1.25, 1.5, 2, 3} and CSS size ∈ {0..4}
    (the range where they currently diverge) as well as a realistic range. No behavior change at
    any size ≥ 1; the CR2-003 pointer tests pass untouched.

- [x] **CR3-004 — Un-stale the `P13-009` tunnel-route test after CR2-004**
  - Three rooms now carry a full-width tunnel, but the test still names two and asserts "the two
    middle rooms". Broaden it to the route as it exists and rename to match. The test must *derive*
    which rooms carry a full-width tunnel by scanning every room, then `assertDeepEqual` that
    derived list against the pinned one — **not** take a positional slice and assert the ids inside
    it, which is what the current test does and which cannot notice a room outside the slice
    gaining a tunnel. See spec §3.2 for the exact shape and why the slice form fails.
  - Acceptance: the test name and assertion messages describe three rooms; the derived list is
    compared against the pin `["echo-hollow", "root-vault", "sun-shrine"]`; temporarily giving Fern
    Gate a full-width tunnel makes the test fail, and temporarily shortening `shrine-tunnel` makes
    it fail — verify both by actually doing so, since the first is the property the slice form
    silently loses and the second is the CR2-004 regression this test now guards;
    `docs/games/JUNGLE_QUEST_DESIGN.md` and the test agree, where today they contradict.

- [x] **CR3-005 — Correct CR2-004's acceptance record to the sweep that shipped**
  - `docs/BUGFIX_TODO_V2.md` still advertises an "interior-end sweep ... for every room"; what
    shipped is the narrower tunnel-width invariant, for reasons recorded in `178c646`. Amend the
    record, keep the code. See spec §3.3.
  - Acceptance: CR2-004's acceptance text in the round-2 TODO describes the tunnel-width invariant
    and notes in one line why the general sweep was rejected; no test or source file changes.

- [x] **CR3-006 — Fix the cross-cutting test rule's contradiction with no-behavior-change tasks**
  - The round-2 rule requires every §1/§2 task to add a regression test; CR2-006 (a rename) and
    CR2-007 (a doc sentence plus a comment) have no behavior to regress and their own acceptance
    said so. Amend the rule in `docs/BUGFIX_TODO_V2.md` and carry the corrected wording into this
    file's own cross-cutting section. See spec §3.4.
  - Acceptance: the rule carves out behavior-preserving tasks, requiring them instead to state why
    no regression test applies and to confirm the existing tests over the touched code pass
    untouched; both round-2 and round-3 cross-cutting sections carry the same wording.

## 4. Manual verification

- [x] **CR3-007 — Record CR2-003's on-screen size change at fractional DPR** — decided: option
  **A**, accept the trade and document it (spec §4.1).
  - Computing the integer scale in device pixels changes how much of the panel the game fills at a
    fractional `devicePixelRatio`: larger at 1.25×, **smaller** at 1.5× (960×720 → 853×640 CSS at
    1366×768). 1.5× is a common Chromebook setting and this has only ever been checked
    arithmetically, never looked at.
  - Acceptance: `docs/SPEC.md` §11.2 records the size-change table; a fractional-DPR check is added
    to `docs/P18_RELEASE_ACCEPTANCE.md`'s human items. Per this project's convention, leaving the
    actual observation for the native-hardware pass is an acceptable completion basis provided it
    is recorded there rather than assumed.

---

## Cross-cutting acceptance

- `npm run lint`, `npm run test`, and `npm run build` pass after every individual task and after
  the full set.
- Every task in §1 and §2 that changes behavior adds a regression test that fails against the
  pre-fix code and passes against the post-fix code — verify this locally before committing, by
  reverting the fix and watching the test fail, not by inspection. A task that changes no behavior
  (a rename, a comment, a documentation edit) instead states in its acceptance why no regression
  test applies, and confirms the existing tests covering the touched code pass untouched.
- A task is only marked `[x]` when every artifact its acceptance names exists. If an artifact turns
  out to be impractical, say so in the TODO and get the criterion amended — do not mark the task
  complete and explain the gap in a commit message. (Both prior rounds shipped a task this way;
  CR3-002 is the round-2 instance.)
- Commit messages use `CR3-<NNN>: <description>`.
- The `[!]` task is not started until its decision is confirmed; the default in the spec is the
  recommendation, not the decision.
