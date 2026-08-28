import { assert, type TestCase } from "../../test/harness.js";
import {
  MAZE_CHASE_MAZE,
  MAZE_CHASE_ORIGINAL_LAYOUT,
  cellKey,
  legalDirections,
  neighborCell,
  parseMaze,
  shortestPathDistance,
} from "./maze.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-001 Circuit Garden is an original fully connected 21 by 17 maze",
    run: () => {
      assert(MAZE_CHASE_MAZE.width === 21 && MAZE_CHASE_MAZE.height === 17, "maze dimensions must remain stable");
      assert(
        MAZE_CHASE_MAZE.sourceRows.join("\n") === MAZE_CHASE_ORIGINAL_LAYOUT.join("\n"),
        "parsed maze must preserve the authored source layout",
      );
      assert(MAZE_CHASE_MAZE.tunnelRows.has(8), "middle corridor must expose the authored edge tunnel");
      assert(
        MAZE_CHASE_MAZE.pellets.size > 100 && MAZE_CHASE_MAZE.powerItems.size === 4,
        "first maze must provide a complete collectible field and four power items",
      );
      for (const enemy of Object.values(MAZE_CHASE_MAZE.enemyStarts)) {
        assert(
          Number.isFinite(shortestPathDistance(MAZE_CHASE_MAZE, MAZE_CHASE_MAZE.playerStart, enemy)),
          "every sentinel start must be reachable from the runner",
        );
      }
    },
  },
  {
    name: "P10-001 tunnel neighbors wrap through the graph rather than teleporting visually only",
    run: () => {
      const left = neighborCell(MAZE_CHASE_MAZE, { x: 0, y: 8 }, "left");
      const right = neighborCell(MAZE_CHASE_MAZE, { x: 20, y: 8 }, "right");
      assert(left?.x === 20 && left.y === 8, "left tunnel edge must connect to the opposite cell");
      assert(right?.x === 0 && right.y === 8, "right tunnel edge must connect to the opposite cell");
      assert(
        legalDirections(MAZE_CHASE_MAZE, { x: 0, y: 8 }).includes("left"),
        "tunnel wrapping must participate in normal navigation legality",
      );
    },
  },
  {
    name: "P10-001 parser rejects disconnected required gameplay cells",
    run: () => {
      let rejected = false;
      try {
        parseMaze([
          "#########",
          "#P.A#B X#",
          "#####.###",
          "#C  #  D#",
          "#########",
        ]);
      } catch (error) {
        rejected = error instanceof Error && error.message.includes("unreachable");
      }
      assert(rejected, "disconnected collectibles or starts must fail maze validation");
      assert(
        !MAZE_CHASE_MAZE.walls.has(cellKey(MAZE_CHASE_MAZE.bonusSpawn)),
        "bonus spawn must be a walkable graph cell",
      );
    },
  },
];
