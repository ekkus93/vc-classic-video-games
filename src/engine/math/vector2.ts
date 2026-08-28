export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(vector: Vector2, scalar: number): Vector2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function lengthSquared(vector: Vector2): number {
  return dot(vector, vector);
}

export function length(vector: Vector2): number {
  return Math.sqrt(lengthSquared(vector));
}

export function normalize(vector: Vector2): Vector2 {
  const magnitude = length(vector);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }
  return scale(vector, 1 / magnitude);
}

export function wrapCoordinate(value: number, extent: number): number {
  if (!Number.isFinite(extent) || extent <= 0) {
    throw new RangeError("extent must be a positive finite number");
  }
  return ((value % extent) + extent) % extent;
}
