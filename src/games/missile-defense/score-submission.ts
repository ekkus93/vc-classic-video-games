import type { ScoreService } from "../../engine/index.js";
import type { MissileDefenseSimulationEvent } from "./simulation.js";

export class MissileDefenseScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: (error: unknown) => void = () => undefined,
  ) {}

  public handle(events: readonly MissileDefenseSimulationEvent[]): void {
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
