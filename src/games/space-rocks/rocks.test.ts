import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  SpaceRocksRockFactory,
  type SpaceRocksRock,
} from "./rocks.js";

function parentRock(): SpaceRocksRock {
  return Object.freeze({
    id: 99,
    size: "large",
    position: Object.freeze({ x: 100, y: 80 }),
    velocity: Object.freeze({ x: 20, y: -5 }),
    rotationRadians: 0.25,
    angularVelocityRadiansPerSecond: 0.3,
    shapeSeed: 123,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P7-005 fixed seed produces an identical deterministic rock split",
    run: () => {
      const first = new SpaceRocksRockFactory(new SeededRandomService(0x1234abcd), "orbit");
      const second = new SpaceRocksRockFactory(new SeededRandomService(0x1234abcd), "orbit");
      const firstChildren = first.split(parentRock());
      const secondChildren = second.split(parentRock());

      assert(firstChildren.length === 2, "large rock must split into two children");
      assert(
        firstChildren.every((child) => child.size === "medium"),
        "large rock children must be medium",
      );
      assert(
        JSON.stringify(firstChildren) === JSON.stringify(secondChildren),
        "same seed and parent must reproduce the exact child states",
      );
    },
  },
  {
    name: "P7-005 fracture hierarchy terminates at small rocks",
    run: () => {
      const factory = new SpaceRocksRockFactory(new SeededRandomService(77), "orbit");
      const medium = { ...parentRock(), size: "medium" as const };
      const small = { ...parentRock(), size: "small" as const };

      const smallChildren = factory.split(medium);
      assert(
        smallChildren.length === 2 && smallChildren.every((child) => child.size === "small"),
        "medium rock must split into two small rocks",
      );
      assert(factory.split(small).length === 0, "small rocks must not split further");
    },
  },
  {
    name: "P7-005 initial wave generation is seeded procedural data with bounded density",
    run: () => {
      const first = new SpaceRocksRockFactory(new SeededRandomService(12345), "drift");
      const second = new SpaceRocksRockFactory(new SeededRandomService(12345), "drift");
      const wave = first.createInitialWave(9);
      const reproduced = second.createInitialWave(9);

      assert(wave.length === 7, "drift wave nine must follow the project-owned count formula");
      assert(JSON.stringify(wave) === JSON.stringify(reproduced), "wave generation must reproduce for a fixed seed");
      assert(
        wave.every(
          (rock) =>
            rock.position.x === 0 ||
            rock.position.x === 319 ||
            rock.position.y === 0 ||
            rock.position.y === 239,
        ),
        "initial hazards must spawn on the perimeter away from the center ship",
      );

      const capped = new SpaceRocksRockFactory(new SeededRandomService(2), "nova").createInitialWave(99);
      assert(capped.length === 9, "initial large-rock count must remain hard bounded");
    },
  },
];
