# Bugfix Remediation Spec — round 3

Design source of truth for `docs/BUGFIX_TODO_V3.md`. Source: code review of the round-2
remediation (`docs/BUGFIX_TODO_V2.md`, CR2-001 – CR2-013), conducted 2026-08-29 against `master`
at `bac782a`. Every finding was verified against the shipped code by running a probe or a
mechanical comparison, not by reading commit messages; the evidence is cited inline.

This round is small and mostly consolidating. Round 2's fixes hold up: the CR2-009 reformat was
verified token-identical across all seven source files, CR2-011's file split was verified to change
no drawing constant, and CR2-002 was probed past its own tests (bottom-row landing, two-fall
scoring, at-rest stability) without finding a defect. What follows is one real correctness gap, one
unmet acceptance criterion from round 2, and four consistency/staleness items.

Sections: §1 correctness, §2 test-coverage gaps, §3 consistency and staleness, §4 manual
verification. Items marked **decision required** carry a default recommendation; the task in the
TODO is `[!]` until the decision is confirmed.

---

## 1. Correctness

### 1.1 `ScoreCommitter`'s containment is still asymmetric: a throwing `reportError` escapes

**File:** `src/engine/scores/score-committer.ts` (`handle`)

**Current behavior:** CR2-005 closed the case where `scores.submit` throws synchronously. It did
not close the case where `reportError` — the game-supplied handler that failure is routed to —
throws. The two paths now behave differently:

```
syncPath_reporterThrows_escaped=bad reporter     <- escapes handle(), reaches the game's update()
asyncPath_reporterThrows_escaped=none            <- becomes an unhandled rejection instead
```

(Probed directly against the shipped class.)

This matters because `ScoreCommitter` exists for exactly one guarantee — a failing score store must
not take a playable run down with it — and CR2-005 was the task that asserted that guarantee. The
sync path now leaks through a door the async path doesn't, so the class is inconsistent with itself
and with its own documentation.

Reachability is low but real. Six of the ten game handlers interpolate `String(error)`:

```ts
services.logger.warn(`Deep Digger score persistence failed: ${String(error)}`);
```

`String()` is safe for a Symbol (verified: `String(Symbol("x"))` returns `"Symbol(x)"` rather than
throwing — an earlier draft of this finding claimed otherwise and was wrong). It does throw for a
null-prototype object and for any value whose `toString` throws:

```
String(Object.create(null))     -> THROWS TypeError
String({toString(){throw ...}}) -> THROWS Error
```

So a `ScoreService` that rejects with, or throws, such a value turns a contained persistence
failure into an escaped game failure. A broken `logger` would do the same.

**Intended behavior:** No input to `handle` — including a failure in the failure handler — can
propagate out of `handle`.

**Design decision:** Wrap every `reportError` invocation, on both paths, and swallow a throw from
it. Swallowing is the right terminal behavior specifically here: the reporter *is* the error
channel, so if it fails there is nothing left to report to, and the only alternatives are escaping
into gameplay (the bug) or recursing into the same broken reporter. Make the async path swallow
too, so "contained" means the same thing on both — today it merely relocates the failure to an
unhandled rejection, which is not containment in any useful sense, just a quieter leak.

Do **not** change the ten game handlers to a safer stringifier as part of this. `ScoreCommitter`
must be robust to a hostile handler regardless of what the current handlers happen to do;
hardening the callers instead would leave the class's guarantee resting on caller discipline.

Test: a `ScoreService` that throws synchronously *and* a reporter that throws, asserting `handle`
returns normally; the same for the rejection path, asserting no unhandled rejection escapes and
`handle` still returns normally. Both must fail against the pre-fix code.

## 2. Test-coverage gaps

### 2.1 CR2-003's backing-store resize has no test, and its acceptance criterion said it would

**Files:** `src/app/App.tsx` (present loop), `src/app/App.test.ts`

**Current behavior:** CR2-003's acceptance criteria required, verbatim:

> `App.test.ts` (or the present-loop test added in CR-005) asserts the backing store is resized to
> `round(client × dpr)`

Nothing asserts this. `grep` finds no test in the repository touching the present loop; the
parenthetical fallback does not exist either, because CR-005 never added such a test. CR2-003 was
nonetheless marked `[x]`. The sizing *rule* is well covered (`devicePhysicalSize` has its own unit
tests, and `viewport.test.ts` covers 1366×768 at four DPRs); the *DOM glue that applies it* is not,
so a transposition like `canvas.width = targetHeight` would ship green.

This is the same failure mode round 1's review found and this project has now hit twice: a task
marked complete with a named acceptance artifact missing, the gap explained in a commit message
rather than surfaced in the TODO.

**Intended behavior:** The resize decision — read the CSS box, convert to device pixels, assign
only when it actually changed — is covered by a test, without adding a browser-DOM test
environment.

