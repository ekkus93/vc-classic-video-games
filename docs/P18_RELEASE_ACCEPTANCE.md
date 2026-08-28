# P18 Release 1 acceptance ledger

This document is the release-level evidence ledger for **P18-001 — complete all ten per-game release/playable acceptance checklists**.

P18-001 is not satisfied by automated tests alone. `docs/SPEC.md` requires manual release-candidate testing on a converted Chromebook with keyboard input, a common USB gamepad, gamepad hot-plug, fullscreen, repeated game switching, audio enabled/disabled, and other native-app observations. The per-game checklists also contain visual, audible, game-feel, and target-hardware criteria that cannot be inferred from headless tests.

## Candidate baseline

- Application candidate commit: `30462d85e94e2a275d66df0f15c770b564b1aa6e`
- CI run: `33220593106`
- CI result: **PASS**
- Automated evidence date: 2026-08-28

The candidate passed the repository's complete CI workflow:

- frontend formatting;
- frontend lint and game-boundary checks;
- project metadata consistency;
- asset and attribution validation;
- strict TypeScript typecheck;
- complete frontend tests for all ten games and shared runtime;
- production frontend build;
- Rust formatting;
- Clippy with warnings denied;
- Rust tests;
- native Tauri compile;
- bundled frontend smoke test under the release CSP;
- `tauri dev` smoke test under Xvfb.

This establishes the automated preflight for all ten game checklists. It does **not** substitute for the human-observable rows in those checklists.

## Per-game status

| Game | Checklist | Automated preflight | Human native-app pass | Release status |
| --- | --- | --- | --- | --- |
| P7 Space Rocks | `docs/P7_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P8 Missile Defense | `docs/P8_MISSILE_DEFENSE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P9 River Hopper | `docs/P9_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P10 Maze Chase | `docs/P10_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P11 Bug Barrage | `docs/P11_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P12 Sky Riders | `docs/P12_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P13 Jungle Quest | `docs/P13_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P14 Deep Digger | `docs/P14_PLAYABLE_ACCEPTANCE.md` | PASS | Pending | In progress |
| P15 Star Defender | `docs/P15_PLAYABLE_ACCEPTANCE.md` | PASS | Pending; target-hardware performance required | In progress |
| P16 Barrel Climber | `docs/P16_PLAYABLE_ACCEPTANCE.md` | PASS | Pending; Chromebook-class dense-level observation required | In progress |

## Human acceptance environment

Use one exact application candidate for the entire pass unless a defect is found and fixed. If any application code changes, select a new candidate commit, require green CI on that exact commit, and restart affected acceptance evidence.

Record at minimum:

- candidate commit;
- CI run;
- test date;
- tester;
- Chromebook model/CPU/GPU/RAM/display;
- Debian or Ubuntu version and desktop environment;
- keyboard layout;
- USB gamepad make/model;
- Bluetooth gamepad make/model if used;
- windowed/fullscreen observations;
- audio device used;
- failures, fixes, and retest evidence.

A standard gamepad is required for the final release pass. A checklist may temporarily record `not available in this run`, but P18-001 cannot be closed until the required gamepad paths have been exercised for the release candidate.

## Recommended execution order

Run the ten game checklists in launcher order or P-number order. To reduce duplicated setup work, use this sequence:

1. Perform each game's keyboard-only route and core gameplay observations.
2. Perform each game's gamepad-only route using the same standard USB gamepad.
3. Exercise P12 two-player play with keyboard and two standard gamepads.
4. Exercise audio, mute/unmute, pause/resume, restart, and return-to-launcher checks while each game is already active.
5. Perform each game's repeated lifecycle cycles without restarting the Tauri application.
6. Perform P15 maximum-density performance observation and P16 dense later-level observation on the selected reference Chromebook.
7. Record results directly in each per-game checklist and update the table above.

Do not merge P18-001 with the separate cross-game soak, hot-plug, suspend/resume, corrupted-persistence, or offline release tasks. Those remain P18-006 through P18-010, although observations made during P18-001 may be reused as evidence when they exactly satisfy those later criteria.

## Release blocker rule

Any unchecked required human-observable row in a per-game checklist keeps P18-001 open. Any failure discovered during the pass is a release blocker until fixed, revalidated by CI, and retested on the affected native-app path.

## Current result

**P18-001: IN PROGRESS.**

Automated preflight is complete and green for all ten games. The remaining work is the physical/native human acceptance pass required by the specification and the game-specific checklists.
