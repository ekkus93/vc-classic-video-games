import { assert, type TestCase } from "../../test/harness.js";
import { MAZE_CHASE_MAZE } from "./maze.js";
import {
  advanceCorridorMover,
  corridorPosition,
  createCorridorMover,
} from "./movement.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-002 corridor movement interpolates smoothly between grid centers",
    run: () => {
      const start = createCorridorMover(MAZE_CHASE_MAZE.playerStart);
      const moved = advanceCorridorMover(MAZE_CHASE_MAZE, start, "right", 0.75);
      const position = corridorPosition(MAZE_CHASE_MAZE, moved);
      assert(moved.cell.x === 10 && moved.cell.y === 9, "sub-cell motion must retain the current anchor cell");
      assert(moved.direction === "right" && Math.abs(moved.progress - 0.75) < 1e-9, "motion progress must be deterministic");
      assert(Math.abs(position.x - 10.75) < 1e-9 && position.y === 9, "render position must interpolate along the active corridor edge");
    },
  },
  {
    name: "P10-003 an early requested turn is executed exactly at the next legal intersection",
    run: () => {
      let mover = createCorridorMover(MAZE_CHASE_MAZE.playerStart);
      mover = advanceCorridorMover(MAZE_CHASE_MAZE, mover, "right", 0.78);
      mover = advanceCorridorMover(MAZE_CHASE_MAZE, mover, "up", 0.32);
      const position = corridorPosition(MAZE_CHASE_MAZE, mover);
      assert(mover.cell.x === 11 && mover.cell.y === 9, "runner must first arrive at the intersection center");
      assert(mover.direction === "up", "buffered request must become the new corridor direction");
      assert(position.y < 9, "remaining frame distance must continue smoothly through the turn");
    },
  },
  {
    name: "P10-002 tunnel movement wraps smoothly across the horizontal maze edge",
    run: () => {
      const tunnelStart = createCorridorMover({ x: 20, y: 8 });
      const moved = advanceCorridorMover(MAZE_CHASE_MAZE, tunnelStart, "right", 1.25);
      const position = corridorPosition(MAZE_CHASE_MAZE, moved);
      assert(moved.cell.x === 0 && moved.cell.y === 8, "crossing the tunnel must wrap to the opposite edge cell");
      assert(moved.direction === "right" && Math.abs(moved.progress - 0.25) < 1e-9, "wrapped movement must retain unused frame distance");
      assert(Math.abs(position.x - 0.25) < 1e-9 && position.y === 8, "render position must continue smoothly after tunnel wrapping");
    },
  },
  {
    name: "P10-002 reversals preserve continuous position rather than snapping to a cell center",
    run: () => {
      let mover = createCorridorMover(MAZE_CHASE_MAZE.playerStart);
      mover = advanceCorridorMover(MAZE_CHASE_MAZE, mover, "right", 0.4);
      const before = corridorPosition(MAZE_CHASE_MAZE, mover);
      mover = advanceCorridorMover(MAZE_CHASE_MAZE, mover, "left", 0);
      const after = corridorPosition(MAZE_CHASE_MAZE, mover);
      assert(Math.abs(before.x - after.x) < 1e-9 && before.y === after.y, "direction reversal must not teleport the runner");
      assert(mover.direction === "left", "opposite input must reverse the active edge");
    },
  },
];
