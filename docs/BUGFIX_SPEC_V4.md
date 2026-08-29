# Bugfix Remediation Spec — round 4

Design source of truth for `docs/BUGFIX_TODO_V4.md`. Source: code review of the round-3
remediation (`docs/BUGFIX_TODO_V3.md`, CR3-001 – CR3-007), conducted 2026-08-29 against `master`
at `cb22539`. Every finding below was produced by mutating the shipped code and observing the test
suite's response, not by reading commit messages; the probe output is quoted inline.

**No runtime defect was found in round 3's shipped code.** CR3-001's containment is complete and
its tests fail for the right assertions; CR3-002's helper is correct on every branch including the
one its tests miss; CR3-003's helper is correct; CR3-004's rewritten test does its job in both
directions. What this round fixes is three *guard failures* — one factual error in the canonical
spec, and two tests that pass for the wrong reason — plus two consistency items.

All three of the substantive findings originate in round 3 itself, and two of them are the same
species round 3 was convened to eliminate: a test whose name claims more than it verifies, and a
record that disagrees with reality. That recurrence is the reason §4's generalized rule exists.

Sections: §1 correctness of the canonical record, §2 test-coverage gaps, §3 consistency and code
quality, §4 a new cross-cutting rule. Items marked **decision required** carry a default
recommendation; the task in the TODO is `[!]` until the decision is confirmed.

---

## 1. Correctness of the canonical record

### 1.1 `docs/SPEC.md` §11.2's DPR table contradicts the paragraph directly beneath it

**File:** `docs/SPEC.md` §11.2 (added by CR3-007, `cb22539`)

**Current state.** The shipped table reads:

```
| DPR | device px per logical px (after) | CSS px per logical px (before) | on-screen game size |
| 1    | 3 | 3    | unchanged (960x720 CSS) |
| 1.25 | 4 | 3.2  | larger (960x720 → 1024x768 CSS) |
| 1.5  | 4 | 2.67 | smaller (960x720 → 853x640 CSS) |
| 2    | 6 | 3    | unchanged (960x720 CSS) |
```

The third column is headed **(before)** but holds the **after** values. Probed against the real
`calculateViewport`/`devicePhysicalSize` at a 1366×768 CSS viewport and a 320×240 logical
framebuffer:

```
dpr=1    devicePxPerLogical=3 cssPerLogical=3.000 onscreenCSS=960.0x720.0
dpr=1.25 devicePxPerLogical=4 cssPerLogical=3.200 onscreenCSS=1024.0x768.0
dpr=1.5  devicePxPerLogical=4 cssPerLogical=2.667 onscreenCSS=853.3x640.0
dpr=2    devicePxPerLogical=6 cssPerLogical=3.000 onscreenCSS=960.0x720.0
```

`3 / 3.2 / 2.67 / 3` is exactly `scale ÷ dpr` — the CSS pixels per logical pixel *after*
CR2-003. The true *before* value is `3` at every DPR, because the pre-CR2-003 code fed
`calculateViewport` CSS pixels directly: `floor(min(1366/320, 768/240)) = floor(min(4.269, 3.2))
= 3`, independent of `devicePixelRatio`.

The sentence immediately below the table already says so — *"The 'before' column is
DPR-independent because the pre-CR2-003 code fed `calculateViewport` CSS pixels directly
(`floor(min(1366/320, 768/240)) = 3` at every DPR)"* — so the table and its own explanatory
paragraph state different things about the same column.

**Cause.** `docs/BUGFIX_SPEC_V3.md` §4.1 carried a correct five-column table with separate
*before* and *after* columns. Condensing it to four columns for `SPEC.md` dropped the *before*
column and left the *after* values under the *before* header. The source table is still correct;
only the copy in `SPEC.md` is wrong.

**Why this matters more than a typo.** `docs/SPEC.md` is the architectural source of truth this
project audits against, and this table is the recorded justification for a deliberate,
user-visible rendering trade-off on target hardware. A reader checking whether CR2-003 was worth
its cost reads a table saying the *old* behavior varied with DPR — the opposite of the actual
argument, whose whole force is that the old behavior was DPR-blind. CR3-005 and CR3-006 existed
to stop records from disagreeing with reality; this reintroduced the same failure into a
higher-authority document than either of them touched.

