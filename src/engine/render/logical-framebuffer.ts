import { CanvasGameRenderer, type GameRenderer } from "./renderer.js";
import { calculateViewport, type Viewport } from "./viewport.js";

export interface CanvasSurface {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
}

function requireLogicalDimension(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export class LogicalFramebuffer {
  public readonly context: CanvasRenderingContext2D;
  public readonly renderer: GameRenderer;

  public constructor(
    public readonly canvas: CanvasSurface,
    public readonly logicalWidth = 320,
    public readonly logicalHeight = 240,
  ) {
    requireLogicalDimension(logicalWidth, "logicalWidth");
    requireLogicalDimension(logicalHeight, "logicalHeight");

    canvas.width = logicalWidth;
    canvas.height = logicalHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D context is unavailable");
    }
    context.imageSmoothingEnabled = false;
    this.context = context;
    this.renderer = new CanvasGameRenderer(
      context,
      logicalWidth,
      logicalHeight,
    );
  }
}

export function presentFramebuffer(
  displayContext: CanvasRenderingContext2D,
  framebuffer: LogicalFramebuffer,
  displayWidth: number,
  displayHeight: number,
  letterboxColor = "#000000",
): Viewport {
  const viewport = calculateViewport(
    { width: framebuffer.logicalWidth, height: framebuffer.logicalHeight },
    { width: displayWidth, height: displayHeight },
  );

  displayContext.save();
  displayContext.setTransform(1, 0, 0, 1, 0, 0);
  displayContext.imageSmoothingEnabled = false;
  displayContext.fillStyle = letterboxColor;
  displayContext.fillRect(0, 0, displayWidth, displayHeight);
  displayContext.drawImage(
    framebuffer.canvas as unknown as CanvasImageSource,
    viewport.x,
    viewport.y,
    viewport.width,
    viewport.height,
  );
  displayContext.restore();

  return viewport;
}
