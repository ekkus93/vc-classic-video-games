import { devicePhysicalSize, type Size2D } from "../../engine/index.js";

/**
 * Structural shape `pointerViewportPhysicalSize` needs from the pointer-bounds element -- a real
 * `HTMLElement` satisfies this on its own; tests supply a plain object instead.
 */
export interface PointerBoundsSize {
  readonly clientWidth: number;
  readonly clientHeight: number;
}

/**
 * CR3-003: converts the pointer-bounds element's CSS box into the device-pixel size
 * `calculateViewport`'s `viewport()` callback needs, pulled out so it is directly testable
 * against the render path's own `devicePhysicalSize(canvas.clientWidth, dpr)` call
 * (`resizeCanvasToDevicePixels`, CR3-002) without a DOM. Previously wrapped the CSS size in
 * `Math.max(1, …)` before calling `devicePhysicalSize`, which already floors at one device pixel
 * on its own -- CR2-003's design is that both paths quantize identically *by construction*, and a
 * caller pre-flooring in CSS pixels while the other did not was a seam in that construction, not a
 * reachable bug (a sweep found zero divergence at any CSS size >= 1; see spec 3.1). One flooring
 * rule, in one place: the raw CSS size is passed through untouched.
 *
 * CR4-004: lives in its own module, alongside `canvas-resize.ts` and `pointer-bounds.ts`, rather
 * than inside `use-shell-input.ts` -- it was left there despite this doc-comment already claiming
 * to mirror `createPointerBoundsResolver`, which pulled its own test dependency-free by living in
 * its own file. `use-shell-input.ts`'s first import is React; a helper living there drags React,
 * the shell controller, and every module `useShellInput` touches into a test exercising four
 * lines of arithmetic.
 */
export function pointerViewportPhysicalSize(
  bounds: PointerBoundsSize,
  devicePixelRatio: number,
): Size2D {
  return {
    width: devicePhysicalSize(bounds.clientWidth, devicePixelRatio),
    height: devicePhysicalSize(bounds.clientHeight, devicePixelRatio),
  };
}
