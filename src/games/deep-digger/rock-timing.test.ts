import { DEEP_DIGGER_DIFFICULTIES } from "./design.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { createDeepDiggerLevel, type DeepDiggerLevelDefinition } from "./level.js";
import { DeepDiggerSimulation, type DeepDiggerSimulationEvent } from "./simulation.js";

const IDLE_INPUT = Object.freeze({ move: null, attack: false } as const);
const SURVEY_SHAKE_SECONDS = DEEP_DIGGER_DIFFICULTIES.survey.rockShakeSeconds;

function rockTimingLevel(): DeepDiggerLevelDefinition {
  return Object.freeze({
    columns: 5,
    rows: 6,
    tunnels: Object.freeze([
      Object.freeze({ column: 0, row: 5 }),
      Object.freeze({ column: 2, row: 1 }),
      Object.freeze({ column: 2, row: 2 }),
      Object.freeze({ column: 2, row: 3 }),
      Object.freeze({ column: 2, row: 4 }),
      Object.freeze({ column: 2, row: 5 }),
      Object.freeze({ column: 4, row: 5 }),
    ]),
    playerSpawn: Object.freeze({ column: 0, row: 5 }),
    enemySpawns: Object.freeze([Object.freeze({ column: 4, row: 5 })]),
    rockSpawns: Object.freeze([Object.freeze({ column: 2, row: 0 })]),
  });
}

function createRockTimingSimulation(seed: number): DeepDiggerSimulation {
  const services = createFakeGameServices(seed);
  return new DeepDiggerSimulation({
    rng: services.rng,
    difficulty: "survey",
    level: rockTimingLevel(),
    initialInvulnerabilitySeconds: 10,
  });
}

/**
 * `simulation.rocks[n]?.state` narrows across repeated reads inside one function scope (TypeScript
 * treats the getter access path as stable, though it returns a fresh snapshot every call), so a
 * loop condition re-reading state after an earlier assertion has already narrowed it away trips a
 * spurious "no overlap" comparison error. Reading through a plain function call breaks that.
 */
function rockState(simulation: DeepDiggerSimulation, index: number): string | undefined {
  return simulation.rocks[index]?.state;
}

function loosenRock(simulation: DeepDiggerSimulation): void {
  const events = simulation.update(IDLE_INPUT, 0);
  assert(
    events.some((event) => event.type === "rock-loosened"),
    "fixture must loosen the unsupported rock",
  );
  assert(simulation.rocks[0]?.state === "shaking", "loosened rock must begin shaking");
}

