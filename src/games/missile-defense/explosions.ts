import type { Vector2 } from "../../engine/index.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";

export type MissileDefenseExplosionPhase = "expanding" | "contracting";

export interface MissileDefenseExplosion {
  readonly id: number;
  readonly position: Vector2;
  readonly radius: number;
  readonly phase: MissileDefenseExplosionPhase;
  readonly chain: boolean;
}

export class MissileDefenseExplosionSystem {
  private nextId = 1;
  private explosionsValue: readonly MissileDefenseExplosion[] = Object.freeze([]);

  public get explosions(): readonly MissileDefenseExplosion[] {
    return this.explosionsValue;
  }

  public trySpawn(position: Vector2, chain = false): boolean {
    if (this.explosionsValue.length >= MISSILE_DEFENSE_RUN_RULES.maxExplosions) {
      return false;
    }
    this.explosionsValue = Object.freeze([
      ...this.explosionsValue,
      Object.freeze({
        id: this.nextId,
        position: Object.freeze({ ...position }),
        radius: chain ? 4 : 2,
        phase: "expanding" as const,
        chain,
      }),
    ]);
    this.nextId += 1;
    return true;
  }

  public update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    const next: MissileDefenseExplosion[] = [];
    for (const explosion of this.explosionsValue) {
      if (explosion.phase === "expanding") {
        const radius = Math.min(
          MISSILE_DEFENSE_RUN_RULES.explosionMaxRadius,
          explosion.radius + MISSILE_DEFENSE_RUN_RULES.explosionExpandSpeed * dtSeconds,
        );
        next.push(
          Object.freeze({
            ...explosion,
            radius,
            phase:
              radius >= MISSILE_DEFENSE_RUN_RULES.explosionMaxRadius
                ? ("contracting" as const)
                : ("expanding" as const),
          }),
        );
        continue;
      }
      const radius =
        explosion.radius - MISSILE_DEFENSE_RUN_RULES.explosionContractSpeed * dtSeconds;
      if (radius > 0) {
        next.push(Object.freeze({ ...explosion, radius }));
      }
    }
    this.explosionsValue = Object.freeze(next);
  }

  public contains(position: Vector2): boolean {
    return this.explosionsValue.some((explosion) => {
      const dx = position.x - explosion.position.x;
      const dy = position.y - explosion.position.y;
      return dx * dx + dy * dy <= explosion.radius * explosion.radius;
    });
  }

  public reset(): void {
    this.explosionsValue = Object.freeze([]);
    this.nextId = 1;
  }
}
