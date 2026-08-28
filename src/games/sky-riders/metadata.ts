import { defineGameMetadata } from "../../engine/index.js";
import {
  SKY_RIDERS_DEFAULT_DIFFICULTY,
  SKY_RIDERS_DIFFICULTIES,
  SKY_RIDERS_RUN_RULES,
} from "./design.js";

export const SKY_RIDERS_METADATA = defineGameMetadata({
  id: "sky-riders",
  title: "Sky Riders",
  description:
    "Flap mechanical Kitewings through Cloudbreak Steps and win deterministic altitude duels.",
  version: 1,
  players: [1, 2],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: SKY_RIDERS_RUN_RULES.logicalWidth,
  logicalHeight: SKY_RIDERS_RUN_RULES.logicalHeight,
  defaultDifficulty: SKY_RIDERS_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(SKY_RIDERS_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    {
      action: "left/right",
      label: "Steer",
      description: "Accelerate horizontally while preserving aerial momentum.",
    },
    {
      action: "action-1",
      label: "Flap",
      description: "Apply one cadence-limited upward wingbeat impulse.",
    },
    {
      action: "pause",
      label: "Pause",
      description: "Open the shared pause overlay.",
    },
  ],
  assetManifest: "assets.json",
});
