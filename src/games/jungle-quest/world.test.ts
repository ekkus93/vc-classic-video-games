import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_RUN_RULES } from "./design.js";
import {
  JUNGLE_QUEST_ENTRY_SUPPORT_TOLERANCE,
  JUNGLE_QUEST_ROOMS,
  JUNGLE_QUEST_TOTAL_COLLECTIBLES,
  jungleQuestCollectibleIds,
  jungleQuestSealedPassages,
} from "./world.js";

export const tests: readonly TestCase[] = [
  {
    name: "P13-001 authored world is a four-room connected expedition with unique relics",
    run: () => {
      assert(JUNGLE_QUEST_ROOMS.length === 4, "Jungle Quest must contain four authored rooms");
      assert(
        JUNGLE_QUEST_ROOMS[0]?.previous === null && JUNGLE_QUEST_ROOMS[3]?.next === null,
        "room chain must have bounded endpoints",
      );
      for (let i = 0; i < JUNGLE_QUEST_ROOMS.length - 1; i += 1) {
        assert(
          JUNGLE_QUEST_ROOMS[i]?.next === JUNGLE_QUEST_ROOMS[i + 1]?.id,
          "rooms must connect in order",
        );
      }
      const ids = jungleQuestCollectibleIds();
      assert(
        ids.length === JUNGLE_QUEST_TOTAL_COLLECTIBLES && new Set(ids).size === ids.length,
        "relic ids must be unique",
      );
    },
  },
  {
    name: "P13-009 Echo Hollow through Sun Shrine expose a continuous lower tunnel route",
    run: () => {
      // CR3-004: derive the set of rooms that actually carry a full-width tunnel by scanning
      // every room, then compare the derived list against the pin -- not a positional slice of
      // the room list (JUNGLE_QUEST_ROOMS.slice(1, 3), what this test used to do). A fixed-length
      // slice of the middle cannot notice a room outside it gaining a tunnel: Fern Gate sits at
      // index 0, outside any "middle" slice, so "giving Fern Gate a tunnel must fail this test"
      // would silently not hold under the slice form. Filtering over JUNGLE_QUEST_ROOMS, which is
      // in chain order, also verifies the route is contiguous and runs in the documented
      // direction -- no separate adjacency check is needed. Pinning the derived list rather than
      // asserting a bare property is the same reason CR-001's sealed-passage test pins its own
      // list: a room gaining or losing the route should be a deliberate edit that fails a test.
      const width = JUNGLE_QUEST_RUN_RULES.logicalWidth;
      const withFullWidthTunnel = JUNGLE_QUEST_ROOMS.filter((room) =>
        room.platforms.some((p) => p.kind === "tunnel" && p.x1 === 0 && p.x2 === width),
      ).map((room) => room.id);
      assertDeepEqual(
        withFullWidthTunnel,
        ["echo-hollow", "root-vault", "sun-shrine"],
        "the alternate tunnel route must span exactly Echo Hollow, Root Vault, and Sun Shrine, in that order",
      );
    },
  },
  {
    name: "CR-001 every travelable room boundary has floor on both sides of the crossing",
    run: () => {
      // The transition fires once the player is a half-width past the room edge, and a platform that
      // ends at the room edge holds them exactly that far -- support runs out on the same frame the
      // room flips. That coupling is what makes a crossing safe, and nothing but this test states it,
      // so an edge platform shortened by a few pixels would silently turn a doorway into a pit.
      const halfWidth = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
      const width = JUNGLE_QUEST_RUN_RULES.logicalWidth;
      for (const room of JUNGLE_QUEST_ROOMS) {
        for (const side of ["next", "previous"] as const) {
          const neighbourId = room[side];
          if (neighbourId === null) {
            continue;
          }
          const edgeX = side === "next" ? width : 0;
          const trigger = side === "next" ? width + halfWidth : -halfWidth;

          // Departure side: something must carry the player all the way to the trigger.
          const carrying = room.platforms.filter((p) => p.x1 <= edgeX && p.x2 >= edgeX);
          assert(
            carrying.length > 0,
            `${room.id} leads ${side} but no platform reaches that edge, so the boundary can never be walked to`,
          );
          for (const platform of carrying) {
            const lastSupportedX = side === "next" ? platform.x2 + halfWidth : platform.x1 - halfWidth;
            const reaches = side === "next" ? lastSupportedX >= trigger : lastSupportedX <= trigger;
            assert(
              reaches,
              `${room.id}.${platform.id} stops supporting the player at ${lastSupportedX} but the ${side} transition only fires at ${trigger}, leaving a gap to fall through`,
            );
          }

          void neighbourId;
        }
      }
    },
  },
  {
    name: "CR-001 distinct walkable heights stay further apart than the entry-support tolerance",
    run: () => {
      // resolveRoomTransition accepts a landing platform sitting up to half a player height above the
      // arriving feet, to absorb the sub-pixel dip of walking off a platform end. That is only safe
      // while no two real walkable heights are that close together; if a room ever authored two
      // levels within the tolerance, the transition check could mistake one for the other.
      const tolerance = JUNGLE_QUEST_ENTRY_SUPPORT_TOLERANCE;
      const heights = [...new Set(JUNGLE_QUEST_ROOMS.flatMap((room) => room.platforms.map((p) => p.y)))].sort(
        (a, b) => a - b,
      );
      for (let i = 1; i < heights.length; i += 1) {
        const gap = (heights[i] ?? 0) - (heights[i - 1] ?? 0);
        assert(
          gap > tolerance,
          `walkable heights ${String(heights[i - 1])} and ${String(heights[i])} are ${gap} apart, inside the ${tolerance} entry-support tolerance`,
        );
      }
    },
  },
  {
    name: "CR-001 the only sealed passage in the world is the west end of Echo Hollow's tunnel",
    run: () => {
      // Pins the world's dead ends explicitly. The renderer draws a rock face at every entry here
      // and the simulation walls it, so a new one appearing (or this one disappearing) is a level
      // change that should be made on purpose -- if Fern Gate ever gains a tunnel, update this.
      const sealed = JUNGLE_QUEST_ROOMS.flatMap((room) =>
        jungleQuestSealedPassages(room).map(
          (passage) => `${room.id}.${passage.platform.id}:${passage.side}`,
        ),
      );
      assertDeepEqual(sealed, ["echo-hollow.echo-tunnel:previous"], "sealed passages must match the authored world");
    },
  },
  {
    name: "CR2-004 every tunnel platform spans the room's full width, matching the tunnel backdrop drawn behind it",
    run: () => {
      // This is the general form of the bug CR2-004 fixed: sealed-passages.ts paints the tunnel band
      // (TUNNEL_BAND_TOP, 42px tall) across the *entire* width of every room, unconditionally, but
      // Sun Shrine's tunnel *floor* used to stop at x=112 -- well short of that -- with nothing
      // marking where the walkable part actually ended. A CR-001-style edge sweep alone cannot
      // catch this shape of bug: it only checks the two room edges, and this drop was mid-room, past
      // the room's own exit ladder. This is deliberately narrower than "every platform end is safe
      // to walk off" would be -- a general sweep like that would have to special-case Fern Gate's
      // ledge (a legitimate drop onto the ground below) and its chasm (a legitimate, already-tested
      // pit hazard) to avoid flagging real design, which risks the check quietly rubber-stamping a
      // real hole in exactly the way it is meant to prevent. A tunnel-kind platform's width has no
      // such legitimate short reading: the backdrop drawn behind it makes an unconditional claim
      // (this whole band is where the tunnel floor is) that only this platform's own extent can
      // honor, so requiring the two to match is the one general rule this room shape supports.
      const width = JUNGLE_QUEST_RUN_RULES.logicalWidth;
      for (const room of JUNGLE_QUEST_ROOMS) {
        for (const p of room.platforms) {
          if (p.kind !== "tunnel") {
            continue;
          }
          assert(
            p.x1 === 0 && p.x2 === width,
            `${room.id}.${p.id} spans ${p.x1}..${p.x2}, but the tunnel backdrop is drawn across the room's full 0..${width} -- a tunnel floor shorter than that leaves an unmarked drop where the backdrop still implies floor`,
          );
        }
      }
    },
  },
];
