import type { Vector2 } from "../../engine/index.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";

export interface MissileDefenseInterceptor {
  readonly id: number;
  readonly position: Vector2;
  readonly target: Vector2;
}

export interface MissileDefenseInterceptorStep {
  readonly active: readonly MissileDefenseInterceptor[];
  readonly arrived: readonly Vector2[];
}

export class MissileDefenseInterceptorSystem {
  private nextId = 1;
  private activeValue: readonly MissileDefenseInterceptor[] = Object.freeze([]);

  public get active(): readonly MissileDefenseInterceptor[] {
    return this.activeValue;
  }

  public tryLaunch(origin: Vector2, target: Vector2): boolean {
    if (this.activeValue.length >= MISSILE_DEFENSE_RUN_RULES.maxInterceptors) {
      return false;
    }
    this.activeValue = Object.freeze([
      ...this.activeValue,
      Object.freeze({
        id: this.nextId,
        position: Object.freeze({ ...origin }),
        target: Object.freeze({ ...target }),
      }),
    ]);
    this.nextId += 1;
    return true;
  }

  public update(dtSeconds: number): MissileDefenseInterceptorStep {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    const arrived: Vector2[] = [];
    const next: MissileDefenseInterceptor[] = [];
    for (const interceptor of this.activeValue) {
      const dx = interceptor.target.x - interceptor.position.x;
      const dy = interceptor.target.y - interceptor.position.y;
      const distance = Math.hypot(dx, dy);
      const travel = MISSILE_DEFENSE_RUN_RULES.interceptorSpeed * dtSeconds;
      if (distance <= travel || distance === 0) {
        arrived.push(interceptor.target);
        continue;
      }
      const ratio = travel / distance;
      next.push(
        Object.freeze({
          ...interceptor,
          position: Object.freeze({
            x: interceptor.position.x + dx * ratio,
            y: interceptor.position.y + dy * ratio,
          }),
        }),
      );
    }
    this.activeValue = Object.freeze(next);
    return Object.freeze({
      active: this.activeValue,
      arrived: Object.freeze(arrived),
    });
  }

  public reset(): void {
    this.activeValue = Object.freeze([]);
    this.nextId = 1;
  }
}
