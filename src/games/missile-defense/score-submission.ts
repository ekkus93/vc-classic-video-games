import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { MissileDefenseSimulationEvent } from "./simulation.js";


/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class MissileDefenseScoreCommitter extends ScoreCommitter<MissileDefenseSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: ScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<MissileDefenseSimulationEvent, "game-over">("game-over"),
      reportError,
    );
  }
}
