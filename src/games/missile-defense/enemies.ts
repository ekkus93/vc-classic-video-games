import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  MISSILE_DEFENSE_DIFFICULTIES,
  MISSILE_DEFENSE_RUN_RULES,
  type MissileDefenseDifficultyId,
} from "./design.js";
import type { MissileDefenseGroundState } from "./ground.js";

export interface MissileDefenseEnemyMissile {
  readonly id: number;
  readonly start: Vector2;
  readonly position: Vector2;
  readonly targetId: string;
  readonly target: Vector2;
  readonly speed: number;
}

export interface MissileDefenseEnemyStep {
  readonly active: readonly MissileDefenseEnemyMissile[];
  readonly impacts: readonly MissileDefenseEnemyMissile[];
}

export class MissileDefenseEnemyFactory {
  private nextId = 1;

  public constructor(
    private readonly rng: RandomService,
    private readonly difficulty: MissileDefenseDifficultyId,
  ) {}

  public create(ground: MissileDefenseGroundState, wave: number): MissileDefenseEnemyMissile {
    const targets = [
      ...ground.cities.filter((city) => city.alive),
      ...ground.batteries.filter((battery) => battery.alive),
    ];
    if (targets.length === 0) {
      throw new Error("cannot create an enemy missile without a live ground target");
    }
    const target = targets[Math.floor(this.rng.nextFloat() * targets.length)] ?? targets[0];
    if (target === undefined) {
      throw new Error("enemy target selection failed");
    }
    const x = 8 + this.rng.nextFloat() * (MISSILE_DEFENSE_RUN_RULES.logicalWidth - 16);
    const speed =
      MISSILE_DEFENSE_DIFFICULTIES[this.difficulty].enemySpeed *
      Math.min(1.55, 1 + (wave - 1) * 0.055);
    const start = Object.freeze({ x, y: 18 });
    const missile = Object.freeze({
      id: this.nextId,
      start,
      position: start,
      targetId: target.id,
      target: target.position,
      speed,
    });
    this.nextId += 1;
    return missile;
  }

  public update(
    missiles: readonly MissileDefenseEnemyMissile[],
    dtSeconds: number,
  ): MissileDefenseEnemyStep {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    const active: MissileDefenseEnemyMissile[] = [];
    const impacts: MissileDefenseEnemyMissile[] = [];
    for (const missile of missiles) {
      const dx = missile.target.x - missile.position.x;
      const dy = missile.target.y - missile.position.y;
      const distance = Math.hypot(dx, dy);
      const travel = missile.speed * dtSeconds;
      if (distance <= travel || distance === 0) {
        impacts.push(missile);
        continue;
      }
      const ratio = travel / distance;
      active.push(
        Object.freeze({
          ...missile,
          position: Object.freeze({
            x: missile.position.x + dx * ratio,
            y: missile.position.y + dy * ratio,
          }),
        }),
      );
    }
    return Object.freeze({ active: Object.freeze(active), impacts: Object.freeze(impacts) });
  }
}
