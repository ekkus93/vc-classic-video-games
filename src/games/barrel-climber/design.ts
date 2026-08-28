export const BARREL_CLIMBER_DIFFICULTIES = Object.freeze({
  steady: Object.freeze({
    label: "Steady",
    hazardSpeedScale: 0.84,
    spawnIntervalSeconds: 3.15,
    spawnProtectionSeconds: 1.8,
    ladderDropScale: 0.72,
  }),
  shift: Object.freeze({
    label: "Shift",
    hazardSpeedScale: 1,
    spawnIntervalSeconds: 2.55,
    spawnProtectionSeconds: 1.45,
    ladderDropScale: 1,
  }),
  surge: Object.freeze({
    label: "Surge",
    hazardSpeedScale: 1.18,
    spawnIntervalSeconds: 2.05,
    spawnProtectionSeconds: 1.1,
    ladderDropScale: 1.28,
  }),
});

export type BarrelClimberDifficultyId = keyof typeof BARREL_CLIMBER_DIFFICULTIES;

export const BARREL_CLIMBER_DEFAULT_DIFFICULTY: BarrelClimberDifficultyId = "shift";

export const BARREL_CLIMBER_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  startingLives: 3,
  playerWidth: 10,
  playerHeight: 14,
  runSpeed: 72,
  climbSpeed: 52,
  jumpVelocity: -132,
  gravity: 380,
  hazardRadius: 6,
  hazardBaseSpeed: 39,
  hazardFallAcceleration: 250,
  hazardLadderSpeed: 46,
  maxHazards: 12,
  stageCount: 3,
});

export const BARREL_CLIMBER_SCORING = Object.freeze({
  vaultHazard: 120,
  stageClearBase: 700,
  stageClearPerStage: 140,
  stageClearPerLevel: 90,
});

export function barrelClimberStageClearScore(stageIndex: number, level: number): number {
  if (!Number.isSafeInteger(stageIndex) || stageIndex < 0 || stageIndex >= BARREL_CLIMBER_RUN_RULES.stageCount) {
    throw new RangeError("stageIndex must reference a Barrel Climber stage");
  }
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError("level must be a positive safe integer");
  }
  return (
    BARREL_CLIMBER_SCORING.stageClearBase +
    BARREL_CLIMBER_SCORING.stageClearPerStage * stageIndex +
    BARREL_CLIMBER_SCORING.stageClearPerLevel * (level - 1)
  );
}
