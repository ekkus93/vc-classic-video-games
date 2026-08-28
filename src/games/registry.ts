import { GameRegistry, type GameModule } from "../engine/index.js";
import { JUNGLE_QUEST_MODULE } from "./jungle-quest/module.js";
import { SPACE_ROCKS_MODULE } from "./space-rocks/module.js";

/**
 * Canonical game-module list. Game phases append modules here; the launcher
 * consumes registry metadata and never branches on game IDs.
 */
export const GAME_MODULES: readonly GameModule[] = Object.freeze([
  JUNGLE_QUEST_MODULE,
  SPACE_ROCKS_MODULE,
]);

export function createGameRegistry(
  modules: readonly GameModule[] = GAME_MODULES,
): GameRegistry {
  return new GameRegistry(modules);
}
