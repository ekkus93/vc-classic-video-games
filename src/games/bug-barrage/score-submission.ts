import type { ScoreService } from "../../engine/index.js";
import type { BugBarrageSimulationEvent } from "./simulation.js";

export type BugBarrageScoreSubmitErrorHandler = (error: unknown) => void;

export class BugBarrageScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: BugBarrageScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly BugBarrageSimulationEvent[]): void {
    if (this.submitted) {
      return;
    }
    const gameOver = events.find((event) => event.type === "game-over");
    if (gameOver === undefined || gameOver.type !== "game-over") {
      return;
    }
    this.submitted = true;
    void this.scores
      .submit({ score: gameOver.score, mode: "default" })
      .catch((error: unknown) => this.reportError(error));
  }

  public reset(): void {
    this.submitted = false;
  }
}
