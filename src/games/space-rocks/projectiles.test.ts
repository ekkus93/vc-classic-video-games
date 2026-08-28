import { assert, type TestCase } from "../../test/harness.js";
import { createSpaceRocksShip } from "./ship.js";
import {
  SPACE_ROCKS_PROJECTILE_RULES,
  SpaceRocksProjectileSystem,
} from "./projectiles.js";

export const tests: readonly TestCase[] = [
  {
    name: "P7-004 projectile cadence rejects shots until cooldown expires",
    run: () => {
      const system = new SpaceRocksProjectileSystem();
      const ship = createSpaceRocksShip({ x: 160, y: 120 });

      assert(system.tryFire(ship), "first pulse must fire immediately");
      assert(!system.tryFire(ship), "second pulse in the same instant must be rejected");
      system.update(SPACE_ROCKS_PROJECTILE_RULES.fireIntervalSeconds / 2);
      assert(!system.tryFire(ship), "half cooldown must still reject fire");
      system.update(SPACE_ROCKS_PROJECTILE_RULES.fireIntervalSeconds / 2);
      assert(system.tryFire(ship), "fire must reopen when cooldown reaches zero");
    },
  },
  {
    name: "P7-004 holding fire cannot exceed the hard projectile bound",
    run: () => {
      const system = new SpaceRocksProjectileSystem();
      const ship = createSpaceRocksShip({ x: 160, y: 120 });
      let maximumObserved = 0;

      for (let frame = 0; frame < 60 * 20; frame += 1) {
        system.tryFire(ship);
        system.update(1 / 60);
        maximumObserved = Math.max(maximumObserved, system.bolts.length);
      }

      assert(
        maximumObserved <= SPACE_ROCKS_PROJECTILE_RULES.maxActive,
        "sustained fire must never exceed maxActive",
      );
    },
  },
  {
    name: "P7-004 pulse bolts expire and wrap while preserving overshoot",
    run: () => {
      const system = new SpaceRocksProjectileSystem();
      const ship = {
        ...createSpaceRocksShip({ x: 160, y: 15 }),
        velocity: { x: 0, y: 0 },
        facingRadians: 0,
      };
      assert(system.tryFire(ship), "fixture must fire a bolt");
      const initial = system.bolts[0];
      assert(initial !== undefined, "fixture must expose the fired bolt");
      assert(initial.position.y === 5, "fixture bolt must begin just above the top edge");
      system.update(0.1);
      const wrapped = system.bolts[0];
      assert(wrapped !== undefined, "bolt must still be alive after short update");
      assert(
        wrapped.position.y > 220 && wrapped.position.y < 240,
        "upward bolt crossing the top must wrap to bottom while preserving overshoot",
      );

      system.update(SPACE_ROCKS_PROJECTILE_RULES.lifetimeSeconds);
      assert(system.bolts.length === 0, "expired projectiles must be removed");
    },
  },
];
