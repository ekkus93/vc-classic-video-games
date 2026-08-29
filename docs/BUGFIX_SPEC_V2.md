# Bugfix Remediation Spec — round 2

Design source of truth for `docs/BUGFIX_TODO_V2.md`. Source: code review of the round-1
remediation (`docs/BUGFIX_TODO.md`, CR-001 – CR-025), conducted 2026-08-28 against `master` at
`a2caab1`. Every finding below was verified by reading the shipped code and, where the behavior
was in doubt, by running a probe against the simulation; the evidence is cited inline.

Sections mirror `docs/BUGFIX_SPEC.md`: §1 player-facing bugs, §2 latent correctness, §3 code
quality. Items marked **decision required** carry a default recommendation; the task in the TODO
is `[!]` until the decision is confirmed.

---

## 1. Player-facing bugs

### 1.1 Deep Digger high scores are never visible in the launcher

**Files:** `src/games/deep-digger/module.ts:209`, `src/games/deep-digger/score-submission.test.ts:25`,
`src/app/shell/controller.ts:438`

**Current behavior:** Deep Digger submits its terminal score with
`mode = this.runDifficulty` (`"survey"` / `"bore"` / `"mantle"`). The other nine games submit
`mode: "default"`. The launcher's high-score query is hard-coded to `mode: "default"` and passes
difficulty as its own column. Deep Digger's scores are therefore written under a mode nothing ever
reads, and its high-score view is always empty.

This was deliberate: the P14 test asserts `mode === "bore"` with the message "difficulty must
scope the score mode". But difficulty scoping already happens one layer down —
`PersistentScoreService.submit` (`src/engine/scores/scores.ts`) attaches the run's difficulty to
every submission before it reaches the repository — so the game-level scoping was redundant, and
the launcher never agreed to it. CR-016 preserved this as "behavior-preserving"; it preserved a
bug. The P14 acceptance doc's manual item "confirm the difficulty-scoped high score is visible
after returning to the launcher" would have caught it and was never run.

**Intended behavior:** Deep Digger's high scores appear in the launcher, scoped by difficulty the
same way every other game's are.

**Design decision:** Submit `mode: "default"`. Rewrite the P14 test to assert what is actually
true: the submission's mode is `"default"`, and difficulty reaches the repository through the
score service (an engine-level concern, already covered by `p5.test.ts`). Do not add a
game-specific mode concept; there is no second mode in Deep Digger to distinguish.

`ScoreCommitter.handle`'s `mode` parameter becomes unused by every game after this. Keep it — it
is the right shape for a game that does have modes — but its default is now the only value in use.

Persisted scores already written under `"survey"` etc. stay invisible. No migration: the app has
not shipped and the score file is a development artifact. State this in the commit message so it
is a recorded choice, not an oversight.

### 1.2 A landed Deep Digger rock never re-checks its support

**File:** `src/games/deep-digger/simulation.ts` (`advanceRock`, `landRock`)

**Current behavior:** `advanceRock` returns immediately for a `"resting"` rock. Only
`"supported"` rocks are checked for an open cell beneath. Two consequences, both probed:

- Rock A falls onto supported rock B and comes to rest. Dig out B's support; B falls to the floor.
  A stays `"resting"` where it was, above an open tunnel with nothing beneath it.
- Dig directly under a rock that has already landed once: nothing happens. The design doc says
  rocks "become unstable as soon as the cell below them is excavated"
  (`docs/games/DEEP_DIGGER_DESIGN.md:23`); the code applies that only to a rock's first fall.

Pre-existing, not caused by CR-009 — B was `"supported"`, not `"falling"` — but CR-009 is what
makes rocks stack, so the shipped column-18 pair now reaches it.

**Intended behavior:** A rock with an open cell beneath it and no rock there is unstable,
whether or not it has fallen before. A rock resting on another rock falls when that rock leaves.

**Design decision:** Run the support check for `"resting"` rocks exactly as for `"supported"`
ones (same shake delay, same `rock-loosened` event). Keep the `"resting"` state — the renderer
and two `rock-timing` tests distinguish it — it just stops being terminal.

