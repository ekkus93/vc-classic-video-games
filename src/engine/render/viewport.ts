export interface Size2D {
  readonly width: number;
  readonly height: number;
}

export interface Viewport extends Size2D {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly integerScale: boolean;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}

export interface LogicalPoint {
  readonly x: number;
  readonly y: number;
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export function calculateViewport(
  logical: Size2D,
  physical: Size2D,
): Viewport {
  requirePositiveFinite(logical.width, "logical.width");
  requirePositiveFinite(logical.height, "logical.height");
  requirePositiveFinite(physical.width, "physical.width");
  requirePositiveFinite(physical.height, "physical.height");

  const fractionalScale = Math.min(
    physical.width / logical.width,
    physical.height / logical.height,
  );
  const wholeScale = Math.floor(fractionalScale);
  const integerScale = wholeScale >= 1;
  const scale = integerScale ? wholeScale : fractionalScale;
  const width = logical.width * scale;
  const height = logical.height * scale;

  return {
    x: (physical.width - width) / 2,
    y: (physical.height - height) / 2,
    width,
    height,
    scale,
    integerScale,
    logicalWidth: logical.width,
    logicalHeight: logical.height,
  };
}

export function physicalToLogical(
  viewport: Viewport,
  physicalX: number,
  physicalY: number,
): LogicalPoint | null {
  const x = (physicalX - viewport.x) / viewport.scale;
  const y = (physicalY - viewport.y) / viewport.scale;

  if (
    x < 0 ||
    y < 0 ||
    x > viewport.logicalWidth ||
    y > viewport.logicalHeight
  ) {
    return null;
  }

  return { x, y };
}
