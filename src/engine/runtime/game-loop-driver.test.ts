import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import type { FrameCallback, FrameScheduler } from "./frame-loop.js";
import { GameLoopDriver } from "./game-loop-driver.js";

class FakeFrameScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameCallback>();
  public readonly cancelled: number[] = [];

  public request(callback: FrameCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  public cancel(handle: number): void {
    this.cancelled.push(handle);
    this.callbacks.delete(handle);
  }

  public fire(timestampMilliseconds: number): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameCallback]
      | undefined;
    if (entry === undefined) {
      throw new Error("No pending animation frame");
    }
    const [handle, callback] = entry;
    this.callbacks.delete(handle);
    callback(timestampMilliseconds);
  }

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "game loop owns one RAF chain and decouples fixed updates from renders",
    run: () => {
      const scheduler = new FakeFrameScheduler();
      const events: string[] = [];
      const driver = new GameLoopDriver(
        {
          update: () => events.push("update"),
          render: () => events.push("render"),
        },
        { scheduler },
      );
      const stepMilliseconds = 1000 / 60;

      driver.start();
      driver.start();
      assert(scheduler.pendingCount === 1, "driver must own exactly one RAF chain");

      scheduler.fire(0);
      scheduler.fire(stepMilliseconds / 2);
      scheduler.fire(stepMilliseconds);

      assertDeepEqual(
        events,
        ["render", "render", "update", "render"],
        "render cadence must remain independent from fixed update cadence",
      );
      assertDeepEqual(
        [scheduler.pendingCount],
        [1],
        "each frame must schedule exactly one successor",
      );

      driver.stop();
      assertDeepEqual(
        [scheduler.pendingCount],
        [0],
        "stop must cancel the owned RAF request",
      );
    },
  },
  {
    name: "paused game loop continues rendering without simulation catch-up",
    run: () => {
      const scheduler = new FakeFrameScheduler();
      let updates = 0;
      let renders = 0;
      const driver = new GameLoopDriver(
        {
          update: () => {
            updates += 1;
          },
          render: () => {
            renders += 1;
          },
        },
        { scheduler },
      );
      const stepMilliseconds = 1000 / 60;

      driver.start();
      scheduler.fire(0);
      scheduler.fire(stepMilliseconds);
      driver.pauseSimulation();
      scheduler.fire(10000);
      driver.resumeSimulation();
      scheduler.fire(20000);
      scheduler.fire(20000 + stepMilliseconds);

      assert(updates === 2, "pause/resume must not simulate suspended elapsed time");
      assert(renders === 5, "paused loop may continue rendering shell/overlay frames");
    },
  },
  {
    name: "new-run reset clears stale timing and resumes simulation",
    run: () => {
      const scheduler = new FakeFrameScheduler();
      let updates = 0;
      const driver = new GameLoopDriver(
        {
          update: () => {
            updates += 1;
          },
          render: () => undefined,
        },
        { scheduler },
      );
      const stepMilliseconds = 1000 / 60;

      driver.start();
      scheduler.fire(0);
      scheduler.fire(stepMilliseconds / 2);
      assert(
        driver.getLastAdvance().interpolationAlpha > 0,
        "fixture must accumulate a partial stale step",
      );

      driver.pauseSimulation();
      assert(driver.isSimulationPaused(), "fixture must enter paused timing state");
      driver.resetForNewRun();

      assert(!driver.isSimulationPaused(), "new run must resume simulation timing");
      assert(
        driver.getLastAdvance().interpolationAlpha === 0,
        "new run must discard stale interpolation accumulator",
      );

      scheduler.fire(10000);
      assert(updates === 0, "first new-run frame must establish a fresh baseline");
      scheduler.fire(10000 + stepMilliseconds);
      assert(updates === 1, "new run must advance from the fresh baseline");
    },
  },
];
