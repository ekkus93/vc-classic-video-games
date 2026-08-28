import type { ScoreService, ScoreSubmission } from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BarrelClimberScoreCommitter } from "./score-submission.js";

class RejectingScoreService implements ScoreService {
  public readonly submissions: ScoreSubmission[] = [];
  public submit(submission: ScoreSubmission): Promise<void> {
    this.submissions.push(submission);
    return Promise.reject(new Error("synthetic persistence failure"));
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P16 terminal score submission is single-shot and persistence failures stay contained",
    run: async () => {
      const scores = new RejectingScoreService();
      const errors: unknown[] = [];
      const committer = new BarrelClimberScoreCommitter(scores, (error) => errors.push(error));
      const terminal = Object.freeze([{ type: "game-over" as const, score: 4321 }]);
      committer.handle(terminal);
      committer.handle(terminal);
      await Promise.resolve();
      await Promise.resolve();
      assert(scores.submissions.length === 1, "one run must submit at most one terminal score");
      assert(scores.submissions[0]?.score === 4321 && scores.submissions[0]?.mode === "default", "submitted score must preserve the terminal value");
      assert(errors.length === 1, "rejected persistence must be reported without escaping the game loop");

      committer.reset();
      committer.handle(terminal);
      await Promise.resolve();
      assert(Number(scores.submissions.length) === 2, "reset must re-arm score submission for the next run");
    },
  },
];
