# P6 keyboard-only accessibility checklist

This checklist is the manual acceptance procedure for **P6-010 — accessible status/error messaging**. It is intentionally keyboard-only: do not use a mouse, touchpad, touchscreen, or gamepad while executing it.

## Automated preflight

Before manual execution, CI must pass all of the following:

- frontend formatting and linting;
- strict TypeScript typecheck;
- frontend tests, including shell focus synchronization and accessible message semantics;
- production frontend build;
- Rust formatting, Clippy, and tests;
- native Tauri compile plus release-CSP and `tauri dev` Xvfb smoke tests.

The shell's current dark palette also exceeds WCAG AA 4.5:1 contrast for normal text on its intended backgrounds. Representative ratios are:

| Foreground | Background | Use | Contrast |
| --- | --- | --- | ---: |
| `#f4f4f5` | `#09090b` | primary text | 18.10:1 |
| `#d4d4d8` | `#09090b` | secondary text | 13.46:1 |
| `#fde047` | `#09090b` | headings/focus accent | 15.09:1 |
| `#a1a1aa` | `#09090b` | subdued diagnostics | 7.76:1 |
| `#86efac` | `#18181b` | high-score text | 12.62:1 |
| `#f87171` | `#18181b` | error border/accent | 6.40:1 |

Color is not the sole indicator of state: warning and error messages include the literal prefixes `Warning:` and `Error:`, focused controls receive a visible outline, selected remapping controls expose `aria-pressed`, and disabled/loading controls retain text labels.

## Manual environment

1. Start the application using the normal development Tauri command.
2. Put both hands on the keyboard and do not use pointer input for the remainder of the checklist.
3. Start with default settings when practical. If testing an existing profile, record any remappings that change the keys below.
4. For P6 before the first game is registered, execute sections A-D. Section E is the same checklist extension that must be repeated when P7 registers Space Rocks; P6's deterministic shell tests exercise those game-dependent routes in the meantime.

## A. Startup and launcher

- [x] On startup, a clearly visible focus/selection outline is present on the current launcher action. The focused control is not indicated by color alone.
- [x] Press `Tab` and `Shift+Tab`. Browser focus remains visibly identifiable and never disappears behind an overlay.
- [x] With the current empty release-one registry, focus `Settings & controls` and press `Enter` or `Space`. The settings screen opens without pointer input.
- [x] Press `Escape`/Back from settings. The launcher becomes interactive immediately and focus returns to a current launcher control rather than a removed element.

## B. Settings and controls

- [x] Navigate every settings group using only the keyboard. Every native control shows a visible focus indicator.
- [x] Change Master, Music, and Effects volume using keyboard arrows. The numeric percentage changes with the control.
- [x] Toggle mute, fullscreen, reduced effects, and pixel smoothing with `Space`. Each option has a textual label; state is not represented by color alone.
- [x] Focus a keyboard binding and activate it. `Press a key…` is displayed and the binding exposes a pressed/capture state.
- [x] Enter a valid replacement key. The new key name is displayed without pointer input.
- [x] Attempt a conflicting binding. The operation is rejected and an `Error:` message is visibly displayed.
- [x] Focus `Dismiss message` and activate it. The message disappears without changing the current screen.
- [x] Activate `Reset controls to defaults`; confirm the default binding names return.
- [x] Activate `Done`; focus returns to the originating shell screen.

## C. Status, warning, and error announcements

- [x] Routine status feedback is visible as text and is represented by a polite status live region.
- [x] Warning feedback contains the literal `Warning:` prefix and does not rely on its yellow border alone.
- [x] Error feedback contains the literal `Error:` prefix and does not rely on its red border alone.
- [x] A message can be dismissed entirely by keyboard.
- [x] New status/error content does not steal focus away from the control the user is operating.

## D. Keyboard focus integrity

- [x] Arrow/WASD shell navigation moves both the shell selection and DOM focus to the same interactive control.
- [x] When the selected shell item is a label containing a range/select/checkbox, DOM focus lands on the nested native control.
- [x] `Tab` navigation remains available; the global game-input adapter does not capture `Tab` or `Shift+Tab`.
- [x] Changing screens never leaves focus on an element that was removed from the DOM.
- [x] No operation in sections A-D requires a pointer.

## E. Game-dependent shell route — repeat when P7 registers Space Rocks

These rows cannot be executed against the production P6 registry because it intentionally contains no playable game until P7. They are covered by deterministic P6 controller/lifecycle tests and become a required manual release check as soon as Space Rocks exists.

- [ ] Select a game from the launcher using arrows/WASD and `Enter`/`Space`; the pre-game screen receives a current visible focus target.
- [ ] Navigate Start, player count, difficulty, high scores, controls, and Back using only the keyboard.
- [ ] Start the game and press `Escape`/Start to open Pause. The pause menu has visible focus and the paused state is communicated with text, not color alone.
- [ ] Navigate Resume, Restart, Controls, Sound, and Return to launcher with keyboard only.
- [ ] Restart and return to launcher both leave a usable, visibly focused shell control and no stale focus on the destroyed game/pause UI.

## Acceptance record

For a release candidate, record the date, commit SHA, environment, tester, and any failures below. Do not mark P6-010/release accessibility accepted if a required row for the currently available product surface fails.

- Date: 2026-08-28
- Commit: `69b3d4c0bccd166cbfec717925a7be412c447631`
- Environment: Linux/x86_64 native Tauri development app via `npm run tauri:dev`; Node 24.20.0; npm 11.19.0
- Tester: user manual validation
- Result: **PASS** for the currently available P6 product surface (sections A-D)
- Notes: CI run `33195691565` passed all frontend, Rust, and Tauri jobs. Section E remains intentionally deferred until P7 registers Space Rocks and must be repeated then.
