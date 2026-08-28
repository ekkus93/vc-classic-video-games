export type AudioUnlock = () => Promise<boolean>;

export function attachAudioUnlockGestures(
  keyboardTarget: EventTarget,
  pointerTarget: EventTarget,
  unlock: AudioUnlock,
): () => void {
  let attached = true;
  let unlocking = false;

  const detach = (): void => {
    if (!attached) {
      return;
    }
    attached = false;
    keyboardTarget.removeEventListener("keydown", onGesture);
    pointerTarget.removeEventListener("pointerdown", onGesture);
  };

  const onGesture = (): void => {
    if (!attached || unlocking) {
      return;
    }
    unlocking = true;
    let attempt: Promise<boolean>;
    try {
      attempt = unlock();
    } catch {
      unlocking = false;
      return;
    }
    void attempt
      .then((unlocked) => {
        if (unlocked) {
          detach();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        unlocking = false;
      });
  };

  keyboardTarget.addEventListener("keydown", onGesture);
  pointerTarget.addEventListener("pointerdown", onGesture);
  return detach;
}
