export const BUG_BARRAGE_DIFFICULTIES = Object.freeze({
  garden: Object.freeze({
    label: "Garden",
    segmentSpeedScale: 0.82,
    initialObstacles: 24,
    initialSegments: 9,
    roamerIntervalScale: 1.2,
  }),
  swarm: Object.freeze({
    label: "Swarm",
    segmentSpeedScale: 1,
    initialObstacles: 30,
    initialSegments: 11,
    roamerIntervalScale: 1,
  }),
  outbreak: Object.freeze({
    label: "Outbreak",
    segmentSpeedScale: 1.18,
    initialObstacles: 36,
    initialSegments: 13,
    roamerIntervalScale: 0.82,
  }),
});

export type BugBarrageDifficultyId = keyof typeof BUG_BARRAGE_DIFFICULTIES;

export const BUG_BARRAGE_DEFAULT_DIFFICULTY: BugBarrageDifficultyId = "swarm";

export const BUG_BARRAGE_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  playerRegionTop: 176,
  playerRegionBottom: 228,
  startingLives: 3,
  playerSpeed: 112,
  playerRadius: 6,
  projectileSpeed: 260,
  projectileCooldownSeconds: 0.14,
  projectileRadius: 2,
  segmentRadius: 6,
  obstacleRadius: 7,
  rowStep: 12,
  maxObstacleHealth: 3,
  respawnProtectionSeconds: 1.2,
});

export const BUG_BARRAGE_LIMITS = Object.freeze({
  maxProjectiles: 7,
  maxObstacles: 56,
  maxChains: 32,
  maxSegments: 40,
  maxRoamers: 6,
  maxEffects: 72,
});

export const BUG_BARRAGE_SCORING = Object.freeze({
  segment: 40,
  headSegment: 70,
  obstacleHit: 5,
  obstacleDestroyed: 25,
  skimmer: 120,
  mender: 180,
  waveBase: 360,
  waveStep: 80,
});

export function bugBarrageWaveSegmentCount(
  wave: number,
  difficulty: BugBarrageDifficultyId,
): number {
  requireWave(wave);
  return Math.min(
    BUG_BARRAGE_LIMITS.maxSegments,
    BUG_BARRAGE_DIFFICULTIES[difficulty].initialSegments + (wave - 1) * 2,
  );
}

export function bugBarrageWaveObstacleCount(
  wave: number,
  difficulty: BugBarrageDifficultyId,
): number {
  requireWave(wave);
  return Math.min(
    BUG_BARRAGE_LIMITS.maxObstacles,
    BUG_BARRAGE_DIFFICULTIES[difficulty].initialObstacles + (wave - 1) * 2,
  );
}

export function bugBarrageSegmentSpeed(
  wave: number,
  difficulty: BugBarrageDifficultyId,
): number {
  requireWave(wave);
  return Math.min(
    188,
    54 * BUG_BARRAGE_DIFFICULTIES[difficulty].segmentSpeedScale *
      (1 + (wave - 1) * 0.09),
  );
}

export function bugBarrageRoamerInterval(
  wave: number,
  difficulty: BugBarrageDifficultyId,
): number {
  requireWave(wave);
  return Math.max(
    1.25,
    4.2 * BUG_BARRAGE_DIFFICULTIES[difficulty].roamerIntervalScale -
      (wave - 1) * 0.18,
  );
}

export function bugBarrageWaveClearScore(wave: number): number {
  requireWave(wave);
  return BUG_BARRAGE_SCORING.waveBase + BUG_BARRAGE_SCORING.waveStep * (wave - 1);
}

function requireWave(wave: number): void {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
}
