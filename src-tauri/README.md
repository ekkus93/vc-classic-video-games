# Native/Tauri boundary

`src-tauri` owns the Rust crate used for native application integration.

P0 contains only a dependency-free Rust scaffold so formatting, Clippy, tests, and the pinned Rust toolchain are continuously validated. P1 adds Tauri 2 while preserving the rule that per-frame game work stays in the webview.
