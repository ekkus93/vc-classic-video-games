import type { GameRenderer } from "../render/renderer.js";

export class FakeGameRenderer implements GameRenderer {
  public constructor(
    public readonly logicalWidth = 320,
    public readonly logicalHeight = 240,
  ) {}

  public clear(): void {}
  public fillRect(): void {}
  public strokeRect(): void {}
  public drawLine(): void {}
  public fillCircle(): void {}
  public strokeCircle(): void {}
  public fillPolygon(): void {}
  public drawText(): void {}
  public drawSprite(): void {}
  public save(): void {}
  public restore(): void {}
  public translate(): void {}
  public rotate(): void {}
}
