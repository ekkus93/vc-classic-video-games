import { assert, type TestCase } from "../../test/harness.js";
import { LogicalFramebuffer, presentFramebuffer, type CanvasSurface } from "./logical-framebuffer.js";
import { calculateViewport } from "./viewport.js";

function fakeSurface(): CanvasSurface {
  const context = { imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D;
  return {
    width: 0,
    height: 0,
    getContext: () => context,
  };
}

interface RecordedDisplayContext {
  readonly context: CanvasRenderingContext2D;
  readonly fillRectCalls: readonly (readonly [number, number, number, number])[];
  readonly drawImageCalls: readonly (readonly [unknown, number, number, number, number])[];
  readonly fillStyles: readonly unknown[];
  readonly smoothingValues: readonly boolean[];
}

function fakeDisplayContext(): RecordedDisplayContext {
  const fillRectCalls: (readonly [number, number, number, number])[] = [];
  const drawImageCalls: (readonly [unknown, number, number, number, number])[] = [];
  const fillStyles: unknown[] = [];
  const smoothingValues: boolean[] = [];
  const context = {
    save: () => undefined,
    restore: () => undefined,
    setTransform: () => undefined,
    fillRect: (x: number, y: number, width: number, height: number) => {
      fillRectCalls.push([x, y, width, height]);
    },
    drawImage: (image: unknown, x: number, y: number, width: number, height: number) => {
      drawImageCalls.push([image, x, y, width, height]);
    },
    set fillStyle(value: unknown) {
      fillStyles.push(value);
    },
    set imageSmoothingEnabled(value: boolean) {
      smoothingValues.push(value);
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, fillRectCalls, drawImageCalls, fillStyles, smoothingValues };
}

export const tests: readonly TestCase[] = [
  {
    name: "logical framebuffer defaults to 320x240 and configures pixel rendering",
    run: () => {
      const surface = fakeSurface();
      const framebuffer = new LogicalFramebuffer(surface);
      assert(surface.width === 320 && surface.height === 240, "default framebuffer must be 320x240");
      assert(framebuffer.renderer.logicalWidth === 320, "renderer must expose logical width");
      assert(framebuffer.renderer.logicalHeight === 240, "renderer must expose logical height");
      assert(!framebuffer.context.imageSmoothingEnabled, "logical framebuffer must disable image smoothing");
    },
  },
  {
    name: "logical framebuffer accepts portrait game dimensions through the same runtime type",
    run: () => {
      const surface = fakeSurface();
      const framebuffer = new LogicalFramebuffer(surface, 240, 320);
      assert(surface.width === 240 && surface.height === 320, "portrait framebuffer dimensions must be preserved");
      assert(framebuffer.renderer.logicalWidth === 240 && framebuffer.renderer.logicalHeight === 320, "portrait renderer must expose declared logical size");
    },
  },
  {
    name: "CR-005 presentFramebuffer scales through the tested integer-nearest-neighbor viewport, matching calculateViewport exactly",
    run: () => {
      const framebuffer = new LogicalFramebuffer(fakeSurface());
      const display = fakeDisplayContext();
      // 1366x768 is the primary Chromebook viewport size viewport.test.ts already covers.
      const viewport = presentFramebuffer(display.context, framebuffer, 1366, 768, "#111111");
      const expectedViewport = calculateViewport({ width: 320, height: 240 }, { width: 1366, height: 768 });
      assert(
        JSON.stringify(viewport) === JSON.stringify(expectedViewport),
        "presentFramebuffer must return the same viewport calculateViewport computes for the same inputs",
      );
      assert(
        JSON.stringify(display.fillRectCalls) === JSON.stringify([[0, 0, 1366, 768]]),
        "letterbox fill must cover the full physical display area",
      );
      assert(JSON.stringify(display.fillStyles) === JSON.stringify(["#111111"]), "letterbox fill must use the requested color");
      const expectedDrawImageCalls = [[framebuffer.canvas, expectedViewport.x, expectedViewport.y, expectedViewport.width, expectedViewport.height]];
      assert(
        JSON.stringify(display.drawImageCalls) === JSON.stringify(expectedDrawImageCalls),
        "the logical framebuffer must be drawn at exactly the scale/position calculateViewport computed -- not a separately maintained approximation",
      );
      assert(display.smoothingValues[display.smoothingValues.length - 1] === false, "display context image smoothing must be disabled so scaling stays nearest-neighbor");
    },
  },
];
