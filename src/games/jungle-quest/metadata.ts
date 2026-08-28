import { defineGameMetadata } from "../../engine/index.js";
import { JUNGLE_QUEST_DEFAULT_DIFFICULTY, JUNGLE_QUEST_DIFFICULTIES, JUNGLE_QUEST_RUN_RULES } from "./design.js";
export const JUNGLE_QUEST_METADATA = defineGameMetadata({
  id: "jungle-quest", title: "Jungle Quest",
  description: "Recover four relics across an original connected jungle of ledges, tunnels, ladders, and swinging vines.",
  version: 1, players: [1], supportedInputs: ["keyboard", "gamepad"], logicalWidth: JUNGLE_QUEST_RUN_RULES.logicalWidth, logicalHeight: JUNGLE_QUEST_RUN_RULES.logicalHeight,
  defaultDifficulty: JUNGLE_QUEST_DEFAULT_DIFFICULTY,
  difficulties: Object.entries(JUNGLE_QUEST_DIFFICULTIES).map(([id, profile]) => ({ id, label: profile.label })),
  controls: [
    { action: "left/right", label: "Run / swing", description: "Run on platforms or pump a latched vine." },
    { action: "up/down", label: "Climb", description: "Enter and traverse ladders between elevations and routes." },
    { action: "action-1", label: "Jump / release", description: "Jump from footing or release from a vine with momentum." },
    { action: "action-2", label: "Grip vine", description: "Latch or release a nearby hanging vine." },
    { action: "pause", label: "Pause", description: "Open the shared pause overlay." },
  ],
  assetManifest: "assets.json",
});
