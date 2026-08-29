import { assert, type TestCase } from "../../test/harness.js";
import type { ScoreService, ScoreSubmission } from "../game/services.js";
import { ScoreCommitter, terminalScoreOfType } from "./score-committer.js";

type SampleEvent =
  | { readonly type: "tick"; readonly frame: number }
  | { readonly type: "wave-cleared"; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };

class RecordingScores implements ScoreService {
  public readonly submissions: ScoreSubmission[] = [];

  public submit(submission: ScoreSubmission): Promise<void> {
    this.submissions.push(submission);
    return Promise.resolve();
  }
}

class RejectingScores implements ScoreService {
  public attempts = 0;

  public constructor(private readonly failure: Error) {}

  public submit(): Promise<void> {
    this.attempts += 1;
    return Promise.reject(this.failure);
  }
}

/**
 * CR2-005: a `ScoreService` whose `submit` throws synchronously, before ever returning a promise
 * -- a submission it validates eagerly, say. `ScoreService.submit` is typed as returning
 * `Promise<void>`, but nothing in the interface stops an implementation from throwing instead of
 * rejecting; `ScoreCommitter` has to contain both shapes of failure, not just the one that awaits
 * cleanly.
 */
class ThrowingScores implements ScoreService {
  public attempts = 0;

  public constructor(private readonly failure: Error) {}

  public submit(): Promise<void> {
    this.attempts += 1;
    throw this.failure;
  }
}

