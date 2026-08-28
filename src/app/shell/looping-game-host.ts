import {
  GameLoopDriver,
  type FrameScheduler,
  type GameModule,
  type GameRenderer,
  type GameStartOptions,
} from "../../engine/index.js";
import {
  LifecycleGameHost,
  type GameHostErrorReporter,
  type GameLaunchPhaseReporter,
  type GameRunTimingPort,
  type GameServicesFactory,
  type ShellGameHost,
} from "./game-host.js";

/**
 * Couples the shell lifecycle host to exactly one P3 fixed-step/RAF driver.
 * The renderer is attached by the React canvas surface and may come and go
 * without reconstructing the game instance or Tauri window.
 */
export class LoopingGameHost implements ShellGameHost, GameRunTimingPort {
  private readonly lifecycle: LifecycleGameHost;
  private readonly driver: GameLoopDriver;
  private renderer: GameRenderer | null = null;

  public constructor(
    createServices: GameServicesFactory,
    reportError: GameHostErrorReporter = () => undefined,
    scheduler?: FrameScheduler,
  ) {
    this.lifecycle = new LifecycleGameHost(createServices, reportError, this);
    this.driver = new GameLoopDriver(
      {
        update: (dtSeconds) => this.lifecycle.update(dtSeconds),
        render: () => {
          if (this.renderer !== null) {
            this.lifecycle.render(this.renderer);
          }
        },
      },
      scheduler === undefined ? {} : { scheduler },
    );
  }

  public setRenderer(renderer: GameRenderer | null): void {
    this.renderer = renderer;
  }

  public async launch(
    module: GameModule,
    options: GameStartOptions,
    reportPhase?: GameLaunchPhaseReporter,
  ): Promise<void> {
    this.driver.stop();
    await this.lifecycle.launch(module, options, reportPhase);
    this.driver.start();
  }

  public pause(): void {
    this.lifecycle.pause();
    this.driver.pauseSimulation();
  }

  public resume(): void {
    this.lifecycle.resume();
    this.driver.resumeSimulation();
  }

  public restart(): Promise<void> {
    return this.lifecycle.restart();
  }

  public exit(): void {
    this.driver.stop();
    this.lifecycle.exit();
    this.renderer = null;
  }

  public resetForNewRun(): void {
    this.driver.resetForNewRun();
  }

  public get activeGameId(): string | null {
    return this.lifecycle.activeGameId;
  }

  public get loopRunning(): boolean {
    return this.driver.isRunning();
  }

  public get simulationPaused(): boolean {
    return this.driver.isSimulationPaused();
  }
}
