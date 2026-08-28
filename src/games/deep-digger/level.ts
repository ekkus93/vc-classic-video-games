import {
  DEEP_DIGGER_DIFFICULTIES,
  DEEP_DIGGER_RUN_RULES,
  type DeepDiggerDifficultyId,
} from "./design.js";
import type { GridCell } from "./terrain.js";

export interface DeepDiggerLevelDefinition {
  readonly columns: number;
  readonly rows: number;
  readonly tunnels: readonly GridCell[];
  readonly playerSpawn: GridCell;
  readonly enemySpawns: readonly GridCell[];
  readonly rockSpawns: readonly GridCell[];
}

const ORIGINAL_LEVEL_ROWS = Object.freeze([
  "........................",
  "....########............",
  "....#......#............",
  "..###......######.......",
  "..#............#........",
  "..#....#########........",
  "..#....#................",
  "..######....########....",
  ".......#....#......#....",
  ".......######......#....",
  "............#......#....",
  "....#########..#####....",
  "....#..........#........",
  "....############........",
  "........................",
  "........................",
]);

const PLAYER_SPAWN = Object.freeze({ column: 4, row: 1 });
const ENEMY_SPAWNS = Object.freeze([
  Object.freeze({ column: 11, row: 1 }),
  Object.freeze({ column: 16, row: 3 }),
  Object.freeze({ column: 8, row: 5 }),
  Object.freeze({ column: 18, row: 7 }),
  Object.freeze({ column: 12, row: 9 }),
  Object.freeze({ column: 6, row: 11 }),
  Object.freeze({ column: 15, row: 13 }),
  Object.freeze({ column: 4, row: 13 }),
]);
const ROCK_SPAWNS = Object.freeze([
  Object.freeze({ column: 9, row: 2 }),
  Object.freeze({ column: 18, row: 4 }),
  Object.freeze({ column: 18, row: 8 }),
  Object.freeze({ column: 2, row: 10 }),
  Object.freeze({ column: 21, row: 12 }),
]);

function requireTemplate(): void {
  if (ORIGINAL_LEVEL_ROWS.length !== DEEP_DIGGER_RUN_RULES.gridRows) {
    throw new Error("Deep Digger original level row count is invalid");
  }
  for (const row of ORIGINAL_LEVEL_ROWS) {
    if (row.length !== DEEP_DIGGER_RUN_RULES.gridColumns) {
      throw new Error("Deep Digger original level column count is invalid");
    }
  }
}

export function createDeepDiggerLevel(
  difficulty: DeepDiggerDifficultyId,
  wave: number,
): DeepDiggerLevelDefinition {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  requireTemplate();
  const tunnels: GridCell[] = [];
  for (let row = 0; row < ORIGINAL_LEVEL_ROWS.length; row += 1) {
    const encoded = ORIGINAL_LEVEL_ROWS[row];
    if (encoded === undefined) {
      continue;
    }
    for (let column = 0; column < encoded.length; column += 1) {
      if (encoded[column] === "#") {
        tunnels.push(Object.freeze({ column, row }));
      }
    }
  }

  const profileEnemyCount = DEEP_DIGGER_DIFFICULTIES[difficulty].startingEnemies;
  const enemyCount = Math.min(
    DEEP_DIGGER_RUN_RULES.maxEnemies,
    profileEnemyCount + Math.floor((wave - 1) / 2),
  );
  const rockCount = Math.min(
    DEEP_DIGGER_RUN_RULES.maxRocks,
    3 + Math.floor((wave - 1) / 3),
  );

  return Object.freeze({
    columns: DEEP_DIGGER_RUN_RULES.gridColumns,
    rows: DEEP_DIGGER_RUN_RULES.gridRows,
    tunnels: Object.freeze(tunnels),
    playerSpawn: PLAYER_SPAWN,
    enemySpawns: Object.freeze(ENEMY_SPAWNS.slice(0, enemyCount)),
    rockSpawns: Object.freeze(ROCK_SPAWNS.slice(0, rockCount)),
  });
}

export const DEEP_DIGGER_ORIGINAL_LEVEL_SIGNATURE = Object.freeze({
  name: "Copper Lattice",
  rows: ORIGINAL_LEVEL_ROWS,
  authored: "project-original",
});
