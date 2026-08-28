import type { RandomService } from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { stepBarrelClimberHazard, type BarrelClimberHazard } from "./hazards.js";
import { BARREL_CLIMBER_STAGES } from "./stages.js";

const stage = BARREL_CLIMBER_STAGES[0];
if (stage === undefined) {
  throw new Error("Barrel Climber stage fixture missing");
}

class ConstantRandom implements RandomService {
  public constructor(private value: number) {}
  public nextUint32(): number { return Math.floor(this.value * 0x1_0000_0000) >>> 0; }
  public nextFloat(): number { return this.value; }
  public reset(seed: number): void { this.value = (seed >>> 0) / 0x1_0000_0000; }
}

function hazard(overrides: Partial<BarrelClimberHazard> = {}): BarrelClimberHazard {
  return Object.freeze({
    id: 1,
    x: 58.5,
    y: 60,
    direction: -1,
    mode: "rolling",
    platformId: "c4",
    ladderId: null,
    verticalSpeed: 0,
    rotationRadians: 0,
    ...overrides,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P16-004 rolling hazards fall from an exposed edge and land on lower geometry",
    run: () => {
      const rng = new ConstantRandom(0.99);
      let state = stepBarrelClimberHazard(stage, hazard(), 0.1, { speedScale: 1, ladderDropScale: 1, rng });
      assert(state !== null && state.mode === "falling" && state.platformId === null, "edge crossing must transition to falling");
      for (let index = 0; index < 120 && state !== null && state.mode === "falling"; index += 1) {
        state = stepBarrelClimberHazard(stage, state, 1 / 60, { speedScale: 1, ladderDropScale: 1, rng });
      }
      assert(state !== null && state.mode === "rolling" && state.platformId === "c3", "falling hazard must land on the first lower overlapping platform");
    },
  },
  {
    name: "P16-005 seeded ladder choice can route a rolling hazard downward",
    run: () => {
      const rng = new ConstantRandom(0);
      let state = stepBarrelClimberHazard(stage, hazard({ x: 95, y: 60 }), 0.1, { speedScale: 1, ladderDropScale: 1, rng });
      assert(state !== null && state.mode === "descending" && state.ladderId === "c-l3", "successful seeded ladder choice must enter descending mode");
      for (let index = 0; index < 120 && state !== null && state.mode === "descending"; index += 1) {
        state = stepBarrelClimberHazard(stage, state, 1 / 60, { speedScale: 1, ladderDropScale: 1, rng });
      }
      assert(state !== null && state.mode === "rolling" && state.platformId === "c3", "ladder descent must dismount onto the declared lower platform");
    },
  },
  {
    name: "P16-005 failed seeded ladder choice preserves rolling motion",
    run: () => {
      const rng = new ConstantRandom(0.99);
      const state = stepBarrelClimberHazard(stage, hazard({ x: 95, y: 60 }), 0.1, { speedScale: 1, ladderDropScale: 1, rng });
      assert(state !== null && state.mode === "rolling" && state.platformId === "c4", "failed ladder choice must keep the hazard on its platform");
      assert(state.x < 95, "rolling hazard must continue in its travel direction");
    },
  },
];
