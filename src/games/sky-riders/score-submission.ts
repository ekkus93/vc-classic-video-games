import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { SkyRidersSimulationEvent } from "./simulation.js";

export type SkyRidersScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class SkyRidersScoreCommitter extends ScoreCommitter<SkyRidersSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: SkyRidersScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<SkyRidersSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
