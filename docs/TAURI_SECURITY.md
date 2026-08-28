# Tauri security boundary

The desktop shell uses Tauri 2 with a deliberately narrow native surface.

## Capability policy

`src-tauri/capabilities/main.json` is the only capability enabled by `tauri.conf.json`. It is scoped to the bundled local `main` window and currently grants only `core:app:default`. The project does **not** enable shell, filesystem, HTTP/network, dialog, notification, or remote-content plugins.

Application-defined Rust commands are registered explicitly in `src-tauri/src/lib.rs`. The frontend uses Tauri's official `window.__TAURI__.core.invoke` global API, enabled by `app.withGlobalTauri`, so P1 does not add a separate runtime npm dependency. Capabilities still constrain native API access, and no remote capability is configured. Command inputs must be typed and validated before use. Real-time game update/render/input/audio code must never use Tauri IPC per frame.

## Content security policy

The release configuration permits bundled content only. Scripts and styles are restricted to `'self'`; `connect-src` contains only Tauri IPC endpoints; images/fonts are limited to local/data/asset sources required by the application. Remote scripts, arbitrary network origins, and wildcard source expressions are intentionally absent.

Development uses a separate CSP that additionally permits the loopback Vite HMR WebSocket and inline development styles. Those allowances are not present in release builds.

## Adding native functionality

Before adding a plugin or command:

1. Prefer a frontend-only implementation when native access is unnecessary.
2. Add only the smallest command/permission required.
3. Validate command inputs in Rust.
4. Scope filesystem or other resources narrowly if such access is later introduced.
5. Never grant generic shell execution to game modules.
6. Update this document and `docs/SPEC.md` when the security boundary materially changes.
