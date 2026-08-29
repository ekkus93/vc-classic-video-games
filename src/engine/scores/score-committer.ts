import type { ScoreService } from "../game/services.js";

export type ScoreSubmitErrorHandler = (error: unknown) => void;

/**
 * Reads the terminal score out of one frame's events, or null when that frame did not end the
 * run. Games supply this because only a game knows which of its own events is terminal (most use
 * `"game-over"`; Jungle Quest uses `"run-ended"`) -- see `terminalScoreOfType`.
 */
export type TerminalScoreReader<TEvent> = (
  events: readonly TEvent[],
) => number | null;

/**
 * Builds the terminal-score reader every game needs: find the first event of `type` in the frame
 * and read its `score`. `TType` is constrained to the type tags of the event union's *scoring*
 * members, so naming an event that carries no score (`"wave-cleared"`, say) is a compile error
 * rather than a run that quietly submits `undefined`.
 */
export function terminalScoreOfType<
  TEvent extends { readonly type: string },
  TType extends Extract<TEvent, { readonly score: number }>["type"],
>(type: TType): TerminalScoreReader<TEvent> {
  return (events) => {
    const terminal = events.find(
      (event): event is Extract<TEvent, { readonly type: TType; readonly score: number }> =>
        event.type === type,
    );
    return terminal === undefined ? null : terminal.score;
  };
}

/**
 * The submit-once guard and async-rejection containment every game needs around `ScoreService`.
 *
 * A run submits its score at most once: the first frame whose events carry the game's terminal
 * event wins, and every later frame is ignored until `reset()` starts a new run. The submit
 * promise is deliberately not awaited and never surfaces a rejection to the caller -- a score
 * store that is full, corrupt, or unavailable must not take a playable run down with it -- so a
 * rejection is routed to `reportError` instead, inside the game's own boundary.
 */
export class ScoreCommitter<TEvent> {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly readTerminalScore: TerminalScoreReader<TEvent>,
    private readonly reportError: ScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly TEvent[], mode = "default"): void {
    if (this.submitted) {
      return;
    }
    const score = this.readTerminalScore(events);
    if (score === null) {
      return;
    }
    this.submitted = true;
    // CR2-005: `scores.submit` is an async method by its declared type, but nothing stops an
    // implementation from throwing synchronously before it ever returns a promise -- a
    // submission it validates eagerly, say. The `.catch()` below only ever contains a
    // *rejection*; a synchronous throw here would escape `handle` entirely and reach the calling
    // game's `update`, which is exactly the "must not take a playable run down with it" failure
    // this class exists to prevent. Wrapping the call itself, not just its result, closes that
    // gap. `submitted` stays set either way: a throw is a failed attempt, not a reason to retry.
    let pending: Promise<void>;
    try {
      pending = this.scores.submit({ score, mode });
    } catch (error) {
      this.report(error);
      return;
    }
    void pending.catch((error: unknown) => this.report(error));
  }

  public reset(): void {
    this.submitted = false;
  }

  // CR3-001: `reportError` is the game's own failure channel, so a throw from it has nowhere left
  // to go -- escaping into the caller's update() reproduces exactly the "a failing score store
  // must not take a playable run down with it" bug this class exists to prevent, just one level
  // removed. Swallowing here is deliberate, not an oversight: the alternatives are escaping (the
  // bug) or recursing into the same broken reporter. This must hold on both the synchronous throw
  // path and the rejection path identically -- before this fix the async path merely relocated a
  // throwing reporter into an unhandled rejection, which is a quieter leak, not containment.
  private report(error: unknown): void {
    try {
      this.reportError(error);
    } catch {
      // Nothing left to report to; see comment above.
    }
  }
}
