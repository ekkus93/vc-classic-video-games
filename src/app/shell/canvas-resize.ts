import { devicePhysicalSize } from "../../engine/index.js";

/**
 * Structural shape `resizeCanvasToDevicePixels` needs from the canvas it resizes -- a real
 * `HTMLCanvasElement` satisfies this on its own; tests supply a minimal fake instead of a real
 * DOM (this project has no jsdom).
 */
export interface ResizableCanvas {
  readonly clientWidth: number;
  readonly clientHeight: number;
  width: number;
  height: number;
}

/**
 * CR3-002: the present loop's backing-store resize decision, pulled out of `App.tsx` so it is
 * directly testable without a browser-DOM test environment -- the same reason
 * `createPointerBoundsResolver` (CR2-012) was pulled out of `useShellInput`. `App.tsx` becomes a
 * thin caller: read the CSS box, convert to device pixels via `devicePhysicalSize`, assign only
 * when the target actually differs from what is already there.
 *
 * Recomputing every frame rather than only on a resize event matters specifically because
 * `devicePixelRatio` itself can change without one firing -- browser zoom changes it with the CSS
 * box (`clientWidth`/`clientHeight`) left untouched, so a DPR-only change must still trigger a
 * resize here.
 *
 * Returns whether it resized, so a caller (or a test) can observe the "only when changed"
 * behavior directly instead of inferring it from a lack of visible effect.
 */
export function resizeCanvasToDevicePixels(
  canvas: ResizableCanvas,
  devicePixelRatio: number,
): boolean {
  const targetWidth = devicePhysicalSize(canvas.clientWidth, devicePixelRatio);
  const targetHeight = devicePhysicalSize(canvas.clientHeight, devicePixelRatio);
  if (canvas.width === targetWidth && canvas.height === targetHeight) {
    return false;
  }
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  return true;
}
