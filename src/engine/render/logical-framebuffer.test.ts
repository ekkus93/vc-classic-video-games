import { assert, type TestCase } from "../../test/harness.js";
import { LogicalFramebuffer, type CanvasSurface } from "./logical-framebuffer.js";

function fakeSurface(): CanvasSurface {
  const context = { imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D;
  return {
    width: 0,
    height: 0,
    getContext: () => context,
  };
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
];
