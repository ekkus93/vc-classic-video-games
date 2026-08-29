import { assert, type TestCase } from "../../test/harness.js";
import { resizeCanvasToDevicePixels, type ResizableCanvas } from "./canvas-resize.js";

/**
 * Minimal fake matching only what `resizeCanvasToDevicePixels` touches. `width`/`height` are
 * tracked through an assignment counter as well as their current value, so a test can assert "no
 * write happened" directly rather than inferring it from the value being unchanged (a no-op
 * assignment of the same value would look identical to the value check alone).
 */
class FakeCanvas implements ResizableCanvas {
  public widthAssignments = 0;
  public heightAssignments = 0;
  private currentWidth: number;
  private currentHeight: number;

  public constructor(
    public readonly clientWidth: number,
    public readonly clientHeight: number,
    width = 0,
    height = 0,
  ) {
    this.currentWidth = width;
    this.currentHeight = height;
  }

  public get width(): number {
    return this.currentWidth;
  }

  public set width(value: number) {
    this.currentWidth = value;
    this.widthAssignments += 1;
  }

  public get height(): number {
    return this.currentHeight;
  }

  public set height(value: number) {
    this.currentHeight = value;
    this.heightAssignments += 1;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "CR3-002 resizes the backing store to round(client x dpr) at each supported DPR",
    run: () => {
      const cases: ReadonlyArray<{
        readonly dpr: number;
        readonly width: number;
        readonly height: number;
      }> = [
        { dpr: 1, width: 1366, height: 768 },
        { dpr: 1.25, width: 1366, height: 768 },
        { dpr: 1.5, width: 1366, height: 768 },
        { dpr: 2, width: 1366, height: 768 },
      ];

      for (const { dpr, width, height } of cases) {
        const canvas = new FakeCanvas(width, height);
        const resized = resizeCanvasToDevicePixels(canvas, dpr);

        assert(resized, `dpr ${dpr}: a canvas with a mismatched backing store must resize`);
        assert(
          canvas.width === Math.round(width * dpr) && canvas.height === Math.round(height * dpr),
          `dpr ${dpr}: expected ${Math.round(width * dpr)}x${Math.round(height * dpr)}, got ${canvas.width}x${canvas.height}`,
        );
      }
    },
  },
  {
    name: "CR3-002 an already-correct backing store is not written to",
    run: () => {
      const dpr = 1.5;
      const canvas = new FakeCanvas(1366, 768, Math.round(1366 * dpr), Math.round(768 * dpr));

      const resized = resizeCanvasToDevicePixels(canvas, dpr);

      assert(!resized, "the returned flag must report that nothing changed");
      assert(
        canvas.widthAssignments === 0 && canvas.heightAssignments === 0,
        "an already-correct canvas must not be assigned to at all, not merely re-assigned the same value",
      );
    },
  },
  {
    name: "CR3-002 a zero-sized CSS box floors the backing store at one device pixel",
    run: () => {
      const canvas = new FakeCanvas(0, 0);

      const resized = resizeCanvasToDevicePixels(canvas, 2);

      assert(resized, "a zero-sized box still needs an initial resize to the floor");
      assert(
        canvas.width === 1 && canvas.height === 1,
        `a zero CSS box must floor at one device pixel, got ${canvas.width}x${canvas.height}`,
      );
    },
  },
  {
    name: "CR3-002 a DPR change alone, with an unchanged CSS box, triggers a resize",
    run: () => {
      // The browser-zoom case: devicePixelRatio changes without a resize event, and the CSS box
      // (clientWidth/clientHeight) is untouched. The present loop's own comment claims this is
      // handled by recomputing every frame; this is the test that actually exercises it.
      const canvas = new FakeCanvas(1366, 768, Math.round(1366 * 1), Math.round(768 * 1));

      const resized = resizeCanvasToDevicePixels(canvas, 1.5);

      assert(resized, "a DPR change with the same CSS box must still trigger a resize");
      assert(
        canvas.width === Math.round(1366 * 1.5) && canvas.height === Math.round(768 * 1.5),
        `expected the backing store to follow the new DPR, got ${canvas.width}x${canvas.height}`,
      );
    },
  },
  {
    // CR4-003: every prior fixture had both dimensions matching the target or neither, so the
    // conjunction in the unchanged-check (`canvas.width === targetWidth && canvas.height ===
    // targetHeight`) was unpinned -- weakening it to `||` returned `false` (skipping the resize)
    // as soon as *either* dimension already matched, leaving the other stale, and no existing test
    // noticed. This covers the reachable state a window widened without being made taller
    // produces: clientWidth changed, clientHeight did not.
    name: "CR4-003 a stale width with an already-correct height still resizes, and resizes both correctly",
    run: () => {
      const dpr = 1.25;
      const targetWidth = Math.round(1400 * dpr);
      const targetHeight = Math.round(768 * dpr);
      // Width starts at a stale value (not targetWidth); height already matches its target.
      const canvas = new FakeCanvas(1400, 768, targetWidth - 1, targetHeight);

      const resized = resizeCanvasToDevicePixels(canvas, dpr);

      assert(resized, "a stale width alone must still trigger a resize, not be skipped");
      assert(
        canvas.width === targetWidth && canvas.height === targetHeight,
        `expected ${targetWidth}x${targetHeight}, got ${canvas.width}x${canvas.height} -- ` +
          "a resize that fires but leaves the stale dimension unwritten, or overwrites the " +
          "already-correct one with the wrong value, must be caught here",
      );
    },
  },
  {
    // Mirror of the case above: catches the version of the same mistake written the other way
    // round (`canvas.width === targetWidth || canvas.height === targetHeight`), which the case
    // above alone would not.
    name: "CR4-003 a stale height with an already-correct width still resizes, and resizes both correctly",
    run: () => {
      const dpr = 1.25;
      const targetWidth = Math.round(1366 * dpr);
      const targetHeight = Math.round(900 * dpr);
      // Height starts at a stale value (not targetHeight); width already matches its target.
      const canvas = new FakeCanvas(1366, 900, targetWidth, targetHeight - 1);

      const resized = resizeCanvasToDevicePixels(canvas, dpr);

      assert(resized, "a stale height alone must still trigger a resize, not be skipped");
      assert(
        canvas.width === targetWidth && canvas.height === targetHeight,
        `expected ${targetWidth}x${targetHeight}, got ${canvas.width}x${canvas.height} -- ` +
          "a resize that fires but leaves the stale dimension unwritten, or overwrites the " +
          "already-correct one with the wrong value, must be caught here",
      );
    },
  },
];
