import type { GameRenderer } from "../../engine/index.js";
import { JUNGLE_QUEST_RUN_RULES } from "./design.js";
import {
  JUNGLE_QUEST_SEALED_PASSAGE_DEPTH,
  jungleQuestSealedPassages,
  type JungleQuestPlatformKind,
  type JungleQuestRoom,
} from "./world.js";

// CR2-011: split out of module.ts, which otherwise exports only the game's GameInstance class and
// its GameModule -- exactly what every other game's module.ts does. drawSealedPassages needed a
// public export purely so the CR-001 render test could call it without driving a full render()
// pass; giving it, and the two constants it shares with drawPlatform/render(), a file of their own
// keeps that test seam out of module.ts's own export list instead.

export const TUNNEL_BAND_TOP = 198;

export function platformEdgeColor(kind: JungleQuestPlatformKind): string {
  return kind === "tunnel" ? "#8a6f8f" : "#a8b56d";
}

/**
 * Draws a rock face across every passage in `room` that reaches a room edge but is sealed at that
 * height (see jungleQuestSealedPassages), so a dead end reads as a dead end before the player
 * walks into it. The face is exactly as deep as the simulation's clamp, so the wall the player
 * hits is the wall they see.
 */
export function drawSealedPassages(renderer: GameRenderer, room: JungleQuestRoom): void {
  for (const { side, platform } of jungleQuestSealedPassages(room)) {
    const x = side === "previous" ? 0 : JUNGLE_QUEST_RUN_RULES.logicalWidth - JUNGLE_QUEST_SEALED_PASSAGE_DEPTH;
    const top = platform.kind === "tunnel" ? TUNNEL_BAND_TOP : platform.y - JUNGLE_QUEST_RUN_RULES.playerHeight;
    renderer.fillRect(x, top, JUNGLE_QUEST_SEALED_PASSAGE_DEPTH, platform.y - top, room.palette.earth);
    const faceX = side === "previous" ? x + JUNGLE_QUEST_SEALED_PASSAGE_DEPTH : x;
    renderer.drawLine(faceX, top, faceX, platform.y, platformEdgeColor(platform.kind), 1);
  }
}
