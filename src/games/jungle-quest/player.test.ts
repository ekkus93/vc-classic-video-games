import { assert, type TestCase } from "../../test/harness.js";
import { createJungleQuestPlayer, stepJungleQuestPlayer } from "./player.js";
import { jungleQuestRoom } from "./world.js";

const NEUTRAL = Object.freeze({
  horizontal: 0 as const,
  vertical: 0 as const,
  jumpPressed: false,
  vinePressed: false,
});

export const tests: readonly TestCase[] = [
  {
    name: "P13-002 running acceleration and braking are deterministic",
    run: () => {
      const room = jungleQuestRoom("fern-gate");
      let p = createJungleQuestPlayer({ x: 24, y: 182 });
      p = stepJungleQuestPlayer(p, { ...NEUTRAL, horizontal: 1 }, room, 0.1).state;
      assert(p.velocity.x > 0 && p.position.x > 24, "right input must accelerate");
      const moving = p.velocity.x;
      p = stepJungleQuestPlayer(p, NEUTRAL, room, 0.1).state;
      assert(p.velocity.x < moving, "ground friction must brake deterministically");
    },
  },
  {
    name: "P13-003 jump arc leaves ground and lands on authored footing",
    run: () => {
      const room = jungleQuestRoom("fern-gate");
      let p = createJungleQuestPlayer({ x: 150, y: 182 });
      p = stepJungleQuestPlayer(p, { ...NEUTRAL, jumpPressed: true }, room, 1 / 60).state;
      assert(p.mode === "air" && p.velocity.y < 0, "jump must launch upward");
      for (let i = 0; i < 120 && p.mode !== "ground"; i += 1) {
        p = stepJungleQuestPlayer(p, NEUTRAL, room, 1 / 60).state;
      }
      assert(
        p.mode === "ground" && Math.abs(p.position.y - 182) < 1e-6,
        "jump must settle on surface without drift",
      );
    },
  },
  {
    name: "P13-004 ladder traversal reaches the raised Fern Gate ledge",
    run: () => {
      const room = jungleQuestRoom("fern-gate");
      let p = createJungleQuestPlayer({ x: 92, y: 182 });
      for (let i = 0; i < 60; i += 1) {
        p = stepJungleQuestPlayer(p, { ...NEUTRAL, vertical: -1 }, room, 1 / 60).state;
      }
      assert(p.position.y <= 136.001, "climbing must reach ledge height");
    },
  },
  {
    name: "CR-002 holding a diagonal after dismounting a ladder still applies horizontal movement",
    run: () => {
      const room = jungleQuestRoom("fern-gate");
      let p = createJungleQuestPlayer({ x: 92, y: 182 });
      for (let i = 0; i < 60; i += 1) {
        p = stepJungleQuestPlayer(p, { ...NEUTRAL, vertical: -1 }, room, 1 / 60).state;
      }
      assert(
        p.position.y <= 136.001 && p.mode === "ground",
        "climb must reach ledge height and dismount to ground",
      );
      const UP_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: -1 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      for (let i = 0; i < 30; i += 1) {
        p = stepJungleQuestPlayer(p, UP_RIGHT, room, 1 / 60).state;
      }
      assert(
        p.position.x > 96,
        "horizontal input must not be discarded by re-approaching the ladder while vertical is still held after dismount",
      );
    },
  },
  {
    name: "P13-005 vine latch swing and release preserve deterministic motion",
    run: () => {
      const room = jungleQuestRoom("echo-hollow");
      let p = createJungleQuestPlayer({ x: 158, y: 180 });
      let step = stepJungleQuestPlayer(p, { ...NEUTRAL, vinePressed: true }, room, 1 / 60);
      assert(
        step.state.mode === "vine" && step.events.some((e) => e.type === "vine-latched"),
        "action-2 near vine must latch",
      );
      p = step.state;
      for (let i = 0; i < 20; i += 1) {
        p = stepJungleQuestPlayer(p, { ...NEUTRAL, horizontal: 1 }, room, 1 / 60).state;
      }
      step = stepJungleQuestPlayer(p, { ...NEUTRAL, jumpPressed: true }, room, 1 / 60);
      assert(
        step.state.mode === "air" &&
          step.state.vineId === null &&
          step.events.some((e) => e.type === "vine-released"),
        "jump must release with airborne momentum",
      );
    },
  },
  {
    name: "CR-002 holding a diagonal after dismounting at a ladder's bottom end still applies horizontal movement",
    run: () => {
      // The companion to the test above, at the other end of a ladder: Echo Hollow's descent ladder
      // runs from the surface down to the tunnel, so this dismounts downward and keeps the vertical
      // input held while adding horizontal, which is the input shape that used to be swallowed by
      // re-mounting the ladder the player had just stepped off.
      const room = jungleQuestRoom("echo-hollow");
      let p = createJungleQuestPlayer({ x: 42, y: 182 });
      for (let i = 0; i < 200; i += 1) {
        p = stepJungleQuestPlayer(p, { ...NEUTRAL, vertical: 1 }, room, 1 / 60).state;
      }
      assert(
        p.mode === "ground" && p.position.y > 210,
        "climb must descend to the tunnel floor and dismount to ground",
      );
      const startX = p.position.x;
      const DOWN_RIGHT = Object.freeze({
        horizontal: 1 as const,
        vertical: 1 as const,
        jumpPressed: false,
        vinePressed: false,
      });
      for (let i = 0; i < 30; i += 1) {
        p = stepJungleQuestPlayer(p, DOWN_RIGHT, room, 1 / 60).state;
      }
      assert(
        p.position.x > startX + 4,
        "horizontal input must not be discarded by re-approaching the ladder while vertical is still held after a downward dismount",
      );
    },
  },
];
