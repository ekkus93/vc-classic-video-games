import { defineGameMetadata } from "../../engine/index.js";
import {
  BARREL_CLIMBER_DEFAULT_DIFFICULTY,
  BARREL_CLIMBER_DIFFICULTIES,
  BARREL_CLIMBER_RUN_RULES,
} from "./design.js";

export const BARREL_CLIMBER_METADATA = defineGameMetadata({
  id: "barrel-climber",
  title: "Barrel Climber",
  description: "Scale Copperline Tower, vault rolling coil drums, and reach each rescue beacon.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: BARREL_CLIMBER_RUN_RULES.logicalWidth,
  logicalHeight: BARREL_CLIMBER_RUN_RULES.logicalHeight,
  defaultDifficulty: BARREL_CLIMBER_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(BARREL_CLIMBER_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    { action: "left", label: "Run left", description: "Run left along the current gantry." },
    { action: "right", label: "Run right", description: "Run right along the current gantry." },
    { action: "up", label: "Climb up", description: "Mount a nearby ladder and climb upward." },
    { action: "down", label: "Climb down", description: "Mount a nearby ladder and climb downward." },
    { action: "action-1", label: "Jump", description: "Jump over a rolling hazard for points." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
