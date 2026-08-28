import type { ScoreService, ScoreSubmission } from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BugBarrageScoreCommitter } from "./score-submission.js";

class RecordingScores implements ScoreService {
  public readonly submissions: ScoreSubmission[] = [];
  public submit(submission: ScoreSubmission): Promise<void> {
    this.submissions.push(submission);
    return Promise.resolve();
  }
}

class RejectingScores implements ScoreService {
  public submit(_submission: ScoreSubmission): Promise<void> {
    return Promise.reject(new Error("injected persistence failure"));
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P11 terminal score submission occurs exactly once",
    run: async () => {
      const scores = new RecordingScores();
      const committer = new BugBarrageScoreCommitter(scores);
      committer.handle([{ type: "wave-cleared", wave: 1, bonus: 360 }]);
      assert(scores.submissions.length === 0, "nonterminal events must not submit scores");
      committer.handle([{ type: "game-over", score: 1234 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      await Promise.resolve();
      assert(Number(scores.submissions.length) === 1, "terminal score must submit exactly once");
      assert(scores.submissions[0]?.score === 1234, "first terminal score must be preserved");
      assert(scores.submissions[0]?.mode === "default", "shared default mode must be used");
    },
  },
  {
    name: "P11 rejected score persistence is contained without failing the game",
    run: async () => {
      let reported = 0;
      const committer = new BugBarrageScoreCommitter(new RejectingScores(), () => {
        reported += 1;
      });
      committer.handle([{ type: "game-over", score: 88 }]);
      await Promise.resolve();
      await Promise.resolve();
      assert(reported === 1, "persistence rejection must be reported exactly once");
    },
  },
];
