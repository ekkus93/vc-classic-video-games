const SHELL_UI_BUTTON_SELECTOR = ".pause-menu button, .dismiss-message";

interface ShellUiButton {
  readonly disabled: boolean;
  focus(): void;
  click(): void;
}

export function activateShellUiButton(
  button: ShellUiButton,
  pointerButton: number,
): boolean {
  if (button.disabled || pointerButton !== 0) {
    return false;
  }
  button.focus();
  button.click();
  return true;
}

function shellUiButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest<HTMLButtonElement>(SHELL_UI_BUTTON_SELECTOR);
}

function isolateShellUiPointer(event: PointerEvent): HTMLButtonElement | null {
  const button = shellUiButtonFromTarget(event.target);
  if (button === null) {
    return null;
  }

  // The gameplay pointer adapter listens on this same outer shell surface. Pause-menu chrome and
  // the floating message-dismiss button are shell UI, so their pointer sequence must never leak
  // into gameplay. Capture-phase interception also makes the controls independent of WebKitGTK's
  // compatibility-click synthesis over the accelerated canvas.
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  return button;
}

export function attachShellUiPointerRouting(surface: HTMLElement): () => void {
  const onPointerDown = (event: PointerEvent): void => {
    const button = isolateShellUiPointer(event);
    if (button !== null && event.button === 0 && !button.disabled) {
      button.focus();
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    const button = isolateShellUiPointer(event);
    if (button !== null) {
      activateShellUiButton(button, event.button);
    }
  };

  // Capture before BrowserPointerAdapter's bubbling listeners on the shell surface.
  surface.addEventListener("pointerdown", onPointerDown, true);
  surface.addEventListener("pointerup", onPointerUp, true);

  return () => {
    surface.removeEventListener("pointerdown", onPointerDown, true);
    surface.removeEventListener("pointerup", onPointerUp, true);
  };
}
