import {
  GlobalSettingsRepository,
  ScoreRepository,
  cloneKeyboardMappings,
  createDefaultGlobalSettings,
  createDefaultInputSettings,
  moveMenuSelection,
  parseGlobalSettings,
  parseInputSettings,
  type AudioSettings,
  type GameMetadata,
  type GameRegistry,
  type GlobalSettings,
  type JsonDocumentStore,
  type LogicalAction,
  type PlayerNumber,
  type ScoreEntry,
  type ShellInputContext,
  type ShellNavigationCommand,
} from "../../engine/index.js";
import type { GameLaunchPhase, ShellGameHost } from "./game-host.js";
import {
  buildLauncherHighScores,
  type LauncherHighScores,
} from "./launcher-scores.js";

export type ShellScreen =
  | "launcher"
  | "pre-game"
  | "game"
  | "settings"
  | "scores";
export type ShellLaunchPhase = "idle" | GameLaunchPhase | "error";

export interface GameSelection {
  readonly gameId: string;
  readonly players: number;
  readonly difficulty: string;
}

export interface ShellState {
  readonly screen: ShellScreen;
  readonly launcherFocusIndex: number;
  readonly preGameFocusIndex: number;
  readonly pauseFocusIndex: number;
  readonly settingsFocusIndex: number;
  readonly selection: GameSelection | null;
  readonly gamePaused: boolean;
  readonly settings: GlobalSettings;
  readonly scores: readonly ScoreEntry[];
  readonly launcherHighScores: LauncherHighScores;
  readonly launchPhase: ShellLaunchPhase;
  readonly busy: boolean;
  readonly status: string | null;
  readonly warning: string | null;
  readonly error: string | null;
}

export interface FullscreenPort {
  setFullscreen(enabled: boolean): Promise<void>;
}

export interface ShellAudioSettingsPort {
  configure(settings: AudioSettings): void;
}

export interface ShellControllerOptions {
  readonly registry: GameRegistry;
  readonly documents: JsonDocumentStore;
  readonly gameHost: ShellGameHost;
  readonly fullscreen?: FullscreenPort;
  readonly audio?: ShellAudioSettingsPort;
}

export type ShellStateListener = (state: ShellState) => void;

const PRE_GAME_ITEMS = [
  "start",
  "players",
  "difficulty",
  "scores",
  "controls",
  "back",
] as const;
const PAUSE_ITEMS = [
  "resume",
  "restart",
  "controls",
  "sound",
  "launcher",
] as const;
const SETTINGS_ITEMS = [
  "master-volume",
  "music-volume",
  "effects-volume",
  "mute",
  "fullscreen",
  "reduced-effects",
  "pixel-smoothing",
  "reset-controls",
  "done",
] as const;

type ReturnScreen = "launcher" | "pre-game" | "game";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 20) / 20));
}

function launchStatus(title: string, phase: GameLaunchPhase): string {
  switch (phase) {
    case "loading":
      return `Loading ${title}…`;
    case "ready":
      return `${title} ready`;
    case "running":
      return `${title} running`;
  }
}

export class ShellController {
  private readonly settingsRepository: GlobalSettingsRepository;
  private readonly scoreRepository: ScoreRepository;
  private readonly listeners = new Set<ShellStateListener>();
  private state: ShellState = Object.freeze({
    screen: "launcher",
    launcherFocusIndex: 0,
    preGameFocusIndex: 0,
    pauseFocusIndex: 0,
    settingsFocusIndex: 0,
    selection: null,
    gamePaused: false,
    settings: createDefaultGlobalSettings(),
    scores: Object.freeze([]),
    launcherHighScores: Object.freeze({}),
    launchPhase: "idle",
    busy: false,
    status: null,
    warning: null,
    error: null,
  });
  private settingsReturnScreen: ReturnScreen = "launcher";
  private scoresReturnScreen: "launcher" | "pre-game" = "pre-game";
  private nextSeed = 1;

