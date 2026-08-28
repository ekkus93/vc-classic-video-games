import type { ScoreService } from "../../engine/index.js";
import type { JungleQuestSimulationEvent } from "./simulation.js";
export type JungleQuestScoreSubmitErrorHandler = (error: unknown) => void;
export class JungleQuestScoreCommitter {
  private submitted = false;
  public constructor(private readonly scores: ScoreService, private readonly reportError: JungleQuestScoreSubmitErrorHandler = () => undefined) {}
  public handle(events: readonly JungleQuestSimulationEvent[]): void {
    if (this.submitted) return;
    const terminal = events.find((event) => event.type === "run-ended");
    if (terminal === undefined || terminal.type !== "run-ended") return;
    this.submitted = true;
    void this.scores.submit({ score: terminal.score, mode: "default" }).catch((error: unknown) => this.reportError(error));
  }
  public reset(): void { this.submitted = false; }
}
