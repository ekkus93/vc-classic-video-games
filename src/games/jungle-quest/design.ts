export const JUNGLE_QUEST_DIFFICULTIES = Object.freeze({
  trail: Object.freeze({ label: "Trail", timeLimitSeconds: 210, startingLives: 4, respawnProtectionSeconds: 1.5 }),
  expedition: Object.freeze({ label: "Expedition", timeLimitSeconds: 165, startingLives: 3, respawnProtectionSeconds: 1.1 }),
  tempest: Object.freeze({ label: "Tempest", timeLimitSeconds: 130, startingLives: 2, respawnProtectionSeconds: 0.8 }),
});
export type JungleQuestDifficultyId = keyof typeof JUNGLE_QUEST_DIFFICULTIES;
export const JUNGLE_QUEST_DEFAULT_DIFFICULTY: JungleQuestDifficultyId = "expedition";
export const JUNGLE_QUEST_RUN_RULES = Object.freeze({
  logicalWidth: 320, logicalHeight: 240, playerWidth: 10, playerHeight: 16,
  runAcceleration: 520, groundFriction: 680, maxRunSpeed: 76, gravity: 560,
  maxFallSpeed: 190, jumpSpeed: 178, climbSpeed: 62, vinePumpAcceleration: 2.2,
  maxVineAngularSpeed: 2.7, maxVineAngleRadians: 1.12,
});
export const JUNGLE_QUEST_SCORING = Object.freeze({
  relic: 250, checkpoint: 75, completion: 1200, remainingLife: 180, remainingSecond: 4, hazardPenalty: 100,
});
