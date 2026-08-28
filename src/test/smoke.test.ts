import { XorShift32 } from "../engine/random/xorshift32.js";
import { assertDeepEqual, type TestCase } from "./harness.js";

function sequence(seed: number): readonly number[] {
  const rng = new XorShift32(seed);
  return Array.from({ length: 8 }, () => rng.nextUint32());
}

export const tests: readonly TestCase[] = [
  {
    name: "seeded engine primitive is deterministic",
    run: () => {
      assertDeepEqual(
        sequence(0x12345678),
        sequence(0x12345678),
        "same seed must produce the same sequence",
      );
    },
  },
];
