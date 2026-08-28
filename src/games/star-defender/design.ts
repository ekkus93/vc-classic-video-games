export const STAR_DEFENDER_DIFFICULTIES = Object.freeze({
  patrol: Object.freeze({
    label: "Patrol",
    initialEnemies: 6,
    enemySpeedScale: 0.84,
    waveGrowth: 1,
    abductionSpeedScale: 0.82,
  }),
  frontier: Object.freeze({
    label: "Frontier",
    initialEnemies: 8,
    enemySpeedScale: 1,
    waveGrowth: 2,
    abductionSpeedScale: 1,
  }),
  siege: Object.freeze({
    label: "Siege",
    initialEnemies: 10,
    enemySpeedScale: 1.18,
    waveGrowth: 3,
    abductionSpeedScale: 1.22,
  }),
});

export type StarDefenderDifficultyId = keyof typeof STAR_DEFENDER_DIFFICULTIES;

export const STAR_DEFENDER_DEFAULT_DIFFICULTY: StarDefenderDifficultyId =
  "frontier";

export const STAR_DEFENDER_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  worldWidth: 2048,
  playfieldTop: 50,
  startingLives: 3,
  startingEmergencyCharges: 2,
  maxEmergencyCharges: 3,
  inhabitantCount: 6,
  maxEnemies: 24,
  maxProjectiles: 12,
  projectileLifetimeSeconds: 1.45,
  projectileSpeed: 238,
  fireCooldownSeconds: 0.13,
  playerRadius: 7,
  enemyRadius: 7,
  projectileRadius: 2,
  inhabitantRadius: 4,
  respawnProtectionSeconds: 1.6,
});

export const STAR_DEFENDER_PLAYER_RULES = Object.freeze({
  horizontalAcceleration: 205,
  verticalAcceleration: 158,
  horizontalDragPerSecond: 1.28,
  verticalDragPerSecond: 1.62,
  maxHorizontalSpeed: 142,
  maxVerticalSpeed: 92,
  cameraLookAhead: 46,
});

export const STAR_DEFENDER_SCORING = Object.freeze({
  snatcher: 120,
  stalker: 180,
  skimmer: 230,
  fallingCatch: 160,
  safeReturn: 420,
  waveClearBase: 500,
  waveClearPerWave: 90,
});

export function starDefenderWaveEnemyCount(
  wave: number,
  difficulty: StarDefenderDifficultyId,
): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  const profile = STAR_DEFENDER_DIFFICULTIES[difficulty];
  return Math.min(
    STAR_DEFENDER_RUN_RULES.maxEnemies,
    profile.initialEnemies + profile.waveGrowth * (wave - 1),
  );
}

export function starDefenderWaveClearScore(wave: number): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  return (
    STAR_DEFENDER_SCORING.waveClearBase +
    STAR_DEFENDER_SCORING.waveClearPerWave * (wave - 1)
  );
}
