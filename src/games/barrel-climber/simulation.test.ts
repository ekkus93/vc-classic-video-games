import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BARREL_CLIMBER_SCORING } from "./design.js";
import type { BarrelClimberHazard } from "./hazards.js";
import type { BarrelClimberPlayerState } from "./player.js";
import { BarrelClimberSimulation } from "./simulation.js";

const NEUTRAL = Object.freeze({ move: 0 as const, climb: 0 as const, jump: false });

function player(overrides: Partial<BarrelClimberPlayerState> = {}): BarrelClimberPlayerState {
  return Object.freeze({
    x: 100,
    y: 222,
    velocityX: 0,
    velocityY: 0,
    facing: 1,
    mode: "grounded",
    platformId: "c0",
    ladderId: null,
    ...overrides,
  });
}

function hazard(overrides: Partial<BarrelClimberHazard> = {}): BarrelClimberHazard {
  return Object.freeze({
    id: 1,
    x: 100,
    y: 216,
    direction: 1,
    mode: "rolling",
    platformId: "c0",
    ladderId: null,
    verticalSpeed: 0,
    rotationRadians: 0,
    ...overrides,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P16-006 an airborne player receives one responsive vault award per hazard per jump",
    run: () => {
      const simulation = new BarrelClimberSimulation({
        rng: new SeededRandomService(10),
        difficulty: "shift",
        initialPlayer: player({ y: 198, velocityY: -20, mode: "airborne" }),
        initialHazards: [hazard()],
        initialSpawnDelaySeconds: 999,
      });
      const first = simulation.update(NEUTRAL, 0);
      assert(simulation.score === BARREL_CLIMBER_SCORING.vaultHazard, "first clearance must award canonical vault points");
      assert(first.filter((event) => event.type === "hazard-vaulted").length === 1, "first clearance must emit one vault event");
      const second = simulation.update(NEUTRAL, 0);
      assert(simulation.score === BARREL_CLIMBER_SCORING.vaultHazard, "same jump must not farm repeated points from one hazard");
      assert(second.every((event) => event.type !== "hazard-vaulted"), "same jump must not re-emit the vault event");
    },
  },
  {
    name: "P16-007 final hazard collision consumes the last life and emits one terminal event",
    run: () => {
      const simulation = new BarrelClimberSimulation({
        rng: new SeededRandomService(11),
        difficulty: "shift",
        initialPlayer: player(),
        initialHazards: [hazard()],
        initialLives: 1,
        initialInvulnerabilitySeconds: 0,
        initialSpawnDelaySeconds: 999,
      });
      const events = simulation.update(NEUTRAL, 0);
      assert(simulation.gameOver && simulation.lives === 0, "last collision must end the run");
      assert(events.filter((event) => event.type === "game-over").length === 1, "terminal collision must emit exactly one game-over event");
      assert(simulation.update(NEUTRAL, 1).length === 0, "terminal simulation must stop producing gameplay events");
    },
  },
  {
    name: "P16-007 non-terminal collision respawns safely and clears active hazards",
    run: () => {
      const simulation = new BarrelClimberSimulation({
        rng: new SeededRandomService(12),
        difficulty: "steady",
        initialPlayer: player(),
        initialHazards: [hazard()],
        initialLives: 2,
        initialInvulnerabilitySeconds: 0,
        initialSpawnDelaySeconds: 999,
      });
      simulation.update(NEUTRAL, 0);
      assert(simulation.lives === 1 && !simulation.gameOver, "non-terminal hit must retain the run");
      assert(simulation.hazards.length === 0, "respawn must clear stale hazards around the spawn point");
      assert(simulation.invulnerabilitySeconds > 0, "respawn must restore bounded spawn protection");
    },
  },
  {
    name: "P16-008/P16-009 reaching the goal advances stages and wraps into the next level",
    run: () => {
      const stageOneGoal = new BarrelClimberSimulation({
        rng: new SeededRandomService(13),
        difficulty: "shift",
        initialPlayer: player({ x: 66, y: 66, platformId: "c4" }),
        initialHazards: [],
        initialSpawnDelaySeconds: 999,
      });
      const firstEvents = stageOneGoal.update(NEUTRAL, 0);
      assert(stageOneGoal.stageIndex === 1 && stageOneGoal.level === 1, "first goal must advance to stage two");
      assert(firstEvents.some((event) => event.type === "stage-cleared"), "goal must emit an explicit stage-clear event");

      const stageThreeGoal = new BarrelClimberSimulation({
        rng: new SeededRandomService(14),
        difficulty: "shift",
        initialStageIndex: 2,
        initialPlayer: player({ x: 78, y: 58, platformId: "n4" }),
        initialHazards: [],
        initialSpawnDelaySeconds: 999,
      });
      stageThreeGoal.update(NEUTRAL, 0);
      assert(stageThreeGoal.stageIndex === 0 && stageThreeGoal.level === 2, "third goal must wrap to stage one of the next level");
    },
  },
  {
    name: "P16-004/P16-009 seeded hazard routing is reproducible for identical run state",
    run: () => {
      const fixture = hazard({ x: 95, y: 60, direction: -1, platformId: "c4" });
      const left = new BarrelClimberSimulation({
        rng: new SeededRandomService(0x1616),
        difficulty: "surge",
        initialHazards: [fixture],
        initialSpawnDelaySeconds: 999,
      });
      const right = new BarrelClimberSimulation({
        rng: new SeededRandomService(0x1616),
        difficulty: "surge",
        initialHazards: [fixture],
        initialSpawnDelaySeconds: 999,
      });
      left.update(NEUTRAL, 0.1);
      right.update(NEUTRAL, 0.1);
      assert(JSON.stringify(left.hazards) === JSON.stringify(right.hazards), "same seed and input must produce identical hazard routing");
    },
  },
];
