import type { GameMetadata, ScoreEntry } from "../../engine/index.js";

export type LauncherHighScores = Readonly<Record<string, number | null>>;

export function buildLauncherHighScores(
  games: readonly GameMetadata[],
  entries: readonly ScoreEntry[],
): LauncherHighScores {
  const highScores = Object.create(null) as Record<string, number | null>;

  for (const game of games) {
    highScores[game.id] = null;
  }

  for (const entry of entries) {
    if (!Object.hasOwn(highScores, entry.gameId)) {
      continue;
    }
    const current = highScores[entry.gameId];
    if (current === null || current === undefined || entry.score > current) {
      highScores[entry.gameId] = entry.score;
    }
  }

  return Object.freeze(highScores);
}
