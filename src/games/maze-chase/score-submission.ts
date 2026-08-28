import type { ScoreService } from "../../engine/index.js";
import type { MazeChaseSimulationEvent } from "./simulation.js";

export type MazeChaseScoreSubmitErrorHandler = (error: unknown) => void;

export class MazeChaseScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: MazeChaseScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly MazeChaseSimulationEvent[]): void {
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
