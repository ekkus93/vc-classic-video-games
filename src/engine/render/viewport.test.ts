import { assert, type TestCase } from "../../test/harness.js";
import { calculateViewport, physicalToLogical } from "./viewport.js";

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 1e-9;
}

export const tests: readonly TestCase[] = [
  {
    name: "1366x768 Chromebook viewport uses centered integer nearest-neighbor scale",
    run: () => {
      const viewport = calculateViewport(
        { width: 320, height: 240 },
        { width: 1366, height: 768 },
      );

      assert(viewport.scale === 3, "320x240 must use 3x integer scale at 1366x768");
      assert(viewport.width === 960 && viewport.height === 720, "scaled dimensions must preserve aspect ratio");
      assert(viewport.x === 203 && viewport.y === 24, "viewport must be centered with letterboxing");
      assert(viewport.integerScale, "viewport should report integer scaling when it fits");
    },
  },
  {
    name: "portrait logical framebuffer uses the same aspect-preserving viewport algorithm",
    run: () => {
      const viewport = calculateViewport(
        { width: 240, height: 320 },
        { width: 768, height: 1366 },
      );
      assert(viewport.scale === 3, "portrait game must also prefer integer scale");
      assert(viewport.width === 720 && viewport.height === 960, "portrait aspect ratio must be preserved");
      assert(viewport.x === 24 && viewport.y === 203, "portrait viewport must be centered");
    },
  },
  {
    name: "viewport falls back to fractional scaling when integer scale cannot fit",
    run: () => {
      const viewport = calculateViewport(
        { width: 320, height: 240 },
        { width: 160, height: 120 },
      );
      assert(viewport.scale === 0.5, "small viewport must use fractional fallback");
      assert(!viewport.integerScale, "fractional fallback must be reported");
      assert(viewport.x === 0 && viewport.y === 0, "matching aspect ratio needs no bars");
    },
  },
  {
    name: "pointer coordinates normalize through letterbox offset and scale",
    run: () => {
      const viewport = calculateViewport(
        { width: 320, height: 240 },
        { width: 1366, height: 768 },
      );
      const center = physicalToLogical(viewport, 683, 384);
      const topLeft = physicalToLogical(viewport, 203, 24);
      const bottomRight = physicalToLogical(viewport, 1163, 744);

      assert(center !== null && near(center.x, 160) && near(center.y, 120), "physical center must map to logical center");
      assert(topLeft !== null && topLeft.x === 0 && topLeft.y === 0, "viewport origin must map to logical origin");
      assert(
        bottomRight !== null && bottomRight.x === 320 && bottomRight.y === 240,
        "viewport far corner must map to logical far corner",
      );
      assert(physicalToLogical(viewport, 0, 0) === null, "letterbox coordinates must not map into game space");
    },
  },
];
