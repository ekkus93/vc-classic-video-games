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

/**
 * CR2-003: converts one CSS-pixel dimension (a canvas's `clientWidth`/`clientHeight`, say) into
 * the device-pixel count that dimension actually occupies on the panel, given
 * `devicePixelRatio`. A canvas backing store sized in CSS pixels is scaled onto the panel by the
 * browser's own non-integer compositing scale whenever `devicePixelRatio` is not 1, which defeats
 * `calculateViewport`'s integer-nearest-neighbor guarantee -- that guarantee only holds in
 * whatever unit its `physical` argument is expressed in. Sizing the backing store (and, for
 * pointer input, the physical coordinates measured against it) in device pixels instead makes the
 * guarantee apply where it actually matters: on the panel, not in an intermediate CSS layout unit
 * the browser is about to rescale again.
 *
 * Rounds rather than truncates, so a CSS size already on an exact device-pixel boundary (the
 * common case at integer `devicePixelRatio`) is preserved exactly; floors at 1 device pixel,
 * matching `calculateViewport`'s own requirement that a physical size be positive.
 */
export function devicePhysicalSize(cssSize: number, devicePixelRatio: number): number {
  if (!Number.isFinite(cssSize) || cssSize < 0) {
    throw new RangeError("cssSize must be a non-negative finite number");
  }
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError("devicePixelRatio must be a positive finite number");
  }
  return Math.max(1, Math.round(cssSize * devicePixelRatio));
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
