import { BARREL_CLIMBER_RUN_RULES } from "./design.js";

export interface BarrelClimberPlatform {
  readonly id: string;
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly hazardDirection: -1 | 1;
}

export interface BarrelClimberLadder {
  readonly id: string;
  readonly x: number;
  readonly yTop: number;
  readonly yBottom: number;
  readonly topPlatformId: string;
  readonly bottomPlatformId: string;
  readonly hazardDropChance: number;
}

export interface BarrelClimberGoal {
  readonly x: number;
  readonly width: number;
  readonly platformId: string;
  readonly label: string;
}

export interface BarrelClimberHazardSpawn {
  readonly x: number;
  readonly platformId: string;
  readonly direction: -1 | 1;
}

export interface BarrelClimberStagePalette {
  readonly background: string;
  readonly platform: string;
  readonly platformEdge: string;
  readonly ladder: string;
  readonly accent: string;
  readonly hazard: string;
}

export interface BarrelClimberStage {
  readonly id: string;
  readonly name: string;
  readonly mechanic: string;
  readonly platforms: readonly BarrelClimberPlatform[];
  readonly ladders: readonly BarrelClimberLadder[];
  readonly playerSpawn: Readonly<{ x: number; platformId: string }>;
  readonly hazardSpawn: BarrelClimberHazardSpawn;
  readonly goal: BarrelClimberGoal;
  readonly palette: BarrelClimberStagePalette;
}

function platform(
  id: string,
  x1: number,
  x2: number,
  y: number,
  hazardDirection: -1 | 1,
): BarrelClimberPlatform {
  return Object.freeze({ id, x1, x2, y, hazardDirection });
}

function ladder(
  id: string,
  x: number,
  yTop: number,
  yBottom: number,
  topPlatformId: string,
  bottomPlatformId: string,
  hazardDropChance: number,
): BarrelClimberLadder {
  return Object.freeze({
    id,
    x,
    yTop,
    yBottom,
    topPlatformId,
    bottomPlatformId,
    hazardDropChance,
  });
}

const COPPER_RISE_PLATFORMS = Object.freeze([
  platform("c0", 10, 310, 222, -1),
  platform("c1", 18, 286, 183, 1),
  platform("c2", 34, 310, 144, -1),
  platform("c3", 12, 280, 105, 1),
  platform("c4", 52, 308, 66, -1),
]);

const GLASSWORKS_PLATFORMS = Object.freeze([
  platform("g0", 12, 308, 222, 1),
  platform("g1", 48, 310, 184, -1),
  platform("g2", 10, 266, 146, 1),
  platform("g3", 52, 310, 108, -1),
  platform("g4", 10, 276, 70, 1),
]);

const NIGHT_CRANE_PLATFORMS = Object.freeze([
  platform("n0", 10, 310, 222, -1),
  platform("n1", 10, 252, 181, 1),
  platform("n2", 64, 310, 140, -1),
  platform("n3", 10, 256, 99, 1),
  platform("n4", 64, 310, 58, -1),
]);

