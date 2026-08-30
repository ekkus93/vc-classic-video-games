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
    if (button !== null) {
      // WebKitGTK can lose or retarget the matching pointerup when a composited canvas sits under
      // the pause overlay. We know pointerdown reaches the visible button (and is the user's
      // activation gesture), so perform the button activation here instead of waiting for an
      // unreliable pointerup/compatibility-click sequence. The synthetic click still goes through
      // the button's normal React onClick handler, preserving one source of command semantics.
      activateShellUiButton(button, event.button);
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    // Swallow the rest of the shell-UI pointer sequence so gameplay never observes a release for
    // a press it did not receive. Activation already happened on pointerdown above.
    isolateShellUiPointer(event);
  };

  // Capture before BrowserPointerAdapter's bubbling listeners on the shell surface.
  surface.addEventListener("pointerdown", onPointerDown, true);
  surface.addEventListener("pointerup", onPointerUp, true);

  return () => {
    surface.removeEventListener("pointerdown", onPointerDown, true);
    surface.removeEventListener("pointerup", onPointerUp, true);
  };
}
