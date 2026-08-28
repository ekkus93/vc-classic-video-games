import type { ScoreService } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { MazeChaseScoreCommitter } from "./score-submission.js";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export const tests: readonly TestCase[] = [
  {
    name: "P10-009 terminal score submission occurs once and only at game over",
    run: () => {
      const scores = new FakeScoreService();
      const committer = new MazeChaseScoreCommitter(scores);
      committer.handle([
        { type: "pellet-collected", position: { x: 1, y: 1 }, points: 10 },
        { type: "level-cleared", level: 1, bonus: 600 },
      ]);
      assert(scores.submissions.length === 0, "ordinary gameplay and level completion must not persist a terminal score");
      committer.handle([{ type: "game-over", score: 1230 }]);
      committer.handle([{ type: "game-over", score: 9999 }]);
      assert(Number(scores.submissions.length) === 1, "one run must submit at most one terminal score");
      assert(scores.submissions[0]?.score === 1230, "persisted score must match the first valid terminal event");
      assert(scores.submissions[0]?.mode === "default", "Maze Chase must use the shared default score mode");
      committer.reset();
      committer.handle([{ type: "game-over", score: 77 }]);
      assert(Number(scores.submissions.length) === 2, "a new run may submit its own score");
    },
  },
  {
    name: "P10-009 rejected score persistence is contained and never retried implicitly",
    run: async () => {
      let calls = 0;
      const failure = new Error("score store unavailable");
      let reported: unknown = null;
      const scores: ScoreService = {
        submit: () => {
          calls += 1;
          return Promise.reject(failure);
        },
      };
      const committer = new MazeChaseScoreCommitter(scores, (error) => {
        reported = error;
      });
      committer.handle([{ type: "game-over", score: 500 }]);
      committer.handle([{ type: "game-over", score: 501 }]);
      await flushPromises();
      assert(calls === 1, "persistence rejection must not trigger duplicate retries");
      assert(reported === failure, "persistence rejection must be contained and surfaced to the provided reporter");
    },
  },
];
