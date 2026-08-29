import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";

export type StarDefenderScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class StarDefenderScoreCommitter extends ScoreCommitter<StarDefenderSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: StarDefenderScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<StarDefenderSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
