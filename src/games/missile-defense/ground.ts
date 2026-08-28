import type { Vector2 } from "../../engine/index.js";
import {
  MISSILE_DEFENSE_BATTERY_X,
  MISSILE_DEFENSE_CITY_X,
  MISSILE_DEFENSE_RUN_RULES,
} from "./design.js";

export interface MissileDefenseCity {
  readonly id: string;
  readonly position: Vector2;
  readonly alive: boolean;
}

export interface MissileDefenseBattery {
  readonly id: string;
  readonly position: Vector2;
  readonly alive: boolean;
  readonly ammo: number;
}

export interface MissileDefenseGroundState {
  readonly cities: readonly MissileDefenseCity[];
  readonly batteries: readonly MissileDefenseBattery[];
}

export function createMissileDefenseGround(): MissileDefenseGroundState {
  return Object.freeze({
    cities: Object.freeze(
      MISSILE_DEFENSE_CITY_X.map((x, index) =>
        Object.freeze({
          id: `city-${index + 1}`,
          position: Object.freeze({ x, y: MISSILE_DEFENSE_RUN_RULES.groundY }),
          alive: true,
        }),
      ),
    ),
    batteries: Object.freeze(
      MISSILE_DEFENSE_BATTERY_X.map((x, index) =>
        Object.freeze({
          id: `battery-${index + 1}`,
          position: Object.freeze({ x, y: MISSILE_DEFENSE_RUN_RULES.groundY - 2 }),
          alive: true,
          ammo: MISSILE_DEFENSE_RUN_RULES.batteryAmmo,
        }),
      ),
    ),
  });
}

export function chooseMissileDefenseBattery(
  batteries: readonly MissileDefenseBattery[],
  target: Vector2,
): MissileDefenseBattery | null {
  let selected: MissileDefenseBattery | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const battery of batteries) {
    if (!battery.alive || battery.ammo <= 0) {
      continue;
    }
    const distance = Math.abs(target.x - battery.position.x);
    if (distance < bestDistance) {
      selected = battery;
      bestDistance = distance;
    }
  }
  return selected;
}

export function consumeBatteryAmmo(
  ground: MissileDefenseGroundState,
  batteryId: string,
): MissileDefenseGroundState {
  return Object.freeze({
    cities: ground.cities,
    batteries: Object.freeze(
      ground.batteries.map((battery) =>
        battery.id === batteryId
          ? Object.freeze({ ...battery, ammo: Math.max(0, battery.ammo - 1) })
          : battery,
      ),
    ),
  });
}

export function destroyGroundTarget(
  ground: MissileDefenseGroundState,
  targetId: string,
): MissileDefenseGroundState {
  return Object.freeze({
    cities: Object.freeze(
      ground.cities.map((city) =>
        city.id === targetId ? Object.freeze({ ...city, alive: false }) : city,
      ),
    ),
    batteries: Object.freeze(
      ground.batteries.map((battery) =>
        battery.id === targetId
          ? Object.freeze({ ...battery, alive: false, ammo: 0 })
          : battery,
      ),
    ),
  });
}

export function prepareGroundForNextWave(
  ground: MissileDefenseGroundState,
): MissileDefenseGroundState {
  const remainingAmmo = ground.batteries.reduce((sum, battery) => sum + battery.ammo, 0);
  const carry = Math.floor(remainingAmmo / Math.max(1, ground.batteries.length * 2));
  const reload = Math.min(
    MISSILE_DEFENSE_RUN_RULES.batteryAmmoCap,
    MISSILE_DEFENSE_RUN_RULES.batteryAmmo + carry,
  );
  return Object.freeze({
    cities: ground.cities,
    batteries: Object.freeze(
      ground.batteries.map((battery) =>
        Object.freeze({ ...battery, alive: true, ammo: reload }),
      ),
    ),
  });
}
