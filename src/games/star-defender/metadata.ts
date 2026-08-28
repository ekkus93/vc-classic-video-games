import { defineGameMetadata } from "../../engine/index.js";
import {
  STAR_DEFENDER_DEFAULT_DIFFICULTY,
  STAR_DEFENDER_DIFFICULTIES,
  STAR_DEFENDER_RUN_RULES,
} from "./design.js";

export const STAR_DEFENDER_METADATA = defineGameMetadata({
  id: "star-defender",
  title: "Star Defender",
  description:
    "Defend the wrapped Meridian Belt, break abductions, and return falling settlers to safe ground.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: STAR_DEFENDER_RUN_RULES.logicalWidth,
  logicalHeight: STAR_DEFENDER_RUN_RULES.logicalHeight,
  defaultDifficulty: STAR_DEFENDER_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(STAR_DEFENDER_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    {
      action: "left",
      label: "Thrust left",
      description: "Accelerate left and face the craft toward port.",
    },
    {
      action: "right",
      label: "Thrust right",
      description: "Accelerate right and face the craft toward starboard.",
    },
    {
      action: "up",
      label: "Climb",
      description: "Apply vertical thrust upward while preserving inertia.",
    },
    {
      action: "down",
      label: "Dive",
      description: "Apply vertical thrust downward toward the terrain.",
    },
    {
      action: "action-1",
      label: "Fire lance",
      description: "Fire a bounded pulse lance in the current facing direction.",
    },
    {
      action: "action-2",
      label: "Emergency burst",
      description: "Spend one limited burst charge to clear the active enemy wave.",
    },
    {
      action: "pause",
      label: "Pause",
      description: "Open the shared pause overlay.",
    },
  ],
  assetManifest: "assets.json",
});
