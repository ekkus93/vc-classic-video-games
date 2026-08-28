import type { ScoreService } from "../../engine/index.js";
import type { RiverHopperSimulationEvent } from "./simulation.js";

export type RiverHopperScoreSubmitErrorHandler = (error: unknown) => void;

export class RiverHopperScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: RiverHopperScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly RiverHopperSimulationEvent[]): void {
    if (this.submitted) {
      return;
    }
    const terminal = events.find((event) => event.type === "game-over");
    if (terminal === undefined || terminal.type !== "game-over") {
      return;
    }
    this.submitted = true;
    void this.scores
      .submit({ score: terminal.score, mode: "default" })
      .catch((error: unknown) => this.reportError(error));
  }

  public reset(): void {
    this.submitted = false;
  }
}
