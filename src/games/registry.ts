import { GameRegistry, type GameModule } from "../engine/index.js";

/**
 * Canonical game-module list. Game phases append modules here; the launcher
 * consumes registry metadata and never branches on game IDs.
 */
export const GAME_MODULES: readonly GameModule[] = Object.freeze([]);

export function createGameRegistry(
  modules: readonly GameModule[] = GAME_MODULES,
): GameRegistry {
  return new GameRegistry(modules);
}
