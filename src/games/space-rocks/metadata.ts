import { defineGameMetadata } from "../../engine/index.js";
import {
  SPACE_ROCKS_DEFAULT_DIFFICULTY,
  SPACE_ROCKS_DIFFICULTIES,
  SPACE_ROCKS_RUN_RULES,
} from "./design.js";

export const SPACE_ROCKS_METADATA = defineGameMetadata({
  id: "space-rocks",
  title: "Space Rocks",
  description: "Pilot the Kestrel through seeded fields of splitting fracture rocks.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: SPACE_ROCKS_RUN_RULES.logicalWidth,
  logicalHeight: SPACE_ROCKS_RUN_RULES.logicalHeight,
  defaultDifficulty: SPACE_ROCKS_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(SPACE_ROCKS_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    {
      action: "left",
      label: "Rotate left",
      description: "Rotate the Kestrel counter-clockwise.",
    },
    {
      action: "right",
      label: "Rotate right",
      description: "Rotate the Kestrel clockwise.",
    },
    {
      action: "up",
      label: "Thrust",
      description: "Apply forward thrust while preserving inertial drift.",
    },
    {
      action: "action-1",
      label: "Fire pulse",
      description: "Fire a bounded pulse bolt in the facing direction.",
    },
    {
      action: "pause",
      label: "Pause",
      description: "Open the shared pause overlay.",
    },
  ],
  assetManifest: "assets.json",
});
