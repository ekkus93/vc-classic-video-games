import type { ScoreService } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { StarDefenderScoreCommitter } from "./score-submission.js";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export const tests: readonly TestCase[] = [
  {
    name: "P15 terminal score submission occurs once per run and resets for a new run",
    run: () => {
      const scores = new FakeScoreService();
      const committer = new StarDefenderScoreCommitter(scores);
      committer.handle([]);
      committer.handle([{ type: "game-over", score: 3210 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      assert(scores.submissions.length === 1, "one run must submit at most one score");
      assert(
        scores.submissions[0]?.score === 3210 && scores.submissions[0]?.mode === "default",
        "terminal score must preserve the canonical score and mode",
      );
      committer.reset();
      committer.handle([{ type: "game-over", score: 77 }]);
      assert(Number(scores.submissions.length) === 2, "fresh run may submit its own terminal score");
    },
  },
  {
    name: "P15 rejected score persistence is contained without duplicate retry",
    run: async () => {
      const failure = new Error("score store offline");
      let calls = 0;
      let reported: unknown = null;
      const scores: ScoreService = {
        submit: () => {
          calls += 1;
          return Promise.reject(failure);
        },
      };
      const committer = new StarDefenderScoreCommitter(scores, (error) => {
        reported = error;
      });
      committer.handle([{ type: "game-over", score: 12 }]);
      committer.handle([{ type: "game-over", score: 13 }]);
      await flushPromises();
      assert(calls === 1, "persistence rejection must not create a retry loop");
      assert(reported === failure, "persistence rejection must remain observable to logging");
    },
  },
];
