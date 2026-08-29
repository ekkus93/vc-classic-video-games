# Bugfix Remediation TODO — round 4

Companion task list to `docs/BUGFIX_SPEC_V4.md`, which is the design source of truth for each item
below — read the corresponding spec section before starting a task. Source: code review of the
round-3 remediation (`docs/BUGFIX_TODO_V3.md`), conducted 2026-08-29 against `master` at `cb22539`.

Status convention (same as `docs/TODO.md`):

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and validated
- `[!]` blocked or requires a decision

Task IDs are stable and prefixed `CR4-`, distinct from the feature-phase `P<N>-<NNN>` IDs and from
rounds 1 (`CR-<NNN>`), 2 (`CR2-<NNN>`) and 3 (`CR3-<NNN>`). Commit messages use the
`CR4-<NNN>: <description>` prefix.

**No runtime defect was found in round 3's shipped code.** Every finding here is a guard failure:
one factual error in `docs/SPEC.md`, two tests that pass for the wrong reason, and two consistency
items. Recommended order: **CR4-004 first** (a pure file move that CR4-002's new test would
otherwise have to be written against twice), then CR4-001, then CR4-002 and CR4-003, then
CR4-005. One task is `[!]` pending a decision the spec records a default for; confirm or override
it, flip the marker to `[ ]`, and proceed.

---

## 1. Correctness of the canonical record

- [x] **CR4-001 — Fix `docs/SPEC.md` §11.2's DPR table, which contradicts its own caption**
  - The third column is headed `CSS px per logical px (before)` but holds the *after* values
    (`3 / 3.2 / 2.67 / 3` is `scale ÷ dpr`). The true *before* value is `3` at every DPR, exactly
    as the paragraph beneath the table already states. Restore the five-column form from
    `docs/BUGFIX_SPEC_V3.md` §4.1 with both headers spelled out, and change `853` to `≈853`
    (the real figure is 853.3). See spec §1.1.
  - Regenerate every cell by running the real `calculateViewport`/`devicePhysicalSize` rather than
    transcribing from either existing table — transcription is what introduced this error.
  - Acceptance: the `(before)` column reads `3` in all four rows; a separate `(after)` column
    carries `3 / 3.2 / 2.67 / 3`; the table no longer contradicts the paragraph below it; the
    1.5× on-screen figure is `≈853×640`; every number is confirmed against the real functions in
    the same session as the edit. No test or source file changes — a documentation-only task, so
    per the cross-cutting rule below no regression test applies; confirm `npm run test` passes
    untouched.

## 2. Test-coverage gaps

