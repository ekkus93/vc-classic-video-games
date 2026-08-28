import { assert, type TestCase } from "../../test/harness.js";
import {
  createRiverHopperLane,
  riverHopperLaneOverlaps,
  riverHopperLaneSegments,
  riverHopperLaneVelocity,
  stepRiverHopperLane,
} from "./moving-lane.js";
import type { RiverHopperLaneDefinition } from "./design.js";

const BASE: RiverHopperLaneDefinition = Object.freeze({
  row: 4,
  kind: "river",
  direction: 1,
  speed: 20,
  entityWidth: 30,
  spacing: 80,
  phase: 10,
  palette: "test",
});

export const tests: readonly TestCase[] = [
  {
    name: "P9-003 moving lanes advance periodically in either direction",
    run: () => {
      const right = createRiverHopperLane(BASE);
      const steppedRight = stepRiverHopperLane(right, 0.5);
      assert(steppedRight.offset === 20, "right-moving offset must advance by velocity times dt");
      assert(riverHopperLaneVelocity(right) === 20, "right lane velocity must be positive");

      const left = createRiverHopperLane({ ...BASE, direction: -1, phase: 5 });
      const steppedLeft = stepRiverHopperLane(left, 0.5);
      assert(steppedLeft.offset === 75, "left-moving offset must wrap through the periodic lane");
      assert(riverHopperLaneVelocity(left, 1.5) === -30, "difficulty scale must multiply lane speed");
    },
  },
  {
    name: "P9-003 periodic lane segments remain bounded to visible candidates",
    run: () => {
      const lane = createRiverHopperLane(BASE);
      const segments = riverHopperLaneSegments(lane);
      assert(segments.length >= 4 && segments.length <= 6, "only visible periodic candidates should be emitted");
      assert(segments.every((segment) => segment.x < 320 && segment.x + segment.width > 0), "segments must intersect the logical screen");
    },
  },
  {
    name: "P9-005 platform support requires positive geometric overlap",
    run: () => {
      const lane = createRiverHopperLane({ ...BASE, entityWidth: 20, spacing: 100, phase: 50 });
      assert(
        riverHopperLaneOverlaps(lane, { x: 169.5, y: 98, width: 18, height: 12 }),
        "positive sub-pixel overlap must count as support",
      );
      assert(
        !riverHopperLaneOverlaps(lane, { x: 170, y: 98, width: 18, height: 12 }),
        "edge contact without area must not count as support",
      );
    },
  },
  {
    name: "P9-003 malformed lane geometry fails closed",
    run: () => {
      let rejected = false;
      try {
        createRiverHopperLane({ ...BASE, entityWidth: 90, spacing: 80 });
      } catch (error) {
        rejected = error instanceof RangeError;
      }
      assert(rejected, "entity widths larger than spacing must be rejected");
    },
  },
];
