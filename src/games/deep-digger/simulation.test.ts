import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import type { DeepDiggerLevelDefinition } from "./level.js";
import { DeepDiggerSimulation } from "./simulation.js";

function level(
  tunnels: readonly { readonly column: number; readonly row: number }[],
  playerSpawn: { readonly column: number; readonly row: number },
  enemySpawns: readonly { readonly column: number; readonly row: number }[],
  rockSpawns: readonly { readonly column: number; readonly row: number }[] = [],
  columns = 5,
  rows = 4,
): DeepDiggerLevelDefinition {
  return Object.freeze({
    columns,
    rows,
    tunnels: Object.freeze(tunnels.map((cell) => Object.freeze({ ...cell }))),
    playerSpawn: Object.freeze({ ...playerSpawn }),
    enemySpawns: Object.freeze(enemySpawns.map((cell) => Object.freeze({ ...cell }))),
    rockSpawns: Object.freeze(rockSpawns.map((cell) => Object.freeze({ ...cell }))),
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P14-002/P14-003 player digging changes movement collision and navigation topology immediately",
    run: () => {
      const services = createFakeGameServices(0x1402);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: level(
          [
            { column: 1, row: 1 },
            { column: 4, row: 1 },
          ],
          { column: 1, row: 1 },
          [{ column: 4, row: 1 }],
        ),
        initialInvulnerabilitySeconds: 10,
      });

      const events = simulation.update({ move: "right", attack: false }, 1 / 60);
      assert(simulation.player.cell.column === 2, "player must enter the carved cell");
      assert(simulation.terrain.isTunnel({ column: 2, row: 1 }), "dug cell must become tunnel");
      assert(
        events.some((event) => event.type === "dug"),
        "digging must publish deterministic feedback",
      );
      assert(simulation.score === 2, "new earth cell must award the project-defined dig score");
    },
  },
  {
    name: "P14-004/P14-005 disconnected enemy enters bounded solid-material phase traversal",
    run: () => {
      const fixture = level(
        [
          { column: 0, row: 0 },
          { column: 4, row: 2 },
        ],
        { column: 0, row: 0 },
        [{ column: 4, row: 2 }],
      );
      const aServices = createFakeGameServices(0x1405);
      const bServices = createFakeGameServices(0x1405);
      const a = new DeepDiggerSimulation({
        rng: aServices.rng,
        difficulty: "survey",
        level: fixture,
        initialInvulnerabilitySeconds: 10,
      });
      const b = new DeepDiggerSimulation({
        rng: bServices.rng,
        difficulty: "survey",
        level: fixture,
        initialInvulnerabilitySeconds: 10,
      });

      const first = a.update({ move: null, attack: false }, 0);
      b.update({ move: null, attack: false }, 0);
      assert(
        first.some((event) => event.type === "enemy-phased"),
        "disconnected stalker must switch to its special traversal state",
      );
      assert(a.enemies[0]?.mode === "phase", "enemy must expose visible phase state");

      a.update({ move: null, attack: false }, 0.25);
      b.update({ move: null, attack: false }, 0.25);
      assert(
        JSON.stringify(a.enemies) === JSON.stringify(b.enemies),
        "same seed and inputs must reproduce phase traversal exactly",
      );
    },
  },
  {
    name: "P14-006 pressure attack requires three visible stages before a defeat",
    run: () => {
      const services = createFakeGameServices(0x1406);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: level(
          [
            { column: 0, row: 1 },
            { column: 1, row: 1 },
            { column: 2, row: 1 },
            { column: 3, row: 1 },
            { column: 4, row: 1 },
          ],
          { column: 1, row: 1 },
          [{ column: 4, row: 1 }],
        ),
        initialInvulnerabilitySeconds: 10,
      });

      const first = simulation.update({ move: "right", attack: true }, 0);
      assert(
        first.some((event) => event.type === "enemy-pressured" && event.stage === 1),
        "first pump must create pressure stage one",
      );
      simulation.update({ move: null, attack: true }, 0);
      const third = simulation.update({ move: null, attack: true }, 0);
      assert(
        third.some((event) => event.type === "enemy-defeated"),
        "third pump before decay must defeat the target",
      );
      assert(simulation.score >= 250, "pressure defeat must award score");
    },
  },
  {
    name: "P14-006 pressure decays if the player does not complete the attack sequence",
    run: () => {
      const services = createFakeGameServices(0x1460);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: level(
          [
            { column: 1, row: 1 },
            { column: 2, row: 1 },
            { column: 3, row: 1 },
            { column: 4, row: 1 },
          ],
          { column: 1, row: 1 },
          [{ column: 4, row: 1 }],
        ),
        initialInvulnerabilitySeconds: 10,
      });
      simulation.update({ move: "right", attack: true }, 0);
      assert(simulation.enemies[0]?.pressureStage === 1, "fixture must reach stage one");
      simulation.update({ move: null, attack: false }, 1.6);
      assert(Number(simulation.enemies[0]?.pressureStage) === 0, "unfinished pressure must decay to zero");
    },
  },
  {
    name: "P14-007 falling rock trigger and enemy crush resolve deterministically",
    run: () => {
      const services = createFakeGameServices(0x1407);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: level(
          [
            { column: 0, row: 3 },
            { column: 2, row: 1 },
            { column: 2, row: 2 },
            { column: 2, row: 3 },
            { column: 4, row: 3 },
          ],
          { column: 0, row: 3 },
          [
            { column: 2, row: 2 },
            { column: 4, row: 3 },
          ],
          [{ column: 2, row: 0 }],
          5,
          4,
        ),
        initialInvulnerabilitySeconds: 10,
      });

      const loosened = simulation.update({ move: null, attack: false }, 0);
      assert(
        loosened.some((event) => event.type === "rock-loosened"),
        "excavated support must arm the rock immediately",
      );
      const falling = simulation.update({ move: null, attack: false }, 0.6);
      assert(
        falling.some((event) => event.type === "enemy-crushed"),
        "falling rock must crush a stalker occupying its deterministic path",
      );
      assert(
        !falling.some((event) => event.type === "rock-landed"),
        "shake time must not be reused to accelerate the rock to its landing",
      );
      const landed = simulation.update({ move: null, attack: false }, 0.13);
      assert(
        landed.some((event) => event.type === "rock-landed"),
        "rock must stop after the remaining deterministic fall time elapses",
      );
    },
  },
  {
    name: "P14-008 terminal life loss emits one game-over event and freezes the run",
    run: () => {
      const services = createFakeGameServices(0x1408);
      const simulation = new DeepDiggerSimulation({
        rng: services.rng,
        difficulty: "survey",
        level: level(
          [{ column: 1, row: 1 }],
          { column: 1, row: 1 },
          [{ column: 1, row: 1 }],
        ),
        initialLives: 1,
      });
      const terminal = simulation.update({ move: null, attack: false }, 0);
      assert(
        terminal.filter((event) => event.type === "game-over").length === 1,
        "terminal collision must emit exactly one game-over event",
      );
      assert(simulation.gameOver, "terminal collision must freeze the run");
      assert(
        simulation.update({ move: null, attack: false }, 1).length === 0,
        "finished runs must not continue simulating or duplicate terminal events",
      );
    },
  },
];
