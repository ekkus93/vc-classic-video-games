import type { Vector2 } from "../../engine/index.js";
import {
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
} from "./design.js";

export interface BugBarrageProjectile {
  readonly id: number;
  readonly position: Vector2;
  readonly previousPosition: Vector2;
}

export class BugBarrageProjectileSystem {
  private values: readonly BugBarrageProjectile[] = Object.freeze([]);
  private nextId = 1;
  private cooldownSeconds = 0;

  public get projectiles(): readonly BugBarrageProjectile[] {
    return this.values;
  }

  public tryFire(position: Vector2): BugBarrageProjectile | null {
    if (
      this.cooldownSeconds > 0 ||
      this.values.length >= BUG_BARRAGE_LIMITS.maxProjectiles
    ) {
      return null;
    }
    const projectile = Object.freeze({
      id: this.nextId,
      position: Object.freeze({ x: position.x, y: position.y - 8 }),
      previousPosition: Object.freeze({ x: position.x, y: position.y - 8 }),
    });
    this.nextId += 1;
    this.cooldownSeconds = BUG_BARRAGE_RUN_RULES.projectileCooldownSeconds;
    this.values = Object.freeze([...this.values, projectile]);
    return projectile;
  }

  public update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - dtSeconds);
    this.values = Object.freeze(
      this.values
        .map((projectile) =>
          Object.freeze({
            ...projectile,
            previousPosition: projectile.position,
            position: Object.freeze({
              x: projectile.position.x,
              y: projectile.position.y - BUG_BARRAGE_RUN_RULES.projectileSpeed * dtSeconds,
            }),
          }),
        )
        .filter((projectile) => projectile.position.y >= -8),
    );
  }

  public remove(id: number): void {
    this.values = Object.freeze(
      this.values.filter((projectile) => projectile.id !== id),
    );
  }

  public reset(): void {
    this.values = Object.freeze([]);
    this.nextId = 1;
    this.cooldownSeconds = 0;
  }
}

export function sweptPointHitsCircle(
  start: Vector2,
  end: Vector2,
  center: Vector2,
  radius: number,
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((center.x - start.x) * dx + (center.y - start.y) * dy) /
              lengthSquared,
          ),
        );
  const closestX = start.x + dx * t;
  const closestY = start.y + dy * t;
  const offsetX = closestX - center.x;
  const offsetY = closestY - center.y;
  return offsetX * offsetX + offsetY * offsetY <= radius * radius;
}
