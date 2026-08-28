import { assert, type TestCase } from "../../test/harness.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";
import { createMissileDefenseCursor, stepMissileDefenseCursor } from "./cursor.js";

const pointer = (x: number, y: number) => ({
  position: { x, y },
  inside: true,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
});
const absentPointer = {
  position: null,
  inside: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
};

export const tests: readonly TestCase[] = [
  {
    name: "P8-002 pointer aiming consumes shared logical coordinates and clamps battlefield bounds",
    run: () => {
      const moved = stepMissileDefenseCursor(
        createMissileDefenseCursor(),
        { xAxis: 0, yAxis: 0, pointer: pointer(47.5, 91.25) },
        1 / 60,
      );
      assert(moved.x === 47.5 && moved.y === 91.25, "logical pointer position must be preserved exactly");
      const clamped = stepMissileDefenseCursor(
        moved,
        { xAxis: 0, yAxis: 0, pointer: pointer(-50, 500) },
        0,
      );
      assert(clamped.x === 0, "reticle must clamp horizontal edge");
      assert(clamped.y === MISSILE_DEFENSE_RUN_RULES.cursorMaxY, "reticle must stay above ground");
    },
  },
  {
    name: "P8-009 directional aim normalizes diagonals for gamepad parity",
    run: () => {
      const start = { x: 160, y: 120 };
      const horizontal = stepMissileDefenseCursor(
        start,
        { xAxis: 1, yAxis: 0, pointer: absentPointer },
        0.25,
      );
      const diagonal = stepMissileDefenseCursor(
        start,
        { xAxis: 1, yAxis: -1, pointer: absentPointer },
        0.25,
      );
      const horizontalDistance = Math.hypot(horizontal.x - start.x, horizontal.y - start.y);
      const diagonalDistance = Math.hypot(diagonal.x - start.x, diagonal.y - start.y);
      assert(
        Math.abs(horizontalDistance - diagonalDistance) < 1e-9,
        "diagonal aim must not move faster than cardinal aim",
      );
    },
  },
];
