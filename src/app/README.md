# Application shell boundary

`src/app` owns user-interface composition such as the launcher, settings, diagnostics, score views, and shell-level overlays.

Real-time game simulation must not be implemented as application UI state. P1 may introduce React here, while the game runtime remains under `src/engine`.
