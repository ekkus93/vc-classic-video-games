import { assert, type TestCase } from "../../test/harness.js";
import { calculateViewport, devicePhysicalSize, physicalToLogical } from "./viewport.js";

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
  {
    name: "CR2-003 devicePhysicalSize converts a CSS dimension into device pixels",
    run: () => {
      assert(devicePhysicalSize(1366, 1) === 1366, "DPR 1 must leave a CSS size unchanged");
      assert(devicePhysicalSize(1366, 1.25) === 1708, "DPR 1.25 must round 1707.5 up to 1708");
      assert(devicePhysicalSize(1366, 1.5) === 2049, "DPR 1.5 must land on an exact device-pixel count");
      assert(devicePhysicalSize(1366, 2) === 2732, "DPR 2 must double the CSS size exactly");
      assert(devicePhysicalSize(0, 2) === 1, "a zero CSS size must floor at one device pixel");
      assert(devicePhysicalSize(0.1, 1) === 1, "a fractional device-pixel count must round up to one, not zero");

      let rejectedNegativeCss = false;
      try {
        devicePhysicalSize(-1, 1);
      } catch {
        rejectedNegativeCss = true;
      }
      assert(rejectedNegativeCss, "a negative CSS size must be rejected");

      let rejectedZeroDpr = false;
      try {
        devicePhysicalSize(100, 0);
      } catch {
        rejectedZeroDpr = true;
      }
      assert(rejectedZeroDpr, "a non-positive devicePixelRatio must be rejected");
    },
  },
  {
    name: "CR2-003 1366x768 uses an integer device-pixel scale at DPR 1, 1.25, 1.5, and 2",
    run: () => {
      // Fractional-DPR Chromebook display settings (1.25x and 1.5x are common) mean the CSS-pixel
      // size the app actually lays out at is not the panel's real device-pixel resolution. Every
      // one of these must still resolve to a whole-number scale once the CSS size is converted to
      // device pixels first -- that conversion, and only that conversion, is what CR2-003 adds;
      // calculateViewport itself is untouched.
      for (const [devicePixelRatio, expectedScale] of [
        [1, 3],
        [1.25, 4],
        [1.5, 4],
        [2, 6],
      ] as const) {
        const viewport = calculateViewport(
          { width: 320, height: 240 },
          {
            width: devicePhysicalSize(1366, devicePixelRatio),
            height: devicePhysicalSize(768, devicePixelRatio),
          },
        );
        assert(
          viewport.integerScale,
          `DPR ${devicePixelRatio} must still resolve to an integer scale once sized in device pixels`,
        );
        assert(
          viewport.scale === expectedScale,
          `DPR ${devicePixelRatio} must scale 320x240 by ${expectedScale}x in device pixels, got ${viewport.scale}`,
        );
        assert(
          Number.isInteger(viewport.scale),
          `DPR ${devicePixelRatio} scale must be a whole number of device pixels per logical pixel`,
        );
      }
    },
  },
];
