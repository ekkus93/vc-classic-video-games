export interface SpriteAnimationOptions {
  readonly frameCount: number;
  readonly framesPerSecond: number;
  readonly loop?: boolean;
}

export class SpriteAnimation {
  public readonly frameCount: number;
  public readonly framesPerSecond: number;
  public readonly loop: boolean;

  private elapsedSeconds = 0;

  public constructor(options: SpriteAnimationOptions) {
    if (!Number.isInteger(options.frameCount) || options.frameCount <= 0) {
      throw new RangeError("frameCount must be a positive integer");
    }
    if (
      !Number.isFinite(options.framesPerSecond) ||
      options.framesPerSecond <= 0
    ) {
      throw new RangeError("framesPerSecond must be a positive finite number");
    }

    this.frameCount = options.frameCount;
    this.framesPerSecond = options.framesPerSecond;
    this.loop = options.loop ?? true;
  }

  public update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    this.elapsedSeconds += dtSeconds;
  }

  public get frameIndex(): number {
    const rawFrame = Math.floor(this.elapsedSeconds * this.framesPerSecond);
    if (this.loop) {
      return rawFrame % this.frameCount;
    }
    return Math.min(rawFrame, this.frameCount - 1);
  }

  public reset(): void {
    this.elapsedSeconds = 0;
  }
}