function committer(
  scores: ScoreService,
  reportError?: (error: unknown) => void,
): ScoreCommitter<SampleEvent> {
  const reader = terminalScoreOfType<SampleEvent, "game-over">("game-over");
  return reportError === undefined
    ? new ScoreCommitter<SampleEvent>(scores, reader)
    : new ScoreCommitter<SampleEvent>(scores, reader, reportError);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Node tracks a rejected promise's handler across microtask boundaries but only fires
 * `unhandledRejection` once the current macrotask finishes draining -- waiting on further
 * `Promise.resolve()` ticks (`flush`) is not enough to observe it. A real timer tick is.
 */
async function flushMacrotask(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * The frontend `tsconfig` deliberately has no Node type definitions (this code runs in a
 * browser), so `process` cannot be named directly. `scripts/test.mjs` does run these tests under
 * Node, though, and that is the only environment this helper is used from -- a minimal structural
 * type for the one API this file needs, resolved off `globalThis`, is enough.
 */
interface NodeUnhandledRejectionSource {
  on(event: "unhandledRejection", listener: (reason: unknown) => void): void;
  off(event: "unhandledRejection", listener: (reason: unknown) => void): void;
}

function nodeProcess(): NodeUnhandledRejectionSource | undefined {
  return (globalThis as { process?: NodeUnhandledRejectionSource }).process;
}

export const tests: readonly TestCase[] = [
  {
    name: "CR-016 shared score committer submits one terminal score per run",
    run: () => {
      const scores = new RecordingScores();
      const commit = committer(scores);

      commit.handle([{ type: "tick", frame: 1 }]);
      commit.handle([{ type: "wave-cleared", bonus: 400 }]);
      const nonterminalSubmissions: number = scores.submissions.length;
      assert(nonterminalSubmissions === 0, "no nonterminal frame may submit a score");

      commit.handle([{ type: "tick", frame: 2 }, { type: "game-over", score: 1234 }]);
      commit.handle([{ type: "game-over", score: 9999 }]);
      const afterTerminal: number = scores.submissions.length;
      assert(
        afterTerminal === 1 &&
          scores.submissions[0]?.score === 1234 &&
          scores.submissions[0]?.mode === "default",
        "the first terminal frame must submit exactly once, in the default mode",
      );

      commit.reset();
      commit.handle([{ type: "game-over", score: 77 }], "marathon");
      const afterReset: number = scores.submissions.length;
      assert(
        afterReset === 2 &&
          scores.submissions[1]?.score === 77 &&
          scores.submissions[1]?.mode === "marathon",
        "reset must open a fresh run, and an explicit mode must reach the score service",
      );
    },
  },
  {
    name: "CR-016 shared score committer contains a rejected submission without retrying",
    run: async () => {
      const failure = new Error("score store unavailable");
      const scores = new RejectingScores(failure);
      const reported: unknown[] = [];
      const commit = committer(scores, (error) => reported.push(error));

      commit.handle([{ type: "game-over", score: 42 }]);
      commit.handle([{ type: "game-over", score: 43 }]);
      await flush();

      assert(scores.attempts === 1, "a contained failure must not be retried");
      assert(
        reported.length === 1 && reported[0] === failure,
        "the rejection must reach the game's reporter instead of escaping as an unhandled rejection",
      );
    },
  },
  {
    name: "CR-016 shared score committer defaults a missing reporter to a silent no-op",
    run: async () => {
      const scores = new RejectingScores(new Error("score store unavailable"));
      const commit = committer(scores);

      commit.handle([{ type: "game-over", score: 5 }]);
      await flush();

      assert(scores.attempts === 1, "a run without a reporter must still submit exactly once");
    },
  },
  {
    name: "CR2-005 a synchronous throw from submit is contained exactly like a rejection",
    run: () => {
      const failure = new Error("score store validation failed synchronously");
      const scores = new ThrowingScores(failure);
      const reported: unknown[] = [];
      const commit = committer(scores, (error) => reported.push(error));

      // `handle` must return normally -- a synchronous throw inside it must not propagate out and
      // be mistaken for a failure of the game's own update().
      commit.handle([{ type: "game-over", score: 42 }]);
      assert(
        reported.length === 1 && reported[0] === failure,
        "a synchronous throw must reach the game's reporter exactly like a rejection would",
      );

      // The failed attempt must still count as "submitted" -- a second terminal frame in the same
      // run must not retry, the same guarantee CR-016's rejection test makes for async failures.
      commit.handle([{ type: "game-over", score: 43 }]);
      assert(scores.attempts === 1, "a contained synchronous failure must not be retried");
      assert(reported.length === 1, "the reporter must not be called again for the ignored second frame");
    },
  },
  {
    name: "CR3-001 a synchronous throw from submit is contained even when the reporter also throws",
    run: () => {
      const failure = new Error("score store validation failed synchronously");
      const scores = new ThrowingScores(failure);
      const reporterFailure = new Error("logger is broken too");
      const commit = committer(scores, () => {
        throw reporterFailure;
      });

      // `handle` must return normally even though both the score service and the reporter it is
      // routed to throw -- there is nothing left to report to, so the failure is swallowed rather
      // than escaping into the game's update().
      commit.handle([{ type: "game-over", score: 42 }]);

      assert(scores.attempts === 1, "the submit attempt happened exactly once");
      commit.handle([{ type: "game-over", score: 43 }]);
      assert(scores.attempts === 1, "a contained synchronous failure must not be retried");
    },
  },
  {
    name: "CR3-001 a rejected submission is contained even when the reporter also throws",
    run: async () => {
      const failure = new Error("score store unavailable");
      const scores = new RejectingScores(failure);
      const reporterFailure = new Error("logger is broken too");
      const commit = committer(scores, () => {
        throw reporterFailure;
      });

      const proc = nodeProcess();
      assert(proc !== undefined, "this test must run under Node to observe unhandled rejections");

      let unhandledRejection: unknown;
      const onUnhandledRejection = (reason: unknown): void => {
        unhandledRejection = reason;
      };
      proc.on("unhandledRejection", onUnhandledRejection);
      try {
        commit.handle([{ type: "game-over", score: 42 }]);
        await flush();
        await flushMacrotask();
      } finally {
        proc.off("unhandledRejection", onUnhandledRejection);
      }

      assert(scores.attempts === 1, "the submit attempt happened exactly once");
      assert(
        unhandledRejection === undefined,
        "a throwing reporter on the rejection path must not surface as an unhandled rejection",
      );
    },
  },
  {
    name: "CR-016 terminalScoreOfType reads only its own event type",
    run: () => {
      const read = terminalScoreOfType<SampleEvent, "game-over">("game-over");
      assert(read([]) === null, "an empty frame has no terminal score");
      assert(read([{ type: "wave-cleared", bonus: 400 }]) === null, "another event type is not terminal");
      assert(read([{ type: "game-over", score: 0 }]) === 0, "a zero terminal score must read as 0, not as absent");
      assert(
        read([
          { type: "game-over", score: 11 },
          { type: "game-over", score: 22 },
        ]) === 11,
        "the first terminal event in a frame wins",
      );
    },
  },
];
