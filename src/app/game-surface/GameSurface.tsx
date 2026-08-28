import { useEffect, useRef } from "react";

import { CanvasGameRenderer, type GameRenderer } from "../../engine/index.js";

export interface GameSurfaceHost {
  setRenderer(renderer: GameRenderer | null): void;
}

export interface GameSurfaceProps {
  readonly host: GameSurfaceHost;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly title: string;
}

export function GameSurface({
  host,
  logicalWidth,
  logicalHeight,
  title,
}: GameSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (context === null) {
      host.setRenderer(null);
      return undefined;
    }

    const renderer = new CanvasGameRenderer(
      context,
      logicalWidth,
      logicalHeight,
    );
    host.setRenderer(renderer);

    return () => {
      host.setRenderer(null);
    };
  }, [host, logicalHeight, logicalWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="game-viewport"
      width={logicalWidth}
      height={logicalHeight}
      aria-label={`${title} display`}
    />
  );
}