**Design decision:** Extract the glue into a pure-ish helper in `src/app/shell/` taking a minimal
structural canvas type, exactly mirroring what CR2-012 already did for `createPointerBoundsResolver`:

```ts
export interface ResizableCanvas {
  readonly clientWidth: number;
  readonly clientHeight: number;
  width: number;
  height: number;
}
export function resizeCanvasToDevicePixels(canvas: ResizableCanvas, devicePixelRatio: number): boolean;
```

It returns whether it resized, so a test can assert the "only when changed" behavior directly
rather than inferring it. `App.tsx`'s present loop calls it and is left as a thin caller, the same
shape `use-shell-input.ts` now has around `createPointerBoundsResolver`.

**Explicitly rejected: adding jsdom.** It is a substantial dependency for one call site, this
project has deliberately run a hand-rolled Node test runner with no DOM (`scripts/test.mjs`,
`CLAUDE.md`), and the structural-fake pattern already exists in two places here. If a future task
genuinely needs to test React rendering or layout, that is the moment to reconsider — not this one.

Tests: resizes to `round(client × dpr)` at DPR 1, 1.25, 1.5, 2; does not touch `width`/`height`
when already correct (the returned flag and an assignment spy both confirm it); floors at one
device pixel for a zero-sized box; recomputes when only the DPR changes and the CSS box does not
(the browser-zoom case the present loop's comment claims to handle, which nothing currently
verifies).

## 3. Consistency and staleness

### 3.1 `devicePhysicalSize` is called inconsistently between the two CR2-003 paths

**Files:** `src/app/App.tsx`, `src/app/shell/use-shell-input.ts`

The render path passes the CSS size raw; the pointer path wraps it in `Math.max(1, …)`:

```ts
devicePhysicalSize(canvas.clientWidth, window.devicePixelRatio)              // App.tsx
devicePhysicalSize(Math.max(1, bounds.clientWidth), dpr)                     // use-shell-input.ts
```

They diverge at `clientWidth === 0` (render → 1, pointer → 2 at DPR 2; → 3 at DPR 3). A sweep of
six DPRs × ~250 realistic widths found **zero** divergences at any size ≥ 1, so this is not
reachable in practice. It is still worth removing: CR2-003's whole design claim is that the two
paths quantize identically *by construction*, and this is a seam in that construction that a future
edit could widen.

**Design decision:** Remove the redundant `Math.max(1, …)` from the pointer path.
`devicePhysicalSize` already floors at one device pixel and documents that it does; having one
caller pre-floor in CSS pixels and the other not is the actual inconsistency. One flooring rule, in
one place.

### 3.2 `P13-009`'s test name and assertion went stale under CR2-004

**File:** `src/games/jungle-quest/world.test.ts`

CR2-004 extended `shrine-tunnel` to the room's full width, so three rooms now carry a full-width
tunnel — `echo-tunnel`, `root-tunnel`, `shrine-tunnel`. The test still reads:

- name: `"P13-009 Echo Hollow and Root Vault expose a continuous lower tunnel route"`
- assertion message: `"alternate route must span the two middle rooms"`
- scope: `JUNGLE_QUEST_ROOMS.slice(1, 3)`

`docs/games/JUNGLE_QUEST_DESIGN.md` was updated by CR2-004 to say the route spans three rooms. The
doc and the test now contradict each other, and the test is the one a future reader will trust.

**Design decision:** Broaden the test to assert the route as it now exists — a contiguous run of
full-width tunnels from Echo Hollow through Sun Shrine — and rename it to match.

The mechanism matters, and an earlier draft of this section was ambiguous enough to prescribe a
test that could not do its job. The check must **derive** the set of rooms that actually carry a
full-width tunnel by scanning *every* room, then `assertDeepEqual` that derived list against the
pinned one:

```ts
const withFullWidthTunnel = JUNGLE_QUEST_ROOMS
  .filter((room) => room.platforms.some((p) => p.kind === "tunnel" && p.x1 === 0 && p.x2 === width))
  .map((room) => room.id);
assertDeepEqual(withFullWidthTunnel, ["echo-hollow", "root-vault", "sun-shrine"], "...");
```

What it must **not** do is what the current test does: take a positional slice of the room list
(`JUNGLE_QUEST_ROOMS.slice(1, 3)`) and assert the ids of the rooms inside it. A fixed-length slice
of the middle cannot notice a fourth room gaining a tunnel — Fern Gate sits at index 0, outside the
slice — so the "adding a tunnel to Fern Gate must fail this test" property would silently not hold.
Deriving-then-comparing catches a room gained *and* a room lost, in one assertion.

