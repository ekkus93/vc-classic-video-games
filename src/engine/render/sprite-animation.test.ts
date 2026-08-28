import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { SpriteAnimation } from "./sprite-animation.js";

export const tests: readonly TestCase[] = [
  {
    name: "sprite animation advances deterministically from simulation time",
    run: () => {
      const animation = new SpriteAnimation({ frameCount: 4, framesPerSecond: 8 });
      const frames = [animation.frameIndex];
      for (let index = 0; index < 8; index += 1) {
        animation.update(1 / 8);
        frames.push(animation.frameIndex);
      }
      assertDeepEqual(frames, [0, 1, 2, 3, 0, 1, 2, 3, 0], "looping animation must follow deterministic simulation time");
    },
  },
  {
    name: "non-looping sprite animation clamps to its final frame and resets",
    run: () => {
      const animation = new SpriteAnimation({
        frameCount: 3,
        framesPerSecond: 10,
        loop: false,
      });
      animation.update(1);
      const finalFrame = animation.frameIndex;
      assert(finalFrame === 2, "non-looping animation must clamp to final frame");
      animation.reset();
      const resetFrame = animation.frameIndex;
      assert(resetFrame === 0, "reset must return animation to first frame");
    },
  },
];
