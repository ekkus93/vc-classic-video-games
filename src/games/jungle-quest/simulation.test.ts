import { assert, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_RUN_RULES, JUNGLE_QUEST_SCORING } from "./design.js";
import { createJungleQuestPlayer, type JungleQuestPlayerState } from "./player.js";
import { JungleQuestSimulation } from "./simulation.js";
import { JUNGLE_QUEST_ROOMS, JUNGLE_QUEST_SEALED_PASSAGE_DEPTH, jungleQuestCollectibleIds } from "./world.js";

const N = Object.freeze({
  horizontal: 0 as const,
  vertical: 0 as const,
  jumpPressed: false,
  vinePressed: false,
});

function player(x: number, y: number): JungleQuestPlayerState {
  return createJungleQuestPlayer({ x, y });
}

export const tests: readonly TestCase[] = [
  {
    name: "P13-006 contact hazard costs one life and respawns with protection",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialPlayer: player(220, 182),
        initialScore: 300,
      });
      const events = s.update(N, 0);
      assert(s.lives === 2 && s.score === 200, "hazard must cost one life and penalty");
      assert(events.some((e) => e.type === "player-hit"), "hit must emit event");
      assert(
        s.roomId === "fern-gate" && s.player.position.x === 24 && s.invulnerabilitySeconds > 0,
        "survivor must respawn at checkpoint with protection",
      );
      s.update(N, 0.01);
      assert(Number(s.lives) === 2, "protection must prevent immediate repeat contact loss");
    },
  },
  {
    name: "P13-006 pit fall costs a life and returns to checkpoint",
    run: () => {
      const s = new JungleQuestSimulation({ difficulty: "expedition", initialPlayer: player(275, 260) });
      const events = s.update(N, 0);
      assert(s.lives === 2 && events.some((e) => e.type === "player-hit"), "falling below room must cost one life");
      assert(s.player.position.x === 24 && s.player.position.y === 182, "pit must respawn at checkpoint");
    },
  },
  {
    name: "P13-006 pit recovery is immediate even during contact protection",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialPlayer: player(275, 260),
        initialInvulnerabilitySeconds: 1,
      });
      s.update(N, 0);
      assert(s.lives === 2 && s.player.position.y === 182, "pit must bypass contact-only invulnerability");
    },
  },
  {
    name: "P13-007 room transition advances checkpoint and awards once",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "echo-hollow",
        initialPlayer: player(326, 182),
      });
      const events = s.update(N, 0);
      assert(s.roomId === "root-vault", "right boundary must enter Root Vault");
      assert(
        s.score === JUNGLE_QUEST_SCORING.checkpoint && events.some((e) => e.type === "checkpoint"),
        "new checkpoint must score once",
      );
    },
  },
  {
    name: "CR-001 held rightward input actually reaches the room transition",
    run: () => {
      const s = new JungleQuestSimulation({ difficulty: "expedition", initialPlayer: player(310, 182) });
      const HOLD_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      let transitioned = false;
      for (let i = 0; i < 180 && !transitioned; i += 1) {
        s.update(HOLD_RIGHT, 1 / 60);
        if (s.roomId === "echo-hollow") {
          transitioned = true;
        }
      }
      assert(
        transitioned,
        "holding right from the near edge must eventually cross into the next room, not stick at the on-screen bound forever",
      );
      assert(s.player.position.x < 20, "player must land near the left edge of the new room after transitioning");
    },
  },
  {
    name: "CR-001 a dead-end room boundary still clamps the player on-screen",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "sun-shrine",
        initialPlayer: player(310, 182),
      });
      const HOLD_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      for (let i = 0; i < 180; i += 1) {
        s.update(HOLD_RIGHT, 1 / 60);
      }
      assert(s.roomId === "sun-shrine", "the finish room has no next room to transition into");
      assert(s.player.position.x <= 315, "player must stay clamped on-screen at a dead-end boundary");
    },
  },
  {
    name: "P13-008 relic collection is unique and scores once",
    run: () => {
      const s = new JungleQuestSimulation({ difficulty: "expedition", initialPlayer: player(92, 132) });
      s.update(N, 0);
      assert(
        s.hasCollected("jade-seed") && s.score === JUNGLE_QUEST_SCORING.relic,
        "touching relic must collect and score",
      );
      s.update(N, 0);
      assert(
        s.collectedCount === 1 && Number(s.score) === JUNGLE_QUEST_SCORING.relic,
        "collected relic must not score twice",
      );
    },
  },
  {
    name: "P13-008 complete relic set at shrine produces terminal score",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "sun-shrine",
        initialPlayer: player(301, 182),
        collectedIds: jungleQuestCollectibleIds(),
        initialScore: 1000,
      });
      const events = s.update(N, 0);
      assert(
        s.ended && s.endReason === "completed" && s.score > 1000,
        "finish with all relics must complete and award bonus",
      );
      assert(events.filter((e) => e.type === "run-ended").length === 1, "completion must emit one terminal event");
      assert(s.update(N, 1).length === 0, "ended run must stop gameplay events");
    },
  },
  {
    name: "P13-008 timer expiration terminates run without bonus",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialElapsedSeconds: 164.99,
        initialScore: 450,
      });
      const events = s.update(N, 0.02);
      assert(
        s.ended && s.endReason === "time-expired" && s.score === 450,
        "expired timer must preserve score and end run",
      );
      assert(
        events.some((e) => e.type === "run-ended" && e.reason === "time-expired"),
        "timer must emit terminal event",
      );
    },
  },
  {
    name: "P13-006 final life loss is terminal",
    run: () => {
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialPlayer: player(220, 182),
        initialLives: 1,
      });
      const events = s.update(N, 0);
      assert(s.ended && s.endReason === "out-of-lives" && s.lives === 0, "last hazard hit must end run");
      assert(
        events.some((e) => e.type === "run-ended" && e.reason === "out-of-lives"),
        "last life must emit terminal event",
      );
    },
  },
  {
    name: "CR-024 walking back to an earlier checkpoint room re-awards nothing and does not move the respawn back",
    run: () => {
      // fern-gate and root-vault are the two rooms carrying a checkpoint, with echo-hollow (no
      // checkpoint) between them, and every link is bidirectional -- so backward re-entry is reachable
      // by real input, not ruled out by level geometry. Drive forward to root-vault's checkpoint, then
      // walk all the way back to fern-gate.
      const HOLD_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      const HOLD_LEFT = Object.freeze({
        horizontal: -1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      const s = new JungleQuestSimulation({ difficulty: "expedition", initialPlayer: player(310, 182) });
      const roomOf = (run: JungleQuestSimulation): string => run.roomId;
      for (let i = 0; i < 600 && roomOf(s) !== "root-vault"; i += 1) {
        s.update(HOLD_RIGHT, 1 / 60);
      }
      assert(roomOf(s) === "root-vault", "fixture premise: the player must reach the second checkpoint room by real input");
      const scoreAtSecondCheckpoint = s.score;
      assert(
        scoreAtSecondCheckpoint >= JUNGLE_QUEST_SCORING.checkpoint,
        "reaching root-vault must have awarded its checkpoint",
      );

      // The way back is not a mirror of the way out: the forward run drops into Echo Hollow's tunnel,
      // and the tunnel's west end is a wall because Fern Gate has no tunnel to arrive in. The real
      // return route climbs Echo Hollow's descent ladder back to the surface first.
      let backwardCheckpoints = 0;
      const walkBack = (
        input: Parameters<JungleQuestSimulation["update"]>[0],
        frames: number,
        until: () => boolean,
      ): void => {
        for (let i = 0; i < frames && !until(); i += 1) {
          const events = s.update(input, 1 / 60);
          backwardCheckpoints += events.filter((e) => e.type === "checkpoint").length;
        }
      };
      walkBack(HOLD_LEFT, 900, () => roomOf(s) === "echo-hollow");
      walkBack(HOLD_LEFT, 900, () => s.player.position.x <= 44);
      const CLIMB = Object.freeze({
        horizontal: 0 as const,
        vertical: -1 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      walkBack(CLIMB, 600, () => s.player.position.y <= 183 && s.player.mode === "ground");
      walkBack(HOLD_LEFT, 900, () => roomOf(s) === "fern-gate");
      assert(
        roomOf(s) === "fern-gate",
        "fixture premise: the player must be able to walk back to the first checkpoint room",
      );
      assert(backwardCheckpoints === 0, "re-entering an already-banked checkpoint room must not award its bonus again");
      assert(
        Number(s.score) === scoreAtSecondCheckpoint,
        "backward travel must not add score for a checkpoint already banked",
      );

      // The respawn point is only observable through where a death puts the player. The player is now
      // standing in Fern Gate, the room whose checkpoint they started on -- so dying here is exactly
      // the case that would expose a respawn dragged backward: it must still return them to Root
      // Vault's checkpoint, the last one banked, and not to the Fern Gate one they are standing next
      // to. Fern Gate's contact hazard sits between them and the room's west side.
      const livesBeforeDeath: number = s.lives;
      for (let i = 0; i < 900 && s.lives === livesBeforeDeath; i += 1) {
        s.update(HOLD_LEFT, 1 / 60);
      }
      assert(
        Number(s.lives) === livesBeforeDeath - 1,
        "fixture premise: walking west into Fern Gate's hazard must cost exactly one life",
      );
      assert(
        roomOf(s) === "root-vault",
        "a banked checkpoint must still respawn the player in root-vault, not back in the fern-gate room they died in",
      );
      const rootVaultCheckpointX = 28;
      assert(
        s.player.position.x === rootVaultCheckpointX,
        `respawn must use Root Vault's checkpoint, got x=${s.player.position.x}`,
      );
    },
  },
  {
    name: "CR-001 all four rooms are reachable by chained transitions from the checkpoint spawn",
    run: () => {
      // CR-001's acceptance asks for the whole chain driven from a normal start, so this run injects
      // no player position at all -- it begins where a real run begins, at the Fern Gate checkpoint,
      // and holds right for the entire route. The two scripted jumps are the two obstacles Fern Gate
      // puts between the checkpoint and its right edge (the contact hazard at 214-238, then the pit
      // between the left and right ground platforms at 258-296); every later room is crossed by the
      // held run alone, Echo Hollow via the lower tunnel it drops into.
      const s = new JungleQuestSimulation({ difficulty: "expedition" });
      const roomOf = (run: JungleQuestSimulation): string => run.roomId;
      const order: string[] = [roomOf(s)];
      let firedInRoom = new Set<number>();
      for (let i = 0; i < 2000 && order[order.length - 1] !== "sun-shrine"; i += 1) {
        const grounded = s.player.mode === "ground";
        const x = s.player.position.x;
        const trigger = roomOf(s) === "fern-gate" ? [200, 250].find((v) => x >= v && x < v + 3) : undefined;
        const jump = grounded && trigger !== undefined && !firedInRoom.has(trigger);
        if (jump) {
          firedInRoom.add(trigger);
        }
        const before = roomOf(s);
        s.update({ horizontal: 1, vertical: 0, jumpPressed: jump, vinePressed: false }, 1 / 60);
        if (roomOf(s) !== before) {
          order.push(roomOf(s));
          firedInRoom = new Set<number>();
        }
      }
      assert(
        order.join(">") === "fern-gate>echo-hollow>root-vault>sun-shrine",
        `held input must chain through every room in order, got ${order.join(">")}`,
      );
      assert(
        Number(s.lives) === 3,
        "the route must be completable without dying, so the chain is real traversal and not respawn teleporting",
      );
    },
  },
  {
    name: "CR-001 no room boundary ever hands the player into a fall",
    run: () => {
      // Walk into every boundary that leads somewhere, from every platform that reaches it, at that
      // platform's own height. Exactly two outcomes are acceptable: the player crosses and is still
      // standing on the other side, or the boundary behaves as a wall and holds them on-screen. What
      // must never happen is crossing into empty space, which is what Echo Hollow's tunnel did at its
      // west end -- Fern Gate has no tunnel, so the player was put down at tunnel height above a void
      // and fell out of the world. Height is the whole story here, so the sweep is per platform, not
      // per boundary.
      const HALF_HEIGHT = JUNGLE_QUEST_RUN_RULES.playerHeight / 2;
      const WIDTH = JUNGLE_QUEST_RUN_RULES.logicalWidth;
      const roomOf = (run: JungleQuestSimulation): string => run.roomId;
      let crossings = 0;
      let walls = 0;
      for (const room of JUNGLE_QUEST_ROOMS) {
        for (const side of ["next", "previous"] as const) {
          if (room[side] === null) {
            continue;
          }
          const edgeX = side === "next" ? WIDTH : 0;
          for (const platform of room.platforms.filter((p) => p.x1 <= edgeX && p.x2 >= edgeX)) {
            const label = `${room.id}.${platform.id} (${side}, y=${platform.y})`;
            const run = new JungleQuestSimulation({
              difficulty: "expedition",
              initialRoomId: room.id,
              initialPlayer: player(side === "next" ? WIDTH - 20 : 20, platform.y - HALF_HEIGHT),
            });
            const horizontal: -1 | 0 | 1 = side === "next" ? 1 : -1;
            const input = Object.freeze({ horizontal, vertical: 0 as const, jumpPressed: false, vinePressed: false });
            for (let i = 0; i < 400 && roomOf(run) === room.id; i += 1) {
              run.update(input, 1 / 60);
            }
            const crossed = roomOf(run) !== room.id;
            // Let the arrival settle, so a crossing that merely postpones the fall still shows up.
            for (let i = 0; i < 180; i += 1) {
              run.update(N, 1 / 60);
            }
            const lives: number = run.lives;
            assert(
              lives === 3,
              `${label}: walking into this boundary cost a life -- it must either be crossable or behave as a wall, never a fall`,
            );
            assert(!run.ended, `${label}: walking into this boundary ended the run`);
            if (crossed) {
              crossings += 1;
              assert(
                run.player.mode === "ground",
                `${label}: crossed but the player is not standing on anything in ${roomOf(run)}`,
              );
            } else {
              walls += 1;
              const x = run.player.position.x;
              assert(
                x >= 0 && x <= WIDTH,
                `${label}: refused the crossing but let the player walk off-screen to x=${x.toFixed(1)}`,
              );
            }
          }
        }
      }
      assert(crossings > 0 && walls > 0, `the sweep must exercise both outcomes, got ${crossings} crossings and ${walls} walls`);
    },
  },
  {
    name: "CR-001 a sealed passage stops the player at its rock face; a world edge stops them at the screen edge",
    run: () => {
      // The renderer draws the rock face JUNGLE_QUEST_SEALED_PASSAGE_DEPTH into the room, so the clamp
      // must land the player's edge on that face, not on the screen edge inside the rock. A world edge
      // with nothing drawn at it keeps the plain screen-edge clamp.
      const HALF_WIDTH = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
      const HOLD_LEFT = Object.freeze({
        horizontal: -1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      const HOLD_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      const sealed = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "echo-hollow",
        initialPlayer: player(40, 218),
      });
      for (let i = 0; i < 120; i += 1) {
        sealed.update(HOLD_LEFT, 1 / 60);
      }
      assert(
        sealed.roomId === "echo-hollow" && sealed.lives === 3,
        "the tunnel's west end must hold the player in the room, alive",
      );
      assert(
        Math.abs(sealed.player.position.x - (HALF_WIDTH + JUNGLE_QUEST_SEALED_PASSAGE_DEPTH)) < 1e-6,
        `the player must stop with their edge on the rock face, got x=${sealed.player.position.x}`,
      );
      const edge = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "sun-shrine",
        initialPlayer: player(300, 182),
      });
      for (let i = 0; i < 120; i += 1) {
        edge.update(HOLD_RIGHT, 1 / 60);
      }
      assert(
        Math.abs(edge.player.position.x - (JUNGLE_QUEST_RUN_RULES.logicalWidth - HALF_WIDTH)) < 1e-6,
        `a world edge must keep the screen-edge clamp, got x=${edge.player.position.x}`,
      );
    },
  },
  {
    name: "CR2-004 Sun Shrine's tunnel floor now reaches the room edge instead of dropping the player mid-room",
    run: () => {
      // The tunnel *backdrop* has always been painted across the whole room, but its floor used to
      // stop at x=112 -- well short of the room edge, and past the shrine-ascent ladder (x=82) that is
      // plainly the intended exit. Entering from Root Vault (feet at tunnel height, near the west
      // edge) and holding right used to walk the player off that floor into a fall a few pixels past
      // the ladder, with no hazard or warning involved. Four seconds of held input is comfortably
      // enough to cross the old failure point (~106 logical pixels away) many times over.
      const HOLD_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 0 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      const HALF_WIDTH = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
      const s = new JungleQuestSimulation({
        difficulty: "expedition",
        initialRoomId: "sun-shrine",
        initialPlayer: player(6, 218),
      });
      const livesBefore: number = s.lives;
      for (let i = 0; i < 240; i += 1) {
        s.update(HOLD_RIGHT, 1 / 60);
      }
      const livesAfterFourSeconds: number = s.lives;
      assert(
        livesAfterFourSeconds === livesBefore,
        `holding right along the tunnel floor must not cost a life within four seconds, got ${livesBefore}->${livesAfterFourSeconds}`,
      );
      assert(!s.ended, "the run must not end from an unmarked drop in the finish room");
      assert(
        s.roomId === "sun-shrine",
        "Sun Shrine's east edge has no next room, so the player must stay in this room, not fall through it",
      );
      assert(
        Math.abs(s.player.position.y - 218) < 1e-6,
        "the player must still be walking the tunnel floor, not having fallen to a different height",
      );

      // Keep holding right until the world-edge clamp is reached, confirming the extended floor
      // carries the player the whole way rather than merely surviving the first four seconds.
      for (
        let i = 0;
        i < 300 && s.player.position.x < JUNGLE_QUEST_RUN_RULES.logicalWidth - HALF_WIDTH - 1e-6;
        i += 1
      ) {
        s.update(HOLD_RIGHT, 1 / 60);
      }
      const livesAfterFull: number = s.lives;
      assert(
        livesAfterFull === livesBefore,
        `holding right the entire way to the room edge must not cost a life, got ${livesBefore}->${livesAfterFull}`,
      );
      assert(
        Math.abs(s.player.position.x - (JUNGLE_QUEST_RUN_RULES.logicalWidth - HALF_WIDTH)) < 1e-6,
        `the extended floor must carry the player all the way to the world-edge clamp, got x=${s.player.position.x}`,
      );
      assert(
        Math.abs(s.player.position.y - 218) < 1e-6,
        "the player must still be walking the tunnel floor at the clamp, not having fallen",
      );
    },
  },
];