Because `JUNGLE_QUEST_ROOMS` is in chain order, `filter` preserves that order, so comparing against
an ordered pin also asserts the route is contiguous and runs in the direction the design doc claims
— no separate adjacency check is needed. Pinning the list rather than asserting a bare property is
the same reason CR-001's sealed-passage test pins its own list: a new dead end, or a vanished one,
should be a deliberate edit that fails a test, not something absorbed silently.

### 3.3 CR2-004's acceptance text describes a sweep that was not built

**File:** `docs/BUGFIX_TODO_V2.md` (CR2-004)

The acceptance says "the interior-end sweep passes for every room". What shipped is narrower: an
invariant that every *tunnel-kind* platform spans the room's full width. The reasoning is recorded
in the test's own comment and in `178c646` — a fully general "every platform end is safe to walk
off" sweep would have to special-case Fern Gate's ledge (a legitimate drop) and its chasm (a
legitimate, already-tested pit), and a check riddled with exceptions for real design is one that
rubber-stamps the next real hole.

That reasoning is sound and the narrower invariant is the right check. The defect is only that the
TODO still advertises the broader one, so the record disagrees with the code.

**Design decision:** Amend CR2-004's acceptance text in `docs/BUGFIX_TODO_V2.md` to describe the
tunnel-width invariant that shipped, with a one-line note of why the general sweep was rejected.
Do not weaken or re-scope the shipped test. Round-2 TODO entries are otherwise left as-is;
this edits a completed task's record because the record is what a future reviewer audits against.

### 3.4 The cross-cutting test rule contradicts two tasks' own acceptance criteria

**File:** `docs/BUGFIX_TODO_V2.md` (cross-cutting acceptance)

The cross-cutting rule reads:

> Every task in §1 and §2 adds a regression test that fails against the pre-fix code

CR2-006 (a field rename) and CR2-007 (a design-doc sentence plus a call-site comment) are both §2
tasks whose own acceptance says "no behavior change" and names no new test. A rename and a comment
have no behavioral regression to catch. The two rules contradict, and both tasks shipped following
the per-task rule.

**Design decision:** Amend the cross-cutting rule to carve out tasks that change no behavior,
requiring instead that such a task state in its acceptance *why* no regression test applies and
that the existing tests covering the touched code pass untouched. Carry the amended wording into
round 3's own cross-cutting section so the rule is right going forward, not just retroactively.

## 4. Manual verification

### 4.1 CR2-003 changes on-screen game size at fractional DPR — decision required

**File:** `docs/SPEC.md` §11.2

CR2-003 is working as designed, and that design has a visible consequence nobody has looked at on
hardware. Computing the integer scale in device pixels rather than CSS pixels changes how much of
the screen the game fills at a fractional `devicePixelRatio`. At 1366×768 CSS:

| DPR | device px per logical px (after) | before (CSS px per logical px) | after | on-screen size |
| --- | --- | --- | --- | --- |
| 1 | 3 | 3 | 3 | unchanged (960×720 CSS) |
| 1.25 | 4 | 3 | 3.2 | **larger** (960×720 → 1024×768 CSS) |
| 1.5 | 4 | 3 | 2.67 | **smaller** (960×720 → 853×640 CSS) |
| 2 | 6 | 3 | 3 | unchanged (960×720 CSS) |

Every row was produced by running the real `calculateViewport`/`devicePhysicalSize` rather than by
hand-arithmetic, so it can be quoted into `docs/SPEC.md` as-is without re-deriving. The "before"
column is DPR-independent because the pre-CR2-003 code fed `calculateViewport` CSS pixels directly:
`floor(min(1366/320, 768/240)) = 3` at every DPR.

At DPR 1.5 the game now occupies noticeably less of the panel, in exchange for each logical pixel
being exactly 4 device pixels instead of 4.5. That is precisely the trade `docs/SPEC.md` §11.2 asks
for ("Prefer integer nearest-neighbor scaling"), and 1.5× is a common Chromebook display setting,
so this is a real change to the shipped look on target hardware that has only ever been checked
arithmetically.

**Design decision (default: A):**

- **A — accept the trade and document it.** Add the table above to `docs/SPEC.md` §11.2 so the
  size change is a recorded consequence rather than a surprise, and add a line to
  `docs/P18_RELEASE_ACCEPTANCE.md`'s human-acceptance items to eyeball the game at a fractional
  DPR. *Recommended: it is what the spec already asks for, and the alternative reopens a decision
  P3-005 settled.*
- **B — prefer the larger fractional scale when the integer one loses more than a set fraction of
  the screen.** Keeps the panel filled at 1.5× at the cost of non-integer pixels, i.e. partially
  reverts CR2-003's goal. Needs a threshold nobody has a principled value for.

Either way this is a manual item: it cannot be settled from a test, only from looking at a
1.5×-scaled panel. Per this project's convention (`docs/P13_PLAYABLE_ACCEPTANCE.md`), leaving it
for the native-hardware pass is an acceptable completion basis as long as it is recorded there.
