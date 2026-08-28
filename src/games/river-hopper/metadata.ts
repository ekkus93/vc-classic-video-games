import { defineGameMetadata } from "../../engine/index.js";
import {
  RIVER_HOPPER_DEFAULT_DIFFICULTY,
  RIVER_HOPPER_DIFFICULTIES,
  RIVER_HOPPER_RUN_RULES,
} from "./design.js";

export const RIVER_HOPPER_METADATA = defineGameMetadata({
  id: "river-hopper",
  title: "River Hopper",
  description: "Guide the Juniper runner across courier lanes and drifting river barges to light every beacon.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: RIVER_HOPPER_RUN_RULES.logicalWidth,
  logicalHeight: RIVER_HOPPER_RUN_RULES.logicalHeight,
  defaultDifficulty: RIVER_HOPPER_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(RIVER_HOPPER_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    { action: "up", label: "Hop forward", description: "Hop one lane toward the river beacons." },
    { action: "down", label: "Hop back", description: "Hop one lane toward the starting bank." },
    { action: "left", label: "Hop left", description: "Hop one cell to the left." },
    { action: "right", label: "Hop right", description: "Hop one cell to the right." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
