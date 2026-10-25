import { useEffect, useRef } from "react";
import type { Shape } from "../game/rules";
import { PAINT } from "./colors";

/**
 * The TV's sky of kites: one 2D canvas at 1920×1080, no WebGL. A phone draws this TV for AirPlay
 * while it also runs the controller page, so the budget is small: one canvas, one rAF loop, no
 * per-frame allocation, nothing that compiles shaders. See README "TV performance budget".
 */
export function Kites({ shapes }: { shapes: Shape[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const W = canvas.width;
    const H = canvas.height;
    const t0 = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, W, H);
      for (const s of shapes) {
        const x = ((s.x + t * 0.025 * s.drift) % 1) * W;
        const y = s.y * H + Math.sin(t * 1.6 * s.drift + s.x * 9) * 18;
        const r = 46 * s.size;
        // The string down to the ground.
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y + r * 1.4);
        g.quadraticCurveTo(x - 60, y + r * 4, x - 20, H + 10);
        g.stroke();
        // The kite: a diamond with its cross spars.
        g.fillStyle = PAINT[s.color].fill;
        g.beginPath();
        g.moveTo(x, y - r * 1.3);
        g.lineTo(x + r, y);
        g.lineTo(x, y + r * 1.4);
        g.lineTo(x - r, y);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(20,30,60,0.45)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y - r * 1.3);
        g.lineTo(x, y + r * 1.4);
        g.moveTo(x - r, y);
        g.lineTo(x + r, y);
        g.stroke();
        // Two bows on the tail.
        for (let i = 1; i <= 2; i++) {
          const bx = x - 8 * i + Math.sin(t * 3 + i) * 6;
          const by = y + r * 1.4 + i * 26;
          g.fillStyle = PAINT[s.color].fill;
          g.fillRect(bx - 9, by - 4, 18, 8);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shapes]);
  return <canvas ref={ref} className="kites" width={1920} height={1080} />;
}
