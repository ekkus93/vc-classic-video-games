import {
  BrowserFrameScheduler,
  FrameLoop,
  type FrameScheduler,
} from "./frame-loop.js";
import {
  FixedStepClock,
  type FixedStepAdvanceResult,
  type FixedStepOptions,
} from "./fixed-step.js";

export interface GameLoopCallbacks {
  readonly update: (stepSeconds: number) => void;
  readonly render: (interpolationAlpha: number) => void;
}

export interface GameLoopDriverOptions extends FixedStepOptions {
  readonly scheduler?: FrameScheduler;
}

export class GameLoopDriver {
  private readonly clock: FixedStepClock;
  private readonly frameLoop: FrameLoop;
  private lastAdvance: FixedStepAdvanceResult = {
    updates: 0,
    interpolationAlpha: 0,
    acceptedDeltaSeconds: 0,
    droppedSeconds: 0,
  };

  public constructor(
    callbacks: GameLoopCallbacks,
    options: GameLoopDriverOptions = {},
  ) {
    this.clock = new FixedStepClock(options);
    this.frameLoop = new FrameLoop(
      options.scheduler ?? new BrowserFrameScheduler(),
      (timestampMilliseconds) => {
        this.lastAdvance = this.clock.advance(
          timestampMilliseconds,
          callbacks.update,
        );
        callbacks.render(this.lastAdvance.interpolationAlpha);
      },
    );
  }

  public start(): void {
    this.clock.resetTiming();
    this.frameLoop.start();
  }

  public stop(): void {
    this.frameLoop.stop();
    this.clock.resetTiming();
  }

  public pauseSimulation(): void {
    this.clock.suspend();
  }

  public resumeSimulation(): void {
    this.clock.resume();
  }

  public isRunning(): boolean {
    return this.frameLoop.isRunning();
  }

  public isSimulationPaused(): boolean {
    return this.clock.isSuspended();
  }

  public getLastAdvance(): FixedStepAdvanceResult {
    return this.lastAdvance;
  }
}
