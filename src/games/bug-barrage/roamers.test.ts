import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_LIMITS, BUG_BARRAGE_RUN_RULES } from "./design.js";
import { spawnBugBarrageRoamer, stepBugBarrageRoamer } from "./roamers.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11-007 secondary bug spawning is seeded and hard-bounded",
    run: () => {
      const firstRng = new SeededRandomService(0x1107);
      const secondRng = new SeededRandomService(0x1107);
      const first = spawnBugBarrageRoamer(firstRng, 1, 0, 3);
      const second = spawnBugBarrageRoamer(secondRng, 1, 0, 3);
      assert(
        JSON.stringify(first) === JSON.stringify(second),
        "same run seed must reproduce the same secondary bug",
      );
      assert(
        spawnBugBarrageRoamer(
          new SeededRandomService(9),
          2,
          BUG_BARRAGE_LIMITS.maxRoamers,
          3,
        ) === null,
        "secondary bug spawning must fail closed at the entity cap",
      );
    },
  },
  {
    name: "P11-007 skimmers remain in the lower defense band while roaming",
    run: () => {
      let seed = 1;
      let skimmer = spawnBugBarrageRoamer(new SeededRandomService(seed), 1, 0, 1);
      while (skimmer?.kind !== "skimmer" && seed < 100) {
        seed += 1;
        skimmer = spawnBugBarrageRoamer(new SeededRandomService(seed), 1, 0, 1);
      }
      assert(skimmer?.kind === "skimmer", "fixture must obtain a seeded skimmer");
      const stepped = stepBugBarrageRoamer(skimmer, 0.5);
      assert(stepped !== null, "half-step skimmer must remain active");
      assert(
        stepped.position.y >= BUG_BARRAGE_RUN_RULES.playerRegionTop + 6 &&
          stepped.position.y <= BUG_BARRAGE_RUN_RULES.playerRegionBottom - 6,
        "skimmer vertical motion must bounce inside the defense band",
      );
    },
  },
];
