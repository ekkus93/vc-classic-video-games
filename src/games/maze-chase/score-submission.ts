import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { MazeChaseSimulationEvent } from "./simulation.js";

export type MazeChaseScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class MazeChaseScoreCommitter extends ScoreCommitter<MazeChaseSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: MazeChaseScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<MazeChaseSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
