import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_RUN_RULES } from "./design.js";
import {
  createBugBarrageChain,
  splitBugBarrageChain,
  stepBugBarrageChain,
  type BugBarrageChain,
} from "./chains.js";
import type { BugBarrageObstacle } from "./field.js";

function chainAt(x: number, y: number): BugBarrageChain {
  return Object.freeze({
    id: 1,
    segments: Object.freeze([
      Object.freeze({
        id: 1,
        position: Object.freeze({ x, y }),
        direction: 1 as const,
        verticalDirection: 1 as const,
      }),
    ]),
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P11-004/P11-005 chain traversal reverses and changes row at field topology",
    run: () => {
      const obstacle: BugBarrageObstacle = Object.freeze({
        id: 1,
        position: Object.freeze({ x: 80, y: 60 }),
        health: 3,
      });
      const stepped = stepBugBarrageChain(chainAt(40, 60), [obstacle], 188, 0.3);
      const segment = stepped.segments[0];
      assert(segment !== undefined, "chain must retain its segment");
      assert(segment.direction === -1, "high-speed topology contact must reverse direction");
      assert(
        segment.position.y === 60 + BUG_BARRAGE_RUN_RULES.rowStep,
        "topology contact must move exactly one row",
      );
    },
  },
  {
    name: "P11-006 destroying a middle segment produces independent chain identities",
    run: () => {
      const chain = createBugBarrageChain(5, 10, 5);
      const middle = chain.segments[2];
      assert(middle !== undefined, "fixture must have a middle segment");
      const split = splitBugBarrageChain(chain, middle.id, 20);
      assert(split.length === 2, "middle hit must create two survivor chains");
      assert(split[0]?.id === 20 && split[1]?.id === 21, "split chains need distinct identities");
      assert(split[0]?.segments.length === 2, "leading survivor group must be preserved");
      assert(split[1]?.segments.length === 2, "trailing survivor group must be preserved");
      const left = stepBugBarrageChain(split[0]!, [], 70, 0.1);
      assert(
        left !== split[1] && left.id !== split[1]?.id,
        "advancing one split chain must not alias the other chain",
      );
    },
  },
  {
    name: "P11-005 wall contact remains stable at maximum designed speed",
    run: () => {
      const stepped = stepBugBarrageChain(chainAt(312, 48), [], 188, 0.25);
      const segment = stepped.segments[0];
      assert(segment?.direction === -1, "wall contact must reverse at high speed");
      assert(
        segment !== undefined && segment.position.x <= BUG_BARRAGE_RUN_RULES.logicalWidth,
        "sub-stepping must keep the segment in the logical field",
      );
    },
  },
];
