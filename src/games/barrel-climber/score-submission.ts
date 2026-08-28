import type { ScoreService } from "../../engine/index.js";
import type { BarrelClimberSimulationEvent } from "./simulation.js";

export type BarrelClimberScoreSubmitErrorHandler = (error: unknown) => void;

export class BarrelClimberScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: BarrelClimberScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly BarrelClimberSimulationEvent[]): void {
    if (this.submitted) {
      return;
    }
    const gameOver = events.find((event) => event.type === "game-over");
    if (gameOver === undefined || gameOver.type !== "game-over") {
      return;
    }
    this.submitted = true;
    void this.scores.submit({ score: gameOver.score, mode: "default" }).catch((error: unknown) => {
      this.reportError(error);
    });
  }

  public reset(): void {
    this.submitted = false;
  }
}
