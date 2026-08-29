import { assert, type TestCase } from "../../test/harness.js";
import { resizeCanvasToDevicePixels, type ResizableCanvas } from "./canvas-resize.js";
import { pointerViewportPhysicalSize } from "./pointer-viewport.js";

const DPRS: readonly number[] = [1, 1.25, 1.5, 2, 3];

/**
 * CR4-002: every pair has `width !== height`. A square fixture cannot tell a transposed
 * `pointerViewportPhysicalSize` apart from a correct one -- swapping width and height on a square
 * input changes nothing observable. 0×1 and 1×0 also cover the flooring boundary asymmetrically.
 */
const ASYMMETRIC_CSS_SIZES: ReadonlyArray<{ readonly width: number; readonly height: number }> = [
  { width: 1366, height: 768 },
  { width: 640, height: 480 },
  { width: 3, height: 4 },
  { width: 0, height: 1 },
  { width: 1, height: 0 },
];

/**
 * Minimal `ResizableCanvas` fake for this file only -- `canvas-resize.test.ts`'s `FakeCanvas`
 * (with its assignment-counting spy) is that file's own concern and stays unexported; this test
 * only needs the resulting size, not a record of how many times it was written.
 */
class MinimalResizableCanvas implements ResizableCanvas {
  public width = 0;
  public height = 0;

  public constructor(
    public readonly clientWidth: number,
    public readonly clientHeight: number,
  ) {}
}

export const tests: readonly TestCase[] = [
  {
    // CR4-002: the CR3-003 version of this test compared pointerViewportPhysicalSize against an
    // inline `devicePhysicalSize(size, dpr)` re-implementation of the render path, using a square
    // fixture -- so it passed even with the render path broken (a different test happened to pin
    // that separately) and even with width/height transposed inside the pointer helper (a square
    // fixture can't tell). This version calls both real functions and uses only asymmetric sizes,
    // so it fails if either path changes without the other.
    name: "CR4-002 the pointer path agrees with the real render path for every DPR and asymmetric CSS size",
    run: () => {
      for (const dpr of DPRS) {
        for (const { width, height } of ASYMMETRIC_CSS_SIZES) {
          const canvas = new MinimalResizableCanvas(width, height);
          resizeCanvasToDevicePixels(canvas, dpr);
          const pointerPath = pointerViewportPhysicalSize(
            { clientWidth: width, clientHeight: height },
            dpr,
          );

          assert(
            pointerPath.width === canvas.width && pointerPath.height === canvas.height,
            `dpr ${dpr}, css ${width}x${height}: render path gives ${canvas.width}x${canvas.height}, ` +
              `pointer path gives ${pointerPath.width}x${pointerPath.height}`,
          );
        }
      }
    },
  },
  {
    name: "CR3-003 the pointer path still floors a zero-sized box at one device pixel, unaided by Math.max",
    run: () => {
      for (const dpr of DPRS) {
        const size = pointerViewportPhysicalSize({ clientWidth: 0, clientHeight: 0 }, dpr);
        assert(
          size.width === 1 && size.height === 1,
          `dpr ${dpr}: a zero CSS box must still floor at one device pixel without Math.max, got ${size.width}x${size.height}`,
        );
      }
    },
  },
];
