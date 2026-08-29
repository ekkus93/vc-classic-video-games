import {
  ScoreCommitter,
  terminalScoreOfType,
  type ScoreService,
  type ScoreSubmitErrorHandler,
} from "../../engine/index.js";
import type { JungleQuestSimulationEvent } from "./simulation.js";

export type JungleQuestScoreSubmitErrorHandler = ScoreSubmitErrorHandler;

/**
 * The submit-once guard and rejection containment live in the shared engine `ScoreCommitter`; all
 * this game contributes is which of its own events ends a run.
 */
export class JungleQuestScoreCommitter extends ScoreCommitter<JungleQuestSimulationEvent> {
  public constructor(
    scores: ScoreService,
    reportError: JungleQuestScoreSubmitErrorHandler = () => undefined,
  ) {
    super(
      scores,
      terminalScoreOfType<JungleQuestSimulationEvent, "run-ended">("run-ended"),
      reportError,
    );
  }
}
