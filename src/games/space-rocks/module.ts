import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
  Vector2,
} from "../../engine/index.js";
import {
  SPACE_ROCKS_DIFFICULTIES,
  SPACE_ROCKS_RUN_RULES,
  type SpaceRocksDifficultyId,
} from "./design.js";
import { SpaceRocksEffects } from "./effects.js";
import { SPACE_ROCKS_METADATA } from "./metadata.js";
import {
  spaceRocksRockRadius,
  type SpaceRocksRock,
} from "./rocks.js";
import { SpaceRocksScoreCommitter } from "./score-submission.js";
import { SpaceRocksSimulation } from "./simulation.js";

const STAR_FIELD = Object.freeze(
  Array.from({ length: 42 }, (_, index) =>
    Object.freeze({
      x: (17 + index * 73 + index * index * 3) % SPACE_ROCKS_RUN_RULES.logicalWidth,
      y: (11 + index * 47 + index * index * 5) % SPACE_ROCKS_RUN_RULES.logicalHeight,
      radius: index % 9 === 0 ? 1.25 : index % 4 === 0 ? 0.8 : 0.5,
      color: index % 5 === 0 ? "#8dd8ff" : "#7186a8",
    }),
  ),
);

function resolveDifficulty(value: string): SpaceRocksDifficultyId {
  if (!Object.hasOwn(SPACE_ROCKS_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Space Rocks difficulty: ${value}`);
  }
  return value as SpaceRocksDifficultyId;
}

function rockColor(size: SpaceRocksRock["size"]): string {
  switch (size) {
    case "large":
      return "#655b78";
    case "medium":
      return "#76667d";
    case "small":
      return "#89717e";
  }
}

function rockPolygon(rock: SpaceRocksRock): readonly Vector2[] {
  const radius = spaceRocksRockRadius(rock.size);
  const vertexCount = 6 + (rock.shapeSeed % 3);
  let state = rock.shapeSeed >>> 0;
  const points: Vector2[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const variation = 0.72 + (state / 0x1_0000_0000) * 0.28;
    const angle = (Math.PI * 2 * index) / vertexCount;
    points.push(
      Object.freeze({
        x: Math.cos(angle) * radius * variation,
        y: Math.sin(angle) * radius * variation,
      }),
    );
  }
  return Object.freeze(points);
}

function renderRock(renderer: GameRenderer, rock: SpaceRocksRock): void {
  renderer.save();
  renderer.translate(rock.position.x, rock.position.y);
  renderer.rotate(rock.rotationRadians);
  renderer.fillPolygon(rockPolygon(rock), rockColor(rock.size));
  const radius = spaceRocksRockRadius(rock.size);
  renderer.drawLine(-radius * 0.42, 0, radius * 0.18, radius * 0.28, "#d89b52", 1);
  renderer.drawLine(radius * 0.18, radius * 0.28, radius * 0.48, -radius * 0.1, "#d89b52", 1);
  renderer.fillCircle(radius * 0.12, -radius * 0.12, Math.max(1, radius * 0.12), "#f2c56d");
  renderer.restore();
}

function renderShip(
  renderer: GameRenderer,
  position: Vector2,
  facingRadians: number,
  thrusting: boolean,
): void {
  renderer.save();
  renderer.translate(position.x, position.y);
  renderer.rotate(facingRadians);
  if (thrusting) {
    renderer.fillPolygon(
      [
        { x: -3, y: 5 },
        { x: 0, y: 12 },
        { x: 3, y: 5 },
        { x: 0, y: 7 },
      ],
      "#f6a84a",
    );
  }
  renderer.fillPolygon(
    [
      { x: 0, y: -10 },
      { x: 7, y: 5 },
      { x: 2, y: 3 },
      { x: 0, y: 7 },
      { x: -2, y: 3 },
      { x: -7, y: 5 },
    ],
    "#55cfe8",
  );
  renderer.fillCircle(0, -2, 2.25, "#ffd76a");
  renderer.restore();
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/thrust.wav":
      return new URL("./audio/thrust.wav", import.meta.url).href;
    case "audio/pulse.wav":
      return new URL("./audio/pulse.wav", import.meta.url).href;
    case "audio/fracture.wav":
      return new URL("./audio/fracture.wav", import.meta.url).href;
    case "audio/hull-hit.wav":
      return new URL("./audio/hull-hit.wav", import.meta.url).href;
    case "audio/wave-clear.wav":
      return new URL("./audio/wave-clear.wav", import.meta.url).href;
    default:
      return null;
  }
}

export class SpaceRocksGameInstance implements GameInstance {
  private simulation: SpaceRocksSimulation | null = null;
  private effects: SpaceRocksEffects;
  private readonly scoreCommitter: SpaceRocksScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;
  private thrusting = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new SpaceRocksEffects(services.audio);
    this.scoreCommitter = new SpaceRocksScoreCommitter(services.scores);
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Space Rocks supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new SpaceRocksEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new SpaceRocksSimulation({
      rng: this.services.rng,
      difficulty,
    });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
    this.thrusting = false;
  }

  public update(dtSeconds: number): void {
    const simulation = this.simulation;
    if (simulation === null || this.paused) {
      return;
    }
    const left = this.services.input.isHeld(1, "left");
    const right = this.services.input.isHeld(1, "right");
    const thrust = this.services.input.isHeld(1, "up");
    const fire = this.services.input.isHeld(1, "action-1");
    const rotate: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;

    this.thrusting = thrust && !simulation.gameOver;
    this.effects.setThrust(this.thrusting);
    const events = simulation.update({ rotate, thrust, fire }, dtSeconds);
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
    if (simulation.gameOver) {
      this.thrusting = false;
      this.effects.setThrust(false);
    }
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#050816");
    for (const star of STAR_FIELD) {
      renderer.fillCircle(star.x, star.y, star.radius, star.color);
    }

    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText("SPACE ROCKS", renderer.logicalWidth / 2, renderer.logicalHeight / 2, {
        color: "#7fe7ff",
        font: "bold 18px monospace",
        align: "center",
        baseline: "middle",
      });
      return;
    }

    for (const rock of simulation.rocks) {
      renderRock(renderer, rock);
    }
    for (const bolt of simulation.bolts) {
      renderer.fillCircle(bolt.position.x, bolt.position.y, 1.75, "#b9f5ff");
    }

    const protectedBlink =
      simulation.invulnerabilitySeconds > 0 &&
      Math.floor(simulation.invulnerabilitySeconds * 10) % 2 === 0;
    if (!simulation.gameOver && !protectedBlink) {
      renderShip(
        renderer,
        simulation.ship.position,
        simulation.ship.facingRadians,
        this.thrusting,
      );
    }

    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 8, 8, {
      color: "#dff7ff",
      font: "bold 9px monospace",
      baseline: "top",
    });
    renderer.drawText(`HULLS ${simulation.lives}`, renderer.logicalWidth - 8, 8, {
      color: "#ffd76a",
      font: "bold 9px monospace",
      align: "right",
      baseline: "top",
    });
    renderer.drawText(`WAVE ${simulation.wave}`, renderer.logicalWidth / 2, 8, {
      color: "#a7f3d0",
      font: "bold 9px monospace",
      align: "center",
      baseline: "top",
    });

    if (simulation.gameOver) {
      renderer.drawText("RUN COMPLETE", renderer.logicalWidth / 2, renderer.logicalHeight / 2 - 5, {
        color: "#ff8c72",
        font: "bold 15px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, renderer.logicalHeight / 2 + 13, {
        color: "#dff7ff",
        font: "8px monospace",
        align: "center",
        baseline: "middle",
      });
    }
  }

  public pause(): void {
    this.paused = true;
    this.thrusting = false;
    this.effects.setThrust(false);
  }

  public resume(): void {
    this.paused = false;
  }

  public reset(): void {
    const options = this.runOptions;
    if (options === null) {
      return;
    }
    this.start(options);
  }

  public destroy(): void {
    this.effects.destroy();
    this.simulation = null;
    this.runOptions = null;
    this.paused = false;
    this.thrusting = false;
  }
}

export const SPACE_ROCKS_MODULE: GameModule = Object.freeze({
  metadata: SPACE_ROCKS_METADATA,
  create: (services: GameServices) => new SpaceRocksGameInstance(services),
  resolveAssetUrl: assetUrl,
});
