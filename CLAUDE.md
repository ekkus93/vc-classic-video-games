# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Controller-first Tauri 2 desktop app bundling 10 original, clean-room, retro-arcade-inspired
games (no ROMs, no copied assets) behind one shared launcher/runtime, targeting converted
Debian/Ubuntu Chromebooks. Frontend: TypeScript + React 19 + Vite. Native shell: Rust (Tauri 2).
Source of truth for architecture and product decisions: `docs/SPEC.md`. Canonical phased
implementation plan with per-task acceptance criteria: `docs/TODO.md`.

## Commands

All commands are custom npm scripts (no ESLint/Prettier/Jest/Vitest — see below). Run from repo root:

- `npm run format` — auto-fix formatting (`scripts/format.mjs --write` + `cargo fmt --all`)
- `npm run format:check` / `npm run lint` / `npm run metadata:check` / `npm run assets:check` /
  `npm run typecheck` / `npm run test` / `npm run build` — the exact sequence CI runs, in this order
- `npm run test:frontend` — custom test runner only (fast iteration on TS/game logic)
- `npm run tauri:dev` / `npm run tauri:build` — run/build the native shell

Toolchain versions are exact-pinned and enforced: Node `24.20.0`, npm `11.19.0` (`engine-strict` in
`.npmrc`; CI checks the exact npm version), Rust `1.98.0` (`rust-toolchain.toml`). Building the
native shell requires Debian/Ubuntu dev packages (webkit2gtk, appindicator, etc.) — see
`docs/DEVELOPMENT.md`.

`cargo clippy`/`cargo test` require `dist/` to exist first: `tauri::generate_context!()` reads
`frontendDist` (`"../dist"`) from `tauri.conf.json` at compile time and fails if it's missing. Run
`npm run build` before any Rust lint/test command on a fresh checkout (CI's `rust` job does the same).

## Testing

- Frontend tests use a hand-rolled runner, not Jest/Vitest: `scripts/test.mjs` compiles `*.test.ts`
  via `tsconfig.test.json` and runs each module's exported `tests: readonly TestCase[]`
  (`{ name, run }`, defined in `src/test/harness.ts`, which also exports `assert()` /
  `assertDeepEqual()` — no other matcher library). Tests are colocated as `*.test.ts` next to source.
- Rust tests are standard `cargo test --workspace --locked`.
- Games run on a fixed-timestep simulation loop. When writing a test for one mechanic (e.g. a
  landing/collision event), build a fixture that isolates it from other logic sharing the same
  tick — e.g. wave-reset or timestep-remainder handling can silently fire in the same update and
  pollute an unrelated assertion. Prefer a dedicated fixture per mechanic over reusing one that
  exercises multiple systems at once.

## Code style and architecture invariants

`tsconfig.json` is strict beyond defaults: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`,
`noUnusedParameters`, `verbatimModuleSyntax`.

`scripts/lint.mjs` (run via `npm run lint:frontend`) enforces, beyond TS itself:
- No `debugger`, `eval(`, `new Function(`, `@ts-ignore`/`@ts-nocheck`.
- No `Math.random()` inside `src/games/**` — use the shared seeded RNG service instead (games must
  be deterministic).
- No cross-game imports — a game under `src/games/<name>/` must not import another game's internals.
  Shared behavior belongs in `src/engine/` only when it's intentionally reusable across games.

Other invariants documented in `docs/TODO.md` §3 (read that section before touching runtime/engine
code): no per-frame Tauri IPC (real-time sim/render/input/audio stays in the webview), input must go
through `InputService` (no raw key coupling), games must not touch the filesystem directly, no
network dependency (must work fully offline), no unbounded frame catch-up or unbounded
projectile/particle/enemy growth, exactly one active game instance at a time. Architecture changes
must update both `docs/SPEC.md` and `docs/TODO.md`.

Tauri's capability surface is deliberately minimal (`src-tauri/capabilities/main.json` grants only
`core:app:default`) — adding any native capability (filesystem, shell, HTTP, dialog...) requires
updating `docs/TAURI_SECURITY.md` too.

Third-party (non-original) assets must be recorded in `assets/ATTRIBUTION.json` with license and
provenance before shipping — see `docs/ASSET_POLICY.md`; `npm run assets:check` validates this.

`npm run metadata:check` guards against name/version/identifier drift between `package.json`,
`Cargo.toml`, and `tauri.conf.json`.

## Workflow

- `docs/TODO.md` is the active plan, organized by phase (P0–P18) with stable task IDs
  (e.g. `P7-010`) and per-task acceptance criteria. Check it for the next open task before starting
  new work.
- Commit messages: use the task-ID prefix (`P<N>-<NNN>: <description>` or `P<N>: <description>`) for
  work tracked in `docs/TODO.md`; use conventional prefixes (`fix:`, `test:`, `docs:`, `chore:`) for
  incidental fixes, test-only, or docs-only changes not tied to a task ID.
- `master` is the target/default branch. Feature branches typically follow `P<N>_<GameName>`.
