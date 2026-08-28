import { GameRegistry, type GameModule } from "../engine/index.js";
import { SPACE_ROCKS_MODULE } from "./space-rocks/module.js";
import { MISSILE_DEFENSE_MODULE } from "./missile-defense/module.js";

/**
 * Canonical game-module list. Game phases append modules here; the launcher
 * consumes registry metadata and never branches on game IDs.
 */
export const GAME_MODULES: readonly GameModule[] = Object.freeze([
  SPACE_ROCKS_MODULE,
  MISSILE_DEFENSE_MODULE,
]);

export function createGameRegistry(
  modules: readonly GameModule[] = GAME_MODULES,
): GameRegistry {
  return new GameRegistry(modules);
}
