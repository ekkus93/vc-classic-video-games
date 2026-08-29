import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_RUN_RULES } from "./design.js";
import { JUNGLE_QUEST_ENTRY_SUPPORT_TOLERANCE, JUNGLE_QUEST_ROOMS, JUNGLE_QUEST_TOTAL_COLLECTIBLES, jungleQuestCollectibleIds, jungleQuestSealedPassages } from "./world.js";

export const tests: readonly TestCase[] = [
  { name: "P13-001 authored world is a four-room connected expedition with unique relics", run: () => {
    assert(JUNGLE_QUEST_ROOMS.length === 4, "Jungle Quest must contain four authored rooms");
    assert(JUNGLE_QUEST_ROOMS[0]?.previous === null && JUNGLE_QUEST_ROOMS[3]?.next === null, "room chain must have bounded endpoints");
    for (let i=0;i<JUNGLE_QUEST_ROOMS.length-1;i+=1) assert(JUNGLE_QUEST_ROOMS[i]?.next === JUNGLE_QUEST_ROOMS[i+1]?.id, "rooms must connect in order");
    const ids=jungleQuestCollectibleIds(); assert(ids.length===JUNGLE_QUEST_TOTAL_COLLECTIBLES && new Set(ids).size===ids.length, "relic ids must be unique");
  }},
  { name: "P13-009 Echo Hollow and Root Vault expose a continuous lower tunnel route", run: () => {
    const middle=JUNGLE_QUEST_ROOMS.slice(1,3); assert(middle.every((room)=>room.platforms.some((p)=>p.kind==="tunnel" && p.x1===0 && p.x2===320)), "middle rooms must expose the alternate tunnel route");
    assertDeepEqual(middle.map((room)=>room.id), ["echo-hollow","root-vault"], "alternate route must span the two middle rooms");
  }},
  { name: "CR-001 every travelable room boundary has floor on both sides of the crossing", run: () => {
    // The transition fires once the player is a half-width past the room edge, and a platform that
    // ends at the room edge holds them exactly that far -- support runs out on the same frame the
    // room flips. That coupling is what makes a crossing safe, and nothing but this test states it,
    // so an edge platform shortened by a few pixels would silently turn a doorway into a pit.
    const halfWidth = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
    const width = JUNGLE_QUEST_RUN_RULES.logicalWidth;
    for (const room of JUNGLE_QUEST_ROOMS) {
      for (const side of ["next", "previous"] as const) {
        const neighbourId = room[side];
        if (neighbourId === null) continue;
        const edgeX = side === "next" ? width : 0;
        const trigger = side === "next" ? width + halfWidth : -halfWidth;

        // Departure side: something must carry the player all the way to the trigger.
        const carrying = room.platforms.filter((p) => p.x1 <= edgeX && p.x2 >= edgeX);
        assert(carrying.length > 0, `${room.id} leads ${side} but no platform reaches that edge, so the boundary can never be walked to`);
        for (const platform of carrying) {
          const lastSupportedX = side === "next" ? platform.x2 + halfWidth : platform.x1 - halfWidth;
          const reaches = side === "next" ? lastSupportedX >= trigger : lastSupportedX <= trigger;
          assert(reaches, `${room.id}.${platform.id} stops supporting the player at ${lastSupportedX} but the ${side} transition only fires at ${trigger}, leaving a gap to fall through`);
        }

        void neighbourId;
      }
    }
  }},
  { name: "CR-001 distinct walkable heights stay further apart than the entry-support tolerance", run: () => {
    // resolveRoomTransition accepts a landing platform sitting up to half a player height above the
    // arriving feet, to absorb the sub-pixel dip of walking off a platform end. That is only safe
    // while no two real walkable heights are that close together; if a room ever authored two
    // levels within the tolerance, the transition check could mistake one for the other.
    const tolerance = JUNGLE_QUEST_ENTRY_SUPPORT_TOLERANCE;
    const heights = [...new Set(JUNGLE_QUEST_ROOMS.flatMap((room) => room.platforms.map((p) => p.y)))].sort((a, b) => a - b);
    for (let i = 1; i < heights.length; i += 1) {
      const gap = (heights[i] ?? 0) - (heights[i - 1] ?? 0);
      assert(gap > tolerance, `walkable heights ${String(heights[i - 1])} and ${String(heights[i])} are ${gap} apart, inside the ${tolerance} entry-support tolerance`);
    }
  }},
  { name: "CR-001 the only sealed passage in the world is the west end of Echo Hollow's tunnel", run: () => {
    // Pins the world's dead ends explicitly. The renderer draws a rock face at every entry here
    // and the simulation walls it, so a new one appearing (or this one disappearing) is a level
    // change that should be made on purpose -- if Fern Gate ever gains a tunnel, update this.
    const sealed = JUNGLE_QUEST_ROOMS.flatMap((room) => jungleQuestSealedPassages(room).map((passage) => `${room.id}.${passage.platform.id}:${passage.side}`));
    assertDeepEqual(sealed, ["echo-hollow.echo-tunnel:previous"], "sealed passages must match the authored world");
  }},
];