Scoring must change with it. `landRock` pays `cellsFallen × rockDropPerCell` and never resets
`cellsFallen`, so a second fall would pay for the first one again. Reset `cellsFallen` to 0 in
`landRock` after the `rock-landed` event has been emitted; each landing then scores only its own
fall, and the event still reports that fall's distance. No other consumer reads `cellsFallen`
across landings (`grep cellsFallen src/games/deep-digger` — simulation and its tests only).

### 1.3 Viewport integer scaling ignores `devicePixelRatio`

**Files:** `src/app/App.tsx` (CR-005 present loop), `src/app/shell/use-shell-input.ts` (CR-004
pointer bounds), `src/engine/input/pointer.ts`, `src/engine/render/viewport.ts`

**Current behavior:** The present loop sizes the visible canvas's backing store to
`clientWidth × clientHeight` — CSS pixels — and `calculateViewport` computes its integer scale in
that space. Nothing in `src` reads `window.devicePixelRatio`. On a display with fractional
scaling (1.25× and 1.5× are common Chromebook settings), a "3×" CSS scale is 3.75× or 4.5× device
pixels: logical pixels come out uneven widths. `image-rendering: pixelated` on `.game-viewport`
stops the browser blurring the upscale but cannot make it integer. P3-005's goal — integer
nearest-neighbor on target hardware — is met only at DPR 1.

CR-005's acceptance is satisfied (production goes through the tested path); the path is fed the
wrong size.

**Intended behavior:** The backing store is sized in device pixels, the viewport is computed in
device pixels, and pointer input is mapped through that same viewport, so `integerScale` means
integer *on the panel*.

**Design decision:** Physical space is device pixels, end to end.

- **Present loop:** each frame, `target = round(client × devicePixelRatio)` for width and height;
  resize the backing store when it differs (this also absorbs browser-zoom changes, which alter
  `devicePixelRatio` without a resize event); call `presentFramebuffer` with the backing-store
  size. The CSS box is untouched, so the browser maps backing store to panel at exactly `1/dpr`.
- **Pointer:** `BrowserPointerAdapter` gains a `devicePixelRatio: () => number` option (default
  `() => 1`, preserving current behavior for existing callers and tests) and multiplies the
  client-relative offset by it before `physicalToLogical`. `use-shell-input.ts`'s `viewport()`
  computes `calculateViewport(logical, bounds.client × dpr)` — the identical size the present loop
  uses — and passes `() => window.devicePixelRatio` to the adapter. Present and pointer now share
  one viewport by construction, not by coincidence.
- **Engine helper:** extract the sizing into a pure `devicePhysicalSize(cssSize, dpr)` in
  `viewport.ts` (rounding rule lives in one place) and have both callers use it.

Tests: `viewport.test.ts` gains 1366×768 at DPR 1, 1.25, 1.5, and 2, asserting `integerScale` and
that the resulting scale is an integer in device pixels at each. `pointer.test.ts` gains a DPR-2
case: a click at CSS (160, 120) on a 320×240 CSS canvas maps to logical (160, 120), and the
existing DPR-1 cases are unchanged. `docs/SPEC.md` §(viewport scaling) states that scaling is
computed in device pixels.

### 1.4 Sun Shrine's tunnel floor ends mid-room under a full-width tunnel backdrop — decision required

**Files:** `src/games/jungle-quest/world.ts` (`shrine-tunnel`, `0..112` at y=226),
`src/games/jungle-quest/module.ts` (`fillRect(0, TUNNEL_BAND_TOP, width, 42, palette.tunnel)`)

**Current behavior:** The tunnel *floor* runs x=0..112; the tunnel *backdrop* is painted across
the whole room. The passage looks continuous and is not. Probed: enter Sun Shrine's tunnel from
Root Vault (x=6, feet at 226) and hold right — the player walks off the floor at x≈117, falls
below the world, and loses a life in ~1.8 s with no hazard in sight. The `shrine-ascent` ladder at
x=82 is plainly the intended exit, but nothing marks that the floor stops.

This is the interior-platform-end cousin of the Echo Hollow bug fixed in round 1. The round-1
boundary sweep covers room edges only, so it cannot catch this.

