import { assert, type TestCase } from "../../test/harness.js";
import { intersectsAabb, intersectsCircle, segmentsIntersect } from "./collision.js";
import { add, normalize, wrapCoordinate } from "./vector2.js";

export const tests: readonly TestCase[] = [
  {
    name: "vector helpers normalize and wrap coordinates across world edges",
    run: () => {
      const sum = add({ x: 2, y: -1 }, { x: 3, y: 5 });
      const unit = normalize({ x: 3, y: 4 });
      assert(sum.x === 5 && sum.y === 4, "vector addition must preserve components");
      assert(Math.abs(unit.x - 0.6) < 1e-12 && Math.abs(unit.y - 0.8) < 1e-12, "normalization must produce unit direction");
      assert(wrapCoordinate(-1, 320) === 319, "negative coordinate must wrap to far edge");
      assert(wrapCoordinate(321, 320) === 1, "overflow coordinate must wrap to near edge");
    },
  },
  {
    name: "AABB and circle collision include touching edges",
    run: () => {
      assert(
        intersectsAabb(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 10, y: 10, width: 5, height: 5 },
        ),
        "touching AABB corners must count as intersection",
      );
      assert(
        intersectsCircle(
          { x: 0, y: 0, radius: 5 },
          { x: 10, y: 0, radius: 5 },
        ),
        "touching circle edges must count as intersection",
      );
    },
  },
  {
    name: "segment intersection handles crossing, endpoint, parallel, and collinear cases",
    run: () => {
      assert(
        segmentsIntersect(
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ),
        "crossing segments must intersect",
      );
      assert(
        segmentsIntersect(
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ),
        "shared endpoints must intersect",
      );
      assert(
        !segmentsIntersect(
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 1 },
          { x: 10, y: 1 },
        ),
        "separate parallel segments must not intersect",
      );
      assert(
        segmentsIntersect(
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 0 },
          { x: 15, y: 0 },
        ),
        "overlapping collinear segments must intersect",
      );
    },
  },
];
