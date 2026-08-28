import type { ScoreService } from "../../engine/index.js";
import type { SkyRidersSimulationEvent } from "./simulation.js";

export type SkyRidersScoreSubmitErrorHandler = (error: unknown) => void;

export class SkyRidersScoreCommitter {
  private submitted = false;

  public constructor(
    private readonly scores: ScoreService,
    private readonly reportError: SkyRidersScoreSubmitErrorHandler = () => undefined,
  ) {}

  public handle(events: readonly SkyRidersSimulationEvent[]): void {
    if (this.submitted) return;
    const gameOver = events.find((event) => event.type === "game-over");
    if (gameOver === undefined || gameOver.type !== "game-over") return;
    this.submitted = true;
    void this.scores
      .submit({ score: gameOver.score, mode: "default" })
      .catch((error: unknown) => this.reportError(error));
  }

  public reset(): void {
    this.submitted = false;
  }
}
