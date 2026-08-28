import { assert, type TestCase } from "../../test/harness.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";
import type { MissileDefenseEnemyMissile } from "./enemies.js";
import { createMissileDefenseGround, type MissileDefenseGroundState } from "./ground.js";
import {
  MISSILE_DEFENSE_IDLE_INPUT,
  MissileDefenseSimulation,
} from "./simulation.js";

const pointer = (x: number, y: number, pressed = false) => ({
  position: { x, y },
  inside: true,
  primaryHeld: pressed,
  primaryPressed: pressed,
  primaryReleased: false,
});

function enemy(
  position: { readonly x: number; readonly y: number },
  targetId: string,
  target: { readonly x: number; readonly y: number },
  speed: number,
): MissileDefenseEnemyMissile {
  return Object.freeze({
    id: 1,
    start: Object.freeze({ ...position }),
    position: Object.freeze({ ...position }),
    targetId,
    target: Object.freeze({ ...target }),
    speed,
  });
}

function oneCityGround(): MissileDefenseGroundState {
  const ground = createMissileDefenseGround();
  return Object.freeze({
    cities: Object.freeze(
      ground.cities.map((city, index) => Object.freeze({ ...city, alive: index === 0 })),
    ),
    batteries: ground.batteries,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P8-003 simulation enforces per-site finite ammunition and does not launch from an empty site",
    run: () => {
      const services = createFakeGameServices(8);
      const ground = createMissileDefenseGround();
      const centerOnly: MissileDefenseGroundState = Object.freeze({
        cities: ground.cities,
        batteries: Object.freeze(
          ground.batteries.map((battery, index) =>
            Object.freeze({ ...battery, alive: index === 1, ammo: index === 1 ? MISSILE_DEFENSE_RUN_RULES.batteryAmmo : 0 }),
          ),
        ),
      });
      const simulation = new MissileDefenseSimulation({
        rng: services.rng,
        difficulty: "guard",
        initialGround: centerOnly,
        enemyGoalOverride: 99,
      });
      let launches = 0;
      for (let index = 0; index < MISSILE_DEFENSE_RUN_RULES.batteryAmmo + 2; index += 1) {
        launches += simulation.update(
          { xAxis: 0, yAxis: 0, fire: true, pointer: pointer(160, 80, true) },
          0,
        ).filter((event) => event.type === "interceptor-fired").length;
      }
      assert(launches === MISSILE_DEFENSE_RUN_RULES.batteryAmmo, "site may fire only its finite rounds");
      assert(simulation.ground.batteries[1]?.ammo === 0, "center battery must visibly reach zero ammo");
    },
  },
  {
    name: "P8-007 interceptor blast destroys a hostile missile and starts a chain reaction",
    run: () => {
      const services = createFakeGameServices(9);
      const stationary = enemy({ x: 160, y: 80 }, "city-1", { x: 44, y: 214 }, 0);
      const simulation = new MissileDefenseSimulation({
        rng: services.rng,
        difficulty: "guard",
        initialEnemies: [stationary],
        initialSpawnedCount: 1,
        enemyGoalOverride: 1,
      });
      const events = simulation.update(
        { xAxis: 0, yAxis: 0, fire: true, pointer: pointer(160, 80, true) },
        1,
      );
      assert(simulation.enemies.length === 0, "blast intersection must remove the hostile missile");
      assert(
        events.some((event) => event.type === "enemy-intercepted" && event.chain),
        "interception must seed a chain blast while capacity remains",
      );
      assert(simulation.score > 0, "interception must award score");
    },
  },
  {
    name: "P8-008 hostile impact destroys the last settlement and emits one terminal game-over",
    run: () => {
      const services = createFakeGameServices(10);
      const ground = oneCityGround();
      const city = ground.cities[0];
      assert(city !== undefined, "fixture city must exist");
      const incoming = enemy({ x: city.position.x, y: 30 }, city.id, city.position, 1000);
      const simulation = new MissileDefenseSimulation({
        rng: services.rng,
        difficulty: "guard",
        initialGround: ground,
        initialEnemies: [incoming],
        initialSpawnedCount: 1,
        enemyGoalOverride: 1,
      });
      const events = simulation.update(MISSILE_DEFENSE_IDLE_INPUT, 1);
      assert(simulation.ground.cities.every((entry) => !entry.alive), "last settlement must remain destroyed");
      assert(simulation.gameOver, "loss of every settlement must end the run");
      assert(events.filter((event) => event.type === "game-over").length === 1, "terminal event must be unique");
      assert(simulation.update(MISSILE_DEFENSE_IDLE_INPUT, 1).length === 0, "terminal simulation must stay inert");
    },
  },
  {
    name: "P8-008 wave resolution scores survivors and ammo while preserving city damage and repairing batteries",
    run: () => {
      const services = createFakeGameServices(11);
      const base = createMissileDefenseGround();
      const damaged: MissileDefenseGroundState = Object.freeze({
        cities: Object.freeze(
          base.cities.map((city, index) => Object.freeze({ ...city, alive: index !== 0 })),
        ),
        batteries: Object.freeze(
          base.batteries.map((battery, index) =>
            Object.freeze({ ...battery, alive: index !== 1, ammo: index === 1 ? 0 : 3 }),
          ),
        ),
      });
      const simulation = new MissileDefenseSimulation({
        rng: services.rng,
        difficulty: "watch",
        initialGround: damaged,
        enemyGoalOverride: 0,
      });
      const events = simulation.update(MISSILE_DEFENSE_IDLE_INPUT, 0);
      assert(events.some((event) => event.type === "wave-cleared"), "empty resolved wave must award its deterministic bonus");
      assert(simulation.score > 0, "wave survival resources must contribute to score");
      simulation.update(MISSILE_DEFENSE_IDLE_INPUT, MISSILE_DEFENSE_RUN_RULES.waveTransitionSeconds);
      assert(simulation.wave === 2, "transition must advance exactly one wave");
      assert(simulation.ground.cities[0]?.alive === false, "settlement damage must carry across waves");
      assert(simulation.ground.batteries[1]?.alive === true, "battery must be restored for a viable next wave");
    },
  },
];
