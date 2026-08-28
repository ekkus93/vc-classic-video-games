import { defineGameMetadata } from "../../engine/index.js";
import {
  BUG_BARRAGE_DEFAULT_DIFFICULTY,
  BUG_BARRAGE_DIFFICULTIES,
  BUG_BARRAGE_RUN_RULES,
} from "./design.js";

export const BUG_BARRAGE_METADATA = defineGameMetadata({
  id: "bug-barrage",
  title: "Bug Barrage",
  description: "Defend the signal garden from splitting chains and roaming circuit bugs.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad"],
  logicalWidth: BUG_BARRAGE_RUN_RULES.logicalWidth,
  logicalHeight: BUG_BARRAGE_RUN_RULES.logicalHeight,
  defaultDifficulty: BUG_BARRAGE_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(BUG_BARRAGE_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    { action: "left", label: "Move left", description: "Move within the lower defense region." },
    { action: "right", label: "Move right", description: "Move within the lower defense region." },
    { action: "up", label: "Move up", description: "Move within the lower defense region." },
    { action: "down", label: "Move down", description: "Move within the lower defense region." },
    { action: "action-1", label: "Fire spark", description: "Fire a bounded spark shot upward." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
