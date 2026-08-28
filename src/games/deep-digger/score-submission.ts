import type { ScoreService } from "../../engine/index.js";
import type { DeepDiggerSimulationEvent } from "./simulation.js";

export type DeepDiggerScoreSubmitErrorHandler = (error: unknown) => void;

export class DeepDiggerScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: DeepDiggerScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(
    events: readonly DeepDiggerSimulationEvent[],
    mode: string,
  ): void {
    if (this.submitted) {
      return;
    }
    const gameOver = events.find((event) => event.type === "game-over");
    if (gameOver === undefined || gameOver.type !== "game-over") {
      return;
    }
    this.submitted = true;
    void this.scores
      .submit({ score: gameOver.score, mode })
      .catch((error: unknown) => this.reportError(error));
  }

  public reset(): void {
    this.submitted = false;
  }
}
