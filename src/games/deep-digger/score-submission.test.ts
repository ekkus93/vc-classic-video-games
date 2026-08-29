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
      committer.handle([{ type: "wave-cleared", wave: 1, bonus: 400 }]);
      assert(scores.submissions.length === 0, "nonterminal progress must not submit a score");
      committer.handle([{ type: "game-over", score: 1234 }]);
      committer.handle([{ type: "game-over", score: 1234 }]);
      await Promise.resolve();
      assert(Number(scores.submissions.length) === 1, "terminal score must be submitted exactly once");
      assert(scores.submissions[0]?.score === 1234, "submitted score must match final simulation score");
      // CR2-001: difficulty scoping for high scores happens one layer down, in
      // PersistentScoreService (src/engine/scores/scores.ts), which attaches the run's difficulty
      // to every submission before it reaches the repository. The mode this committer submits
      // under is not that mechanism -- it stays "default", matching every other game -- and must
      // not be repurposed to carry difficulty, which is what previously made every Deep Digger
      // score invisible to the launcher's mode-"default" high-score query.
      assert(scores.submissions[0]?.mode === "default", "score mode must stay default, matching every other game's submission");
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
      committer.handle([{ type: "game-over", score: 7 }]);
      await Promise.resolve();
      await Promise.resolve();
      assert(reported === 1, "rejected persistence must be reported without escaping update");
    },
  },
];
