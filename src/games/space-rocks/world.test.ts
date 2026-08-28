import { assert, type TestCase } from "../../test/harness.js";
import {
  advanceWrappedSpaceRocksPosition,
  wrapSpaceRocksPosition,
} from "./world.js";

export const tests: readonly TestCase[] = [
  {
    name: "P7-003 entities wrap seamlessly across all four world boundaries",
    run: () => {
      const left = wrapSpaceRocksPosition({ x: -1, y: 120 });
      const right = wrapSpaceRocksPosition({ x: 320, y: 120 });
      const top = wrapSpaceRocksPosition({ x: 160, y: -1 });
      const bottom = wrapSpaceRocksPosition({ x: 160, y: 240 });

      assert(left.x === 319 && left.y === 120, "left edge must wrap to the right side");
      assert(right.x === 0 && right.y === 120, "right edge must wrap to the left side");
      assert(top.x === 160 && top.y === 239, "top edge must wrap to the bottom side");
      assert(bottom.x === 160 && bottom.y === 0, "bottom edge must wrap to the top side");
    },
  },
  {
    name: "P7-003 wrapped motion handles diagonal multi-axis crossing",
    run: () => {
      const position = advanceWrappedSpaceRocksPosition(
        { x: 318, y: 238 },
        { x: 12, y: 18 },
        0.5,
      );
      assert(position.x === 4, "horizontal movement must preserve overshoot across seam");
      assert(position.y === 7, "vertical movement must preserve overshoot across seam");
    },
  },
];