**Design decision:** restore the five-column form from `docs/BUGFIX_SPEC_V3.md` §4.1, with both
column headers spelled out rather than left as a bare `after`:

| DPR | device px per logical px (after) | CSS px per logical px (before) | CSS px per logical px (after) | on-screen game size |
| --- | --- | --- | --- | --- |
| 1 | 3 | 3 | 3 | unchanged (960×720 CSS) |
| 1.25 | 4 | 3 | 3.2 | **larger** (960×720 → 1024×768 CSS) |
| 1.5 | 4 | 3 | 2.67 | **smaller** (960×720 → ≈853×640 CSS) |
| 2 | 6 | 3 | 3 | unchanged (960×720 CSS) |

Two columns are the minimum that can express the comparison the table exists to make; condensing
below that is what caused the error, so the fix is not a relabel of the surviving column but a
restoration of the one that was dropped.

Also correct `853` to `≈853`: the probe gives `853.3` CSS pixels, and an unqualified `853` in a
spec invites a future reader to treat it as an exact figure the code will reproduce.

Regenerate every value against the real functions while making this edit rather than transcribing
from either existing table — the transcription step is precisely what failed here.

## 2. Test-coverage gaps

### 2.1 Nothing in the repository detects a transposed pointer viewport

**Files:** `src/app/shell/use-shell-input.ts` (`pointerViewportPhysicalSize`),
`src/app/shell/use-shell-input.test.ts`

**Current state.** CR3-003's test drives its helper with a square fixture:

```ts
const pointerPath = pointerViewportPhysicalSize({ clientWidth: size, clientHeight: size }, dpr);
```

Because `clientWidth === clientHeight` in every case, swapping the two inside the helper is
invisible. Probed by transposing them and running the full suite:

```
--- MUTATION: pointer viewport transposed ---
passing: 416
NO FAILURES ANYWHERE IN THE 416-TEST SUITE
```

**Why this matters.** The transposed size is not a cosmetic difference — it changes both the scale
and the letterbox origin the pointer is mapped through. At 1366×768:

```
correct    1366x768 -> {"scale":3,"x":203,"y":24}
transposed 768x1366 -> {"scale":2,"x":64,"y":443}
```

