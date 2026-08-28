export const SPACE_ROCKS_DIFFICULTIES = Object.freeze({
  drift: Object.freeze({
    label: "Drift",
    initialLargeRocks: 3,
    rockSpeedScale: 0.82,
    spawnProtectionSeconds: 2.25,
  }),
  orbit: Object.freeze({
    label: "Orbit",
    initialLargeRocks: 4,
    rockSpeedScale: 1,
    spawnProtectionSeconds: 1.75,
  }),
  nova: Object.freeze({
    label: "Nova",
    initialLargeRocks: 5,
    rockSpeedScale: 1.18,
    spawnProtectionSeconds: 1.25,
  }),
});

export type SpaceRocksDifficultyId = keyof typeof SPACE_ROCKS_DIFFICULTIES;

export const SPACE_ROCKS_DEFAULT_DIFFICULTY: SpaceRocksDifficultyId = "orbit";

export const SPACE_ROCKS_SCORING = Object.freeze({
  largeRock: 35,
  mediumRock: 90,
  smallRock: 225,
  waveClearBase: 300,
  waveClearPerWave: 60,
});

export const SPACE_ROCKS_RUN_RULES = Object.freeze({
  startingLives: 3,
  logicalWidth: 320,
  logicalHeight: 240,
});

export function spaceRocksWaveClearScore(wave: number): number {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
  return (
    SPACE_ROCKS_SCORING.waveClearBase +
    SPACE_ROCKS_SCORING.waveClearPerWave * (wave - 1)
  );
}