**Intended behavior:** Whatever the tunnel does at x=112, the player can see it before it kills
them.

**Design decision (default: A):**

- **A — extend the floor to the room edge.** `shrine-tunnel` becomes `0..320`. Sun Shrine's east
  edge has no `next` room, so the existing world-edge clamp holds the player at x=315; the round-1
  boundary sweep and world tests cover it automatically. The tunnel becomes a dead-end passage
  whose only exit is the ladder — the same shape as Echo Hollow's west end, which already reads
  well. No new mechanism. *Recommended.*
- **B — make it a visible pit.** Keep the floor at 112 and stop the backdrop there, painting
  `palette.earth` from 112 to the room edge across the tunnel band, so the gap reads as a drop.
  Honest, but it plants an instant-death pit in the finish room a few pixels past the ladder.
- **C — leave it.** Only if it is a deliberate trap; the design doc does not say so.

Either A or B gets a regression test: hold right from the tunnel entry for 4 s and assert no life
is lost (A) or that the death is preceded by an on-screen gap (B). Add an interior-platform-end
sweep to `world.test.ts` in the same change: for every platform end that is not at a room edge,
walking off it must either land on another platform or fall into a region the renderer paints as
open — so the next unmarked drop announces itself.

## 2. Latent correctness

### 2.1 `ScoreCommitter` contains rejections but not synchronous throws

**File:** `src/engine/scores/score-committer.ts`

`handle` does `void this.scores.submit(...).catch(reportError)`. A `submit` that throws
*synchronously* (a malformed submission, a repository that validates before returning a promise)
escapes `handle` and into the game's `update`, where the runtime treats it as a game failure.
Every round-1 copy had the same shape, so this is not a regression, but "rejected persistence is
contained" is the documented guarantee and it has a hole.

**Design decision:** Wrap the call so both paths reach `reportError`:
`try { promise = this.scores.submit(...) } catch (e) { reportError(e); return }` then
`void promise.catch(reportError)`. `submitted` stays `true` either way — a throw is a failed
attempt, not a reason to retry. Test: a `ScoreService` whose `submit` throws synchronously; assert
`handle` returns normally, the error reaches the reporter once, and a second terminal frame does
not retry.

### 2.2 `emergencyClearedWaveThisUpdate` is set on charge spend, not on wave clear

**File:** `src/games/star-defender/simulation.ts` (`handleEmergency`, `resolveWaveClear`)

The flag is set the moment a charge is consumed. Today that is equivalent to "the burst cleared
the wave" because `handleEmergency` unconditionally empties `enemyState`, but the name promises a
condition the code does not check, and a future change to the burst (partial wipe, off-screen
survivors) would silently withhold the refund for a wave a lance actually cleared.

**Design decision:** Rename to `emergencyFiredThisUpdate` and update the comment to say what it
means and why that suffices today. No behavior change; the CR-006 tests cover both branches and
must pass untouched.

### 2.3 Maze Chase compound-tick ordering is a pin, not a decision — decision required

**File:** `src/games/maze-chase/simulation.ts` (`update`: `resolveCollisions` then
`resolveLevelClear`)

CR-014 asked that the tick which both empties the field and lands the runner on a sentinel be
"well-defined". It is, and the test pins the current order: the hit resolves first (life lost,
actors reset), then the level clears (actors reset again). Nothing in
`docs/games/MAZE_CHASE_DESIGN.md` chooses that order; it was whatever the code did.

**Design decision (default: keep):**

- **Keep hit-then-clear.** Contact is contact; the design doc says unpowered contact "costs a
  life". Consistent, already tested, no change. *Recommended, on the grounds that the round-1
  test documents it and changing scoring rules should be a design act, not a review side-effect.*
- **Switch to clear-then-hit.** Emptying the field ends the level, and a level that has ended has
  no sentinels to touch. More generous; matches the arcade convention that eating the last dot
  completes the round. Requires flipping the CR-014 assertions and a design-doc sentence.

Whichever is chosen, `MAZE_CHASE_DESIGN.md` gains one sentence stating it, so the next reviewer
does not have to guess again.