export const BARREL_CLIMBER_STAGES: readonly BarrelClimberStage[] = Object.freeze([
  Object.freeze({
    id: "copper-rise",
    name: "Copper Rise",
    mechanic: "Wide switchbacks introduce edge drops and a single hazard ladder route.",
    platforms: COPPER_RISE_PLATFORMS,
    ladders: Object.freeze([
      ladder("c-l0", 256, 183, 222, "c1", "c0", 0.08),
      ladder("c-l1", 72, 144, 183, "c2", "c1", 0.18),
      ladder("c-l2", 244, 105, 144, "c3", "c2", 0.1),
      ladder("c-l3", 92, 66, 105, "c4", "c3", 0.34),
      ladder("c-l4", 182, 144, 183, "c2", "c1", 0),
    ]),
    playerSpawn: Object.freeze({ x: 28, platformId: "c0" }),
    hazardSpawn: Object.freeze({ x: 286, platformId: "c4", direction: -1 }),
    goal: Object.freeze({ x: 66, width: 22, platformId: "c4", label: "LIFT" }),
    palette: Object.freeze({
      background: "#100b16",
      platform: "#824c3a",
      platformEdge: "#f29b5b",
      ladder: "#e3c16f",
      accent: "#5eead4",
      hazard: "#d46d3e",
    }),
  }),
  Object.freeze({
    id: "glassworks",
    name: "Glassworks",
    mechanic: "Offset decks create longer falls and two aggressive hazard ladder choices.",
    platforms: GLASSWORKS_PLATFORMS,
    ladders: Object.freeze([
      ladder("g-l0", 72, 184, 222, "g1", "g0", 0.14),
      ladder("g-l1", 238, 146, 184, "g2", "g1", 0.32),
      ladder("g-l2", 78, 108, 146, "g3", "g2", 0.24),
      ladder("g-l3", 244, 70, 108, "g4", "g3", 0.42),
      ladder("g-l4", 160, 108, 146, "g3", "g2", 0),
    ]),
    playerSpawn: Object.freeze({ x: 286, platformId: "g0" }),
    hazardSpawn: Object.freeze({ x: 30, platformId: "g4", direction: 1 }),
    goal: Object.freeze({ x: 260, width: 22, platformId: "g4", label: "VALVE" }),
    palette: Object.freeze({
      background: "#07151c",
      platform: "#315a68",
      platformEdge: "#72d4e8",
      ladder: "#b8f3ff",
      accent: "#f7cf65",
      hazard: "#ff7b54",
    }),
  }),
  Object.freeze({
    id: "night-crane",
    name: "Night Crane",
    mechanic: "Narrow upper decks and frequent ladder drops compress reaction windows.",
    platforms: NIGHT_CRANE_PLATFORMS,
    ladders: Object.freeze([
      ladder("n-l0", 220, 181, 222, "n1", "n0", 0.2),
      ladder("n-l1", 88, 140, 181, "n2", "n1", 0.3),
      ladder("n-l2", 226, 99, 140, "n3", "n2", 0.36),
      ladder("n-l3", 88, 58, 99, "n4", "n3", 0.48),
      ladder("n-l4", 170, 140, 181, "n2", "n1", 0.12),
    ]),
    playerSpawn: Object.freeze({ x: 30, platformId: "n0" }),
    hazardSpawn: Object.freeze({ x: 292, platformId: "n4", direction: -1 }),
    goal: Object.freeze({ x: 78, width: 22, platformId: "n4", label: "CRANE" }),
    palette: Object.freeze({
      background: "#090d1d",
      platform: "#39466b",
      platformEdge: "#829cf6",
      ladder: "#a7b8ff",
      accent: "#ff8bd8",
      hazard: "#f29b5b",
    }),
  }),
]);

export function barrelClimberPlatformById(
  stage: BarrelClimberStage,
  platformId: string,
): BarrelClimberPlatform {
  const match = stage.platforms.find((candidate) => candidate.id === platformId);
  if (match === undefined) {
    throw new Error(`Unknown Barrel Climber platform: ${platformId}`);
  }
  return match;
}

export function validateBarrelClimberStage(stage: BarrelClimberStage): void {
  const ids = new Set(stage.platforms.map((item) => item.id));
  if (ids.size !== stage.platforms.length) {
    throw new Error(`${stage.id} has duplicate platform IDs`);
  }
  if (!ids.has(stage.playerSpawn.platformId) || !ids.has(stage.hazardSpawn.platformId) || !ids.has(stage.goal.platformId)) {
    throw new Error(`${stage.id} references an unknown platform`);
  }
  for (const item of stage.platforms) {
    if (item.x1 < 0 || item.x2 > BARREL_CLIMBER_RUN_RULES.logicalWidth || item.x1 >= item.x2) {
      throw new Error(`${stage.id}/${item.id} has invalid horizontal bounds`);
    }
    if (item.y <= 24 || item.y >= BARREL_CLIMBER_RUN_RULES.logicalHeight) {
      throw new Error(`${stage.id}/${item.id} has invalid vertical placement`);
    }
  }
  for (const item of stage.ladders) {
    if (!ids.has(item.topPlatformId) || !ids.has(item.bottomPlatformId)) {
      throw new Error(`${stage.id}/${item.id} references an unknown platform`);
    }
    const top = barrelClimberPlatformById(stage, item.topPlatformId);
    const bottom = barrelClimberPlatformById(stage, item.bottomPlatformId);
    if (item.yTop !== top.y || item.yBottom !== bottom.y || item.yTop >= item.yBottom) {
      throw new Error(`${stage.id}/${item.id} does not bridge its declared platforms`);
    }
    if (item.x < Math.max(top.x1, bottom.x1) || item.x > Math.min(top.x2, bottom.x2)) {
      throw new Error(`${stage.id}/${item.id} lies outside its platform overlap`);
    }
    if (item.hazardDropChance < 0 || item.hazardDropChance > 1) {
      throw new Error(`${stage.id}/${item.id} has an invalid hazard drop chance`);
    }
  }
}

for (const stage of BARREL_CLIMBER_STAGES) {
  validateBarrelClimberStage(stage);
}
