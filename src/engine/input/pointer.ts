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

  public constructor(
    private readonly surface: HTMLElement,
    private readonly provider: PointerInputProvider,
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
    const bounds = this.surface.getBoundingClientRect();
    this.provider.move(event.clientX - bounds.left, event.clientY - bounds.top);
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
