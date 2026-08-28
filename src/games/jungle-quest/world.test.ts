import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_ROOMS, JUNGLE_QUEST_TOTAL_COLLECTIBLES, jungleQuestCollectibleIds } from "./world.js";

export const tests: readonly TestCase[] = [
  { name: "P13-001 authored world is a four-room connected expedition with unique relics", run: () => {
    assert(JUNGLE_QUEST_ROOMS.length === 4, "Jungle Quest must contain four authored rooms");
    assert(JUNGLE_QUEST_ROOMS[0]?.previous === null && JUNGLE_QUEST_ROOMS[3]?.next === null, "room chain must have bounded endpoints");
    for (let i=0;i<JUNGLE_QUEST_ROOMS.length-1;i+=1) assert(JUNGLE_QUEST_ROOMS[i]?.next === JUNGLE_QUEST_ROOMS[i+1]?.id, "rooms must connect in order");
    const ids=jungleQuestCollectibleIds(); assert(ids.length===JUNGLE_QUEST_TOTAL_COLLECTIBLES && new Set(ids).size===ids.length, "relic ids must be unique");
  }},
  { name: "P13-005 Echo Hollow and Root Vault expose a continuous lower tunnel route", run: () => {
    const middle=JUNGLE_QUEST_ROOMS.slice(1,3); assert(middle.every((room)=>room.platforms.some((p)=>p.kind==="tunnel" && p.x1===0 && p.x2===320)), "middle rooms must expose the alternate tunnel route");
    assertDeepEqual(middle.map((room)=>room.id), ["echo-hollow","root-vault"], "alternate route must span the two middle rooms");
  }},
];
