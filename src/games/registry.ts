import { GameRegistry, type GameModule } from "../engine/index.js";
import { MAZE_CHASE_MODULE } from "./maze-chase/module.js";
import { SPACE_ROCKS_MODULE } from "./space-rocks/module.js";

/**
 * Canonical game-module list. Game phases append modules here; the launcher
 * consumes registry metadata and never branches on game IDs.
 */
export const GAME_MODULES: readonly GameModule[] = Object.freeze([
  SPACE_ROCKS_MODULE,
  MAZE_CHASE_MODULE,
]);

export function createGameRegistry(
  modules: readonly GameModule[] = GAME_MODULES,
): GameRegistry {
  return new GameRegistry(modules);
}
