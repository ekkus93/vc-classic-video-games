import { assertDeepEqual, type TestCase } from "../../test/harness.js";
import { CanvasGameRenderer } from "./renderer.js";

function fakeContext(events: string[]): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    save: () => events.push("save"),
    restore: () => events.push("restore"),
    setTransform: () => events.push("setTransform"),
    fillRect: () => events.push("fillRect"),
    strokeRect: () => events.push("strokeRect"),
    beginPath: () => events.push("beginPath"),
    moveTo: () => events.push("moveTo"),
    lineTo: () => events.push("lineTo"),
    stroke: () => events.push("stroke"),
    arc: () => events.push("arc"),
    fill: () => events.push("fill"),
    fillText: () => events.push("fillText"),
    drawImage: () => events.push("drawImage"),
    translate: () => events.push("translate"),
    rotate: () => events.push("rotate"),
  } as unknown as CanvasRenderingContext2D;
}

export const tests: readonly TestCase[] = [
  {
    name: "Canvas renderer exposes game primitives without DOM layout knowledge",
    run: () => {
      const events: string[] = [];
      const context = fakeContext(events);
      const renderer = new CanvasGameRenderer(context, 320, 240);
      renderer.clear();
      renderer.drawLine(0, 0, 10, 10, "#fff");
      renderer.fillCircle(5, 5, 2, "#fff");
      renderer.drawText("score", 4, 4, { color: "#fff", font: "8px monospace" });

      assertDeepEqual(
        events,
        [
          "save",
          "setTransform",
          "fillRect",
          "restore",
          "beginPath",
          "moveTo",
          "lineTo",
          "stroke",
          "beginPath",
          "arc",
          "fill",
          "fillText",
        ],
        "renderer must translate game-level primitives into Canvas 2D operations",
      );
    },
  },
];
