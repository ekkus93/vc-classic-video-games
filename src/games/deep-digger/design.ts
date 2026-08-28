export const DEEP_DIGGER_DIFFICULTIES = Object.freeze({
  survey: Object.freeze({
    label: "Survey",
    startingEnemies: 3,
    enemyMoveIntervalSeconds: 0.24,
    phaseDurationSeconds: 1.35,
    phaseCooldownSeconds: 2.2,
    rockShakeSeconds: 0.48,
  }),
  bore: Object.freeze({
    label: "Bore",
    startingEnemies: 4,
    enemyMoveIntervalSeconds: 0.2,
    phaseDurationSeconds: 1.2,
    phaseCooldownSeconds: 1.8,
    rockShakeSeconds: 0.4,
  }),
  mantle: Object.freeze({
    label: "Mantle",
    startingEnemies: 5,
    enemyMoveIntervalSeconds: 0.16,
    phaseDurationSeconds: 1.05,
    phaseCooldownSeconds: 1.45,
    rockShakeSeconds: 0.32,
  }),
});

export type DeepDiggerDifficultyId = keyof typeof DEEP_DIGGER_DIFFICULTIES;

export const DEEP_DIGGER_DEFAULT_DIFFICULTY: DeepDiggerDifficultyId = "bore";

export const DEEP_DIGGER_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  gridColumns: 24,
  gridRows: 16,
  tileSize: 10,
  fieldOriginX: 40,
  fieldOriginY: 54,
  startingLives: 3,
  playerMoveIntervalSeconds: 0.1,
  playerInvulnerabilitySeconds: 1.25,
  pumpRangeTiles: 5,
  pressureStages: 3,
  pressureDecaySeconds: 1.5,
  maxEnemies: 8,
  maxRocks: 5,
});

export const DEEP_DIGGER_SCORING = Object.freeze({
  earthCell: 2,
  pressureDefeatBase: 250,
  pressureDefeatPerWave: 25,
  rockCrush: 500,
  rockDropPerCell: 20,
  waveClearBase: 400,
  waveClearPerWave: 100,
});

export function deepDiggerWaveClearScore(wave: number): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  return (
    DEEP_DIGGER_SCORING.waveClearBase +
    DEEP_DIGGER_SCORING.waveClearPerWave * (wave - 1)
  );
}
