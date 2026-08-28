import { defineGameMetadata } from "../../engine/index.js";
import {
  MAZE_CHASE_DEFAULT_DIFFICULTY,
  MAZE_CHASE_DIFFICULTIES,
  MAZE_CHASE_RUN_RULES,
} from "./design.js";

export const MAZE_CHASE_METADATA = defineGameMetadata({
  id: "maze-chase",
  title: "Maze Chase",
  description: "Route a neon runner through the original Circuit Garden while four sentinels adapt their pursuit.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: MAZE_CHASE_RUN_RULES.logicalWidth,
  logicalHeight: MAZE_CHASE_RUN_RULES.logicalHeight,
  defaultDifficulty: MAZE_CHASE_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(MAZE_CHASE_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    { action: "up", label: "Move up", description: "Move or buffer an upward turn." },
    { action: "down", label: "Move down", description: "Move or buffer a downward turn." },
    { action: "left", label: "Move left", description: "Move or buffer a left turn." },
    { action: "right", label: "Move right", description: "Move or buffer a right turn." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
