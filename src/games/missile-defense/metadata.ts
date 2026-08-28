import { defineGameMetadata } from "../../engine/index.js";
import {
  MISSILE_DEFENSE_DEFAULT_DIFFICULTY,
  MISSILE_DEFENSE_DIFFICULTIES,
  MISSILE_DEFENSE_RUN_RULES,
} from "./design.js";

export const MISSILE_DEFENSE_METADATA = defineGameMetadata({
  id: "missile-defense",
  title: "Missile Defense",
  description:
    "Protect the Meridian settlements with finite interceptors and chain-reacting skybursts.",
  version: 1,
  players: [1],
  supportedInputs: ["keyboard", "gamepad", "pointer"],
  logicalWidth: MISSILE_DEFENSE_RUN_RULES.logicalWidth,
  logicalHeight: MISSILE_DEFENSE_RUN_RULES.logicalHeight,
  defaultDifficulty: MISSILE_DEFENSE_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(MISSILE_DEFENSE_DIFFICULTIES).map(([id, profile]) => ({
    id,
    label: profile.label,
  })),
  controls: [
    { action: "pointer", label: "Aim", description: "Move the targeting reticle in logical game space." },
    { action: "left/right/up/down", label: "Aim", description: "Move the reticle with keyboard or gamepad." },
    { action: "action-1", label: "Launch interceptor", description: "Fire from the nearest live battery with ammunition." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
