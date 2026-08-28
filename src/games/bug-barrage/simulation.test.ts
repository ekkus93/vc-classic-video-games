import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import type { BugBarrageChain } from "./chains.js";
import {
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
  bugBarrageSegmentSpeed,
  bugBarrageWaveObstacleCount,
  bugBarrageWaveSegmentCount,
} from "./design.js";
import type { BugBarrageObstacle } from "./field.js";
import type { BugBarrageRoamer } from "./roamers.js";
import { BugBarrageSimulation } from "./simulation.js";

function chainWithSegments(
  positions: readonly { readonly x: number; readonly y: number }[],
): BugBarrageChain {
  return Object.freeze({
    id: 1,
    segments: Object.freeze(
      positions.map((position, index) =>
        Object.freeze({
          id: index + 1,
          position: Object.freeze({ ...position }),
          direction: 1 as const,
          verticalDirection: 1 as const,
        }),
      ),
    ),
  });
}

function safeChain(): BugBarrageChain {
  return chainWithSegments([{ x: 24, y: 24 }]);
}

export const tests: readonly TestCase[] = [
  {
    name: "P11-002 player moves in four directions and clamps to the lower defense region",
    run: () => {
      const simulation = new BugBarrageSimulation({
        rng: new SeededRandomService(1),
        difficulty: "swarm",
        initialObstacles: [],
        initialChains: [safeChain()],
        initialInvulnerabilitySeconds: 10,
      });
      simulation.update({ horizontal: -1, vertical: -1, fire: false }, 10);
      assert(
        simulation.playerPosition.x === BUG_BARRAGE_RUN_RULES.playerRadius + 2,
        "left movement must clamp inside the framebuffer",
      );
      assert(
        simulation.playerPosition.y ===
          BUG_BARRAGE_RUN_RULES.playerRegionTop + BUG_BARRAGE_RUN_RULES.playerRadius,
        "up movement must clamp at the lower-region boundary",
      );
      simulation.update({ horizontal: 1, vertical: 1, fire: false }, 10);
      assert(
        simulation.playerPosition.x ===
          BUG_BARRAGE_RUN_RULES.logicalWidth - BUG_BARRAGE_RUN_RULES.playerRadius - 2,
        "right movement must clamp inside the framebuffer",
      );
      assert(
        simulation.playerPosition.y ===
          BUG_BARRAGE_RUN_RULES.playerRegionBottom - BUG_BARRAGE_RUN_RULES.playerRadius,
        "down movement must clamp at the defense-region floor",
      );
    },
  },
  {
    name: "P11-006/P11-009 swept spark hit splits a live chain in one high-speed frame",
    run: () => {
      const simulation = new BugBarrageSimulation({
        rng: new SeededRandomService(2),
        difficulty: "swarm",
        initialObstacles: [],
        initialChains: [
          chainWithSegments([
            { x: 130, y: 195 },
            { x: 160, y: 195 },
            { x: 190, y: 195 },
          ]),
        ],
        initialPlayerPosition: { x: 160, y: 216 },
        initialInvulnerabilitySeconds: 10,
      });
      const events = simulation.update(
        { horizontal: 0, vertical: 0, fire: true },
        0.1,
      );
      assert(
        events.some((event) => event.type === "segment-destroyed"),
        "spark sweep must destroy the crossed middle segment",
      );
      assert(simulation.chains.length === 2, "middle segment destruction must split the chain");
      assert(simulation.segmentCount === 2, "exactly the hit segment must be removed");
      assert(simulation.obstacles.length === 1, "destroyed segment must seed one bounded pod");
    },
  },
  {
    name: "P11-007 Mender repairs a damaged signal pod deterministically",
    run: () => {
      const obstacle: BugBarrageObstacle = Object.freeze({
        id: 8,
        position: Object.freeze({ x: 100, y: 100 }),
        health: 1,
      });
      const mender: BugBarrageRoamer = Object.freeze({
        id: 3,
        kind: "mender",
        position: Object.freeze({ x: 100, y: 100 }),
        velocity: Object.freeze({ x: 0, y: 0 }),
        repairCooldownSeconds: 0,
      });
      const simulation = new BugBarrageSimulation({
        rng: new SeededRandomService(3),
        difficulty: "swarm",
        initialObstacles: [obstacle],
        initialChains: [safeChain()],
        initialRoamers: [mender],
        initialInvulnerabilitySeconds: 10,
      });
      const events = simulation.update(
        { horizontal: 0, vertical: 0, fire: false },
        0,
      );
      assert(simulation.obstacles[0]?.health === 2, "Mender must repair one health step");
      assert(
        events.some((event) => event.type === "pod-repaired"),
        "repair must emit a render/audio-facing simulation event",
      );
    },
  },
  {
    name: "P11 lives reach terminal game over exactly on the final shield",
    run: () => {
      const simulation = new BugBarrageSimulation({
        rng: new SeededRandomService(4),
        difficulty: "garden",
        initialObstacles: [],
        initialChains: [chainWithSegments([{ x: 160, y: 216 }])],
        initialPlayerPosition: { x: 160, y: 216 },
        initialLives: 1,
        initialInvulnerabilitySeconds: 0,
      });
      const events = simulation.update(
        { horizontal: 0, vertical: 0, fire: false },
        0,
      );
      assert(simulation.gameOver, "final collision must end the run");
      assert(simulation.lives === 0, "final collision must consume the final shield");
      assert(
        events.filter((event) => event.type === "game-over").length === 1,
        "terminal transition must emit exactly one game-over event",
      );
      assert(
        simulation.update({ horizontal: 0, vertical: 0, fire: true }, 1).length === 0,
        "terminal simulation must remain inert until restart",
      );
    },
  },
  {
    name: "P11-008 clearing the last segment advances wave pressure within hard caps",
    run: () => {
      const simulation = new BugBarrageSimulation({
        rng: new SeededRandomService(5),
        difficulty: "outbreak",
        initialObstacles: [],
        initialChains: [chainWithSegments([{ x: 160, y: 195 }])],
        initialPlayerPosition: { x: 160, y: 216 },
        initialInvulnerabilitySeconds: 10,
      });
      const events = simulation.update(
        { horizontal: 0, vertical: 0, fire: true },
        0.1,
      );
      assert(
        events.some((event) => event.type === "wave-cleared"),
        "destroying the final segment must clear the wave",
      );
      assert(simulation.wave === 2, "wave clear must advance exactly one wave");
      assert(
        simulation.segmentCount === bugBarrageWaveSegmentCount(2, "outbreak"),
        "new wave must use canonical segment progression",
      );
      assert(
        simulation.obstacles.length === bugBarrageWaveObstacleCount(2, "outbreak"),
        "new wave must use canonical field-density progression",
      );
      assert(
        bugBarrageWaveSegmentCount(999, "outbreak") === BUG_BARRAGE_LIMITS.maxSegments &&
          bugBarrageWaveObstacleCount(999, "outbreak") === BUG_BARRAGE_LIMITS.maxObstacles &&
          bugBarrageSegmentSpeed(999, "outbreak") <= 188,
        "late-wave pressure must saturate at explicit design caps",
      );
    },
  },
  {
    name: "P11 seeded run initialization and roaming evolution are reproducible",
    run: () => {
      const make = () =>
        new BugBarrageSimulation({
          rng: new SeededRandomService(0x11bada),
          difficulty: "swarm",
          initialInvulnerabilitySeconds: 100,
        });
      const first = make();
      const second = make();
      for (let index = 0; index < 300; index += 1) {
        const input = { horizontal: 0 as const, vertical: 0 as const, fire: false };
        first.update(input, 1 / 60);
        second.update(input, 1 / 60);
      }
      assert(
        JSON.stringify(first.obstacles) === JSON.stringify(second.obstacles) &&
          JSON.stringify(first.chains) === JSON.stringify(second.chains) &&
          JSON.stringify(first.roamers) === JSON.stringify(second.roamers),
        "same seed and inputs must reproduce field, chain, and roaming state",
      );
      assert(
        first.roamers.length <= BUG_BARRAGE_LIMITS.maxRoamers,
        "secondary enemy population must remain bounded",
      );
    },
  },
];
