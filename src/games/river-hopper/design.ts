export type RiverHopperLaneKind = "road" | "river";
export type RiverHopperDirection = "up" | "down" | "left" | "right";

export interface RiverHopperLaneDefinition {
  readonly row: number;
  readonly kind: RiverHopperLaneKind;
  readonly direction: -1 | 1;
  readonly speed: number;
  readonly entityWidth: number;
  readonly spacing: number;
  readonly phase: number;
  readonly palette: string;
}

export interface RiverHopperStageDefinition {
  readonly id: string;
  readonly label: string;
  readonly lanes: readonly RiverHopperLaneDefinition[];
}

export const RIVER_HOPPER_DIFFICULTIES = Object.freeze({
  brook: Object.freeze({
    label: "Brook",
    laneSpeedScale: 0.82,
    timeSeconds: 50,
    minimumTimeSeconds: 34,
  }),
  channel: Object.freeze({
    label: "Channel",
    laneSpeedScale: 1,
    timeSeconds: 43,
    minimumTimeSeconds: 29,
  }),
  torrent: Object.freeze({
    label: "Torrent",
    laneSpeedScale: 1.2,
    timeSeconds: 36,
    minimumTimeSeconds: 24,
  }),
});

export type RiverHopperDifficultyId = keyof typeof RIVER_HOPPER_DIFFICULTIES;

export const RIVER_HOPPER_DEFAULT_DIFFICULTY: RiverHopperDifficultyId = "channel";

export const RIVER_HOPPER_RUN_RULES = Object.freeze({
  logicalWidth: 320,
  logicalHeight: 240,
  playTop: 32,
  laneHeight: 16,
  rowCount: 12,
  startRow: 11,
  medianRow: 5,
  goalRow: 0,
  playerWidth: 18,
  playerHeight: 12,
  horizontalHopDistance: 32,
  hopDurationSeconds: 0.105,
  startingLives: 4,
  roundSpeedStep: 0.065,
  maxRoundSpeedScale: 1.75,
  timerDropEveryRounds: 2,
  timerDropSeconds: 2,
});

export const RIVER_HOPPER_SCORING = Object.freeze({
  forwardRow: 15,
  goalBase: 260,
  timeSecond: 5,
  roundBase: 900,
  roundStep: 175,
});

export const RIVER_HOPPER_GOAL_COLUMNS = Object.freeze([0, 2, 4, 6, 8]);

const stage = (
  id: string,
  label: string,
  lanes: readonly RiverHopperLaneDefinition[],
): RiverHopperStageDefinition =>
  Object.freeze({
    id,
    label,
    lanes: Object.freeze(lanes.map((lane) => Object.freeze({ ...lane }))),
  });

