export const MAZE_CHASE_DIFFICULTIES = Object.freeze({
  stroll: Object.freeze({
    label: "Stroll",
    playerSpeed: 5.15,
    enemySpeed: 3.45,
    vulnerabilitySeconds: 7.5,
    respawnGraceSeconds: 1.8,
  }),
  circuit: Object.freeze({
    label: "Circuit",
    playerSpeed: 5.25,
    enemySpeed: 3.8,
    vulnerabilitySeconds: 6.25,
    respawnGraceSeconds: 1.5,
  }),
  overdrive: Object.freeze({
    label: "Overdrive",
    playerSpeed: 5.35,
    enemySpeed: 4.15,
    vulnerabilitySeconds: 5,
    respawnGraceSeconds: 1.2,
  }),
});

export type MazeChaseDifficultyId = keyof typeof MAZE_CHASE_DIFFICULTIES;

export const MAZE_CHASE_DEFAULT_DIFFICULTY: MazeChaseDifficultyId = "circuit";

export const MAZE_CHASE_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  startingLives: 3,
  tileSize: 11,
  mazeOriginX: 44.5,
  mazeOriginY: 28,
  bonusLifetimeSeconds: 9,
  enemyRespawnSeconds: 1.4,
  collisionRadiusTiles: 0.43,
  levelSpeedIncrease: 0.055,
  // Both actors speed up level over level from the same ramp, but they stop at different points:
  // sentinels keep gaining all the way to maxLevelSpeedScale while the runner plateaus earlier at
  // maxPlayerLevelSpeedScale. That gap is the difficulty curve -- later levels get harder because
  // the pursuit closes, not because the maze changes -- so the two caps are deliberately unequal
  // and must not be reconciled to one value.
  maxLevelSpeedScale: 1.42,
  maxPlayerLevelSpeedScale: 1.18,
});

export const MAZE_CHASE_SCORING = Object.freeze({
  pellet: 10,
  powerItem: 50,
  bonusBase: 400,
  enemyCaptureBase: 200,
  levelClearBase: 600,
  levelClearPerLevel: 125,
});

export const MAZE_CHASE_PHASES = Object.freeze([
  Object.freeze({ mode: "patrol" as const, seconds: 6 }),
  Object.freeze({ mode: "pursuit" as const, seconds: 14 }),
  Object.freeze({ mode: "patrol" as const, seconds: 5 }),
  Object.freeze({ mode: "pursuit" as const, seconds: 18 }),
  Object.freeze({ mode: "patrol" as const, seconds: 4 }),
  Object.freeze({ mode: "pursuit" as const, seconds: Number.POSITIVE_INFINITY }),
]);

export type MazeChasePhaseMode = (typeof MAZE_CHASE_PHASES)[number]["mode"];

export function mazeChaseLevelSpeedScale(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError("level must be a positive safe integer");
  }
  return Math.min(
    MAZE_CHASE_RUN_RULES.maxLevelSpeedScale,
    1 + (level - 1) * MAZE_CHASE_RUN_RULES.levelSpeedIncrease,
  );
}

export function mazeChaseLevelClearScore(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError("level must be a positive safe integer");
  }
  return (
    MAZE_CHASE_SCORING.levelClearBase +
    (level - 1) * MAZE_CHASE_SCORING.levelClearPerLevel
  );
}
