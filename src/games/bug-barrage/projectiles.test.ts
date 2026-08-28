import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_LIMITS } from "./design.js";
import {
  BugBarrageProjectileSystem,
  sweptPointHitsCircle,
} from "./projectiles.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11-002 spark projectiles are rate limited and entity bounded",
    run: () => {
      const system = new BugBarrageProjectileSystem();
      for (let index = 0; index < 100; index += 1) {
        system.tryFire({ x: 160, y: 210 });
        system.update(1);
      }
      assert(
        system.projectiles.length <= BUG_BARRAGE_LIMITS.maxProjectiles,
        "projectile population must never exceed the hard cap",
      );
    },
  },
  {
    name: "P11-009 swept collision catches targets crossed between high-speed frames",
    run: () => {
      assert(
        sweptPointHitsCircle({ x: 100, y: 200 }, { x: 100, y: 80 }, { x: 100, y: 135 }, 7),
        "sweep must hit a target between endpoints",
      );
      assert(
        !sweptPointHitsCircle({ x: 100, y: 200 }, { x: 100, y: 80 }, { x: 120, y: 135 }, 7),
        "sweep must reject a target outside projectile radius",
      );
    },
  },
];
