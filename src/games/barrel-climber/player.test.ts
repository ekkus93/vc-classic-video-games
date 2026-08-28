import { assert, type TestCase } from "../../test/harness.js";
import { createBarrelClimberPlayer, stepBarrelClimberPlayer, type BarrelClimberPlayerState } from "./player.js";
import { BARREL_CLIMBER_STAGES } from "./stages.js";

const stage = BARREL_CLIMBER_STAGES[0];
if (stage === undefined) {
  throw new Error("Barrel Climber stage fixture missing");
}

function groundedAt(x: number, y: number, platformId: string): BarrelClimberPlayerState {
  return Object.freeze({
    x,
    y,
    velocityX: 0,
    velocityY: 0,
    facing: 1,
    mode: "grounded",
    platformId,
    ladderId: null,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P16-002 runner movement stays deterministic and clamped to the current gantry",
    run: () => {
      const start = createBarrelClimberPlayer(stage);
      const stepped = stepBarrelClimberPlayer(stage, start, { move: 1, climb: 0, jump: false }, 0.5).state;
      assert(stepped.x === 64, "0.5 seconds of right input must move at the canonical run speed");
      assert(stepped.y === start.y && stepped.mode === "grounded", "running must preserve gantry grounding");

      let edge = stepped;
      for (let index = 0; index < 20; index += 1) {
        edge = stepBarrelClimberPlayer(stage, edge, { move: -1, climb: 0, jump: false }, 0.5).state;
      }
      assert(edge.x === 15, "player center must clamp to the platform left edge plus half-width");
    },
  },
  {
    name: "P16-002/P16-006 jump arc leaves and deterministically returns to the same gantry",
    run: () => {
      let state = createBarrelClimberPlayer(stage);
      const launched = stepBarrelClimberPlayer(stage, state, { move: 0, climb: 0, jump: true }, 0);
      state = launched.state;
      assert(launched.jumped && state.mode === "airborne", "jump edge must enter airborne mode exactly once");

      let landed = false;
      for (let index = 0; index < 180 && !landed; index += 1) {
        const step = stepBarrelClimberPlayer(stage, state, { move: 0, climb: 0, jump: false }, 1 / 60);
        state = step.state;
        landed = step.landed;
      }
      assert(landed, "jump arc must land within a bounded number of fixed steps");
      assert(state.mode === "grounded" && state.platformId === "c0" && state.y === 222, "jump must land back on its gantry");
    },
  },
  {
    name: "P16-003 ladder mounting climbing and endpoint dismounting work in both directions",
    run: () => {
      let state = groundedAt(256, 222, "c0");
      let step = stepBarrelClimberPlayer(stage, state, { move: 0, climb: -1, jump: false }, 1 / 60);
      state = step.state;
      assert(step.mountedLadder && state.mode === "climbing" && state.ladderId === "c-l0", "up must mount the ladder from its bottom platform");

      for (let index = 0; index < 120 && state.mode === "climbing"; index += 1) {
        state = stepBarrelClimberPlayer(stage, state, { move: 0, climb: -1, jump: false }, 1 / 60).state;
      }
      assert(state.mode === "grounded" && state.platformId === "c1" && state.y === 183, "climbing up must dismount onto the top platform");

      step = stepBarrelClimberPlayer(stage, state, { move: 0, climb: 1, jump: false }, 1 / 60);
      state = step.state;
      assert(step.mountedLadder && state.mode === "climbing", "down must mount the ladder from its top platform");
      for (let index = 0; index < 120 && state.mode === "climbing"; index += 1) {
        state = stepBarrelClimberPlayer(stage, state, { move: 0, climb: 1, jump: false }, 1 / 60).state;
      }
      assert(state.mode === "grounded" && state.platformId === "c0" && state.y === 222, "climbing down must dismount onto the bottom platform");
    },
  },
];
