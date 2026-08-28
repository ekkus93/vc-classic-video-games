import type { ScoreService, ScoreSubmission } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { DeepDiggerScoreCommitter } from "./score-submission.js";

class RejectingScoreService implements ScoreService {
  public submit(_submission: ScoreSubmission): Promise<void> {
    return Promise.reject(new Error("fixture persistence failure"));
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P14-008 score submission occurs only once at terminal run end",
    run: async () => {
      const scores = new FakeScoreService();
      const committer = new DeepDiggerScoreCommitter(scores);
      committer.handle([{ type: "wave-cleared", wave: 1, bonus: 400 }], "bore");
      assert(scores.submissions.length === 0, "nonterminal progress must not submit a score");
      committer.handle([{ type: "game-over", score: 1234 }], "bore");
      committer.handle([{ type: "game-over", score: 1234 }], "bore");
      await Promise.resolve();
      assert(Number(scores.submissions.length) === 1, "terminal score must be submitted exactly once");
      assert(scores.submissions[0]?.score === 1234, "submitted score must match final simulation score");
      assert(scores.submissions[0]?.mode === "bore", "difficulty must scope the score mode");
    },
  },
  {
    name: "P14 score persistence rejection is contained inside the game boundary",
    run: async () => {
      let reported = 0;
      const committer = new DeepDiggerScoreCommitter(
        new RejectingScoreService(),
        () => {
          reported += 1;
        },
      );
      committer.handle([{ type: "game-over", score: 7 }], "survey");
      await Promise.resolve();
      await Promise.resolve();
      assert(reported === 1, "rejected persistence must be reported without escaping update");
    },
  },
];
