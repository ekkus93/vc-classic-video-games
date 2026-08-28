import type { ScoreService } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { RiverHopperScoreCommitter } from "./score-submission.js";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export const tests: readonly TestCase[] = [
  {
    name: "P9-008 terminal score submits once and non-terminal progress never submits",
    run: () => {
      const scores = new FakeScoreService();
      const committer = new RiverHopperScoreCommitter(scores);
      committer.handle([
        { type: "hop-started", direction: "up" },
        { type: "goal-filled", slotIndex: 0, points: 400, timeBonus: 140 },
      ]);
      assert(scores.submissions.length === 0, "ordinary progress must not persist scores");
      committer.handle([{ type: "game-over", score: 1230 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      assert(Number(scores.submissions.length) === 1, "one run may submit at most one score");
      assert(scores.submissions[0]?.score === 1230, "terminal score value must be preserved");
      assert(scores.submissions[0]?.mode === "default", "River Hopper uses the shared default score mode");
      committer.reset();
      committer.handle([{ type: "game-over", score: 88 }]);
      assert(Number(scores.submissions.length) === 2, "fresh run may submit a new terminal score");
    },
  },
  {
    name: "P9-008 rejected score persistence is contained without retry loops",
    run: async () => {
      const failure = new Error("score store unavailable");
      let calls = 0;
      let reported: unknown = null;
      const scores: ScoreService = {
        submit: () => {
          calls += 1;
          return Promise.reject(failure);
        },
      };
      const committer = new RiverHopperScoreCommitter(scores, (error) => {
        reported = error;
      });
      committer.handle([{ type: "game-over", score: 45 }]);
      committer.handle([{ type: "game-over", score: 46 }]);
      await flushPromises();
      assert(calls === 1, "failed persistence must remain single-shot");
      assert(reported === failure, "persistence rejection must be contained and reportable");
    },
  },
];
