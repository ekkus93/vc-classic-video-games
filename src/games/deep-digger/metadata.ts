import { defineGameMetadata } from "../../engine/index.js";
import {
  DEEP_DIGGER_DEFAULT_DIFFICULTY,
  DEEP_DIGGER_DIFFICULTIES,
  DEEP_DIGGER_RUN_RULES,
} from "./design.js";

export const DEEP_DIGGER_METADATA = defineGameMetadata({
  id: "deep-digger",
  title: "Deep Digger",
  description:
    "Carve the Copper Lattice, pressure tunnel stalkers, and turn unstable stone into a weapon.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: DEEP_DIGGER_RUN_RULES.logicalWidth,
  logicalHeight: DEEP_DIGGER_RUN_RULES.logicalHeight,
  defaultDifficulty: DEEP_DIGGER_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(DEEP_DIGGER_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    {
      action: "up",
      label: "Dig up",
      description: "Move upward and carve earth when the next grid cell is solid.",
    },
    {
      action: "down",
      label: "Dig down",
      description: "Move downward and carve earth when the next grid cell is solid.",
    },
    {
      action: "left",
      label: "Dig left",
      description: "Move left and carve earth when the next grid cell is solid.",
    },
    {
      action: "right",
      label: "Dig right",
      description: "Move right and carve earth when the next grid cell is solid.",
    },
    {
      action: "action-1",
      label: "Pressure line",
      description: "Pump a visible tunnel line; three hits before decay defeat a stalker.",
    },
    {
      action: "pause",
      label: "Pause",
      description: "Open the shared pause overlay.",
    },
  ],
  assetManifest: "assets.json",
});
