import type { ScoreService } from "../../engine/index.js";
import type { SpaceRocksSimulationEvent } from "./simulation.js";

export class SpaceRocksScoreCommitter {
  private submitted = false;

  public constructor(private readonly scores: ScoreService) {}

  public handle(events: readonly SpaceRocksSimulationEvent[]): void {
    if (this.submitted) {
      return;
    }
    const gameOver = events.find((event) => event.type === "game-over");
    if (gameOver === undefined || gameOver.type !== "game-over") {
      return;
    }
    this.submitted = true;
    void this.scores.submit({
      score: gameOver.score,
      mode: "default",
    });
  }

  public reset(): void {
    this.submitted = false;
  }
}
