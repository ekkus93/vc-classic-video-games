import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { BarrelClimberSimulationEvent } from "./simulation.js";

export type BarrelClimberScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class BarrelClimberScoreCommitter extends ScoreCommitter<BarrelClimberSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: BarrelClimberScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<BarrelClimberSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
