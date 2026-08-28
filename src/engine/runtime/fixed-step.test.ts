import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { FixedStepClock } from "./fixed-step.js";

function approximatelyEqual(actual: number, expected: number, epsilon = 1e-9): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

export const tests: readonly TestCase[] = [
  {
    name: "fixed-step clock advances simulation at 60 Hz independent of frame timestamp spacing",
    run: () => {
      const clock = new FixedStepClock();
      const steps: number[] = [];
      const stepMilliseconds = 1000 / 60;

      clock.advance(0, (dt) => steps.push(dt));
      for (let frame = 1; frame <= 60; frame += 1) {
        clock.advance(frame * stepMilliseconds, (dt) => steps.push(dt));
      }

      assert(steps.length === 60, "one simulated second must produce 60 updates");
      assert(
        steps.every((step) => approximatelyEqual(step, 1 / 60)),
        "every simulation update must receive the fixed step",
      );
    },
  },
  {
    name: "fixed-step clock clamps stalls and caps catch-up work",
    run: () => {
      const clock = new FixedStepClock({
        maxFrameDeltaSeconds: 0.25,
        maxUpdatesPerFrame: 8,
      });
      let updates = 0;

      clock.advance(0, () => undefined);
      const result = clock.advance(5000, () => {
        updates += 1;
      });

      assert(updates === 8, "multi-second stall must not exceed update cap");
      assert(
        result.acceptedDeltaSeconds === 0.25,
        "frame delta must be clamped before catch-up",
      );
      assert(result.droppedSeconds > 4.8, "excess stalled time must be discarded");
      assert(
        result.interpolationAlpha >= 0 && result.interpolationAlpha < 1,
        "catch-up must leave a bounded interpolation remainder",
      );
    },
  },
  {
    name: "suspend and resume clear stale accumulated time",
    run: () => {
      const clock = new FixedStepClock();
      const stepMilliseconds = 1000 / 60;
      const updateFrames: number[] = [];
      let marker = 0;

      clock.advance(0, () => updateFrames.push(marker));
      marker = 1;
      clock.advance(stepMilliseconds, () => updateFrames.push(marker));
      clock.suspend();
      marker = 2;
      clock.advance(10000, () => updateFrames.push(marker));
      clock.resume();
      marker = 3;
      clock.advance(20000, () => updateFrames.push(marker));
      marker = 4;
      clock.advance(20000 + stepMilliseconds, () => updateFrames.push(marker));

      assertDeepEqual(
        updateFrames,
        [1, 4],
        "suspended time and first resumed timestamp must not advance simulation",
      );
    },
  },
];
