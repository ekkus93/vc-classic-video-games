import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { SpaceRocksSimulationEvent } from "./simulation.js";

export type SpaceRocksScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class SpaceRocksScoreCommitter extends ScoreCommitter<SpaceRocksSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: SpaceRocksScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<SpaceRocksSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
