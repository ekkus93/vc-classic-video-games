# Bugfix Remediation Spec

Source: full-codebase code review against `docs/TODO.md`, conducted 2026-08-28 (six parallel
audits covering P0–P18). This file is the design source of truth for *how* each issue found in
that review should be fixed. `docs/SPEC.md` remains the source of truth for overall architecture;
this file only specifies deltas to it (called out per-item below) plus fix behavior that doesn't
rise to an architecture change. `docs/BUGFIX_TODO.md` is the paired task list — same status
convention as `docs/TODO.md` (`[ ]`/`[~]`/`[x]`/`[!]`), stable IDs prefixed `CR-` (code review).

None of these were previously tracked in `docs/TODO.md`; several affect games whose phase tasks
are already marked `[x]`. Where a fix invalidates a prior `[x]`, `docs/BUGFIX_TODO.md` says so
explicitly and `docs/TODO.md` should be corrected once the fix lands (see CR-025).

## 1. Critical gameplay bugs

### 1.1 Jungle Quest: room transitions are unreachable through real input

**File:** `src/games/jungle-quest/simulation.ts:70-77`

**Current behavior:** The room-transition trigger fires when `x > logicalWidth + HALF_WIDTH`
(325), but the same function's boundary clamp forces `x` back into `[HALF_WIDTH,
logicalWidth - HALF_WIDTH]` = `[5, 315]` on every frame that hasn't triggered yet. Max run speed
(~1.27 px/frame at 60 Hz) can never close the resulting 10 px gap, so position converges to
exactly 315 (or 5) and sticks there. The player can never leave the starting room ("Fern Gate")
through real input. Three of four relics, the alternate tunnel route (P13-009), and the
completion condition (P13-007/008) are unreachable in shipped gameplay. The one existing test
that exercises a transition (`simulation.test.ts:12`) does so by constructor-injecting a
past-threshold `initialPlayer` position — something that never happens from a real checkpoint
start (`module.ts:31`).

**Root cause:** The clamp and the trigger threshold were written against different bounds and
nothing enforces `clamp bound < trigger threshold` reachable by one frame of movement.

**Intended behavior:** The clamp must not fight the trigger. The trigger check must run (and be
able to fire) before the clamp is applied for the frame in which the player crosses the room
edge, so `x` can genuinely exceed `logicalWidth + HALF_WIDTH` and cause a transition instead of
being clamped back every frame.

**Design decision:** Reorder `simulation.ts`'s per-frame update so the transition check runs
against the pre-clamp position, and only clamp the position that ends up *inside* the current
room (i.e. skip/relax the clamp entirely on the frame a transition fires, since the position is
about to be replaced by the new room's entry point anyway). Do not simply widen the room's play
field — that changes level geometry documented in `docs/P13_BARREL... ` (n/a) /
`docs/games/*` design docs and is out of scope for a bugfix.

**Regression test requirement:** A test must drive the transition via *held movement input*
across multiple simulated frames from a normal checkpoint-start position — not by constructor
injection past the threshold — to prove the fix actually works through real input and to prevent
this exact class of regression from being reintroduced silently (this is the same blind spot that
let the bug ship).

**Related, lower-confidence issue to verify once this is fixed:** `simulation.ts:82-85` re-awards
the checkpoint bonus and regresses the respawn point on *any* re-entry into a differently
checkpointed room, with no forward/backward distinction. This was unreachable while Bug #1 stood;
once fixed, add a test walking backward between checkpoint rooms to confirm score can't be farmed
(CR-024).

### 1.2 Jungle Quest: diagonal input at a ladder end permanently locks horizontal movement

**File:** `src/games/jungle-quest/player.ts:47-51, 74-80`

**Current behavior:** `stepLadder` sets `mode: "ground"` once `atEnd && vertical !== 0` (line
51). On the very next frame, `mode !== "ladder"` so the `mode === "ladder"` short-circuit at line
78 fails, but the separate `vertical !== 0 && activeLadder !== null` check at line 80 re-enters
the ladder every frame, snapping `x` back to the ladder column and returning before horizontal
movement code runs. Holding a diagonal (up+left, up+right, etc.) at a ladder's top or bottom
silently locks horizontal movement until the vertical input is released — normal input in a
controller-first app where diagonals are routine.

**Intended behavior:** Leaving the ladder via `atEnd` should be a one-way transition for that
input state: once `mode` becomes `"ground"`, horizontal input must take effect immediately even
while the vertical button is still held, and the ladder should not be re-entered unless the
player is actually re-approaching the ladder's trigger zone (the normal mount condition), not
merely because `vertical !== 0`.

**Design decision:** Gate ladder re-entry on the same mount-detection condition used for a fresh
mount (proximity/overlap with the ladder's trigger zone), not on `vertical !== 0` alone. Add an
explicit "just dismounted" one-frame (or until-overlap-clears) guard if needed to prevent
immediate re-snap in the same frame.

### 1.3 River Hopper: buffered hop chaining bypasses the water-hazard check

**File:** `src/games/river-hopper/simulation.ts:317-362` (`advanceHop`), `:403-418`
(`resolveRiverSupport`), `:420` (`resolveGoal`)

**Current behavior:** `resolveRiverSupport` early-returns whenever `this.activeHop !== null`.
`advanceHop` immediately chains a queued `bufferedDirectionValue` into a new `activeHop` the
instant the current hop lands — before `resolveRiverSupport` runs later in the same `update()`.
Chaining hops (holding or rapidly tapping a direction — ordinary play, not a technical exploit)
lets a player land on a river row with no platform underneath and immediately move again in the
same tick, so the water-hazard check for that landing row is never evaluated. Confirmed
reproducible: constructing a river lane with no platform near the player's column, buffering a
second hop before the first lands, results in no life lost and no `life-lost` event.
`resolveGoal` has the identical `activeHop !== null` gate, so a chained hop through the goal row
can also silently skip goal registration.

Note the asymmetry: `resolveRoadCollision` (`simulation.ts:391-401`) is *not* gated on
`activeHop` and correctly still catches a vehicle overlap mid-chain. Only the water hazard (and
goal detection) has this hole.

**Intended behavior:** The landed-on-row hazard/goal check must be evaluated against the position
the player just landed on *before* a buffered hop is allowed to chain into a new one, for every
row type — river and road should behave identically here, and they don't today.

**Design decision:** Evaluate `resolveRiverSupport` and `resolveGoal` against the just-landed
position at the point a hop completes, before `advanceHop` chains the buffered direction into a
new hop — i.e. run hazard/goal resolution synchronously as part of hop completion, not as a
separate later step in `update()` that a same-tick re-hop can outrun.

### 1.4 Pointer/mouse input is measured against the wrong DOM element

**File:** `src/app/shell/use-shell-input.ts:29-39`, `src/app/App.tsx:159-161`,
`src/app/styles.css:309-327`

**Current behavior:** `use-shell-input.ts` computes pointer coordinates against
`surface.clientWidth`/`clientHeight`, where `surface` is `<main class="app-shell">` — a padded
(`clamp(1rem, 3vw, 2.5rem)`), multi-row grid container including header/footer chrome — not the
actual `.game-screen` canvas box, which is separately centered (`margin: auto`,
`width: min(100%, calc(100vh * 4/3))`). `calculateViewport`/`physicalToLogical`
(`src/engine/render/viewport.ts`) are themselves correct and well-tested (P3-005/P3-006's cited
unit tests pass), but they're fed the wrong input box. Effect: pointer-aimed gameplay (Missile
Defense's cursor) is misaligned from the visible canvas whenever the shell has any padding, which
it always does in the shipped layout.

**Intended behavior:** Pointer coordinates must be measured against the actual rendered canvas
element's bounding box, not an ancestor container that includes unrelated chrome.

**Design decision:** Change the ref/element passed into the pointer-coordinate pipeline in
`use-shell-input.ts` to the `.game-screen` canvas element (or its immediate wrapper with no
extra padding) instead of `app-shell`. This is a narrow, low-risk fix — no changes needed to
`viewport.ts`/`physicalToLogical` themselves, both of which are already correct.

### 1.5 Production canvas scaling bypasses the tested viewport-scaling code

**File:** `src/app/App.tsx`, `src/app/styles.css:309-327`, `src/engine/render/viewport.ts`,
`src/engine/render/logical-framebuffer.ts`

**Current behavior:** `calculateViewport`'s integer-preferred/fractional-fallback algorithm
(P3-005) is implemented and unit-tested (including at 1366×768, the primary target resolution),
but production rendering doesn't use it — the canvas is scaled by browser CSS
(`aspect-ratio: 4/3`, `width/height: 100%`, `image-rendering: pixelated`) instead.
`presentFramebuffer`/`LogicalFramebuffer` are unused outside their own tests. This is a real gap
between what the test suite validates and what the app actually does; it also means the
integer-nearest-neighbor scaling behavior the spec calls for (crisp pixel-art scaling, no
fractional blur at exact-multiple sizes) isn't actually happening.

**Design decision — needs a call before implementation, default recommendation given:** Wire
production rendering through `calculateViewport`/`presentFramebuffer` so the tested code path is
the real one. This is the recommended default because it's what P3-004/P3-005 were built and
tested for, and CSS `image-rendering: pixelated` does not reproduce true integer-nearest-neighbor
scaling at fractional window sizes (it just disables bilinear filtering; it can still stretch
non-uniformly). If, after investigation, the CSS-based approach is judged good enough in
practice and the team prefers to keep it, the alternative is to formally retire
`presentFramebuffer`/`LogicalFramebuffer` as dead code and update `docs/SPEC.md`/`docs/TODO.md`
P3-004/P3-005 acceptance text to describe CSS-based scaling as the actual chosen approach instead
of the integer-scaling one currently documented. Either path is an architecture-level decision
and requires a `docs/SPEC.md` update per CLAUDE.md's own rule; do not silently pick one without
updating that doc.

### 1.6 Star Defender: the Emergency Burst never actually depletes

**File:** `src/games/star-defender/simulation.ts:625-657` (`handleEmergency`), `:861-882`
(`resolveWaveClear` refund path), `design.ts:36-37` (`maxEmergencyCharges`)

**Current behavior:** `handleEmergency` spends one charge and wipes the entire enemy wave
(`enemyState = Object.freeze([])`). `resolveWaveClear`, called later in the same `update()`, sees
`enemyState.length === 0` and refunds a charge (capped at `maxEmergencyCharges`). Net effect of
pressing the emergency button: the charge count stays flat or climbs toward the cap, while the
player still collects both per-enemy and wave-clear score. The "limited emergency action"
described in P15-005's acceptance never actually becomes limited under repeated use. An existing
test exercises 40 iterations of this without asserting charge depletion, so it went unnoticed.

**Intended behavior:** Using the Emergency Burst must be a genuine resource cost. A wave clear
caused by the emergency action itself must not refund the charge that caused it.

**Design decision:** Give `resolveWaveClear`'s refund logic a way to distinguish "wave cleared by
ordinary combat" from "wave cleared by the emergency action that just fired this tick" — e.g. a
one-tick flag set by `handleEmergency` that suppresses that specific refund path, cleared at the
start of the next `update()`. Do not remove the wave-clear refund mechanic entirely if it's
otherwise a deliberate combat-clear reward — only suppress it for the emergency-caused case.

### 1.7 Barrel Climber: a hazard can be vaulted and hit in the same frame

**File:** `src/games/barrel-climber/simulation.ts:230-254` (`resolveVaults`), `:69-80`
(`intersectsHazard`, used by `resolvePlayerHit` at `:256-274`)

**Current behavior:** The vault "feet above hazard" check
(`playerState.y <= hazard.y - hazardRadius + 1`) and the precise circle-rectangle hit check use
different geometric tolerances that overlap in a real band near minimum jump clearance (verified
numerically: for a representative hazard/player size, both conditions hold simultaneously for
horizontal offsets up to ~8px and ~2px of vertical margin above the vault threshold).
`resolveVaults()` runs before `resolvePlayerHit()` in `update()` (`simulation.ts:198-199`), so a
narrowly-cleared jump can be awarded the vault bonus and cost a life in the same call — the
opposite of "responsive" feedback. No test covers the narrow-clearance case; the existing vault
fixture uses generous (18px) clearance.

**Intended behavior:** Vaulting and being hit by the same hazard must be mutually exclusive for
any given hazard in a given frame.

**Design decision:** Make the hit check the single source of truth for "did this hazard touch the
player," and derive the vault condition as a strict subset of *not* intersecting (e.g. "feet were
above the hazard and the precise hit test is false"), rather than maintaining two independently
tuned geometric approximations. Concretely: compute `intersectsHazard` once per hazard per frame,
and only evaluate the vault "above" condition when it's `false`.

### 1.8 Deep Digger: wave clear silently discards an in-flight rock

**File:** `src/games/deep-digger/simulation.ts:605-632` (`resolveWaveClear`)

**Current behavior:** `resolveWaveClear` fires whenever `enemyState.length === 0` and
unconditionally rebuilds `rockState` from the level's spawn table via `populateActors()`,
discarding any rock currently `"shaking"` or `"falling"`, its `cellsFallen`, and any pending
score, with no event emitted. This is reproducible by killing the last enemy while a rock is
mid-fall. Notably, commit `53cff23` added a second enemy to a test fixture specifically to avoid
triggering `resolveWaveClear` while a rock is mid-fall — i.e. a prior change routed around this
interaction in the test suite rather than fixing it in production code.

**Intended behavior:** A wave clear must not destroy in-flight physical state that belongs to the
next wave's continuity in a way the player can't perceive or that discards earned/pending state
unexpectedly. At minimum, an in-flight rock should either be allowed to finish its fall (with its
outcome resolved) before the new wave's rocks populate, or its removal should be an intentional,
documented design choice with an emitted event — not a silent side effect of iteration order.

**Design decision:** Preserve rocks already `"shaking"`/`"falling"` across `resolveWaveClear`
instead of unconditionally discarding them; let them finish resolving (land/settle) using the
new wave's terrain once it's populated, or — if letting a rock fall into next-wave terrain is
judged too complex — explicitly settle/despawn the rock with its outcome resolved (score
tallied if it was already committed to hitting something) and emit an event for it, rather than
disappearing without a trace. Pick whichever is simpler to implement correctly and document the
choice in this file's tracked task.

### 1.9 Deep Digger: two falling rocks can occupy the same column simultaneously

**File:** `src/games/deep-digger/simulation.ts:660-667` (`isRockAt`)

**Current behavior:** `isRockAt` excludes *all* `"falling"` rocks from blocking, not just the
asking rock's own vacated cell. The shipped `ROCK_SPAWNS` table (`level.ts:47-53`) has two rocks
in the same column (column 18); if both become `"falling"` simultaneously they can overlap into
the same cell. Untested.

**Intended behavior:** A falling rock should only ignore its own previously-vacated cell for
blocking purposes, not every other falling rock's current cell — two rocks should not be able to
occupy the same cell at the same time.

**Design decision:** Change `isRockAt`'s exclusion to be per-rock (exclude only the calling
rock's own prior cell), not a blanket exclusion of every `"falling"` rock.

### 1.10 Deep Digger: falling-rock/player contact is only checked on cell-change ticks

**File:** `src/games/deep-digger/simulation.ts` (`resolveRockContacts`)

**Current behavior:** The player-vs-falling-rock contact check only runs right after a rock's
cell changes, not every tick. A rock idles for several ticks between 0.08s fall steps, during
which a player can walk into or out of its cell without being hit.

**Intended behavior:** A falling rock should be able to hit a player who walks into its cell at
any point while it occupies that cell, not only on the tick it just moved there.

**Design decision:** Run the player-contact check every tick a rock is `"falling"`/`"shaking"`
and occupying a cell, not only on cell-transition ticks.

## 2. Test-coverage gaps (implementation appears correct — close the gap, don't rewrite logic)

- **CR-011 / P2-001** — `src/engine/game/metadata.ts:89-93,168-170,216-219`: duplicate-value
  rejection (players/inputs/difficulties) has zero test coverage. Add tests asserting rejection
  for each duplicate-value case, alongside the existing duplicate-ID/malformed-field tests.
- **CR-012 / P5-008** — `src/engine/scores/scores.ts`: `parseScoreEntry`/`ScoreValidationError`
  correctly reject invalid `gameId`/malformed entries in code but are never exercised by a test.
  Add tests calling `parseScoreEntry`/`parseScoreDocument` directly with an invalid game ID and a
  malformed entry, asserting rejection.
- **CR-013 / P11-008** — `src/games/bug-barrage/simulation.ts:399,559-569`: the `maxChains`
  split-fallback branch and its `assertBounds()` throw path have no test. Add a test that drives
  chain count to the cap and exercises the fallback branch.
- **CR-014 / P10** — `src/games/maze-chase/simulation.ts:239-459`: no test covers a move that
  both empties the last collectible and lands the player on a non-vulnerable enemy in the same
  tick (life-loss reset immediately followed by level-clear reset). Add a fixture isolating this
  compound case, per the fixed-timestep fixture-isolation guidance in `CLAUDE.md`.
- **CR-015 / P12** — `src/games/sky-riders/simulation.ts:106,167-173`: no re-assertion of the
  `enemyState.length + stormSeedState.length <= maxEnemies` invariant after construction, and no
  multi-frame test for a stationary tie-bounce immediately re-clashing before separating past the
  overlap threshold. Add a runtime assertion (or comment justifying its absence) and a targeted
  test for the tie-clash re-entry case.

## 3. Architecture / duplication debt

### 3.1 `ScoreCommitter` is duplicated across all 10 games

**Files:** every `src/games/*/score-submission.ts`

The submit-once guard / async-rejection-containment class is byte-for-byte duplicated 10 times,
with zero shared abstraction in `src/engine/` — a direct violation of this repo's own stated rule
in `CLAUDE.md` ("shared behavior belongs in `src/engine/` only when it's intentionally reusable
across games").

**Design decision:** Extract a single `ScoreCommitter` (or equivalently-named) class into
`src/engine/scores/` (or a new `src/engine/score-submission/` module — match existing directory
conventions) with the same public shape every game currently hand-rolls: submit-once flag,
`handle(event)`/`reset()`, contained async rejection via `.catch()`. Migrate all 10 games'
`score-submission.ts` to import and use it instead of redefining it. This is a mechanical,
behavior-preserving refactor — existing per-game score-submission tests must continue to pass
unmodified in behavior (they may need import-path updates). Update `docs/SPEC.md` to document the
new shared module, per CLAUDE.md's architecture-change rule.

### 3.2 Bounded particle-burst effects are duplicated across ≥8 games

**Files:** most `src/games/*/effects.ts`

The bounded particle-burst pattern (golden-ratio phase jitter constants, `maxParticles`
cap-and-clamp, per-particle age/velocity update loop) is duplicated near-identically across at
least 8 games with no shared `ParticleSystem` in `src/engine/`. Same category of issue as 3.1.

**Design decision:** Extract a shared, configurable particle-burst utility into
`src/engine/render/` (or a new `src/engine/effects/` module). Each game's `effects.ts` should
configure and drive the shared utility (burst count, velocity range, lifetime, color/sprite)
rather than reimplementing the age/velocity/cap loop. Preserve each game's current visual
parameters exactly — this is a mechanical extraction, not a visual redesign. Update `docs/SPEC.md`
to document the new shared module.

## 4. Minor issues

- **CR-018** — `scripts/validate-assets.mjs`: the non-original-asset attribution check only fires
  when a manifest entry explicitly sets `"original": false`; an entry that omits the field
  entirely passes with no attribution required. Make the check fail-closed: require every asset
  manifest entry to declare `original` explicitly (`true` or `false`), and fail validation if the
  field is missing.
- **CR-019** — `src/app/game-surface/GameSurface.tsx` is unused dead code duplicating canvas-mount
  logic that's inlined in `App.tsx`. Either delete it, or replace the inline logic in `App.tsx`
  with a use of this component (decide based on which is a smaller, safer diff — default to
  deleting the dead file, since `App.tsx`'s inline version is the one that's actually tested via
  the app-level tests).
- **CR-020** — `src/games/maze-chase/simulation.ts:228,333`: an undocumented `Math.min(levelScale,
  1.18)` cap applies to the player but not to enemies (uncapped up to 1.42). Not currently
  game-breaking (enemies stay net slower at max level in all difficulties per the reviewing
  agent's check) but undocumented. Add a comment explaining the intentional asymmetry, or lift
  both caps into `design.ts` named constants if there's no reason for the asymmetry.
- **CR-021** — Two near-duplicate test files were found asserting the same fact under different
  task-ID comments (`registry-asset-resolver.test.ts` vs `registry-assets.test.ts`, referencing
  P14 and P9 respectively). Consolidate into one file/one task-ID reference, keeping whichever has
  better coverage.
- **CR-022** — `docs/ASSET_POLICY.md` states the attribution file is "intentionally empty," but
  `assets/ATTRIBUTION.json` now has 31 entries. Update the doc to match current reality.
- **CR-023** — `src/games/jungle-quest/player.test.ts`: test-name task-ID labels are shifted by
  one relative to what they actually test (e.g. a test labeled "P13-002" actually tests P13-003
  jump/landing). Relabel to match actual coverage so future audits aren't misled.

## 5. Overall acceptance for this remediation effort

- Every item in §1 has a fix plus a regression test that would have caught the original bug
  (specifically driven through the same code path a real player would trigger, not just through
  direct state injection where that was the root cause of the original miss — see 1.1).
- Every item in §2 has a new test closing the stated coverage gap, with no production-code
  behavior change (unless the new test reveals the "should be correct" implementation is in fact
  wrong, in which case treat it as a new §1-class item).
- §3.1 and §3.2 extractions preserve all existing per-game test behavior and are reflected in
  `docs/SPEC.md`.
- §4 items are each resolved as described.
- `npm run lint`, `npm run test`, and `npm run build` all pass after each task, and after the full
  set.
- `docs/TODO.md` is corrected per CR-025 once P13's fix lands, since P13-007/008/009 are
  currently marked `[x]` despite being unreachable through real input before this remediation.
