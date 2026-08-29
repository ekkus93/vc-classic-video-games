import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { MAZE_CHASE_SCORING } from "./design.js";
import { parseMaze } from "./maze.js";
import { MazeChaseSimulation } from "./simulation.js";

const BUFFER_MAZE = parseMaze([
  "#########",
  "#A     B#",
  "#      .#",
  "#   X   #",
  "#  P    #",
  "#C     D#",
  "#########",
]);

const LEVEL_MAZE = parseMaze([
  "###########",
  "#P.    A B#",
  "#    X    #",
  "# C      D#",
  "###########",
]);

const POWER_COLLISION_MAZE = parseMaze([
  "#########",
  "#PoA# B #",
  "# ###   #",
  "# X #   #",
  "# C . D #",
  "#########",
]);

const NORMAL_COLLISION_MAZE = parseMaze([
  "#########",
  "#P.A# B #",
  "# ###   #",
  "# X #   #",
  "# C . D #",
  "#########",
]);

// CR-014: NORMAL_COLLISION_MAZE with its second pellet removed, so the single pellet at (2,1)
// is the whole collectible field. Walking right off the start collects that last collectible and
// closes on the non-vulnerable amber sentinel at (3,1) inside the same update, which is the only
// way to drive collectAtPlayer -> resolveCollisions -> resolveLevelClear all in one tick.
const COMPOUND_CLEAR_MAZE = parseMaze([
  "#########",
  "#P.A# B #",
  "# ###   #",
  "# X #   #",
  "# C   D #",
  "#########",
]);

const BONUS_MAZE = parseMaze([
  "###########",
  "#P.X    A #",
  "#       .B#",
  "#         #",
  "# C      D#",
  "###########",
]);

function eventTypes(events: readonly { readonly type: string }[]): string {
  return events.map((event) => event.type).join(",");
}

