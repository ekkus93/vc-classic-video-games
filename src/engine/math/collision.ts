import { subtract, type Vector2 } from "./vector2.js";

export interface Aabb {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export function intersectsAabb(a: Aabb, b: Aabb): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function intersectsCircle(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

function cross(a: Vector2, b: Vector2): number {
  return a.x * b.y - a.y * b.x;
}

export function segmentsIntersect(
  aStart: Vector2,
  aEnd: Vector2,
  bStart: Vector2,
  bEnd: Vector2,
): boolean {
  const r = subtract(aEnd, aStart);
  const s = subtract(bEnd, bStart);
  const denominator = cross(r, s);
  const offset = subtract(bStart, aStart);

  if (denominator === 0) {
    if (cross(offset, r) !== 0) {
      return false;
    }

    const rr = r.x * r.x + r.y * r.y;
    if (rr === 0) {
      return aStart.x === bStart.x && aStart.y === bStart.y;
    }
    const t0 = (offset.x * r.x + offset.y * r.y) / rr;
    const bEndOffset = subtract(bEnd, aStart);
    const t1 = (bEndOffset.x * r.x + bEndOffset.y * r.y) / rr;
    const min = Math.min(t0, t1);
    const max = Math.max(t0, t1);
    return max >= 0 && min <= 1;
  }

  const t = cross(offset, s) / denominator;
  const u = cross(offset, r) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
