import { assert, type TestCase } from "../../test/harness.js";
import {
  DEEP_DIGGER_ORIGINAL_LEVEL_SIGNATURE,
  createDeepDiggerLevel,
} from "./level.js";
import { DeepDiggerTerrain } from "./terrain.js";

export const tests: readonly TestCase[] = [
  {
    name: "P14-001 original Copper Lattice level has stable authored dimensions and bounded actors",
    run: () => {
      const level = createDeepDiggerLevel("bore", 1);
      assert(level.columns === 24 && level.rows === 16, "original level must use the P14 grid");
      assert(level.tunnels.length > 40, "original layout must contain a useful authored tunnel graph");
      assert(level.enemySpawns.length === 4, "Bore wave one must begin with four stalkers");
      assert(level.rockSpawns.length === 3, "wave one must keep rocks bounded");
      assert(
        DEEP_DIGGER_ORIGINAL_LEVEL_SIGNATURE.authored === "project-original",
        "level provenance marker must identify project-original expression",
      );
    },
  },
  {
    name: "P14-002 carving is idempotent and immediately opens a tunnel cell",
    run: () => {
      const terrain = new DeepDiggerTerrain(4, 3, [{ column: 0, row: 1 }]);
      assert(!terrain.isTunnel({ column: 1, row: 1 }), "fixture target must begin solid");
      assert(terrain.carve({ column: 1, row: 1 }), "first carve must change topology");
      assert(terrain.isTunnel({ column: 1, row: 1 }), "carve must be visible immediately");
      assert(!terrain.carve({ column: 1, row: 1 }), "second carve must be idempotent");
      assert(terrain.countTunnels() === 2, "idempotent carve must not duplicate topology");
    },
  },
  {
    name: "P14-003 topology path updates in the same step as a newly carved connection",
    run: () => {
      const terrain = new DeepDiggerTerrain(3, 1, [
        { column: 0, row: 0 },
        { column: 2, row: 0 },
      ]);
      assert(
        terrain.findTunnelPath({ column: 0, row: 0 }, { column: 2, row: 0 }).length === 0,
        "disconnected endpoints must not have a route",
      );
      terrain.carve({ column: 1, row: 0 });
      const path = terrain.findTunnelPath({ column: 0, row: 0 }, { column: 2, row: 0 });
      assert(path.length === 3, "newly carved bridge must be routable immediately");
    },
  },
  {
    name: "P14-004 disconnected tunnel BFS terminates with an empty route",
    run: () => {
      const terrain = new DeepDiggerTerrain(20, 20, [
        { column: 0, row: 0 },
        { column: 19, row: 19 },
      ]);
      const path = terrain.findTunnelPath(
        { column: 0, row: 0 },
        { column: 19, row: 19 },
      );
      assert(path.length === 0, "disconnected graph must fail closed without hanging");
    },
  },
];
