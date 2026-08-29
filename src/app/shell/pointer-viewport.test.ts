import { assert, type TestCase } from "../../test/harness.js";
import { devicePhysicalSize } from "../../engine/index.js";
import { pointerViewportPhysicalSize } from "./pointer-viewport.js";

const DPRS: readonly number[] = [1, 1.25, 1.5, 2, 3];

// CR3-003: 0..4 is the range where the removed Math.max(1, …) could ever have mattered
// (devicePhysicalSize floors at one device pixel on its own for every input >= 1; see
// viewport.test.ts's own CR2-003 coverage), plus a realistic range of on-screen CSS sizes.
const SMALL_CSS_SIZES: readonly number[] = [0, 1, 2, 3, 4];
const REALISTIC_CSS_SIZES: readonly number[] = [100, 320, 640, 853, 960, 1024, 1366, 1920];

export const tests: readonly TestCase[] = [
  {
    name: "CR3-003 the pointer path's sizing agrees with the render path's for every DPR and CSS size checked",
    run: () => {
      for (const dpr of DPRS) {
        for (const size of [...SMALL_CSS_SIZES, ...REALISTIC_CSS_SIZES]) {
          const renderPathWidth = devicePhysicalSize(size, dpr);
          const renderPathHeight = devicePhysicalSize(size, dpr);
          const pointerPath = pointerViewportPhysicalSize(
            { clientWidth: size, clientHeight: size },
            dpr,
          );

          assert(
            pointerPath.width === renderPathWidth && pointerPath.height === renderPathHeight,
            `dpr ${dpr}, css size ${size}: render path gives ${renderPathWidth}x${renderPathHeight}, ` +
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
