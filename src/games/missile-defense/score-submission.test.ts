import type { ScoreService, ScoreSubmission } from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { MissileDefenseScoreCommitter } from "./score-submission.js";

class RejectingScores implements ScoreService {
  public calls = 0;
  public submit(_submission: ScoreSubmission): Promise<void> {
    this.calls += 1;
    return Promise.reject(new Error("injected persistence failure"));
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P8-010 terminal score submits once and rejected persistence is contained",
    run: async () => {
      const scores = new RejectingScores();
      const failures: unknown[] = [];
      const committer = new MissileDefenseScoreCommitter(scores, (error) => failures.push(error));
      committer.handle([{ type: "game-over", score: 1234 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      await Promise.resolve();
      await Promise.resolve();
      assert(scores.calls === 1, "terminal score must be submitted at most once per run");
      assert(failures.length === 1, "rejected persistence must be reported without escaping gameplay");
      committer.reset();
      committer.handle([{ type: "game-over", score: 7 }]);
      await Promise.resolve();
      assert(Number(scores.calls) === 2, "fresh run must be allowed one new terminal submission");
    },
  },
];
