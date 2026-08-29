---
name: verify
description: Run the full local check sequence this repo's CI runs before you commit or open a PR — formatting, linting, metadata sync, asset provenance, typecheck, tests, and build, for both the frontend and Rust sides. Use when the user asks to verify, check, or validate their changes are ready, or before committing/pushing.
---

Run these checks in order. Stop and report as soon as one fails — fix it, then resume from that step
rather than restarting the whole sequence.

1. `npm run format:check` — fails if any file needs `scripts/format.mjs --write` or `cargo fmt`.
   If it fails, run `npm run format` to auto-fix, then re-check.
2. `npm run metadata:check` — verifies `package.json` / `Cargo.toml` / `tauri.conf.json` name,
   version, and identifier stay in sync.
3. `npm run assets:check` — validates any third-party asset is recorded in
   `assets/ATTRIBUTION.json` with license/provenance (see `docs/ASSET_POLICY.md`).
4. `npm run typecheck` — `tsc --noEmit`.
5. `npm run build` — `tsc --noEmit` + `vite build`. Run this *before* step 6, not after: it produces
   `dist/`, which `cargo clippy`/`cargo test` need at compile time (`tauri::generate_context!()`
   reads `frontendDist` from `tauri.conf.json`, currently `"../dist"`) — without it they fail with
   "the `frontendDist` configuration is set to `../dist` but this path doesn't exist". If `dist/`
   already exists from a previous build, this step is still safe to run (it just rebuilds it).
6. `npm run lint` — custom frontend lint (`scripts/lint.mjs` + game-boundary check) and
   `cargo clippy --workspace --all-targets --locked -- -D warnings`.
7. `npm run test` — frontend tests (`scripts/test.mjs`, the hand-rolled runner — not
   Jest/Vitest) and `cargo test --workspace --locked`.

If `node_modules/` doesn't exist yet, run `npm ci` first. Only run `npm run tauri:build` (the native
shell build) if the change touches `src-tauri/` or Tauri config — it's much slower and CI runs it
separately as a smoke test.

When everything passes, summarize what was checked; don't just say "done" — name the steps that ran
clean. If something required a fix, say what was fixed.
