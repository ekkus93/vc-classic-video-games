export const MISSILE_DEFENSE_DIFFICULTIES = Object.freeze({
  watch: Object.freeze({
    label: "Watch",
    enemyMissiles: 8,
    enemySpeed: 20,
    spawnIntervalSeconds: 0.9,
  }),
  guard: Object.freeze({
    label: "Guard",
    enemyMissiles: 11,
    enemySpeed: 25,
    spawnIntervalSeconds: 0.72,
  }),
  siege: Object.freeze({
    label: "Siege",
    enemyMissiles: 14,
    enemySpeed: 31,
    spawnIntervalSeconds: 0.58,
  }),
});

export type MissileDefenseDifficultyId = keyof typeof MISSILE_DEFENSE_DIFFICULTIES;

export const MISSILE_DEFENSE_DEFAULT_DIFFICULTY: MissileDefenseDifficultyId = "guard";

export const MISSILE_DEFENSE_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  groundY: 214,
  cursorMinY: 24,
  cursorMaxY: 196,
  cursorSpeed: 110,
  batteryAmmo: 8,
  batteryAmmoCap: 12,
  interceptorSpeed: 132,
  explosionMaxRadius: 25,
  explosionExpandSpeed: 54,
  explosionContractSpeed: 38,
  maxInterceptors: 18,
  maxExplosions: 24,
  maxEnemyMissiles: 22,
  waveTransitionSeconds: 1.25,
});

export const MISSILE_DEFENSE_SCORING = Object.freeze({
  interceptedMissile: 80,
  chainMissile: 120,
  survivingCity: 110,
  remainingAmmo: 12,
  waveBase: 180,
  waveStep: 55,
});

export const MISSILE_DEFENSE_CITY_X = Object.freeze([44, 82, 121, 199, 238, 276]);
export const MISSILE_DEFENSE_BATTERY_X = Object.freeze([18, 160, 302]);

export function missileDefenseWaveBonus(wave: number): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  return (
    MISSILE_DEFENSE_SCORING.waveBase +
    MISSILE_DEFENSE_SCORING.waveStep * (wave - 1)
  );
}

export function missileDefenseEnemyCount(
  difficulty: MissileDefenseDifficultyId,
  wave: number,
): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  return Math.min(
    28,
    MISSILE_DEFENSE_DIFFICULTIES[difficulty].enemyMissiles + (wave - 1) * 2,
  );
}
