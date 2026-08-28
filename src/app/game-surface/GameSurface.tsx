import { useEffect, useRef } from "react";

import {
  BrowserFrameScheduler,
  FrameLoop,
} from "../../engine/runtime/frame-loop.js";

const LOGICAL_WIDTH = 320;
const LOGICAL_HEIGHT = 240;

function renderPreview(
  context: CanvasRenderingContext2D,
  timestampMilliseconds: number,
): void {
  context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  context.fillStyle = "#020617";
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const seconds = timestampMilliseconds / 1000;
  const x = 160 + Math.cos(seconds) * 90;
  const y = 120 + Math.sin(seconds * 1.5) * 55;

  context.strokeStyle = "#d4d4d8";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y - 9);
  context.lineTo(x + 8, y + 7);
  context.lineTo(x - 8, y + 7);
  context.closePath();
  context.stroke();
}

export function GameSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;

    if (context === null) {
      return;
    }

    const loop = new FrameLoop(
      new BrowserFrameScheduler(),
      (timestampMilliseconds) => {
        renderPreview(context, timestampMilliseconds);
      },
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="game-surface"
      width={LOGICAL_WIDTH}
      height={LOGICAL_HEIGHT}
      aria-label="Independent game runtime preview"
    />
  );
}
