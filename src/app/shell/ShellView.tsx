import { useEffect, useState } from "react";

import {
  LOGICAL_ACTIONS,
  type PlayerNumber,
} from "../../engine/index.js";
import {
  PAUSE_MENU_ITEMS,
  PRE_GAME_MENU_ITEMS,
  SETTINGS_MENU_ITEMS,
  type ShellController,
  type ShellState,
} from "./controller.js";

export interface ShellViewProps {
  readonly controller: ShellController;
  readonly state: ShellState;
}

interface CaptureTarget {
  readonly player: PlayerNumber;
  readonly action: (typeof LOGICAL_ACTIONS)[number];
}

function focused(index: number, expected: number): string | undefined {
  return index === expected ? "true" : undefined;
}

function LauncherView({ controller, state }: ShellViewProps) {
  const games = controller.games;

  return (
    <section className="shell-panel launcher" aria-labelledby="launcher-title">
      <header className="shell-hero">
        <p className="shell-eyebrow">VC Classic Video Games</p>
        <h1 id="launcher-title">Retro Arcade</h1>
        <p>
          Pick a game with the keyboard or a controller. Shared pause, controls,
          sound, scores, and settings stay consistent across the collection.
        </p>
      </header>

      {games.length === 0 ? (
        <div className="empty-library" role="status">
          <div className="empty-library__screen" aria-hidden="true">
            <span>VC</span>
          </div>
          <div>
            <h2>Game cabinet ready</h2>
            <p>
              The shared launcher is complete. Space Rocks will become the first
              registered playable module in P7.
            </p>
          </div>
        </div>
      ) : (
        <div className="game-grid" aria-label="Available games">
          {games.map((game, index) => (
            <button
              className="game-card"
              data-shell-focus={focused(state.launcherFocusIndex, index)}
              key={game.id}
              type="button"
              onClick={() => controller.chooseGame(game.id)}
            >
              <span className="game-card__art" aria-hidden="true">
                {game.title.slice(0, 2).toUpperCase()}
              </span>
              <span className="game-card__body">
                <strong>{game.title}</strong>
                <span>{game.description}</span>
                <span className="game-card__meta">
                  {game.players.join("/")} player
                  {game.players.some((count) => count > 1) ? " options" : ""} ·{" "}
                  {game.supportedInputs.join(" · ")}
                </span>
                <span className="game-card__score">High scores available</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <nav className="launcher-actions" aria-label="Launcher actions">
        <button
          data-shell-focus={focused(state.launcherFocusIndex, games.length)}
          type="button"
          onClick={() => controller.openSettings("launcher")}
        >
          Settings & controls
        </button>
      </nav>
      <p className="control-hint">
        Arrows/WASD or D-pad/stick: move · Enter/Space or primary button: select
      </p>
    </section>
  );
}

function PreGameView({ controller, state }: ShellViewProps) {
  const game = controller.selectedGame;
  const selection = state.selection;
  if (game === null || selection === null) {
    return (
      <section className="shell-panel" role="alert">
        <h1>Game selection unavailable</h1>
        <button type="button" onClick={() => controller.returnToLauncher()}>
          Return to launcher
        </button>
      </section>
    );
  }

  return (
    <section className="shell-panel pre-game" aria-labelledby="pre-game-title">
      <header>
        <p className="shell-eyebrow">Ready player</p>
        <h1 id="pre-game-title">{game.title}</h1>
        <p>{game.description}</p>
      </header>

      <div className="pre-game-grid">
        <div className="pre-game-options" aria-label="Game options">
          <button
            className="primary-action"
            data-shell-focus={focused(state.preGameFocusIndex, 0)}
            type="button"
            disabled={state.busy}
            onClick={() => void controller.launchSelected()}
          >
            {state.busy ? "Loading…" : "Start game"}
          </button>

          <label data-shell-focus={focused(state.preGameFocusIndex, 1)}>
            Players
            <select
              value={selection.players}
              onChange={(event) => controller.setPlayers(Number(event.target.value))}
            >
              {game.players.map((players) => (
                <option key={players} value={players}>
                  {players}
                </option>
              ))}
            </select>
          </label>

          <label data-shell-focus={focused(state.preGameFocusIndex, 2)}>
            Difficulty
            <select
              value={selection.difficulty}
              onChange={(event) => controller.setDifficulty(event.target.value)}
            >
              {game.difficulties.map((difficulty) => (
                <option key={difficulty.id} value={difficulty.id}>
                  {difficulty.label}
                </option>
              ))}
            </select>
          </label>

          <button
            data-shell-focus={focused(state.preGameFocusIndex, 3)}
            type="button"
            onClick={() => void controller.openScores("pre-game")}
          >
            High scores
          </button>
          <button
            data-shell-focus={focused(state.preGameFocusIndex, 4)}
            type="button"
            onClick={() => controller.openSettings("pre-game")}
          >
            Controls & settings
          </button>
          <button
            data-shell-focus={focused(state.preGameFocusIndex, 5)}
            type="button"
            onClick={() => controller.returnToLauncher()}
          >
            Back to launcher
          </button>
        </div>

        <aside className="controls-card" aria-labelledby="controls-title">
          <h2 id="controls-title">Controls</h2>
          {game.controls.length === 0 ? (
            <p>Shared movement and action controls apply.</p>
          ) : (
            <dl>
              {game.controls.map((control) => (
                <div key={`${control.action}:${control.label}`}>
                  <dt>{control.label}</dt>
                  <dd>{control.description ?? control.action}</dd>
                </div>
              ))}
            </dl>
          )}
          <p>
            Logical resolution: {game.logicalWidth}×{game.logicalHeight}
          </p>
        </aside>
      </div>
      <p className="control-hint">
        Up/down: choose option · Left/right: change players/difficulty · Back:
        launcher
      </p>
    </section>
  );
}

function GameView({ controller, state }: ShellViewProps) {
  const game = controller.selectedGame;
  return (
    <section className="game-screen" aria-label={game?.title ?? "Game"}>
      <canvas
        className="game-viewport"
        width={320}
        height={240}
        aria-label={`${game?.title ?? "Game"} display`}
      />
      <div className="game-screen__hud">
        <strong>{game?.title ?? "Game"}</strong>
        <span>Pause: Escape/Start</span>
      </div>

      {state.gamePaused ? (
        <div className="pause-backdrop">
          <section className="pause-menu" aria-labelledby="pause-title">
            <p className="shell-eyebrow">Paused</p>
            <h1 id="pause-title">Game paused</h1>
            <div className="menu-stack">
              {PAUSE_MENU_ITEMS.map((item, index) => {
                const label =
                  item === "resume"
                    ? "Resume"
                    : item === "restart"
                      ? "Restart"
                      : item === "controls"
                        ? "Controls"
                        : item === "sound"
                          ? "Sound"
                          : "Return to launcher";
                return (
                  <button
                    data-shell-focus={focused(state.pauseFocusIndex, index)}
                    key={item}
                    type="button"
                    onClick={() => {
                      if (item === "resume") controller.resumeGame();
                      else if (item === "restart") void controller.restartGame();
                      else if (item === "launcher") controller.returnToLauncher();
                      else controller.openSettings("game");
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ScoresView({ controller, state }: ShellViewProps) {
  const game = controller.selectedGame;
  const difficulty =
    game?.difficulties.find((entry) => entry.id === state.selection?.difficulty)
      ?.label ?? state.selection?.difficulty;

  return (
    <section className="shell-panel scores-view" aria-labelledby="scores-title">
      <header>
        <p className="shell-eyebrow">Leaderboard</p>
        <h1 id="scores-title">{game?.title ?? "Game"} high scores</h1>
        <p>{difficulty === undefined ? "Default" : difficulty} · Default mode</p>
      </header>

      {state.busy ? (
        <p role="status">Loading scores…</p>
      ) : state.scores.length === 0 ? (
        <p className="empty-scores">No scores yet. Be the first on the board.</p>
      ) : (
        <ol className="score-list">
          {state.scores.map((score) => (
            <li key={`${score.timestamp}:${score.sequence}`}>
              <span>{score.initials ?? "---"}</span>
              <strong>{score.score.toLocaleString()}</strong>
              <time dateTime={score.timestamp}>
                {new Date(score.timestamp).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => controller.closeScores()}>
        Back
      </button>
    </section>
  );
}

function SettingsView({ controller, state }: ShellViewProps) {
  const [capture, setCapture] = useState<CaptureTarget | null>(null);

  useEffect(() => {
    if (state.screen !== "settings") {
      setCapture(null);
    }
  }, [state.screen]);

  return (
    <section
      className="shell-panel settings-view"
      aria-labelledby="settings-title"
      onKeyDown={(event) => {
        if (capture === null) return;
        event.preventDefault();
        event.stopPropagation();
        const target = capture;
        void controller
          .remapKeyboard(target.player, target.action, event.code)
          .then((changed) => {
            if (changed) setCapture(null);
          });
      }}
    >
      <header>
        <p className="shell-eyebrow">System</p>
        <h1 id="settings-title">Settings & controls</h1>
        <p>Changes are saved immediately.</p>
      </header>

      <div className="settings-grid">
        <fieldset>
          <legend>Sound</legend>
          {(
            [
              ["Master", "masterVolume", 0],
              ["Music", "musicVolume", 1],
              ["Effects", "effectsVolume", 2],
            ] as const
          ).map(([label, key, focusIndex]) => (
            <label key={key} data-shell-focus={focused(state.settingsFocusIndex, focusIndex)}>
              {label}: {Math.round(state.settings.audio[key] * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.settings.audio[key]}
                onChange={(event) =>
                  void controller.setVolume(key, Number(event.target.value))
                }
              />
            </label>
          ))}
          <label data-shell-focus={focused(state.settingsFocusIndex, 3)}>
            <input
              type="checkbox"
              checked={state.settings.audio.muted}
              onChange={(event) => void controller.setMuted(event.target.checked)}
            />
            Mute all audio
          </label>
        </fieldset>

        <fieldset>
          <legend>Display</legend>
          <label data-shell-focus={focused(state.settingsFocusIndex, 4)}>
            <input
              type="checkbox"
              checked={state.settings.fullscreen}
              onChange={(event) => void controller.setFullscreen(event.target.checked)}
            />
            Start/use fullscreen
          </label>
          <label data-shell-focus={focused(state.settingsFocusIndex, 5)}>
            <input
              type="checkbox"
              checked={state.settings.visual.reducedEffects}
              onChange={(event) =>
                void controller.setVisual("reducedEffects", event.target.checked)
              }
            />
            Reduce flashes/effects
          </label>
          <label data-shell-focus={focused(state.settingsFocusIndex, 6)}>
            <input
              type="checkbox"
              checked={state.settings.visual.pixelSmoothing}
              onChange={(event) =>
                void controller.setVisual("pixelSmoothing", event.target.checked)
              }
            />
            Smooth pixel scaling
          </label>
        </fieldset>

        <fieldset className="controls-settings">
          <legend>Keyboard controls</legend>
          <p>
            Select a binding, then press the replacement key. Conflicting
            mappings are rejected.
          </p>
          {[1, 2].map((playerValue) => {
            const player = playerValue as PlayerNumber;
            return (
              <div className="player-bindings" key={player}>
                <h2>Player {player}</h2>
                {LOGICAL_ACTIONS.map((action) => (
                  <button
                    className="binding-button"
                    key={`${player}:${action}`}
                    type="button"
                    aria-pressed={
                      capture?.player === player && capture.action === action
                    }
                    onClick={() => setCapture({ player, action })}
                  >
                    <span>{action}</span>
                    <strong>
                      {capture?.player === player && capture.action === action
                        ? "Press a key…"
                        : state.settings.input.keyboard[player][action].join(" / ") ||
                          "Unbound"}
                    </strong>
                  </button>
                ))}
              </div>
            );
          })}
          <button
            data-shell-focus={focused(state.settingsFocusIndex, 7)}
            type="button"
            onClick={() => void controller.resetControls()}
          >
            Reset controls to defaults
          </button>
        </fieldset>

        <fieldset>
          <legend>Gamepads</legend>
          <p>
            Standard USB/Bluetooth gamepads auto-assign to players in connection
            order. D-pad and left stick both navigate; disconnects are recoverable.
          </p>
        </fieldset>
      </div>

      <button
        className="primary-action"
        data-shell-focus={focused(state.settingsFocusIndex, 8)}
        type="button"
        onClick={() => controller.closeSettings()}
      >
        Done
      </button>
      <p className="control-hint">
        Up/down: setting · Left/right: volume · Primary button: toggle · Back:
        done
      </p>
    </section>
  );
}

export function ShellView(props: ShellViewProps) {
  const { controller, state } = props;

  return (
    <>
      <div className="shell-messages" aria-live="polite" aria-atomic="true">
        {state.status === null ? null : (
          <p className="message message--status" role="status">
            {state.status}
          </p>
        )}
        {state.warning === null ? null : (
          <p className="message message--warning" role="alert">
            Warning: {state.warning}
          </p>
        )}
        {state.error === null ? null : (
          <p className="message message--error" role="alert">
            Error: {state.error}
          </p>
        )}
      </div>

      {state.screen === "launcher" ? <LauncherView {...props} /> : null}
      {state.screen === "pre-game" ? <PreGameView {...props} /> : null}
      {state.screen === "game" ? <GameView {...props} /> : null}
      {state.screen === "settings" ? <SettingsView {...props} /> : null}
      {state.screen === "scores" ? <ScoresView {...props} /> : null}

      {(state.status ?? state.warning ?? state.error) === null ? null : (
        <button
          className="dismiss-message"
          type="button"
          onClick={() => controller.dismissMessages()}
        >
          Dismiss message
        </button>
      )}
    </>
  );
}

export const SHELL_MENU_COUNTS = Object.freeze({
  preGame: PRE_GAME_MENU_ITEMS.length,
  pause: PAUSE_MENU_ITEMS.length,
  settings: SETTINGS_MENU_ITEMS.length,
});