`physicalToLogical` divides by that scale and subtracts that origin, so every pointer coordinate
in a pointer-aimed game (Missile Defense's cursor) would land somewhere else entirely. This is
the exact misalignment class CR-004 was raised to fix and CR2-003 was careful to preserve, and it
is currently unguarded: the helper is small enough that a future edit swapping two adjacent
near-identical lines is a realistic mistake, and the suite would stay green.

**Secondary defect in the same test.** Its name claims *"the pointer path's sizing agrees with
the render path's"*, but it never calls the render path. It re-implements it inline as
`devicePhysicalSize(size, dpr)`, so it compares the pointer helper against a hand-written
expression rather than against `resizeCanvasToDevicePixels`. Probed by breaking the real render
path (`round` → `floor`, which genuinely diverges the two paths at fractional DPR):

```
not ok 13 - CR3-002 resizes the backing store to round(client x dpr) at each supported DPR
ok  69 - CR3-003 the pointer path's sizing agrees with the render path's ...
```

The invariant is not left entirely unguarded — CR3-002's test independently pins the render path
to `round(client × dpr)` — but it is guarded by a different test than the one whose name and
whose TODO criterion (*"a test asserts the render and pointer sizing expressions agree"*) claim
to guard it. Two tests that each pin one side to the same literal are not the same as one test
that pins them to each other: the former passes if both sides are changed together, which is
exactly the drift CR2-003's design note warns about.

**Intended behavior:** a single test compares the two real implementations against each other,
with a fixture that can tell width from height.

**Design decision:** rewrite the agreement test to call both real functions:

```ts
const canvas = new FakeCanvas(cssWidth, cssHeight);
resizeCanvasToDevicePixels(canvas, dpr);
const pointer = pointerViewportPhysicalSize({ clientWidth: cssWidth, clientHeight: cssHeight }, dpr);
assert(pointer.width === canvas.width && pointer.height === canvas.height, ...);
```

and drive it with **distinct** width and height at every DPR. Use asymmetric pairs throughout
(1366×768, 640×480, 3×4, 0×1 …), never `size × size`. With both sides going through their real
implementations, the test now fails if either path changes without the other — which is the
invariant, not a proxy for it.

This test belongs in `src/app/shell/pointer-viewport.test.ts` (the file §3.1 creates), importing
`resizeCanvasToDevicePixels` from `./canvas-resize.js` as the render-path reference. `FakeCanvas`
in `canvas-resize.test.ts` is not exported and should stay that way — a test file is not a
fixture library — so declare a minimal local `ResizableCanvas` fake here instead. It needs only
`clientWidth`/`clientHeight`/`width`/`height`; the assignment spy is `canvas-resize.test.ts`'s
concern, not this test's, which reads the resulting size rather than counting writes.

Keep the existing zero-box floor test; it is correct and independently useful.

### 2.2 The mixed-dimension resize branch is untested

**Files:** `src/app/shell/canvas-resize.ts`, `src/app/shell/canvas-resize.test.ts`

**Current state.** All four CR3-002 fixtures have *both* dimensions matching the target or
*neither*. No test covers one dimension already correct while the other is stale, so the
conjunction in the unchanged-check is unpinned. Probed by weakening it:

```
--- MUTATION: && changed to || in the unchanged check ---
  => *** NOT CAUGHT ***
```

Under `||`, `resizeCanvasToDevicePixels` returns `false` as soon as *either* dimension already
matches, leaving the other stale.

**The shipped code is correct.** Probed directly against the real helper:

```
[probe] mixed case -> resized=true size=1400x768 (expected true 1400x768)
```

So this is a coverage gap, not a bug — but a reachable one. A window widened without being made
taller (a side panel opening, a horizontal drag, a rotation on a device that reports one axis
unchanged) produces exactly this state: `clientWidth` changed, `clientHeight` did not, target
height already equals current height.

It slipped through because CR3-002's acceptance enumerated four specific scenarios rather than
naming the behavior, and the mixed case was not among the four. That is a lesson about how the
criterion was written, not about the implementer — see §4.

**Design decision:** add a mixed-dimension case in **both** orders — width stale with height
already correct, and height stale with width already correct. One order alone would leave the
mirrored mistake (`canvas.width === targetWidth || …` vs `… || canvas.height === targetHeight`)
uncaught, and asserting only the returned flag is not enough: assert the resulting `width`/
`height` too, so a resize that fires but writes the wrong dimension is caught with it.

## 3. Consistency and code quality

### 3.1 `pointerViewportPhysicalSize` sits in a React hook module, breaking the pattern it cites

**Files:** `src/app/shell/use-shell-input.ts`, `src/app/shell/use-shell-input.test.ts`

The helper's own doc-comment says it was *"pulled out so it is directly testable … without a
DOM"*, mirroring `createPointerBoundsResolver`. But that helper (CR2-012) lives in its own
`pointer-bounds.ts`, and CR3-002's `resizeCanvasToDevicePixels` lives in its own
`canvas-resize.ts`, whereas this one was left inside `use-shell-input.ts` — whose first line is
`import { useEffect, type RefObject } from "react"`.

The consequence is that `use-shell-input.test.ts` pulls React, the shell controller, the input
bridge, the audio-unlock module and the pointer-bounds resolver into the test runner's import
graph in order to exercise four lines of arithmetic. It works, and it is not a bug; it is a
deviation from a two-instance precedent the code itself claims to be following.

**Design decision:** move `PointerBoundsSize` and `pointerViewportPhysicalSize` into
`src/app/shell/pointer-viewport.ts`, alongside `canvas-resize.ts` and `pointer-bounds.ts`.
`use-shell-input.ts` imports it, exactly as it already imports `createPointerBoundsResolver` —
imported, not re-exported. This is a pure move: no identifier, expression, or behavior change.
`use-shell-input.ts`'s `devicePhysicalSize` and `Size2D` engine imports go with the helper, since
nothing else in that file uses them; `calculateViewport` stays.

**The test file moves with it.** `use-shell-input.test.ts` contains only the two CR3-003 cases,
both exercising `pointerViewportPhysicalSize` — verified: nothing in the repository tests
`useShellInput` itself, which is deliberate, as the hook is DOM-coupled and this project has no
jsdom. Since the helper is imported rather than re-exported, leaving the test file where it is
would break its import outright; and even repointing the import in place would leave a file named
for a module it no longer exercises, which is the same colocation inconsistency this task exists
to remove. So the two cases move verbatim into `src/app/shell/pointer-viewport.test.ts` and
`use-shell-input.test.ts` is deleted, matching the `pointer-bounds.ts`/`pointer-bounds.test.ts`
and `canvas-resize.ts`/`canvas-resize.test.ts` pairing.

Doing this **before** §2.1 avoids writing the new agreement test against an import path that is
about to change.

### 3.2 `ScoreCommitter`'s documented guarantee is broader than its implementation — decision required

**File:** `src/engine/scores/score-committer.ts`

`docs/BUGFIX_SPEC_V3.md` §1.1 states the intended behavior as *"No input to `handle` — including
a failure in the failure handler — can propagate out of `handle`."* That is not what ships. The
third collaborator, the game-supplied `readTerminalScore`, is called before the `try` and escapes:

```
[probe] readTerminalScore throw escaped handle(): reader blew up
[probe] after reader threw once, later frame still submitted: submits=1
```

**Not reachable today.** All ten games construct their committer with `terminalScoreOfType`,
whose body is a single `events.find(...)` over the frame's own event array — it cannot throw for
any input the runtime produces. Verified across all ten `score-submission.ts` files.

**Design decision (default: A):**

- **A — narrow the documented guarantee to match the code.** State that `ScoreCommitter` contains
  failures of the *score store* and of the *error reporter*, and that a throwing
  `readTerminalScore` is a programming error in the game's own reader which is deliberately
  allowed to surface. *Recommended.* The distinction is principled rather than convenient:
  `submit` and `reportError` fail for environmental reasons (a full disk, a corrupt store, a
  broken logger) that a playable run must survive, whereas a reader that throws is a bug in game
  code, and hiding it would mean the run silently never scores. Containing it also has no good
  resting state — setting `submitted` would discard a legitimate score on a transient fault, and
  leaving it clear would re-invoke the broken reader every frame at 60 Hz and, if it were routed
  to `reportError`, spam the log at the same rate.
- **B — extend containment to `readTerminalScore`.** Uniform, and closes the guarantee as
  written, at the cost of converting a loud game-code bug into a silent no-score run and
  requiring an answer to the `submitted`/retry question above.

Either way the code and the documentation must agree; today they do not, which is the actual
defect. Option A is a comment-and-spec edit with no behavior change.

## 4. A new cross-cutting rule

Findings §2.1 and §2.2 are the same mistake in two places, and round 3 contained a third instance
of it that was caught before shipping (CR3-004's original positional-slice test, which could not
have satisfied its own "adding a tunnel to Fern Gate must fail this test" criterion). Three
instances in one round is a pattern, not bad luck, and both surviving instances passed review at
the time because the test *name* described the right invariant.

The common shape: **a test that pins a two-sided invariant, written so that it cannot distinguish
the two sides.** A square fixture cannot distinguish width from height. A re-implemented
expression cannot distinguish the real render path from a copy of it. A positional slice cannot
distinguish a room inside it from a room outside it.

**Rule, to be added to `docs/BUGFIX_TODO_V4.md`'s cross-cutting acceptance:**

> A test that asserts two things agree must exercise both through their real implementations, and
> must use a fixture whose values can tell them apart — asymmetric sizes, distinct ids, different
> orders. Re-implementing one side inside the test, or driving it with a symmetric fixture, makes
> the test pass for a reason other than the invariant. Confirm this by mutating one side and
> watching the test fail; a mutation the test survives means the test is not pinning what its
> name says.

This generalizes the verification discipline both prior rounds already require (revert the fix,
watch the test fail) to the case where there is no fix to revert because the code is already
correct and only the guard is missing.