- [x] **CR4-002 — Make the render/pointer agreement test actually compare the two paths**
  - Depends on CR4-004 (the helper's new import path). The current test drives
    `pointerViewportPhysicalSize` with a square fixture (`{ clientWidth: size, clientHeight: size }`)
    and compares it against an inline `devicePhysicalSize(size, dpr)` rather than against
    `resizeCanvasToDevicePixels`. Transposing width and height inside the helper passes all 416
    tests, and breaking the real render path leaves this test green. Rewrite it to call **both**
    real functions and to use **asymmetric** width/height at every DPR. See spec §2.1.
  - Lives in `src/app/shell/pointer-viewport.test.ts` (created by CR4-004), importing
    `resizeCanvasToDevicePixels` from `./canvas-resize.js` as the render-path reference. Note that
    `canvas-resize.test.ts`'s `FakeCanvas` is **not** exported, so this test declares its own
    minimal `ResizableCanvas` fake — it needs only the four properties, not the assignment spy.
  - Acceptance: the test calls `resizeCanvasToDevicePixels` and `pointerViewportPhysicalSize` and
    compares their results to each other, not to a re-implemented expression; every fixture pair
    has `width !== height` (1366×768, 640×480, 3×4, 0×1, …) across DPR ∈ {1, 1.25, 1.5, 2, 3};
    transposing width/height inside `pointerViewportPhysicalSize` makes it fail, and changing
    `resizeCanvasToDevicePixels` from `round` to `floor` makes it fail — verify **both** by
    actually mutating and watching it fail, since each is a mutation the current test survives.
    The existing zero-box floor test is kept. The CR2-003 viewport and pointer tests pass
    untouched.

- [x] **CR4-003 — Cover the mixed-dimension branch of `resizeCanvasToDevicePixels`**
  - All four existing fixtures have both dimensions matching the target or neither, so the
    conjunction in the unchanged-check is unpinned: `&&` → `||` survives the whole suite. The
    shipped code is correct (verified directly); this is a coverage gap on a reachable state — a
    window widened without being made taller. See spec §2.2.
  - Acceptance: tests cover a stale width with an already-correct height **and** a stale height
    with an already-correct width; each asserts the returned flag *and* the resulting
    `width`/`height`, so a resize that fires but writes the wrong dimension is caught too;
    changing `&&` to `||` in the unchanged-check makes them fail — verify by actually mutating and
    watching them fail. The four existing CR3-002 cases pass untouched.

## 3. Consistency and code quality

- [x] **CR4-004 — Move `pointerViewportPhysicalSize` into its own module** — do this first.
  - The helper's doc-comment says it mirrors `createPointerBoundsResolver`, but it was left inside
    `use-shell-input.ts`, whose first line imports React — so its test drags React, the shell
    controller, the input bridge and the audio-unlock module into the runner to exercise four
    lines of arithmetic. Move `PointerBoundsSize` and `pointerViewportPhysicalSize` into
    `src/app/shell/pointer-viewport.ts`, alongside `canvas-resize.ts` and `pointer-bounds.ts`.
    See spec §3.1.
  - The test file moves with it. `use-shell-input.test.ts` contains **only** the two CR3-003 cases,
    both of which test `pointerViewportPhysicalSize` and nothing else — nothing in the repository
    tests `useShellInput` itself, by design, since the hook is DOM-coupled. Because
    `use-shell-input.ts` imports the helper rather than re-exporting it (matching how it already
    treats `createPointerBoundsResolver`), leaving the test file in place would break its import
    and leave a file named for a module it no longer exercises.
  - Acceptance: a pure move — no identifier, expression, or behavior change; `use-shell-input.ts`
    imports the helper the same way it already imports `createPointerBoundsResolver`, and does not
    re-export it; the two CR3-003 test cases move **verbatim** (bodies unchanged; only the file
    location and the import specifier differ) into a new `src/app/shell/pointer-viewport.test.ts`,
    and `src/app/shell/use-shell-input.test.ts` is deleted; the moved tests' import graph no longer
    reaches React; `use-shell-input.ts`'s now-unneeded `devicePhysicalSize`/`Size2D` engine imports
    are dropped with the helper (`noUnusedLocals` enforces this). Per the cross-cutting rule below
    this task changes no behavior, so no regression test applies; confirm the two moved CR3-003
    cases and the CR2-003 pointer tests pass, with the same total test count as before the move.

- [!] **CR4-005 — Reconcile `ScoreCommitter`'s documented guarantee with its implementation** —
  decision required; spec §3.2 default is **A** (narrow the documented guarantee).
  - `docs/BUGFIX_SPEC_V3.md` §1.1 claims "no input to `handle` … can propagate out of `handle`",
    but a throwing game-supplied `readTerminalScore` does escape (verified by probe). Not
    reachable today — all ten games pass `terminalScoreOfType`, which cannot throw — but the code
    and the documentation disagree, and that disagreement is the defect.
  - Option A (recommended, no behavior change): document that the class contains failures of the
    score *store* and of the error *reporter*, and that a throwing reader is a game-code bug
    deliberately allowed to surface — containing it would turn a loud bug into a silent no-score
    run, and has no good `submitted`/retry resting state.
  - Option B: extend containment to `readTerminalScore`, and answer the `submitted`/retry question
    in the same change.
  - Acceptance (A): the class doc-comment and `docs/BUGFIX_SPEC_V3.md` §1.1 both state the
    narrowed guarantee and name `readTerminalScore` as deliberately outside it, with the reasoning
    in one line; no behavior change, so no regression test applies; the seven
    `score-committer.test.ts` cases and all ten per-game score-submission tests pass untouched.
  - Acceptance (B): a test asserts a throwing reader does not escape `handle`, fails against the
    pre-fix code, and the chosen `submitted`/retry semantics are asserted and documented.

---

## Cross-cutting acceptance

- `npm run lint`, `npm run test`, and `npm run build` pass after every individual task and after
  the full set.
- Every task in §1 and §2 that changes behavior adds a regression test that fails against the
  pre-fix code and passes against the post-fix code — verify this locally before committing, by
  reverting the fix and watching the test fail, not by inspection. A task that changes no behavior
  (a rename, a comment, a documentation edit) instead states in its acceptance why no regression
  test applies, and confirms the existing tests covering the touched code pass untouched.
- **New this round (spec §4):** a test that asserts two things agree must exercise both through
  their real implementations, and must use a fixture whose values can tell them apart — asymmetric
  sizes, distinct ids, different orders. Re-implementing one side inside the test, or driving it
  with a symmetric fixture, makes the test pass for a reason other than the invariant. Confirm by
  mutating one side and watching the test fail; a mutation the test survives means the test is not
  pinning what its name says. This applies to tasks whose code is already correct and only the
  guard is missing, where there is no fix to revert.
- A task is only marked `[x]` when every artifact its acceptance names exists. If an artifact turns
  out to be impractical, say so in the TODO and get the criterion amended — do not mark the task
  complete and explain the gap in a commit message.
- Commit messages use `CR4-<NNN>: <description>`.
- The `[!]` task is not started until its decision is confirmed; the default in the spec is the
  recommendation, not the decision.