export const tests: readonly TestCase[] = [
  {
    name: "CR-014/P10 a tick that both empties the field and hits a sentinel resolves hit then clear",
    run: () => {
      const services = createFakeGameServices(0x1014);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: COMPOUND_CLEAR_MAZE,
        initialLives: 3,
        initialRespawnGraceSeconds: 0,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.2);
      const order = eventTypes(events);

      assert(
        order.includes("pellet-collected"),
        "the move must collect the field's last collectible",
      );
      assert(order.includes("player-hit"), "the same move must run into the sentinel");
      assert(order.includes("level-cleared"), "emptying the field must still clear the level");
      assert(
        order.indexOf("player-hit") < order.indexOf("level-cleared"),
        "the compound tick must resolve the life loss before the level clear, not interleave them",
      );

      const livesAfterCompound: number = simulation.lives;
      const levelAfterCompound: number = simulation.level;
      assert(livesAfterCompound === 2, "the compound tick must cost exactly one life");
      assert(!simulation.gameOver, "a nonterminal compound tick must leave the run playable");
      assert(levelAfterCompound === 2, "the level must advance exactly once");
      assert(
        simulation.remainingPellets.size === COMPOUND_CLEAR_MAZE.pellets.size &&
          simulation.remainingPowerItems.size === COMPOUND_CLEAR_MAZE.powerItems.size,
        "the new level must repopulate the full collectible field",
      );
      assert(
        simulation.player.cell.x === COMPOUND_CLEAR_MAZE.playerStart.x &&
          simulation.player.cell.y === COMPOUND_CLEAR_MAZE.playerStart.y,
        "the runner must end the tick at the authored start, not double-reset somewhere else",
      );
      assert(
        simulation.enemies.length === 4 &&
          simulation.enemies.every((enemy) => enemy.respawnSeconds === 0),
        "both resets must leave a full, live sentinel roster with no stale respawn timers",
      );
      assert(
        simulation.enemies.every((enemy) => {
          const start = COMPOUND_CLEAR_MAZE.enemyStarts[enemy.id];
          return enemy.mover.cell.x === start.x && enemy.mover.cell.y === start.y;
        }),
        "every sentinel must be back on its authored start cell",
      );
      assert(
        simulation.vulnerabilitySeconds === 0 && simulation.bonusSeconds === 0,
        "the level clear must leave no power or bonus timer running into the new level",
      );
      assert(
        simulation.respawnGraceSeconds > 0,
        "the new level must start inside a bounded grace period",
      );

      // The state must stay coherent afterwards rather than only looking right for one frame.
      // This one-pellet field clears again on the next identical move, and the grace period the
      // clear installed must absorb the sentinel contact this time instead of costing a life.
      const followUp = simulation.update({ desiredDirection: "right" }, 0.2);
      assert(
        eventTypes(followUp).includes("level-cleared"),
        "the repopulated field must still be clearable through the normal path",
      );
      assert(
        !eventTypes(followUp).includes("player-hit"),
        "the grace period installed by the clear must absorb the next sentinel contact",
      );
      const levelAfterFollowUp: number = simulation.level;
      const livesAfterFollowUp: number = simulation.lives;
      assert(
        levelAfterFollowUp === levelAfterCompound + 1 &&
          livesAfterFollowUp === livesAfterCompound &&
          !simulation.gameOver,
        "the compound tick must not corrupt level or life accounting for later ticks",
      );
    },
  },
  {
    name: "CR-014/P10 a fatal compound tick ends the run instead of clearing the level",
    run: () => {
      const services = createFakeGameServices(0x1015);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: COMPOUND_CLEAR_MAZE,
        initialLives: 1,
        initialRespawnGraceSeconds: 0,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.2);
      const order = eventTypes(events);

      assert(order.includes("player-hit"), "the final life must still be consumed");
      assert(order.includes("game-over"), "losing the final life must terminate the run");
      assert(
        !order.includes("level-cleared"),
        "a run that ended on this tick must not also bank a level clear",
      );
      const finalLives: number = simulation.lives;
      const finalLevel: number = simulation.level;
      assert(
        simulation.gameOver && finalLives === 0 && finalLevel === 1,
        "the terminal state must be stable and must not advance the level",
      );
    },
  },
  {
    name: "P10-003 simulation retains a short early turn request until the intersection",
    run: () => {
      const services = createFakeGameServices(0x1003);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: BUFFER_MAZE,
        initialRespawnGraceSeconds: 10,
      });

      simulation.update({ desiredDirection: "right" }, 0.15);
      simulation.update({ desiredDirection: "up" }, 0.05);
      const position = simulation.playerPosition;
      assert(simulation.player.cell.x === 4 && simulation.player.cell.y === 4, "runner must reach the intended intersection");
      assert(simulation.player.direction === "up", "buffered input must turn at the first legal center");
      assert(position.y < 4, "unused frame distance must continue after the buffered turn");
    },
  },
  {
    name: "P10-004/P10-009 clearing the final collectible advances level and rebuilds the field",
    run: () => {
      const services = createFakeGameServices(0x1009);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "stroll",
        maze: LEVEL_MAZE,
        initialRespawnGraceSeconds: 10,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.21);

      assert(eventTypes(events).includes("pellet-collected"), "moving across the final pellet must collect it");
      assert(eventTypes(events).includes("level-cleared"), "empty collectible state must produce a level completion event");
      assert(simulation.level === 2, "level completion must advance exactly one level");
      assert(simulation.remainingPellets.size === 1, "next level must rebuild the authored collectible field");
      assert(
        simulation.score === MAZE_CHASE_SCORING.pellet + 600,
        "level score must include the pellet and deterministic level-one clear bonus",
      );
      assert(simulation.player.cell.x === LEVEL_MAZE.playerStart.x, "new level must reset the runner start");
    },
  },
  {
    name: "P10-008 power state reverses collision danger for a bounded period",
    run: () => {
      const services = createFakeGameServices(0x1008);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: POWER_COLLISION_MAZE,
        initialRespawnGraceSeconds: 0,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.2);
      const captured = events.find((event) => event.type === "enemy-captured");

      assert(eventTypes(events).includes("power-collected"), "runner must activate power on contact");
      assert(captured?.type === "enemy-captured" && captured.enemy === "amber", "powered contact must capture rather than damage the runner");
      assert(simulation.lives === 3, "powered collision must preserve runner lives");
      assert(simulation.vulnerabilitySeconds > 0, "power state must remain active after activation");
      assert(
        simulation.enemies.find((enemy) => enemy.id === "amber")?.respawnSeconds === 1.4,
        "captured sentinel must be removed for the bounded respawn period",
      );

      simulation.update({ desiredDirection: null }, 6.5);
      assert(simulation.vulnerabilitySeconds === 0, "power state must expire instead of becoming permanent");
    },
  },
  {
    name: "P10-009 nonterminal sentinel contact preserves field progress and respawns the runner",
    run: () => {
      const services = createFakeGameServices(0x1009);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: NORMAL_COLLISION_MAZE,
        initialLives: 2,
        initialRespawnGraceSeconds: 0,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.2);

      assert(eventTypes(events).includes("player-hit"), "unpowered contact must consume one life");
      assert(!eventTypes(events).includes("game-over"), "a remaining life must keep the run active");
      assert(simulation.lives === 1 && !simulation.gameOver, "nonterminal contact must leave one playable life");
      assert(simulation.player.cell.x === NORMAL_COLLISION_MAZE.playerStart.x && simulation.player.cell.y === NORMAL_COLLISION_MAZE.playerStart.y, "runner must respawn at the authored start cell");
      assert(simulation.remainingPellets.size === 1, "collected pellets must remain collected across a life respawn");
      assert(simulation.respawnGraceSeconds > 0, "respawn must receive the configured bounded grace period");
    },
  },
  {
    name: "P10-009 normal sentinel contact consumes the final life and emits one terminal score",
    run: () => {
      const services = createFakeGameServices(0x1010);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "circuit",
        maze: NORMAL_COLLISION_MAZE,
        initialLives: 1,
        initialRespawnGraceSeconds: 0,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.2);

      assert(eventTypes(events).includes("player-hit"), "unpowered contact must damage the runner");
      assert(eventTypes(events).includes("game-over"), "final life loss must terminate the run");
      assert(simulation.lives === 0 && simulation.gameOver, "terminal state must be stable after final contact");
      assert(simulation.update({ desiredDirection: "left" }, 1).length === 0, "game-over simulation must stop producing gameplay events");
    },
  },
  {
    name: "P10-004 bonus appears after collectible progress and expires when ignored",
    run: () => {
      const services = createFakeGameServices(0x1004);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "stroll",
        maze: BONUS_MAZE,
        initialRespawnGraceSeconds: 10,
      });
      const events = simulation.update({ desiredDirection: "right" }, 0.21);
      assert(eventTypes(events).includes("bonus-appeared"), "crossing the progress threshold must spawn the timed bonus");
      assert(simulation.bonusVisible, "spawned bonus must be visible while its timer is positive");
      simulation.update({ desiredDirection: null }, 9.1);
      assert(!simulation.bonusVisible && simulation.bonusSeconds === 0, "ignored bonus must expire at the fixed lifetime bound");
    },
  },
  {
    name: "P10-004 timed bonus can be collected for the deterministic level-scaled score",
    run: () => {
      const services = createFakeGameServices(0x1004);
      const simulation = new MazeChaseSimulation({
        rng: services.rng,
        difficulty: "stroll",
        maze: BONUS_MAZE,
        initialRespawnGraceSeconds: 10,
      });
      simulation.update({ desiredDirection: "right" }, 0.21);
      const events = simulation.update({ desiredDirection: "right" }, 0.18);
      const collected = events.find((event) => event.type === "bonus-collected");

      assert(collected?.type === "bonus-collected", "runner reaching the visible bonus cell must collect it");
      assert(collected.points === MAZE_CHASE_SCORING.bonusBase, "level one bonus must award the base bonus value");
      assert(simulation.score === MAZE_CHASE_SCORING.pellet + MAZE_CHASE_SCORING.bonusBase, "bonus points must be added exactly once to the run score");
      assert(!simulation.bonusVisible, "collected bonus must disappear immediately");
    },
  },
  {
    name: "P10-006/P10-008 complete seeded simulation is reproducible across runs",
    run: () => {
      const firstServices = createFakeGameServices(0x10cafe);
      const secondServices = createFakeGameServices(0x10cafe);
      const first = new MazeChaseSimulation({ rng: firstServices.rng, difficulty: "circuit" });
      const second = new MazeChaseSimulation({ rng: secondServices.rng, difficulty: "circuit" });
      const directions = ["left", "up", "right", "down", null] as const;

      for (let frame = 0; frame < 900; frame += 1) {
        const desiredDirection = directions[Math.floor(frame / 45) % directions.length] ?? null;
        first.update({ desiredDirection }, 1 / 60);
        second.update({ desiredDirection }, 1 / 60);
      }

      const snapshot = (simulation: MazeChaseSimulation): string =>
        JSON.stringify({
          score: simulation.score,
          lives: simulation.lives,
          level: simulation.level,
          player: simulation.player,
          enemies: simulation.enemies,
          pellets: [...simulation.remainingPellets].sort(),
          power: [...simulation.remainingPowerItems].sort(),
          vulnerability: simulation.vulnerabilitySeconds,
          phase: simulation.phaseMode,
          bonus: simulation.bonusSeconds,
        });
      assert(snapshot(first) === snapshot(second), "same seed and inputs must reproduce the full deterministic game state");
    },
  },
];
