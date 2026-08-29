import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { BugBarrageSimulationEvent } from "./simulation.js";

export type BugBarrageScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class BugBarrageScoreCommitter extends ScoreCommitter<BugBarrageSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: BugBarrageScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<BugBarrageSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
