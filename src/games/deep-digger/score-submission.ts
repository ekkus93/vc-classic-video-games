import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { DeepDiggerSimulationEvent } from "./simulation.js";

export type DeepDiggerScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class DeepDiggerScoreCommitter extends ScoreCommitter<DeepDiggerSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: DeepDiggerScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<DeepDiggerSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
