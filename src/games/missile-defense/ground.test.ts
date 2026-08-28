import { assert, type TestCase } from "../../test/harness.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";
import {
  chooseMissileDefenseBattery,
  consumeBatteryAmmo,
  createMissileDefenseGround,
  destroyGroundTarget,
  prepareGroundForNextWave,
} from "./ground.js";

export const tests: readonly TestCase[] = [
  {
    name: "P8-003 nearest live battery consumes exactly one finite round",
    run: () => {
      const ground = createMissileDefenseGround();
      const selected = chooseMissileDefenseBattery(ground.batteries, { x: 150, y: 80 });
      assert(selected?.id === "battery-2", "center battery must serve a center target");
      const fired = consumeBatteryAmmo(ground, "battery-2");
      assert(
        fired.batteries[1]?.ammo === MISSILE_DEFENSE_RUN_RULES.batteryAmmo - 1,
        "one launch consumes one round",
      );
      assert(
        ground.batteries[1]?.ammo === MISSILE_DEFENSE_RUN_RULES.batteryAmmo,
        "ground updates must not mutate prior state",
      );
    },
  },
  {
    name: "P8-008 destroyed batteries are unavailable and receive bounded emergency repair next wave",
    run: () => {
      const destroyed = destroyGroundTarget(createMissileDefenseGround(), "battery-2");
      assert(
        chooseMissileDefenseBattery(destroyed.batteries, { x: 160, y: 80 })?.id !== "battery-2",
        "destroyed launch site must not fire",
      );
      const repaired = prepareGroundForNextWave(destroyed);
      assert(repaired.batteries[1]?.alive === true, "surviving run must not soft-lock without batteries");
      assert(
        (repaired.batteries[1]?.ammo ?? 0) > 0 &&
          (repaired.batteries[1]?.ammo ?? 0) <= MISSILE_DEFENSE_RUN_RULES.batteryAmmoCap,
        "wave reload must be positive and bounded",
      );
    },
  },
];
