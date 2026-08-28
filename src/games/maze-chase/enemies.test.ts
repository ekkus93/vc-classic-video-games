import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  MazeChasePhaseScheduler,
  chooseFrightenedDirection,
  chooseTargetDirection,
  enemyTargetCell,
} from "./enemies.js";
import { MAZE_CHASE_MAZE, cellKey } from "./maze.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-006 four pursuit personalities produce distinct deterministic targets",
    run: () => {
      const player = { cell: { x: 10, y: 9 }, direction: "up" as const };
      const targets = ["amber", "cyan", "lime", "violet"].map((id) =>
        enemyTargetCell(
          MAZE_CHASE_MAZE,
          id as "amber" | "cyan" | "lime" | "violet",
          "pursuit",
          player,
          { x: id === "violet" ? 10 : 2, y: id === "violet" ? 8 : 2 },
        ),
      );
      assert(targets[0]?.x === 10 && targets[0]?.y === 9, "amber must target the current runner cell");
      assert(new Set(targets.map(cellKey)).size === 4, "all four authored pursuit rules must resolve to distinct targets in the reference state");

      const first = chooseTargetDirection(MAZE_CHASE_MAZE, { x: 8, y: 7 }, "right", targets[0] ?? player.cell);
      const second = chooseTargetDirection(MAZE_CHASE_MAZE, { x: 8, y: 7 }, "right", targets[0] ?? player.cell);
      assert(first === second, "graph routing tie-breaking must be deterministic");
    },
  },
  {
    name: "P10-007 phase scheduler alternates authored patrol and pursuit windows deterministically",
    run: () => {
      const scheduler = new MazeChasePhaseScheduler();
      assert(scheduler.mode === "patrol", "run must begin in patrol mode");
      assert(!scheduler.update(5.9), "phase must remain stable before its exact boundary");
      assert(scheduler.update(0.1) && String(scheduler.mode) === "pursuit", "six-second boundary must enter pursuit");
      assert(!scheduler.update(13.9), "pursuit must retain its authored duration");
      assert(scheduler.update(0.1) && String(scheduler.mode) === "patrol", "next phase boundary must be deterministic");
      scheduler.reset();
      assert(scheduler.mode === "patrol" && scheduler.phaseIndex === 0, "reset must restore the initial phase exactly");
    },
  },
  {
    name: "P10-008 frightened routing consumes only the seeded shared RNG and reproduces choices",
    run: () => {
      const first = createFakeGameServices(0x10f0);
      const second = createFakeGameServices(0x10f0);
      const sequenceA = Array.from({ length: 8 }, () =>
        chooseFrightenedDirection(MAZE_CHASE_MAZE, { x: 10, y: 9 }, null, first.rng),
      );
      const sequenceB = Array.from({ length: 8 }, () =>
        chooseFrightenedDirection(MAZE_CHASE_MAZE, { x: 10, y: 9 }, null, second.rng),
      );
      assert(sequenceA.join(",") === sequenceB.join(","), "same run seed must reproduce frightened route decisions");
    },
  },
];