### 2.4 Dead `"shaking"` branch in the per-tick rock/player contact check

**File:** `src/games/deep-digger/simulation.ts` (`updateRocks`, CR-010)

`resolveRockPlayerContact` runs for rocks in `"shaking"` or `"falling"`. A shaking rock is still
in its original earth cell, and `isRockAt` (with no `ignoredRockId`) blocks the player from
entering any non-falling rock's cell, so the player can never be in a shaking rock's cell. The
branch is unreachable. Harmless, but the comment claims it matters.

**Design decision:** Check `"falling"` only, and say in the comment why `"shaking"` needs no
check. Add a one-line test that a player walking into a shaking rock's cell is blocked, not hit —
which is the invariant that makes the branch dead.

## 3. Code quality

### 3.1 Jungle Quest is written one statement per line, minified

**Files:** `src/games/jungle-quest/{simulation,player,world,module,effects}.ts` and every
`*.test.ts` beside them

Methods are single 300-character lines; test cases are single 900-character lines. Round 1 added
to these files in the local style, which was the right call for a bugfix, and it made every one of
those diffs hard to review. `scripts/format.mjs` does not reflow code, so this will not fix
itself.

**Design decision:** One mechanical reformat commit, by hand, to the style the other nine games
use — one statement per line, standard indentation. No identifier, expression, or statement-order
changes. Acceptance is behavioral: the full test suite passes before and after with the same test
count, and the commit touches only Jungle Quest files. Do it *after* §1 and §2, so nothing
substantive is in flight in those files at the same time.

### 3.2 Every migrated `effects.ts` redeclares the burst-style shape

**Files:** `src/games/{barrel-climber,river-hopper,space-rocks,star-defender}/effects.ts`

Each declares a local `BurstStyle` / `Burst` interface identical to
`Omit<ParticleBurst, "x" | "y">`. CR-017 extracted the mechanism and left the shape behind.

**Design decision:** Export `ParticleBurstStyle = Omit<ParticleBurst, "x" | "y">` from
`src/engine/effects/particle-burst.ts` (and `src/engine/index.ts`); delete the four local copies.
Type-only change; effects tests must pass untouched.

### 3.3 `drawSealedPassages` is exported from `module.ts` as a test seam

**File:** `src/games/jungle-quest/module.ts`

The round-1 render test needed a way to call the cap-drawing code without driving a full run, and
the cheapest seam was to export it from the module file. Module files otherwise export only the
`GameModule`.

**Design decision:** Move the room-drawing helpers (`drawPlatform`, `drawHazard`, `drawRelic`,
`drawPlayer`, `drawSealedPassages`, `TUNNEL_BAND_TOP`, `platformEdgeColor`) into
`src/games/jungle-quest/render.ts`, matching the games that already separate rendering; the test
imports from there. Fold into 3.1's reformat if convenient, since the same lines move.

### 3.4 Pointer-bounds `querySelector` runs on every pointer event and every `viewport()` call

**File:** `src/app/shell/use-shell-input.ts`

`resolvePointerBoundsElement` is a DOM query. It runs per pointer event (via the adapter) and per
`viewport()` call. Cheap on a one-canvas page, but it is a per-frame DOM query in the input path
for no reason the element could change between two frames of the same game screen.

**Design decision:** Cache the resolved element and invalidate on screen change (the effect
already re-runs when `shellState.screen` changes). Keep the `?? surface` fallback. No behavior
change; the CR-004 pointer test must pass untouched.

### 3.5 CR-015's tie-clash test accepts a range where the mechanism supports an exact number

**File:** `src/games/sky-riders/simulation.test.ts`

The test asserts `clashes <= 2` across a separation. With the fix, a stationary tie produces
exactly one clash on the collision frame and, on the fixed seed used, exactly one re-approach
clash. A tolerance hides a regression that adds a third.

**Design decision:** Assert the exact count the fixed seed produces, with a comment naming the
seed and that the second clash is the pursuit re-approach. If a later physics change alters the
count legitimately, the test should fail and be re-pinned on purpose.
