export interface FixedStepOptions {
  readonly stepSeconds?: number;
  readonly maxFrameDeltaSeconds?: number;
  readonly maxUpdatesPerFrame?: number;
}

export interface FixedStepAdvanceResult {
  readonly updates: number;
  readonly interpolationAlpha: number;
  readonly acceptedDeltaSeconds: number;
  readonly droppedSeconds: number;
}

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_MAX_FRAME_DELTA_SECONDS = 0.25;
const DEFAULT_MAX_UPDATES_PER_FRAME = 8;

export class FixedStepClock {
  public readonly stepSeconds: number;
  public readonly maxFrameDeltaSeconds: number;
  public readonly maxUpdatesPerFrame: number;

  private accumulatorSeconds = 0;
  private lastTimestampMilliseconds: number | null = null;
  private suspended = false;

  public constructor(options: FixedStepOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
    this.maxFrameDeltaSeconds =
      options.maxFrameDeltaSeconds ?? DEFAULT_MAX_FRAME_DELTA_SECONDS;
    this.maxUpdatesPerFrame =
      options.maxUpdatesPerFrame ?? DEFAULT_MAX_UPDATES_PER_FRAME;

    if (!Number.isFinite(this.stepSeconds) || this.stepSeconds <= 0) {
      throw new RangeError("stepSeconds must be a positive finite number");
    }
    if (
      !Number.isFinite(this.maxFrameDeltaSeconds) ||
      this.maxFrameDeltaSeconds <= 0
    ) {
      throw new RangeError(
        "maxFrameDeltaSeconds must be a positive finite number",
      );
    }
    if (
      !Number.isInteger(this.maxUpdatesPerFrame) ||
      this.maxUpdatesPerFrame <= 0
    ) {
      throw new RangeError("maxUpdatesPerFrame must be a positive integer");
    }
  }

  public advance(
    timestampMilliseconds: number,
    update: (stepSeconds: number) => void,
  ): FixedStepAdvanceResult {
    if (!Number.isFinite(timestampMilliseconds)) {
      throw new RangeError("timestampMilliseconds must be finite");
    }

    if (this.suspended || this.lastTimestampMilliseconds === null) {
      this.lastTimestampMilliseconds = timestampMilliseconds;
      return this.result(0, 0, 0);
    }

    const rawDeltaSeconds = Math.max(
      0,
      (timestampMilliseconds - this.lastTimestampMilliseconds) / 1000,
    );
    this.lastTimestampMilliseconds = timestampMilliseconds;

    const acceptedDeltaSeconds = Math.min(
      rawDeltaSeconds,
      this.maxFrameDeltaSeconds,
    );
    let droppedSeconds = rawDeltaSeconds - acceptedDeltaSeconds;
    this.accumulatorSeconds += acceptedDeltaSeconds;

    let updates = 0;
    while (
      this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds &&
      updates < this.maxUpdatesPerFrame
    ) {
      update(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      updates += 1;
    }

    if (this.accumulatorSeconds >= this.stepSeconds) {
      const wholeStepsToDrop = Math.floor(
        this.accumulatorSeconds / this.stepSeconds,
      );
      const droppedFromCatchUp = wholeStepsToDrop * this.stepSeconds;
      this.accumulatorSeconds -= droppedFromCatchUp;
      droppedSeconds += droppedFromCatchUp;
    }

    return this.result(updates, acceptedDeltaSeconds, droppedSeconds);
  }

  public suspend(): void {
    this.suspended = true;
    this.resetTiming();
  }

  public resume(): void {
    this.suspended = false;
    this.resetTiming();
  }

  public resetTiming(): void {
    this.accumulatorSeconds = 0;
    this.lastTimestampMilliseconds = null;
  }

  public isSuspended(): boolean {
    return this.suspended;
  }

  private result(
    updates: number,
    acceptedDeltaSeconds: number,
    droppedSeconds: number,
  ): FixedStepAdvanceResult {
    return {
      updates,
      interpolationAlpha: this.accumulatorSeconds / this.stepSeconds,
      acceptedDeltaSeconds,
      droppedSeconds,
    };
  }
}
