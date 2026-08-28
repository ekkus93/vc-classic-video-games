export class KeyboardInputProvider {
  private readonly heldCodes = new Set<string>();
  private readonly pressedCodes = new Set<string>();
  private readonly releasedCodes = new Set<string>();

  public keyDown(code: string, repeat = false): void {
    if (code.length === 0) {
      return;
    }

    if (this.heldCodes.has(code)) {
      return;
    }

    this.heldCodes.add(code);
    if (!repeat) {
      this.pressedCodes.add(code);
    }
  }

  public keyUp(code: string): void {
    if (!this.heldCodes.delete(code)) {
      return;
    }
    this.releasedCodes.add(code);
  }

  public isHeld(code: string): boolean {
    return this.heldCodes.has(code);
  }

  public wasPressed(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  public wasReleased(code: string): boolean {
    return this.releasedCodes.has(code);
  }

  public clearEdges(): void {
    this.pressedCodes.clear();
    this.releasedCodes.clear();
  }

  public reset(): void {
    this.heldCodes.clear();
    this.clearEdges();
  }
}

export type KeyboardCapturePredicate = (code: string) => boolean;

export class BrowserKeyboardAdapter {
  private attached = false;

  public constructor(
    private readonly target: Window,
    private readonly provider: KeyboardInputProvider,
    private readonly shouldCapture: KeyboardCapturePredicate = () => true,
  ) {}

  public attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    this.target.addEventListener("blur", this.onBlur);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.provider.reset();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.shouldCapture(event.code)) {
      event.preventDefault();
    }
    this.provider.keyDown(event.code, event.repeat);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.shouldCapture(event.code)) {
      event.preventDefault();
    }
    this.provider.keyUp(event.code);
  };

  private readonly onBlur = (): void => {
    this.provider.reset();
  };
}
