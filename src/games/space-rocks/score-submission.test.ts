import type { ScoreService } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { SpaceRocksScoreCommitter } from "./score-submission.js";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export const tests: readonly TestCase[] = [
  {
    name: "P7-007 score submission occurs only once at valid game end",
    run: () => {
      const scores = new FakeScoreService();
      const committer = new SpaceRocksScoreCommitter(scores);

      committer.handle([
        { type: "pulse-fired", position: { x: 1, y: 2 } },
        { type: "wave-cleared", wave: 1, bonus: 300 },
      ]);
      assert(
        Number(scores.submissions.length) === 0,
        "non-terminal gameplay must not submit a score",
      );

      committer.handle([{ type: "game-over", score: 1234 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      assert(
        Number(scores.submissions.length) === 1,
        "one run must submit at most one terminal score",
      );
      assert(
        scores.submissions[0]?.score === 1234,
        "submitted score must match terminal run score",
      );
      assert(
        scores.submissions[0]?.mode === "default",
        "Space Rocks must use the default score mode",
      );

      committer.reset();
      committer.handle([{ type: "game-over", score: 77 }]);
      assert(
        Number(scores.submissions.length) === 2,
        "a fresh run may submit its own terminal score",
      );
    },
  },
  {
    name: "P7-007 rejected terminal score persistence is contained without duplicate retry",
    run: async () => {
      let submitCalls = 0;
      let reported: unknown = null;
      const failure = new Error("score store unavailable");
      const scores: ScoreService = {
        submit: () => {
          submitCalls += 1;
          return Promise.reject(failure);
        },
      };
      const committer = new SpaceRocksScoreCommitter(scores, (error) => {
        reported = error;
      });

      committer.handle([{ type: "game-over", score: 99 }]);
      committer.handle([{ type: "game-over", score: 100 }]);
      await flushPromises();

      assert(submitCalls === 1, "failed persistence must not trigger duplicate submission");
      assert(reported === failure, "persistence rejection must be contained and reported");
    },
  },
];