export const RIVER_HOPPER_STAGES: readonly RiverHopperStageDefinition[] =
  Object.freeze([
    stage("copper-bend", "Copper Bend", [
      { row: 1, kind: "river", direction: -1, speed: 28, entityWidth: 70, spacing: 98, phase: 14, palette: "copper" },
      { row: 2, kind: "river", direction: 1, speed: 37, entityWidth: 54, spacing: 86, phase: 43, palette: "moss" },
      { row: 3, kind: "river", direction: -1, speed: 47, entityWidth: 78, spacing: 116, phase: 71, palette: "slate" },
      { row: 4, kind: "river", direction: 1, speed: 32, entityWidth: 46, spacing: 78, phase: 21, palette: "amber" },
      { row: 6, kind: "road", direction: 1, speed: 50, entityWidth: 24, spacing: 84, phase: 12, palette: "coral" },
      { row: 7, kind: "road", direction: -1, speed: 69, entityWidth: 38, spacing: 112, phase: 57, palette: "cyan" },
      { row: 8, kind: "road", direction: 1, speed: 43, entityWidth: 30, spacing: 76, phase: 5, palette: "lime" },
      { row: 9, kind: "road", direction: -1, speed: 61, entityWidth: 24, spacing: 91, phase: 39, palette: "violet" },
      { row: 10, kind: "road", direction: 1, speed: 77, entityWidth: 42, spacing: 128, phase: 83, palette: "gold" },
    ]),
    stage("lantern-reach", "Lantern Reach", [
      { row: 1, kind: "river", direction: 1, speed: 42, entityWidth: 58, spacing: 92, phase: 9, palette: "moss" },
      { row: 2, kind: "river", direction: -1, speed: 55, entityWidth: 82, spacing: 126, phase: 77, palette: "slate" },
      { row: 3, kind: "river", direction: 1, speed: 34, entityWidth: 44, spacing: 74, phase: 29, palette: "amber" },
      { row: 4, kind: "river", direction: -1, speed: 63, entityWidth: 66, spacing: 106, phase: 51, palette: "copper" },
      { row: 6, kind: "road", direction: -1, speed: 82, entityWidth: 28, spacing: 96, phase: 68, palette: "violet" },
      { row: 7, kind: "road", direction: 1, speed: 56, entityWidth: 46, spacing: 130, phase: 15, palette: "gold" },
      { row: 8, kind: "road", direction: -1, speed: 73, entityWidth: 22, spacing: 78, phase: 32, palette: "coral" },
      { row: 9, kind: "road", direction: 1, speed: 91, entityWidth: 34, spacing: 119, phase: 90, palette: "cyan" },
      { row: 10, kind: "road", direction: -1, speed: 48, entityWidth: 30, spacing: 87, phase: 44, palette: "lime" },
    ]),
    stage("cedar-run", "Cedar Run", [
      { row: 1, kind: "river", direction: -1, speed: 58, entityWidth: 48, spacing: 80, phase: 33, palette: "amber" },
      { row: 2, kind: "river", direction: 1, speed: 45, entityWidth: 72, spacing: 118, phase: 81, palette: "copper" },
      { row: 3, kind: "river", direction: -1, speed: 69, entityWidth: 56, spacing: 94, phase: 17, palette: "moss" },
      { row: 4, kind: "river", direction: 1, speed: 51, entityWidth: 86, spacing: 136, phase: 61, palette: "slate" },
      { row: 6, kind: "road", direction: 1, speed: 94, entityWidth: 26, spacing: 98, phase: 3, palette: "gold" },
      { row: 7, kind: "road", direction: -1, speed: 62, entityWidth: 50, spacing: 142, phase: 105, palette: "lime" },
      { row: 8, kind: "road", direction: 1, speed: 79, entityWidth: 28, spacing: 82, phase: 47, palette: "cyan" },
      { row: 9, kind: "road", direction: -1, speed: 101, entityWidth: 36, spacing: 132, phase: 72, palette: "coral" },
      { row: 10, kind: "road", direction: 1, speed: 67, entityWidth: 24, spacing: 88, phase: 26, palette: "violet" },
    ]),
  ]);

export function riverHopperRowCenter(row: number): number {
  if (!Number.isInteger(row) || row < 0 || row >= RIVER_HOPPER_RUN_RULES.rowCount) {
    throw new RangeError("row must reference a River Hopper lane");
  }
  return (
    RIVER_HOPPER_RUN_RULES.playTop +
    row * RIVER_HOPPER_RUN_RULES.laneHeight +
    RIVER_HOPPER_RUN_RULES.laneHeight / 2
  );
}

export function riverHopperGoalCenter(slotIndex: number): number {
  const column = RIVER_HOPPER_GOAL_COLUMNS[slotIndex];
  if (column === undefined) {
    throw new RangeError("slotIndex must reference a River Hopper goal");
  }
  return column * RIVER_HOPPER_RUN_RULES.horizontalHopDistance + 16;
}

export function riverHopperRoundBonus(round: number): number {
  if (!Number.isSafeInteger(round) || round < 1) {
    throw new RangeError("round must be a positive safe integer");
  }
  return (
    RIVER_HOPPER_SCORING.roundBase +
    (round - 1) * RIVER_HOPPER_SCORING.roundStep
  );
}
