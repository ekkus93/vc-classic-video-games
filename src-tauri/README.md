# Native/Tauri boundary

`src-tauri` owns the Rust/native application boundary. Tauri 2 creates the desktop window and serves the bundled Vite frontend through the system webview.

Native commands and platform integrations belong here. Real-time game simulation, rendering, input polling, and audio must remain in the webview; game code must never add per-frame Tauri IPC.
