import { assert, type TestCase } from "../../test/harness.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";
import { MissileDefenseEnemyFactory } from "./enemies.js";
import { MissileDefenseExplosionSystem } from "./explosions.js";
import { createMissileDefenseGround } from "./ground.js";
import { MissileDefenseInterceptorSystem } from "./interceptors.js";

export const tests: readonly TestCase[] = [
  {
    name: "P8-004 interceptor travels toward its target and only arrives after covering the distance",
    run: () => {
      const system = new MissileDefenseInterceptorSystem();
      assert(system.tryLaunch({ x: 10, y: 200 }, { x: 110, y: 100 }), "launch must succeed");
      const first = system.update(0.25);
      assert(first.arrived.length === 0 && first.active.length === 1, "interceptor must travel visibly");
      const second = system.update(2);
      assert(second.arrived.length === 1 && second.active.length === 0, "interceptor must terminate at target");
    },
  },
  {
    name: "P8-005 explosions expand contract and enforce a hard entity cap",
    run: () => {
      const system = new MissileDefenseExplosionSystem();
      for (let index = 0; index < MISSILE_DEFENSE_RUN_RULES.maxExplosions + 10; index += 1) {
        system.trySpawn({ x: index, y: 80 });
      }
      assert(system.explosions.length === MISSILE_DEFENSE_RUN_RULES.maxExplosions, "blast cap must hold");
      system.update(1);
      assert(
        system.explosions.every((blast) => blast.radius <= MISSILE_DEFENSE_RUN_RULES.explosionMaxRadius),
        "blast radius must remain bounded",
      );
      system.update(2);
      assert(Number(system.explosions.length) === 0, "contracted blasts must be reclaimed");
    },
  },
  {
    name: "P8-006 seeded hostile target selection and trajectories reproduce exactly",
    run: () => {
      const a = createFakeGameServices(0x8123);
      const b = createFakeGameServices(0x8123);
      const firstFactory = new MissileDefenseEnemyFactory(a.rng, "guard");
      const secondFactory = new MissileDefenseEnemyFactory(b.rng, "guard");
      const ground = createMissileDefenseGround();
      const first = firstFactory.create(ground, 3);
      const second = secondFactory.create(ground, 3);
      assert(
        first.start.x === second.start.x && first.targetId === second.targetId && first.speed === second.speed,
        "same seed and wave must generate the same hostile missile",
      );
      const steppedA = firstFactory.update([first], 0.5).active[0];
      const steppedB = secondFactory.update([second], 0.5).active[0];
      assert(
        steppedA?.position.x === steppedB?.position.x && steppedA?.position.y === steppedB?.position.y,
        "seeded trajectory advancement must remain deterministic",
      );
    },
  },
];
