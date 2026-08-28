const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const SHELL_FALLBACK_SELECTOR = [
  ".shell-panel button:not(:disabled)",
  ".shell-panel input:not(:disabled)",
  ".shell-panel select:not(:disabled)",
  ".pause-menu button:not(:disabled)",
].join(", ");

function focusableWithin(node: HTMLElement): HTMLElement | null {
  if (node.matches(FOCUSABLE_SELECTOR)) {
    return node;
  }
  return node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}

/**
 * Keeps DOM focus aligned with the shell's controller/keyboard selection.
 *
 * Controller navigation is intentionally independent of browser Tab order, but
 * assistive technology must still follow the same selected control. If a screen
 * has no managed selection (for example the running game canvas), focus falls
 * back to the shell surface rather than a stale control from the previous view.
 */
export function moveFocusToShellSelection(surface: HTMLElement): HTMLElement {
  const selected = surface.querySelector<HTMLElement>('[data-shell-focus="true"]');
  const selectedTarget = selected === null ? null : focusableWithin(selected);
  const fallback = surface.querySelector<HTMLElement>(SHELL_FALLBACK_SELECTOR);
  const target = selectedTarget ?? fallback ?? surface;
  target.focus();
  return target;
}
