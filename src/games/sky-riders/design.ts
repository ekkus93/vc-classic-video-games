export const SKY_RIDERS_DIFFICULTIES = Object.freeze({
  breeze: Object.freeze({
    label: "Breeze",
    initialEnemies: 2,
    enemySpeedScale: 0.88,
  }),
  squall: Object.freeze({
    label: "Squall",
    initialEnemies: 3,
    enemySpeedScale: 1,
  }),
  tempest: Object.freeze({
    label: "Tempest",
    initialEnemies: 4,
    enemySpeedScale: 1.12,
  }),
});

export type SkyRidersDifficultyId = keyof typeof SKY_RIDERS_DIFFICULTIES;
export const SKY_RIDERS_DEFAULT_DIFFICULTY: SkyRidersDifficultyId = "squall";

export const SKY_RIDERS_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  startingLives: 3,
  maxEnemies: 8,
  riderHalfWidth: 7,
  riderHalfHeight: 8,
  horizontalAcceleration: 285,
  horizontalDragPerSecond: 3.2,
  playerMaxHorizontalSpeed: 92,
  enemyMaxHorizontalSpeed: 78,
  gravity: 235,
  flapImpulse: 108,
  flapCooldownSeconds: 0.16,
  maxFallSpeed: 155,
  altitudeVictoryPixels: 4,
  collisionBounceSpeed: 38,
  spawnProtectionSeconds: 1,
  stormSeedLifetimeSeconds: 6,
  stormSeedRadius: 4,
  stormSeedGravity: 180,
  stormSeedMaxFallSpeed: 115,
});

export const SKY_RIDERS_SCORING = Object.freeze({
  enemyBase: 100,
  enemyPerWave: 20,
  recovery: 175,
  waveClearBase: 400,
  waveClearPerWave: 100,
});

export interface SkyRidersPlatform {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export const SKY_RIDERS_PLATFORMS: readonly SkyRidersPlatform[] = Object.freeze([
  Object.freeze({ id: "lower-shelf", x: 0, y: 226, width: 320 }),
  Object.freeze({ id: "west-ledge", x: 24, y: 162, width: 92 }),
  Object.freeze({ id: "east-ledge", x: 202, y: 154, width: 94 }),
  Object.freeze({ id: "crown-ledge", x: 108, y: 92, width: 104 }),
]);

export function skyRidersEnemyScore(wave: number): number {
  requireWave(wave);
  return SKY_RIDERS_SCORING.enemyBase + SKY_RIDERS_SCORING.enemyPerWave * (wave - 1);
}

export function skyRidersWaveClearScore(wave: number): number {
  requireWave(wave);
  return SKY_RIDERS_SCORING.waveClearBase + SKY_RIDERS_SCORING.waveClearPerWave * (wave - 1);
}

export function skyRidersEnemyCount(
  difficulty: SkyRidersDifficultyId,
  wave: number,
): number {
  requireWave(wave);
  return Math.min(
    SKY_RIDERS_RUN_RULES.maxEnemies,
    SKY_RIDERS_DIFFICULTIES[difficulty].initialEnemies + Math.floor((wave - 1) / 2),
  );
}

function requireWave(wave: number): void {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
}
