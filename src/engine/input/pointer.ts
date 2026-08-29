import {
  physicalToLogical,
  type LogicalPoint,
  type Viewport,
} from "../render/viewport.js";

export interface PointerSnapshot {
  readonly position: LogicalPoint | null;
  readonly inside: boolean;
  readonly primaryHeld: boolean;
  readonly primaryPressed: boolean;
  readonly primaryReleased: boolean;
}

export interface PointerInputService {
  snapshot(): PointerSnapshot;
}

const EMPTY_POINTER: PointerSnapshot = Object.freeze({
  position: null,
  inside: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
});

export class PointerInputProvider {
  private position: LogicalPoint | null = null;
  private inside = false;
  private primaryHeld = false;
  private primaryPressed = false;
  private primaryReleased = false;

  public constructor(private readonly viewport: () => Viewport) {}

  public move(physicalX: number, physicalY: number): void {
    this.position = physicalToLogical(this.viewport(), physicalX, physicalY);
    this.inside = this.position !== null;
  }

  public buttonDown(button: number): void {
    if (button !== 0 || this.primaryHeld) {
      return;
    }
    this.primaryHeld = true;
    this.primaryPressed = true;
  }

  public buttonUp(button: number): void {
    if (button !== 0 || !this.primaryHeld) {
      return;
    }
    this.primaryHeld = false;
    this.primaryReleased = true;
  }

  public leave(): void {
    this.position = null;
    this.inside = false;
  }

  public consumeFrame(): PointerSnapshot {
    const snapshot = Object.freeze({
      position: this.position === null ? null : Object.freeze({ ...this.position }),
      inside: this.inside,
      primaryHeld: this.primaryHeld,
      primaryPressed: this.primaryPressed,
      primaryReleased: this.primaryReleased,
    });
    this.primaryPressed = false;
    this.primaryReleased = false;
    return snapshot;
  }

  public reset(): void {
    this.position = null;
    this.inside = false;
    this.primaryHeld = false;
    this.primaryPressed = false;
    this.primaryReleased = false;
  }
}

export class StaticPointerInputService implements PointerInputService {
  public constructor(private state: PointerSnapshot = EMPTY_POINTER) {}

  public set(snapshot: PointerSnapshot): void {
    this.state = Object.freeze(snapshot);
  }

  public snapshot(): PointerSnapshot {
    return this.state;
  }
}

export class BrowserPointerAdapter {
  private attached = false;

  /**
   * CR-004: `surface` is the element pointer events are listened on -- it must stay mounted for
   * the adapter's whole lifetime, so callers typically pass a stable ancestor container.
   * `boundsSurface`, if given, is resolved fresh on every pointer event and is the element whose
   * `getBoundingClientRect()` actually defines the physical-coordinate origin/size a caller's
   * `viewport()` callback should also be measuring against. They must agree: if the listening
   * surface has padding/chrome the visible game box doesn't (as this app's outer shell container
   * does around its canvas), using the listening surface's own bounds for both computes physical
   * coordinates against the wrong box and misaligns pointer-aimed gameplay from where the pointer
   * visually is. Defaults to `surface` itself, preserving the old (bounds === listening surface)
   * behavior for callers that have no such mismatch.
   *
   * CR2-003: `devicePixelRatio`, if given, scales the CSS-pixel event offset into device pixels
   * before it reaches `viewport()`'s output. This exists to agree with the render path, not to
   * "fix" pointer math on its own -- `event.clientX`/`getBoundingClientRect()` are both CSS
   * pixels, so pointer math is internally self-consistent (and DPR-correct) even without this.
   * The reason it still has to change: `calculateViewport`'s integer scale is `floor(physical /
   * logical)`, and `floor` is not linear in `devicePixelRatio` -- a CSS size just under an integer
   * multiple of the logical size can floor to a different scale once expanded to device pixels
   * than it did in CSS pixels. If the render path (see `presentFramebuffer`'s caller) sizes its
   * backing store, and therefore its own `calculateViewport` call, in device pixels while pointer
   * math stays in CSS pixels, the two can quantize to genuinely different viewports at exactly
   * those boundary sizes -- not just a scale-factor mismatch, but a different letterbox offset --
   * and a click would target the wrong logical position relative to what is actually drawn.
   * Scaling the physical coordinate here, together with `viewport()` being fed the same
   * device-pixel physical size the render path uses, keeps both sides quantizing identically.
   * Defaults to `() => 1`, preserving the old (CSS-pixel) behavior for callers with no such
   * device-pixel render path to agree with.
   */
  public constructor(
    private readonly surface: HTMLElement,
    private readonly provider: PointerInputProvider,
    private readonly boundsSurface: () => HTMLElement | null = () => surface,
    private readonly devicePixelRatio: () => number = () => 1,
  ) {}

  public attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.surface.addEventListener("pointermove", this.onPointerMove);
    this.surface.addEventListener("pointerdown", this.onPointerDown);
    this.surface.addEventListener("pointerup", this.onPointerUp);
    this.surface.addEventListener("pointerleave", this.onPointerLeave);
    this.surface.addEventListener("pointercancel", this.onPointerCancel);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    this.surface.removeEventListener("pointermove", this.onPointerMove);
    this.surface.removeEventListener("pointerdown", this.onPointerDown);
    this.surface.removeEventListener("pointerup", this.onPointerUp);
    this.surface.removeEventListener("pointerleave", this.onPointerLeave);
    this.surface.removeEventListener("pointercancel", this.onPointerCancel);
    this.provider.reset();
  }

  private moveFromEvent(event: PointerEvent): void {
    const bounds = (this.boundsSurface() ?? this.surface).getBoundingClientRect();
    const dpr = this.devicePixelRatio();
    this.provider.move(
      (event.clientX - bounds.left) * dpr,
      (event.clientY - bounds.top) * dpr,
    );
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.moveFromEvent(event);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.moveFromEvent(event);
    this.provider.buttonDown(event.button);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.moveFromEvent(event);
    this.provider.buttonUp(event.button);
  };

  private readonly onPointerLeave = (): void => {
    this.provider.leave();
  };

  private readonly onPointerCancel = (): void => {
    this.provider.reset();
  };
}
