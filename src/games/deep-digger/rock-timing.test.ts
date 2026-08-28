import { DEEP_DIGGER_DIFFICULTIES } from "./design.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import type { DeepDiggerLevelDefinition } from "./level.js";
import { DeepDiggerSimulation } from "./simulation.js";

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
];