export const tests: readonly TestCase[] = [
  {
    name: "P14-007 rock remains shaking before the shake duration elapses",
    run: () => {
      const simulation = createRockTimingSimulation(0x1471);
      loosenRock(simulation);

      simulation.update(IDLE_INPUT, SURVEY_SHAKE_SECONDS - 0.01);
      const rock = simulation.rocks[0];
      assert(rock?.state === "shaking", "sub-threshold time must not start the fall");
      assert(rock.cell.row === 0, "shaking must not move the rock");
      assert(rock.cellsFallen === 0, "shaking must not count fall distance");
    },
  },
  {
    name: "P14-007 exact shake threshold starts falling with one immediate cell step",
    run: () => {
      const simulation = createRockTimingSimulation(0x1472);
      loosenRock(simulation);

      const events = simulation.update(IDLE_INPUT, SURVEY_SHAKE_SECONDS);
      const rock = simulation.rocks[0];
      assert(
        events.some((event) => event.type === "rock-falling"),
        "exact threshold must publish the falling transition",
      );
      assert(rock?.state === "falling", "exact threshold must enter falling state");
      assert(rock.cell.row === 1, "falling transition preserves the immediate first cell step");
      assert(rock.cellsFallen === 1, "first falling cell must be counted exactly once");
    },
  },
  {
    name: "P14-007 shake-to-fall transition consumes only leftover frame time",
    run: () => {
      const simulation = createRockTimingSimulation(0x1473);
      loosenRock(simulation);

      simulation.update(IDLE_INPUT, SURVEY_SHAKE_SECONDS + 0.02);
      const rock = simulation.rocks[0];
      assert(rock?.state === "falling", "cross-threshold frame must enter falling state");
      assert(
        rock.cell.row === 1 && rock.cellsFallen === 1,
        "only the 20ms remainder may advance falling after the shake interval",
      );
    },
  },
  {
    name: "P14-007 aggregate and fixed-step shake-to-fall timing are equivalent",
    run: () => {
      const aggregate = createRockTimingSimulation(0x1474);
      const fixedStep = createRockTimingSimulation(0x1474);
      loosenRock(aggregate);
      loosenRock(fixedStep);

      aggregate.update(IDLE_INPUT, 0.6);
      for (let step = 0; step < 36; step += 1) {
        fixedStep.update(IDLE_INPUT, 1 / 60);
      }

      const aggregateRock = aggregate.rocks[0];
      const fixedStepRock = fixedStep.rocks[0];
      assert(
        aggregateRock?.state === fixedStepRock?.state,
        "frame partitioning must not change the rock lifecycle state",
      );
      assert(
        aggregateRock?.cell.row === fixedStepRock?.cell.row,
        "frame partitioning must not change the rock cell",
      );
      assert(
        aggregateRock?.cellsFallen === fixedStepRock?.cellsFallen,
        "frame partitioning must not change the fall distance",
      );
      assert(
        Math.abs(
          (aggregateRock?.fallStepRemainingSeconds ?? 0) -
            (fixedStepRock?.fallStepRemainingSeconds ?? 0),
        ) < 1e-9,
        "frame partitioning must preserve the remaining fall-step time",
      );
    },
  },
  {
    name: "CR-008 defeating the last enemy while a rock is mid-fall still lands and scores that rock",
    run: () => {
      // A long player/enemy corridor at row 1, plus a rock at (2,0) whose support tunnel (2,1)
      // is already open, so it starts shaking immediately -- and a deep open shaft below (2,1)
      // so the rock stays "falling" for several ticks instead of landing on its first step,
      // leaving a window to defeat the enemy while it's still mid-air. The enemy closes one cell
      // of distance on every update() call once its movement budget is exhausted (it starts
      // exhausted), including the two setup calls below and each of the three pump calls that
      // follow (firePump always runs before that tick's enemy movement, so each pump still sees
      // the enemy at its pre-move distance) -- the corridor is long enough that the enemy is
      // never closer than 1 cell from the player until the final, defeating pump.
      const services = createFakeGameServices(0xc008);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 8,
          rows: 6,
          tunnels: [
            { column: 0, row: 1 },
            { column: 1, row: 1 },
            { column: 2, row: 1 },
            { column: 3, row: 1 },
            { column: 4, row: 1 },
            { column: 5, row: 1 },
            { column: 6, row: 1 },
            { column: 7, row: 1 },
            { column: 2, row: 2 },
            { column: 2, row: 3 },
            { column: 2, row: 4 },
            { column: 2, row: 5 },
          ],
          playerSpawn: { column: 1, row: 1 },
          enemySpawns: [{ column: 6, row: 1 }],
          rockSpawns: [{ column: 2, row: 0 }],
        },
        initialInvulnerabilitySeconds: 10,
      });

      const loosened = simulation.update(IDLE_INPUT, 0);
      assert(loosened.some((event) => event.type === "rock-loosened"), "fixture must loosen the rock immediately");

      const fell = simulation.update(IDLE_INPUT, SURVEY_SHAKE_SECONDS);
      assert(fell.some((event) => event.type === "rock-falling"), "shake threshold must start the fall");
      assert(simulation.rocks[0]?.state === "falling", "rock must be mid-fall, not yet landed, going into the pump attacks");

      // The enemy's own pathfinding has already closed two cells of distance during the setup
      // calls above, so the player stays put here (facing "right" from spawn) for the sequence.
      simulation.update({ move: null, attack: true }, 0);
      simulation.update({ move: null, attack: true }, 0);
      assert(simulation.rocks[0]?.state === "falling", "rock must still be mid-fall while the pump sequence is in progress");
      const defeated = simulation.update({ move: null, attack: true }, 0);

      assert(defeated.some((event) => event.type === "enemy-defeated"), "third pump must defeat the last enemy");
      assert(
        defeated.some((event) => event.type === "rock-landed"),
        "the rock still mid-fall when the wave cleared must be landed and scored, not silently discarded",
      );
      assert(defeated.some((event) => event.type === "wave-cleared"), "defeating the last enemy must still clear the wave");
      const nextWaveRock = simulation.rocks[0];
      assert(
        simulation.rocks.length === 1 && nextWaveRock !== undefined && nextWaveRock.state === "supported",
        "the next wave's rock population must start fresh (freshly supported) once the prior rock has been resolved",
      );
    },
  },
  {
    name: "CR-009 two rocks falling in the same column never share a cell",
    run: () => {
      // The shipped level's ROCK_SPAWNS table has a same-column pair (column 18, rows 4 and 8),
      // both present from wave 1, so this is a reachable production configuration rather than a
      // synthetic one. The fixture below reuses those exact cells and carves a column-18 shaft
      // with a floor at row 11, so both rocks loosen on the first tick and fall together.
      const shipped = createDeepDiggerLevel("survey", 1).rockSpawns;
      assert(
        shipped.some((cell, index) =>
          shipped.some((other, otherIndex) => otherIndex !== index && other.column === cell.column),
        ),
        "fixture premise: the shipped wave-1 rock spawns must contain a same-column pair",
      );

      const services = createFakeGameServices(0xc009);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 24,
          rows: 16,
          tunnels: [
            // The upper rock's shaft, down to the lower rock's cell (which the lower rock carves
            // for itself the moment it starts falling).
            { column: 18, row: 5 },
            { column: 18, row: 6 },
            { column: 18, row: 7 },
            // The lower rock's shaft: two cells, then solid earth at row 11 as its floor.
            { column: 18, row: 9 },
            { column: 18, row: 10 },
            // A sealed pocket for the player, with the one enemy parked on top of it so it never
            // paths anywhere near the shaft and never clears the wave mid-test.
            { column: 0, row: 15 },
          ],
          playerSpawn: { column: 0, row: 15 },
          enemySpawns: [{ column: 0, row: 15 }],
          rockSpawns: [
            { column: 18, row: 4 },
            { column: 18, row: 8 },
          ],
        },
        initialInvulnerabilitySeconds: 100,
      });

      const assertNoOverlap = (label: string): void => {
        const [upper, lower] = simulation.rocks;
        assert(upper !== undefined && lower !== undefined, `${label}: both rocks must exist`);
        assert(
          !(upper.cell.column === lower.cell.column && upper.cell.row === lower.cell.row),
          `${label}: two rocks must never occupy the same cell (both at ` +
            `${upper.cell.column},${upper.cell.row})`,
        );
        assert(
          upper.cell.row < lower.cell.row,
          `${label}: the upper rock must never fall past the lower one (upper row ` +
            `${upper.cell.row}, lower row ${lower.cell.row})`,
        );
      };

      // Fine-grained ticks until the lower rock is falling in the last cell above its floor. It
      // stays "falling" there for one fall-step interval before its next step lands it, which is
      // the window the upper rock can be driven into.
      let ticks = 0;
      for (;;) {
        simulation.update(IDLE_INPUT, 0.02);
        ticks += 1;
        assertNoOverlap(`tick ${ticks}`);
        const lower = simulation.rocks[1];
        assert(ticks < 200, "fixture must reach the lower rock's pre-landing window");
        if (lower?.state === "falling" && lower.cell.row === 10) {
          break;
        }
      }
      const upperBeforeSpike = simulation.rocks[0];
      assert(
        upperBeforeSpike?.state === "falling" && upperBeforeSpike.cell.row < 10,
        "the upper rock must still be mid-fall above the lower rock at the start of the spike frame",
      );

      // One catch-up-sized frame: enough fall-step time for the upper rock to cover every
      // remaining cell in a single update()'s step loop, which is exactly when it used to walk
      // straight through the still-falling lower rock (rocks are advanced in spawn order, so the
      // upper rock moves while the lower one is still in its pre-frame cell).
      simulation.update(IDLE_INPUT, 0.5);
      assertNoOverlap("catch-up frame");

      const [upper, lower] = simulation.rocks;
      assert(
        lower?.state === "resting" && lower.cell.row === 10,
        "the lower rock must land on its floor",
      );
      assert(
        upper?.state === "resting" && upper.cell.row === 9,
        "the upper rock must come to rest directly on top of the lower rock, not inside it",
      );

      simulation.update(IDLE_INPUT, 0.5);
      assertNoOverlap("settled frame");
    },
  },
  {
    name: "CR-010 a falling rock hits a player who walks in on an idle tick between fall steps",
    run: () => {
      // A rock only advances one cell every ROCK_FALL_STEP_SECONDS, so at a 0.02s tick it sits
      // idle in a cell for three ticks out of every four. Contact used to be resolved only on the
      // tick a rock changed cells, so walking into an idling rock was free. The player and the
      // enemy start 19 columns apart, and the enemy gets only a handful of move intervals over
      // the ~0.8s this fixture runs, so it never reaches the player and never confuses a hit.
      const services = createFakeGameServices(0xc010);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 24,
          rows: 16,
          tunnels: [
            { column: 2, row: 1 },
            { column: 2, row: 2 },
            { column: 2, row: 3 },
            { column: 2, row: 4 },
            { column: 2, row: 5 },
            { column: 2, row: 6 },
            { column: 2, row: 7 },
            { column: 2, row: 8 },
            { column: 0, row: 4 },
            { column: 1, row: 4 },
            { column: 20, row: 15 },
          ],
          playerSpawn: { column: 1, row: 4 },
          enemySpawns: [{ column: 20, row: 15 }],
          rockSpawns: [{ column: 2, row: 0 }],
        },
        initialInvulnerabilitySeconds: 0,
      });

      // Tick until the rock has just stepped into the cell beside the player.
      let ticks = 0;
      for (;;) {
        simulation.update(IDLE_INPUT, 0.02);
        ticks += 1;
        assert(ticks < 200, "fixture must land the rock in the player's row");
        const rock = simulation.rocks[0];
        if (rock?.state === "falling" && rock.cell.row === 4) {
          break;
        }
      }
      const livesBeforeContact: number = simulation.lives;
      assert(
        livesBeforeContact === 3,
        "the rock must not have touched the player on its way down",
      );

      // One idle tick, so the move below lands on a tick where the rock does not change cells.
      simulation.update(IDLE_INPUT, 0.02);
      const idling = simulation.rocks[0];
      assert(
        idling?.state === "falling" && idling.cell.row === 4,
        "fixture premise: the rock must idle in place between fall steps",
      );

      const events = simulation.update({ move: "right", attack: false }, 0.02);
      const settled = simulation.rocks[0];
      assert(
        settled?.state === "falling" && settled.cell.row === 4,
        "the contact tick must be an idle tick, not one where the rock changed cells",
      );
      assert(
        events.some((event) => event.type === "player-hit"),
        "walking into a falling rock's cell must be a hit even between its fall steps",
      );
      const livesAfterContact: number = simulation.lives;
      assert(
        livesAfterContact === livesBeforeContact - 1,
        "the contact must cost exactly one life",
      );
    },
  },
  {
    name: "CR2-002 a rock resting on another rock re-loosens once that rock falls away",
    run: () => {
      // Rock A falls from (2,0) down an open shaft and lands directly on rock B, which sits
      // "supported" at (2,3) on solid earth at (2,4). Before the fix, A's "resting" state was
      // terminal: it never rechecked its support, so once B later fell away A would be left
      // floating over open tunnel forever. With the fix, A's support is rechecked exactly like a
      // freshly-supported rock's, so it must re-loosen and fall further once B is gone.
      const services = createFakeGameServices(0x2002);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 6,
          rows: 10,
          tunnels: [
            { column: 2, row: 1 },
            { column: 2, row: 2 },
            // A sealed pocket for the player and enemy, well away from the rock column.
            { column: 0, row: 9 },
          ],
          playerSpawn: { column: 0, row: 9 },
          enemySpawns: [{ column: 0, row: 9 }],
          rockSpawns: [
            { column: 2, row: 0 },
            { column: 2, row: 3 },
          ],
        },
        initialInvulnerabilitySeconds: 100,
      });

      let ticks = 0;
      for (; rockState(simulation, 0) !== "resting"; ticks += 1) {
        simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 200, "fixture must let rock A land on rock B");
      }
      const landedA = simulation.rocks[0];
      assert(
        landedA?.cell.row === 2 && rockState(simulation, 1) === "supported",
        "rock A must come to rest directly on rock B, which stays supported on its own earth floor",
      );

      // Dig out B's own support so B, in turn, falls away -- carving straight through terrain
      // rather than driving the player there, since only the rock behavior is under test.
      simulation.terrain.carve({ column: 2, row: 4 });
      for (ticks = 0; rockState(simulation, 1) !== "resting"; ticks += 1) {
        simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 200, "fixture must let rock B fall away once its support is dug out");
      }
      assert(
        simulation.rocks[1]?.cell.row === 4,
        "rock B must land one cell down, on the earth its own support check requires",
      );

      // Rock A is still reported "resting" at row 2 at this exact instant only because rocks
      // advance in array order within one tick -- A's own check ran before B's departure carved
      // the cell between them open this same tick. It must not stay there: give it a short,
      // separately-bounded window (well short of the fixture's own 200-tick timeout above) to
      // recheck its support and re-loosen (leaving "resting" for "shaking", still at row 2 --
      // shaking does not itself move a rock).
      for (
        ticks = 0;
        rockState(simulation, 0) === "resting" && simulation.rocks[0]?.cell.row === 2;
        ticks += 1
      ) {
        simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 10, "rock A must not remain resting above the now-open, rock-free cell rock B vacated");
      }
      assert(
        rockState(simulation, 0) === "shaking",
        "rock A must re-loosen (re-enter the shake delay) once its support is gone, not skip straight to falling or stay put",
      );

      // Let the re-loosened rock actually fall and land again, proving it is not merely stuck
      // shaking in place -- the floating-forever bug this guards against left it "resting" and
      // silent, not "shaking" and stuck, so this final leg is the fix's real payoff.
      for (ticks = 0; rockState(simulation, 0) !== "resting"; ticks += 1) {
        simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 200, "fixture must let the re-loosened rock finish falling and land again");
      }
      assert(
        (simulation.rocks[0]?.cell.row ?? 0) > 2,
        "rock A must actually fall further once its support is gone, not merely change state in place",
      );
    },
  },
  {
    name: "CR2-002 digging directly under a landed rock re-loosens it after the shake delay",
    run: () => {
      // A single rock lands on solid earth with nothing else involved, then that earth is dug out
      // from directly beneath it. Before the fix this did nothing at all -- a landed rock's
      // support was never rechecked, full stop, independent of whether anything else had ever sat
      // beneath it.
      const services = createFakeGameServices(0x2003);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 6,
          rows: 10,
          tunnels: [
            { column: 2, row: 1 },
            { column: 2, row: 2 },
            { column: 0, row: 9 },
          ],
          playerSpawn: { column: 0, row: 9 },
          enemySpawns: [{ column: 0, row: 9 }],
          rockSpawns: [{ column: 2, row: 0 }],
        },
        initialInvulnerabilitySeconds: 100,
      });

      let ticks = 0;
      for (; rockState(simulation, 0) !== "resting"; ticks += 1) {
        simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 200, "fixture must let the rock land on the earth floor at row 2");
      }
      assert(simulation.rocks[0]?.cell.row === 2, "the rock must land on the earth floor at row 2");

      simulation.terrain.carve({ column: 2, row: 3 });
      let reloosened: readonly { readonly type: string }[] = [];
      for (ticks = 0; rockState(simulation, 0) === "resting"; ticks += 1) {
        reloosened = simulation.update(IDLE_INPUT, 0.02);
        assert(ticks < 200, "fixture must let the rock re-loosen and start shaking again");
      }
      assert(
        reloosened.some((event) => event.type === "rock-loosened"),
        "digging under a landed rock must re-fire rock-loosened, not silently do nothing",
      );
      assert(simulation.rocks[0]?.state === "shaking", "the rock must re-enter the shake delay, not fall immediately");
    },
  },
  {
    name: "CR2-002 a rock's second landing scores only that fall's own cells, not the first fall's again",
    run: () => {
      // Same re-loosening setup as above, but this one drives the rock all the way to its second
      // landing and checks the score and event payload. cellsFallen must reset after the first
      // landing, or the second rock-landed event double-counts the first fall's distance.
      const services = createFakeGameServices(0x2004);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 6,
          rows: 10,
          tunnels: [
            { column: 2, row: 1 },
            { column: 2, row: 2 },
            { column: 0, row: 9 },
          ],
          playerSpawn: { column: 0, row: 9 },
          enemySpawns: [{ column: 0, row: 9 }],
          rockSpawns: [{ column: 2, row: 0 }],
        },
        initialInvulnerabilitySeconds: 100,
      });

      let ticks = 0;
      let firstLanding: DeepDiggerSimulationEvent | undefined;
      for (; firstLanding === undefined; ticks += 1) {
        const events = simulation.update(IDLE_INPUT, 0.02);
        firstLanding = events.find((event) => event.type === "rock-landed");
        assert(ticks < 200, "fixture must let the rock reach its first landing");
      }
      assert(
        firstLanding.type === "rock-landed" && firstLanding.cellsFallen === 2 && firstLanding.points === 40,
        "the rock's first fall must cover exactly the two cells from row 0 to row 2",
      );
      const scoreAfterFirstLanding: number = simulation.score;

      // Dig two cells beneath it, so its second fall covers a different distance (one cell) than
      // its first (two cells) -- if cellsFallen were not reset, this second landing's cellsFallen
      // and points would read as cumulative (3 cells) rather than just this fall's own distance.
      simulation.terrain.carve({ column: 2, row: 3 });

      let secondLanding: DeepDiggerSimulationEvent | undefined;
      for (ticks = 0; secondLanding === undefined; ticks += 1) {
        const events = simulation.update(IDLE_INPUT, 0.02);
        secondLanding = events.find((event) => event.type === "rock-landed");
        assert(ticks < 200, "fixture must let the rock reach its second landing");
      }
      assert(
        secondLanding.type === "rock-landed" && secondLanding.cellsFallen === 1 && secondLanding.points === 20,
        `the second landing must score only its own one-cell fall, not the first fall's cells again -- got cellsFallen=${String((secondLanding as { cellsFallen?: number }).cellsFallen)}`,
      );
      assert(
        simulation.score === scoreAfterFirstLanding + 20,
        "total score must grow by exactly the second fall's own points, not the first fall's points a second time",
      );
    },
  },
  {
    name: "CR2-008 a shaking rock still blocks player movement into its cell -- the per-tick contact check never needs to fire for it",
    run: () => {
      // The rock at (2,0) has open support at (2,1), so it loosens on the very first tick. The
      // player, parked one cell away at (1,0), then tries to move directly into the shaking
      // rock's own cell -- exactly the case the per-tick contact check's removed "shaking" branch
      // claimed to guard. It can't actually happen: isRockAt (called with no ignoredRockId, as
      // every player-movement check is) blocks entry into any non-falling rock's cell, so the
      // move itself is refused before contact is ever a question.
      const services = createFakeGameServices(0x2008);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: {
          columns: 5,
          rows: 5,
          tunnels: [
            { column: 1, row: 0 },
            { column: 2, row: 1 },
          ],
          playerSpawn: { column: 1, row: 0 },
          enemySpawns: [{ column: 1, row: 0 }],
          rockSpawns: [{ column: 2, row: 0 }],
        },
        initialInvulnerabilitySeconds: 100,
      });

      const loosened = simulation.update(IDLE_INPUT, 0);
      assert(loosened.some((event) => event.type === "rock-loosened"), "fixture must loosen the rock on the first tick");
      assert(simulation.rocks[0]?.state === "shaking", "the rock must be shaking, not yet falling, going into the move attempt");

      const movedInto = simulation.update({ move: "right", attack: false }, 0.02);
      assert(
        simulation.player.cell.column === 1 && simulation.player.cell.row === 0,
        "moving into a shaking rock's cell must be refused, leaving the player in place",
      );
      assert(
        !movedInto.some((event) => event.type === "dug"),
        "a refused move must not carve the rock's cell as though the player had entered it",
      );
      assert(
        !movedInto.some((event) => event.type === "player-hit"),
        "a shaking rock the player never entered must never register as a hit",
      );
      assert(simulation.lives === 3, "a blocked move must cost no life");
    },
  },
];