  public constructor(private readonly options: ShellControllerOptions) {
    const reportRecovery = (warning: { readonly message: string }): void => {
      this.patch({ warning: warning.message });
    };
    this.settingsRepository = new GlobalSettingsRepository(
      options.documents,
      reportRecovery,
    );
    this.scoreRepository = new ScoreRepository(options.documents, reportRecovery);
  }

  public get snapshot(): ShellState {
    return this.state;
  }

  public get games(): readonly GameMetadata[] {
    return this.options.registry.listMetadata();
  }

  public get selectedGame(): GameMetadata | null {
    const selection = this.state.selection;
    return selection === null
      ? null
      : (this.games.find((game) => game.id === selection.gameId) ?? null);
  }

  public get inputContext(): ShellInputContext {
    switch (this.state.screen) {
      case "launcher":
        return "launcher";
      case "pre-game":
        return "pre-game";
      case "game":
        return this.state.gamePaused ? "paused" : "running";
      case "settings":
      case "scores":
        return "settings";
    }
  }

  public subscribe(listener: ShellStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async initialize(): Promise<void> {
    try {
      const settings = await this.settingsRepository.load();
      this.options.audio?.configure(settings.audio);
      this.patch({ settings });
      if (settings.fullscreen && this.options.fullscreen !== undefined) {
        try {
          await this.options.fullscreen.setFullscreen(true);
        } catch (error) {
          this.patch({
            warning: `Fullscreen preference could not be applied: ${describeError(error)}`,
          });
        }
      }
    } catch (error) {
      this.patch({
        error: `Settings could not be initialized: ${describeError(error)}`,
      });
    }

    await this.refreshLauncherHighScores();
  }

  public async refreshLauncherHighScores(): Promise<void> {
    try {
      const document = await this.scoreRepository.load();
      this.patch({
        launcherHighScores: buildLauncherHighScores(this.games, document.entries),
      });
    } catch (error) {
      this.patch({
        launcherHighScores: buildLauncherHighScores(this.games, []),
        warning: `Launcher high scores could not be loaded: ${describeError(error)}`,
      });
    }
  }

  public chooseGame(gameId: string): void {
    const game = this.games.find((candidate) => candidate.id === gameId);
    if (game === undefined) {
      this.patch({ error: `Unknown game: ${gameId}` });
      return;
    }
    const players = game.players[0];
    if (players === undefined) {
      this.patch({ error: `${game.title} has no valid player count` });
      return;
    }
    this.patch({
      screen: "pre-game",
      preGameFocusIndex: 0,
      selection: Object.freeze({
        gameId: game.id,
        players,
        difficulty: game.defaultDifficulty,
      }),
      scores: Object.freeze([]),
      launchPhase: "idle",
      status: null,
      error: null,
    });
  }

  public setPlayers(players: number): void {
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (game === null || selection === null || !game.players.includes(players)) {
      return;
    }
    this.patch({ selection: Object.freeze({ ...selection, players }) });
  }

  public setDifficulty(difficulty: string): void {
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (
      game === null ||
      selection === null ||
      !game.difficulties.some((entry) => entry.id === difficulty)
    ) {
      return;
    }
    this.patch({ selection: Object.freeze({ ...selection, difficulty }) });
  }

  public async launchSelected(): Promise<void> {
    if (this.state.busy) {
      return;
    }
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (game === null || selection === null) {
      this.patch({ error: "Select a game before starting" });
      return;
    }

    this.patch({
      busy: true,
      launchPhase: "loading",
      error: null,
      status: launchStatus(game.title, "loading"),
    });
    try {
      await this.options.gameHost.launch(
        this.options.registry.getModule(game.id),
        {
          players: selection.players,
          difficulty: selection.difficulty,
          seed: this.nextSeed++,
        },
        (phase) => {
          this.patch({
            launchPhase: phase,
            status: launchStatus(game.title, phase),
          });
        },
      );
      this.patch({
        screen: "game",
        gamePaused: false,
        pauseFocusIndex: 0,
        launchPhase: "running",
        busy: false,
        status: launchStatus(game.title, "running"),
      });
    } catch (error) {
      this.options.gameHost.exit();
      this.patch({
        busy: false,
        launchPhase: "error",
        status: null,
        error: `Could not launch ${game.title}: ${describeError(error)}`,
      });
    }
  }

  public pauseGame(): void {
    if (this.state.screen !== "game" || this.state.gamePaused) {
      return;
    }
    try {
      this.options.gameHost.pause();
      this.patch({ gamePaused: true, pauseFocusIndex: 0, status: "Game paused" });
    } catch (error) {
      this.patch({ error: `Could not pause game: ${describeError(error)}` });
    }
  }

  public resumeGame(): void {
    if (this.state.screen !== "game" || !this.state.gamePaused) {
      return;
    }
    try {
      this.options.gameHost.resume();
      this.patch({ gamePaused: false, status: "Game resumed" });
    } catch (error) {
      this.patch({ error: `Could not resume game: ${describeError(error)}` });
    }
  }

  public async restartGame(): Promise<void> {
    if (this.state.screen !== "game" || this.state.busy) {
      return;
    }
    this.patch({ busy: true, error: null, status: "Restarting game…" });
    try {
      await this.options.gameHost.restart();
      this.patch({
        busy: false,
        gamePaused: false,
        pauseFocusIndex: 0,
        launchPhase: "running",
        status: "Game restarted",
      });
    } catch (error) {
      this.patch({
        busy: false,
        error: `Could not restart game: ${describeError(error)}`,
      });
    }
  }

  public returnToLauncher(): void {
    this.options.gameHost.exit();
    this.patch({
      screen: "launcher",
      gamePaused: false,
      selection: null,
      scores: Object.freeze([]),
      launchPhase: "idle",
      busy: false,
      status: "Returned to launcher",
      error: null,
    });
    void this.refreshLauncherHighScores();
  }

  public openSettings(returnScreen: ReturnScreen = this.defaultReturnScreen()): void {
    this.settingsReturnScreen = returnScreen;
    this.patch({ screen: "settings", settingsFocusIndex: 0, error: null });
  }

  public closeSettings(): void {
    this.patch({ screen: this.settingsReturnScreen });
  }

  public async openScores(
    returnScreen: "launcher" | "pre-game" = "pre-game",
  ): Promise<void> {
    this.scoresReturnScreen = returnScreen;
    this.patch({ screen: "scores", scores: Object.freeze([]), busy: true, error: null });
    await this.refreshScores();
  }

  public closeScores(): void {
    this.patch({ screen: this.scoresReturnScreen });
  }

  public async refreshScores(): Promise<void> {
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (game === null) {
      this.patch({ scores: Object.freeze([]), busy: false });
      return;
    }
    try {
      const difficulty = selection?.difficulty ?? game.defaultDifficulty;
      const scores = await this.scoreRepository.queryScores(
        game.id,
        "default",
        difficulty,
        10,
      );
      this.patch({ scores, busy: false });
    } catch (error) {
      this.patch({
        scores: Object.freeze([]),
        busy: false,
        error: `High scores could not be loaded: ${describeError(error)}`,
      });
    }
  }

  public async setVolume(
    key: "masterVolume" | "musicVolume" | "effectsVolume",
    value: number,
  ): Promise<void> {
    await this.saveSettings({
      ...this.state.settings,
      audio: { ...this.state.settings.audio, [key]: clamp01(value) },
    });
  }

  public async setMuted(muted: boolean): Promise<void> {
    await this.saveSettings({
      ...this.state.settings,
      audio: { ...this.state.settings.audio, muted },
    });
  }

  public async setVisual(
    key: "reducedEffects" | "pixelSmoothing",
    value: boolean,
  ): Promise<void> {
    await this.saveSettings({
      ...this.state.settings,
      visual: { ...this.state.settings.visual, [key]: value },
    });
  }

  public async setFullscreen(enabled: boolean): Promise<void> {
    await this.saveSettings({ ...this.state.settings, fullscreen: enabled });
    if (this.options.fullscreen === undefined) {
      return;
    }
    try {
      await this.options.fullscreen.setFullscreen(enabled);
    } catch (error) {
      this.patch({
        warning: `Fullscreen change could not be applied: ${describeError(error)}`,
      });
    }
  }

  public async remapKeyboard(
    player: PlayerNumber,
    action: LogicalAction,
    code: string,
  ): Promise<boolean> {
    try {
      const keyboard = cloneKeyboardMappings(this.state.settings.input.keyboard);
      keyboard[player][action] = [code];
      const input = parseInputSettings({ version: 1, keyboard });
      await this.saveSettings({ ...this.state.settings, input });
      this.patch({ status: `${action} mapped to ${code}`, error: null });
      return true;
    } catch (error) {
      this.patch({ error: `Control mapping was not changed: ${describeError(error)}` });
      return false;
    }
  }

  public async resetControls(): Promise<void> {
    await this.saveSettings({
      ...this.state.settings,
      input: createDefaultInputSettings(),
    });
    this.patch({ status: "Controls reset to defaults" });
  }

  public dismissMessages(): void {
    this.patch({ status: null, warning: null, error: null });
  }

  public async handleCommand(command: ShellNavigationCommand): Promise<void> {
    if (this.state.busy) {
      return;
    }
    switch (this.state.screen) {
      case "launcher":
        await this.handleLauncherCommand(command);
        return;
      case "pre-game":
        await this.handlePreGameCommand(command);
        return;
      case "game":
        await this.handleGameCommand(command);
        return;
      case "settings":
        await this.handleSettingsCommand(command);
        return;
      case "scores":
        if (command === "back" || command === "activate") {
          this.closeScores();
        }
    }
  }

  private async handleLauncherCommand(command: ShellNavigationCommand): Promise<void> {
    const itemCount = this.games.length + 1;
    if (["up", "down", "left", "right"].includes(command)) {
      this.patch({
        launcherFocusIndex: moveMenuSelection(
          this.state.launcherFocusIndex,
          itemCount,
          command,
        ),
      });
      return;
    }
    if (command !== "activate") {
      return;
    }
    if (this.state.launcherFocusIndex < this.games.length) {
      const game = this.games[this.state.launcherFocusIndex];
      if (game !== undefined) {
        this.chooseGame(game.id);
      }
    } else {
      this.openSettings("launcher");
    }
  }

  private async handlePreGameCommand(command: ShellNavigationCommand): Promise<void> {
    if (command === "back") {
      this.returnToLauncher();
      return;
    }
    if (command === "up" || command === "down") {
      this.patch({
        preGameFocusIndex: moveMenuSelection(
          this.state.preGameFocusIndex,
          PRE_GAME_ITEMS.length,
          command,
        ),
      });
      return;
    }
    const item = PRE_GAME_ITEMS[this.state.preGameFocusIndex];
    if ((command === "left" || command === "right") && item === "players") {
      this.cyclePlayers(command === "right" ? 1 : -1);
      return;
    }
    if ((command === "left" || command === "right") && item === "difficulty") {
      this.cycleDifficulty(command === "right" ? 1 : -1);
      return;
    }
    if (command !== "activate") {
      return;
    }
    switch (item) {
      case "start":
        await this.launchSelected();
        break;
      case "players":
        this.cyclePlayers(1);
        break;
      case "difficulty":
        this.cycleDifficulty(1);
        break;
      case "scores":
        await this.openScores("pre-game");
        break;
      case "controls":
        this.openSettings("pre-game");
        break;
      case "back":
        this.returnToLauncher();
        break;
    }
  }

  private async handleGameCommand(command: ShellNavigationCommand): Promise<void> {
    if (!this.state.gamePaused) {
      if (command === "pause") {
        this.pauseGame();
      }
      return;
    }
    if (command === "back") {
      this.resumeGame();
      return;
    }
    if (command === "up" || command === "down") {
      this.patch({
        pauseFocusIndex: moveMenuSelection(
          this.state.pauseFocusIndex,
          PAUSE_ITEMS.length,
          command,
        ),
      });
      return;
    }
    if (command !== "activate") {
      return;
    }
    switch (PAUSE_ITEMS[this.state.pauseFocusIndex]) {
      case "resume":
        this.resumeGame();
        break;
      case "restart":
        await this.restartGame();
        break;
      case "controls":
      case "sound":
        this.openSettings("game");
        break;
      case "launcher":
        this.returnToLauncher();
        break;
    }
  }

  private async handleSettingsCommand(command: ShellNavigationCommand): Promise<void> {
    if (command === "back") {
      this.closeSettings();
      return;
    }
    if (command === "up" || command === "down") {
      this.patch({
        settingsFocusIndex: moveMenuSelection(
          this.state.settingsFocusIndex,
          SETTINGS_ITEMS.length,
          command,
        ),
      });
      return;
    }
    const item = SETTINGS_ITEMS[this.state.settingsFocusIndex];
    if (command === "left" || command === "right") {
      const delta = command === "right" ? 0.05 : -0.05;
      switch (item) {
        case "master-volume":
          await this.setVolume("masterVolume", this.state.settings.audio.masterVolume + delta);
          break;
        case "music-volume":
          await this.setVolume("musicVolume", this.state.settings.audio.musicVolume + delta);
          break;
        case "effects-volume":
          await this.setVolume("effectsVolume", this.state.settings.audio.effectsVolume + delta);
          break;
      }
      return;
    }
    if (command !== "activate") {
      return;
    }
    switch (item) {
      case "mute":
        await this.setMuted(!this.state.settings.audio.muted);
        break;
      case "fullscreen":
        await this.setFullscreen(!this.state.settings.fullscreen);
        break;
      case "reduced-effects":
        await this.setVisual("reducedEffects", !this.state.settings.visual.reducedEffects);
        break;
      case "pixel-smoothing":
        await this.setVisual("pixelSmoothing", !this.state.settings.visual.pixelSmoothing);
        break;
      case "reset-controls":
        await this.resetControls();
        break;
      case "done":
        this.closeSettings();
        break;
    }
  }

  private cyclePlayers(direction: 1 | -1): void {
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (game === null || selection === null) {
      return;
    }
    const index = game.players.indexOf(selection.players);
    const next = game.players[(index + direction + game.players.length) % game.players.length];
    if (next !== undefined) {
      this.setPlayers(next);
    }
  }

  private cycleDifficulty(direction: 1 | -1): void {
    const game = this.selectedGame;
    const selection = this.state.selection;
    if (game === null || selection === null) {
      return;
    }
    const index = game.difficulties.findIndex(
      (difficulty) => difficulty.id === selection.difficulty,
    );
    const next =
      game.difficulties[
        (index + direction + game.difficulties.length) % game.difficulties.length
      ];
    if (next !== undefined) {
      this.setDifficulty(next.id);
    }
  }

  private async saveSettings(value: GlobalSettings): Promise<void> {
    try {
      const settings = parseGlobalSettings(value);
      await this.settingsRepository.save(settings);
      this.options.audio?.configure(settings.audio);
      this.patch({ settings, error: null });
    } catch (error) {
      this.patch({ error: `Settings were not saved: ${describeError(error)}` });
    }
  }

  private defaultReturnScreen(): ReturnScreen {
    if (this.state.screen === "game") {
      return "game";
    }
    if (this.state.screen === "pre-game") {
      return "pre-game";
    }
    return "launcher";
  }

  private patch(patch: Partial<ShellState>): void {
    this.state = Object.freeze({ ...this.state, ...patch });
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const PRE_GAME_MENU_ITEMS = PRE_GAME_ITEMS;
export const PAUSE_MENU_ITEMS = PAUSE_ITEMS;
export const SETTINGS_MENU_ITEMS = SETTINGS_ITEMS;
