---
name: lint-n-test
description: Lint the frontend and Rust code, then run the full test suite. Use when the user asks to lint and test their changes.
model: haiku
---

First, if `node_modules/` doesn't exist, run `npm ci`. Then, if `dist/` doesn't exist, run
`npm run build` — `cargo clippy`/`cargo test` need it at compile time
(`tauri::generate_context!()` reads `frontendDist` from `tauri.conf.json`) and fail without it with
"the `frontendDist` configuration is set to `../dist` but this path doesn't exist".

Then run these two checks, in order, and report the result of each:

1. `npm run lint` — custom frontend lint (`scripts/lint.mjs` + game-boundary check) and
   `cargo clippy --workspace --all-targets --locked -- -D warnings`.
2. `npm run test` — frontend tests (`scripts/test.mjs`, the hand-rolled test runner — not
   Jest/Vitest) and `cargo test --workspace --locked`.

Stop and report as soon as one step fails, showing the relevant error output. Don't attempt to fix
failures yourself — just report what failed and where. If both pass, say so plainly; don't just say
"done", name the two commands that ran clean.
