import {
  FrameLoop,
  type FrameCallback,
  type FrameScheduler,
} from "./frame-loop.js";
import { assertDeepEqual, type TestCase } from "../../test/harness.js";

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

  public fireNext(timestampMilliseconds: number): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameCallback]
      | undefined;

    if (entry === undefined) {
      throw new Error("No scheduled frame is available");
    }

    const [handle, callback] = entry;
    this.callbacks.delete(handle);
    callback(timestampMilliseconds);
  }

  public pendingCount(): number {
    return this.callbacks.size;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "frame loop owns one independent scheduler chain",
    run: () => {
      const scheduler = new FakeFrameScheduler();
      const frames: number[] = [];
      const loop = new FrameLoop(scheduler, (timestamp) => {
        frames.push(timestamp);
      });

      loop.start();
      loop.start();
      assertDeepEqual(
        [scheduler.pendingCount()],
        [1],
        "starting twice must not create duplicate frame chains",
      );

      scheduler.fireNext(16);
      scheduler.fireNext(32);
      assertDeepEqual(frames, [16, 32], "scheduled timestamps must reach runtime");
      assertDeepEqual(
        [scheduler.pendingCount()],
        [1],
        "runtime must leave exactly one future frame scheduled",
      );

      loop.stop();
      assertDeepEqual(
        [scheduler.pendingCount(), loop.isRunning() ? 1 : 0],
        [0, 0],
        "stop must cancel the pending frame and halt the loop",
      );
    },
  },
];
