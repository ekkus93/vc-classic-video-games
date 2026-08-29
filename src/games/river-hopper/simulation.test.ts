import { assert, type TestCase } from "../../test/harness.js";
import {
  RIVER_HOPPER_RUN_RULES,
  RIVER_HOPPER_SCORING,
  riverHopperGoalCenter,
  type RiverHopperStageDefinition,
} from "./design.js";
import { RiverHopperSimulation } from "./simulation.js";

const EMPTY_STAGE: RiverHopperStageDefinition = Object.freeze({
  id: "empty-test",
  label: "Empty Test",
  lanes: Object.freeze([]),
});

function stageWithLane(
  lane: RiverHopperStageDefinition["lanes"][number],
): RiverHopperStageDefinition {
  return Object.freeze({
    id: `test-${lane.kind}-${lane.row}`,
    label: "Test Lane",
    lanes: Object.freeze([Object.freeze({ ...lane })]),
  });
}

function completeHop(
  simulation: RiverHopperSimulation,
  direction: "up" | "down" | "left" | "right",
) {
  return simulation.update(direction, RIVER_HOPPER_RUN_RULES.hopDurationSeconds + 0.001);
}

export const tests: readonly TestCase[] = [
  {
    name: "P9-002 player movement is discrete and buffers exactly one next hop",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialPlayer: { x: 160, row: 5 },
      });
      simulation.update("up", 0.04);
      assert(simulation.player.moving && simulation.player.row === 5, "row ownership changes only when a hop lands");
      simulation.update("right", 0.04);
      assert(simulation.player.bufferedDirection === "right", "direction pressed mid-hop must be buffered");
      const events = simulation.update(null, 0.04);
      assert(Number(simulation.player.row) === 4, "first hop must land on the adjacent row");
      assert(simulation.player.moving, "buffered hop must begin immediately after landing");
      assert(simulation.player.bufferedDirection === null, "one-slot buffer must be consumed once");
      assert(
        events.some((event) => event.type === "hop-started" && event.direction === "right"),
        "buffer consumption must be observable as a new hop",
      );
      completeHop(simulation, "up");
      assert(simulation.player.position.x === 192, "buffered horizontal hop must move one 32-unit cell");
    },
  },
  {
    name: "P9-004 road hazards use geometric collision and consume one life",
    run: () => {
      const stage = stageWithLane({
        row: 10,
        kind: "road",
        direction: 1,
        speed: 0,
        entityWidth: 20,
        spacing: 100,
        phase: 50,
        palette: "coral",
      });
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 160, row: 10 },
      });
      const events = simulation.update(null, 0);
      assert(simulation.lives === 3, "vehicle overlap must consume exactly one life");
      assert(simulation.player.row === RIVER_HOPPER_RUN_RULES.startRow, "collision must respawn at the start bank");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "vehicle"), "vehicle loss reason must be explicit");
    },
  },
  {
    name: "P9-004 side-boundary collision is deterministic at the exact player edge",
    run: () => {
      const safe = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialPlayer: { x: RIVER_HOPPER_RUN_RULES.playerWidth / 2, row: 11 },
      });
      safe.update(null, 0);
      assert(safe.lives === 4, "exact in-bounds edge contact must remain safe");

      const outside = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialPlayer: { x: RIVER_HOPPER_RUN_RULES.playerWidth / 2 - 0.001, row: 11 },
      });
      const events = outside.update(null, 0);
      assert(outside.lives === 3, "crossing the edge by any positive amount must consume a life");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "bank-edge"), "edge loss must be explicit");
    },
  },
  {
    name: "P9-005 river support is based on actual positive overlap",
    run: () => {
      const stage = stageWithLane({
        row: 4,
        kind: "river",
        direction: 1,
        speed: 0,
        entityWidth: 20,
        spacing: 100,
        phase: 50,
        palette: "moss",
      });
      const supported = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 178.999, row: 4 },
      });
      supported.update(null, 0);
      assert(supported.lives === 4, "positive overlap with a barge must support the player");

      const edgeOnly = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 179, row: 4 },
      });
      const events = edgeOnly.update(null, 0);
      assert(edgeOnly.lives === 3, "zero-area edge contact must fall into the river");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "water"), "water loss must be explicit");
    },
  },
  {
    name: "P9-006 occupied moving platform carries the player by the same displacement",
    run: () => {
      const stage = stageWithLane({
        row: 4,
        kind: "river",
        direction: 1,
        speed: 20,
        entityWidth: 320,
        spacing: 320,
        phase: 0,
        palette: "slate",
      });
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 100, row: 4 },
      });
      simulation.update(null, 0.5);
      assert(simulation.player.position.x === 110, "player must inherit platform velocity times dt");
      assert(simulation.lives === 4, "carried player must remain supported");
    },
  },
  {
    name: "P9-006 platform carrying off the bank resolves as a boundary loss",
    run: () => {
      const stage = stageWithLane({
        row: 4,
        kind: "river",
        direction: 1,
        speed: 20,
        entityWidth: 320,
        spacing: 320,
        phase: 0,
        palette: "slate",
      });
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 310, row: 4 },
      });
      const events = simulation.update(null, 0.2);
      assert(simulation.lives === 3, "carried player must not wrap with the platform pattern");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "bank-edge"), "off-bank carry must use the boundary rule");
    },
  },
  {
    name: "P9-007 filled goal persists through the current round and respawns the runner",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialPlayer: { x: riverHopperGoalCenter(0), row: 1 },
      });
      const events = completeHop(simulation, "up");
      assert(simulation.filledGoals[0] === true, "successful beacon must remain filled");
      assert(simulation.player.row === RIVER_HOPPER_RUN_RULES.startRow, "goal must respawn for the next crossing");
      assert(simulation.lives === 4, "successful goal must not consume a life");
      assert(events.some((event) => event.type === "goal-filled" && event.slotIndex === 0), "goal fill must emit its scoring event");
    },
  },
  {
    name: "P9-007 occupied or missed goal is hazardous without clearing persisted goals",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialFilledGoals: [true, false, false, false, false],
        initialPlayer: { x: riverHopperGoalCenter(0), row: 1 },
      });
      const events = completeHop(simulation, "up");
      assert(simulation.lives === 3, "re-entering an occupied goal must consume a life");
      assert(simulation.filledGoals[0] === true, "previously filled goal must persist after the loss");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "closed-goal"), "closed goal must identify its loss reason");
    },
  },
  {
    name: "P9-007 missed goal gap is hazardous without changing persisted goals",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialFilledGoals: [false, true, false, false, false],
        initialPlayer: { x: 48, row: 1 },
      });
      const events = completeHop(simulation, "up");
      assert(simulation.lives === 3, "landing between beacon slots must consume one life");
      assert(
        simulation.filledGoals.join(",") === "false,true,false,false,false",
        "missed goal must preserve existing beacon occupancy",
      );
      assert(
        events.some((event) => event.type === "life-lost" && event.reason === "closed-goal"),
        "goal-gap loss must use the closed-goal rule",
      );
    },
  },
  {
    name: "P9-007 complete five-beacon round succeeds through ordinary discrete movement",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
      });
      const reachableGoalX = [32, 96, 160, 192, 256] as const;
      let filledCount = 0;

      for (const targetX of reachableGoalX) {
        while (simulation.player.position.x < targetX) {
          completeHop(simulation, "right");
        }
        while (simulation.player.position.x > targetX) {
          completeHop(simulation, "left");
        }
        for (let row = RIVER_HOPPER_RUN_RULES.startRow; row > 0; row -= 1) {
          const events = completeHop(simulation, "up");
          filledCount += events.filter((event) => event.type === "goal-filled").length;
        }
      }

      assert(filledCount === 5, "ordinary movement must be able to reach and fill all five beacons");
      assert(simulation.round === 2, "filling all five beacons must complete exactly one round");
      assert(simulation.lives === 4, "a clean complete round must not consume a life");
      assert(
        simulation.filledGoals.every((filled) => !filled),
        "the next round must begin with all beacon slots open",
      );
    },
  },
  {
    name: "P9-007 final beacon completes round, awards bonus, and advances original stage",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        initialFilledGoals: [true, true, true, true, false],
        initialPlayer: { x: riverHopperGoalCenter(4), row: 1 },
      });
      const events = completeHop(simulation, "up");
      assert(simulation.round === 2, "fifth beacon must advance the round");
      assert(simulation.stage.id === "lantern-reach", "round two must use the second original layout");
      assert(simulation.filledGoals.every((filled) => !filled), "new round must reset beacon occupancy");
      assert(events.some((event) => event.type === "round-cleared" && event.nextStageId === "lantern-reach"), "round transition must emit the next original stage");
    },
  },
  {
    name: "P9-008 timer expiry consumes a life and restores the round timer",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialTimeSeconds: 0.01,
      });
      const events = simulation.update(null, 0.01);
      assert(simulation.lives === 3, "timer expiry must consume one life");
      assert(simulation.timeRemainingSeconds === 43, "respawn must restore the current difficulty timer");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "timeout"), "timeout must be distinguishable from collisions");
    },
  },
  {
    name: "P9-008 forward-progress score is awarded only for new rows within a life",
    run: () => {
      const simulation = new RiverHopperSimulation({ difficulty: "channel", stages: [EMPTY_STAGE] });
      completeHop(simulation, "up");
      assert(simulation.score === RIVER_HOPPER_SCORING.forwardRow, "first forward row must score");
      completeHop(simulation, "down");
      completeHop(simulation, "up");
      assert(simulation.score === RIVER_HOPPER_SCORING.forwardRow, "revisiting an already reached row must not farm points");
    },
  },
  {
    name: "P9-008 later rounds increase lane pressure and reduce the timer deterministically",
    run: () => {
      const pressureStage = stageWithLane({
        row: 6,
        kind: "road",
        direction: 1,
        speed: 20,
        entityWidth: 20,
        spacing: 100,
        phase: 0,
        palette: "coral",
      });
      const roundOne = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [pressureStage],
        initialRound: 1,
      });
      const roundThree = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [pressureStage],
        initialRound: 3,
      });

      assert(roundOne.timeRemainingSeconds === 43, "round one uses the base channel timer");
      assert(roundThree.timeRemainingSeconds === 41, "round three must apply one deterministic timer drop");
      roundOne.update(null, 1);
      roundThree.update(null, 1);
      const firstOffset = roundOne.lanes[0]?.offset;
      const laterOffset = roundThree.lanes[0]?.offset;
      assert(firstOffset === 20, "round one lane displacement uses the base speed");
      assert(
        laterOffset !== undefined && Math.abs(laterOffset - 22.6) < 1e-9,
        "round three lane displacement must include the deterministic round speed step",
      );
    },
  },
  {
    name: "P9-008 final life emits one terminal score and freezes gameplay",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "torrent",
        stages: [EMPTY_STAGE],
        initialLives: 1,
        initialTimeSeconds: 0.01,
      });
      const events = simulation.update(null, 0.01);
      assert(simulation.gameOver && simulation.lives === 0, "final life loss must end the run");
      assert(events.filter((event) => event.type === "game-over").length === 1, "terminal update emits one game-over event");
      assert(simulation.update("up", 1).length === 0, "terminal simulation must stop advancing");
    },
  },
  {
    name: "CR-003 a chained buffered hop still triggers the water hazard it lands on",
    run: () => {
      const stage = stageWithLane({
        row: 4,
        kind: "river",
        direction: 1,
        speed: 0,
        entityWidth: 20,
        spacing: 100,
        phase: 50,
        palette: "moss",
      });
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [stage],
        initialPlayer: { x: 179, row: 5 },
      });
      simulation.update("up", 0.01);
      assert(simulation.player.moving, "hop toward the water row must be in progress");
      simulation.update("up", 0.01);
      assert(simulation.player.bufferedDirection === "up", "a second press mid-hop must buffer, not start a new hop yet");
      const events = simulation.update(null, RIVER_HOPPER_RUN_RULES.hopDurationSeconds);
      assert(simulation.lives === 3, "landing on open water must cost a life even though a hop was buffered to chain immediately on landing");
      assert(events.some((event) => event.type === "life-lost" && event.reason === "water"), "chained-hop landing on water must still be detected");
    },
  },
  {
    name: "CR-003 a chained buffered hop still registers landing on the goal row",
    run: () => {
      const simulation = new RiverHopperSimulation({
        difficulty: "channel",
        stages: [EMPTY_STAGE],
        initialPlayer: { x: riverHopperGoalCenter(0), row: 1 },
      });
      simulation.update("up", 0.01);
      assert(simulation.player.moving, "hop toward the goal row must be in progress");
      simulation.update("right", 0.01);
      assert(simulation.player.bufferedDirection === "right", "a second press mid-hop must buffer, not start a new hop yet");
      const events = simulation.update(null, RIVER_HOPPER_RUN_RULES.hopDurationSeconds);
      assert(simulation.filledGoals[0] === true, "landing on the goal row must still register even though a hop was buffered to chain immediately on landing");
      assert(simulation.player.row === RIVER_HOPPER_RUN_RULES.startRow, "a filled goal must respawn the runner, discarding the buffered chain");
      assert(events.some((event) => event.type === "goal-filled" && event.slotIndex === 0), "chained-hop landing on the goal must still emit its scoring event");
    },
  },
];
