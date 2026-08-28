import { GameRegistry, type GameModule } from "../engine/index.js";
import { BARREL_CLIMBER_MODULE } from "./barrel-climber/module.js";
import { BUG_BARRAGE_MODULE } from "./bug-barrage/module.js";
import { DEEP_DIGGER_MODULE } from "./deep-digger/module.js";
import { MAZE_CHASE_MODULE } from "./maze-chase/module.js";
import { MISSILE_DEFENSE_MODULE } from "./missile-defense/module.js";
import { RIVER_HOPPER_MODULE } from "./river-hopper/module.js";
import { SPACE_ROCKS_MODULE } from "./space-rocks/module.js";
import { STAR_DEFENDER_MODULE } from "./star-defender/module.js";

/**
 * Canonical game-module list. Game phases append modules here; the launcher
 * consumes registry metadata and never branches on game IDs.
 */
export const GAME_MODULES: readonly GameModule[] = Object.freeze([
  SPACE_ROCKS_MODULE,
  DEEP_DIGGER_MODULE,
  BARREL_CLIMBER_MODULE,
  RIVER_HOPPER_MODULE,
  STAR_DEFENDER_MODULE,
  MAZE_CHASE_MODULE,
  BUG_BARRAGE_MODULE,
  MISSILE_DEFENSE_MODULE,
]);

export function createGameRegistry(
  modules: readonly GameModule[] = GAME_MODULES,
): GameRegistry {
  return new GameRegistry(modules);
}
