import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { RiverHopperSimulationEvent } from "./simulation.js";

export type RiverHopperScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class RiverHopperScoreCommitter extends ScoreCommitter<RiverHopperSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: RiverHopperScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<RiverHopperSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
