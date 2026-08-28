export type FrameCallback = (timestampMilliseconds: number) => void;

export interface FrameScheduler {
  request(callback: FrameCallback): number;
  cancel(handle: number): void;
}

export class BrowserFrameScheduler implements FrameScheduler {
  public request(callback: FrameCallback): number {
    return requestAnimationFrame(callback);
  }

  public cancel(handle: number): void {
    cancelAnimationFrame(handle);
  }
}

export class FrameLoop {
  private handle: number | null = null;
  private running = false;

  public constructor(
    private readonly scheduler: FrameScheduler,
    private readonly onFrame: FrameCallback,
  ) {}

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.scheduleNextFrame();
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.handle !== null) {
      this.scheduler.cancel(this.handle);
      this.handle = null;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  private readonly tick: FrameCallback = (timestampMilliseconds) => {
    if (!this.running) {
      return;
    }

    this.handle = null;
    this.onFrame(timestampMilliseconds);

    if (this.running) {
      this.scheduleNextFrame();
    }
  };

  private scheduleNextFrame(): void {
    this.handle = this.scheduler.request(this.tick);
  }
}
