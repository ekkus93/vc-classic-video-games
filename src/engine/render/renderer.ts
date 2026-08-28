export type HorizontalTextAlign = "left" | "center" | "right";
export type VerticalTextAlign = "top" | "middle" | "bottom" | "alphabetic";

export interface TextStyle {
  readonly color: string;
  readonly font: string;
  readonly align?: HorizontalTextAlign;
  readonly baseline?: VerticalTextAlign;
}

export interface SpriteSourceRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PolygonPoint {
  readonly x: number;
  readonly y: number;
}

export interface GameRenderer {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  clear(color?: string): void;
  fillRect(x: number, y: number, width: number, height: number, color: string): void;
  strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth?: number,
  ): void;
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth?: number,
  ): void;
  fillCircle(x: number, y: number, radius: number, color: string): void;
  strokeCircle(
    x: number,
    y: number,
    radius: number,
    color: string,
    lineWidth?: number,
  ): void;
  fillPolygon(points: readonly PolygonPoint[], color: string): void;
  drawText(text: string, x: number, y: number, style: TextStyle): void;
  drawSprite(
    image: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    source?: SpriteSourceRect,
  ): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
}

export class CanvasGameRenderer implements GameRenderer {
  public constructor(
    private readonly context: CanvasRenderingContext2D,
    public readonly logicalWidth: number,
    public readonly logicalHeight: number,
  ) {
    context.imageSmoothingEnabled = false;
  }

  public clear(color = "#000000"): void {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = color;
    this.context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.context.restore();
  }

  public fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ): void {
    this.context.fillStyle = color;
    this.context.fillRect(x, y, width, height);
  }

  public strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth = 1,
  ): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.strokeRect(x, y, width, height);
  }

  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth = 1,
  ): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.beginPath();
    this.context.moveTo(x1, y1);
    this.context.lineTo(x2, y2);
    this.context.stroke();
  }

  public fillCircle(x: number, y: number, radius: number, color: string): void {
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.fill();
  }

  public strokeCircle(
    x: number,
    y: number,
    radius: number,
    color: string,
    lineWidth = 1,
  ): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.stroke();
  }

  public fillPolygon(points: readonly PolygonPoint[], color: string): void {
    if (points.length < 3) {
      return;
    }
    const first = points[0];
    if (first === undefined) {
      return;
    }
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.moveTo(first.x, first.y);
    for (const point of points.slice(1)) {
      this.context.lineTo(point.x, point.y);
    }
    this.context.closePath();
    this.context.fill();
  }

  public drawText(text: string, x: number, y: number, style: TextStyle): void {
    this.context.fillStyle = style.color;
    this.context.font = style.font;
    this.context.textAlign = style.align ?? "left";
    this.context.textBaseline = style.baseline ?? "alphabetic";
    this.context.fillText(text, x, y);
  }

  public drawSprite(
    image: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    source?: SpriteSourceRect,
  ): void {
    if (source === undefined) {
      this.context.drawImage(image, x, y, width, height);
      return;
    }

    this.context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      x,
      y,
      width,
      height,
    );
  }

  public save(): void {
    this.context.save();
  }

  public restore(): void {
    this.context.restore();
  }

  public translate(x: number, y: number): void {
    this.context.translate(x, y);
  }

  public rotate(radians: number): void {
    this.context.rotate(radians);
  }
}
