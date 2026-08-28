import type { Aabb } from "../../engine/index.js";
import { RIVER_HOPPER_RUN_RULES, type RiverHopperLaneDefinition } from "./design.js";

export interface RiverHopperLaneState {
  readonly definition: RiverHopperLaneDefinition;
  readonly offset: number;
}

export interface RiverHopperLaneSegment extends Aabb {
  readonly row: number;
  readonly kind: RiverHopperLaneDefinition["kind"];
  readonly palette: string;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function validateLane(definition: RiverHopperLaneDefinition): void {
  if (
    !Number.isInteger(definition.row) ||
    definition.row < 0 ||
    definition.row >= RIVER_HOPPER_RUN_RULES.rowCount
  ) {
    throw new RangeError("lane row is outside the River Hopper playfield");
  }
  for (const [name, value] of [
    ["speed", definition.speed],
    ["entityWidth", definition.entityWidth],
    ["spacing", definition.spacing],
    ["phase", definition.phase],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`lane ${name} must be finite`);
    }
  }
  if (definition.speed < 0 || definition.entityWidth <= 0 || definition.spacing <= 0) {
    throw new RangeError("lane speed must be non-negative and dimensions positive");
  }
  if (definition.entityWidth > definition.spacing) {
    throw new RangeError("lane entityWidth must not exceed spacing");
  }
}

export function createRiverHopperLane(
  definition: RiverHopperLaneDefinition,
): RiverHopperLaneState {
  validateLane(definition);
  return Object.freeze({
    definition,
    offset: positiveModulo(definition.phase, definition.spacing),
  });
}

export function riverHopperLaneVelocity(
  lane: RiverHopperLaneState,
  speedScale = 1,
): number {
  if (!Number.isFinite(speedScale) || speedScale < 0) {
    throw new RangeError("speedScale must be non-negative and finite");
  }
  return lane.definition.direction * lane.definition.speed * speedScale;
}

export function stepRiverHopperLane(
  lane: RiverHopperLaneState,
  dtSeconds: number,
  speedScale = 1,
): RiverHopperLaneState {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be non-negative and finite");
  }
  const spacing = lane.definition.spacing;
  return Object.freeze({
    definition: lane.definition,
    offset: positiveModulo(
      lane.offset + riverHopperLaneVelocity(lane, speedScale) * dtSeconds,
      spacing,
    ),
  });
}

export function riverHopperLaneSegments(
  lane: RiverHopperLaneState,
): readonly RiverHopperLaneSegment[] {
  const { definition, offset } = lane;
  const segments: RiverHopperLaneSegment[] = [];
  const y =
    RIVER_HOPPER_RUN_RULES.playTop +
    definition.row * RIVER_HOPPER_RUN_RULES.laneHeight;
  const first = offset - definition.spacing * 2;
  const last = RIVER_HOPPER_RUN_RULES.logicalWidth + definition.spacing;

  for (let x = first; x <= last; x += definition.spacing) {
    if (x + definition.entityWidth <= 0 || x >= RIVER_HOPPER_RUN_RULES.logicalWidth) {
      continue;
    }
    segments.push(
      Object.freeze({
        x,
        y,
        width: definition.entityWidth,
        height: RIVER_HOPPER_RUN_RULES.laneHeight,
        row: definition.row,
        kind: definition.kind,
        palette: definition.palette,
      }),
    );
  }
  return Object.freeze(segments);
}

export function riverHopperOverlapArea(a: Aabb, b: Aabb): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

export function riverHopperLaneOverlaps(
  lane: RiverHopperLaneState,
  bounds: Aabb,
): boolean {
  return riverHopperLaneSegments(lane).some(
    (segment) => riverHopperOverlapArea(segment, bounds) > 0,
  );
}
