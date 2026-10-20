"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { windAt, type Frame } from "@/lib/spread";
import type { LonLat } from "@/lib/sim/types";
import { boundaryPath, MAP_H, MAP_W, projection } from "./map-geometry";

const COUNT = 460;
/**
 * Map units moved per frame: true direction, and faster in stronger wind, but with a floor so a light
 * breeze still reads as drift. Calm air (under 0.8 km/h) does not move.
 */
const pace = (kmh: number) => (kmh < 0.8 ? 0 : 0.35 + 0.09 * kmh);

type Particle = { x: number; y: number; age: number; life: number };

/**
 * The wind as pencil strokes drifting across the survey sheet: each particle follows the hour's wind
 * (interpolated between the nine forecast points), leaving a fading trail. Rain hours draw in canal blue.
 */
export function WindField({ frame, points }: { frame: Frame | undefined; points: LonLat[] | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const live = useRef({ frame, points });
  useEffect(() => {
    live.current = { frame, points };
  }, [frame, points]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const clip = new Path2D(boundaryPath);
    let scale = 1;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      scale = el.width / MAP_W;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // The taluka as a coarse mask in map units, built once: particles live only inside the boundary.
    const CELL = 4, cols = Math.ceil(MAP_W / CELL), rows = Math.ceil(MAP_H / CELL);
    const mask = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mask[r * cols + c] = ctx.isPointInPath(clip, c * CELL + CELL / 2, r * CELL + CELL / 2) ? 1 : 0;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && mask[Math.floor(y / CELL) * cols + Math.floor(x / CELL)] === 1;
    const spawn = (p: Particle) => {
      for (let i = 0; i < 20; i++) {
        p.x = Math.random() * MAP_W;
        p.y = Math.random() * MAP_H;
        if (inside(p.x, p.y)) break;
      }
      p.age = 0;
      p.life = 40 + Math.floor(Math.random() * 60);
      return p;
    };
    const particles = Array.from({ length: COUNT }, () => spawn({ x: 0, y: 0, age: 0, life: 0 }));
    for (const p of particles) p.age = Math.floor(Math.random() * p.life);
    const velocity = (x: number, y: number): [number, number] => {
      const { frame: f, points: pts } = live.current;
      if (!f) return [0, 0];
      const ll = projection.invert!([x, y]) as LonLat;
      const [u, v] = windAt(f, pts, ll);
      const speed = Math.hypot(u, v);
      const k = speed ? pace(speed) / speed : 0;
      return [u * k, -v * k];
    };

    const drawArrows = () => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      ctx.save();
      ctx.clip(clip);
      ctx.strokeStyle = "rgba(28,26,23,0.45)";
      ctx.fillStyle = "rgba(28,26,23,0.45)";
      ctx.lineWidth = 1.1;
      for (let x = 40; x < MAP_W; x += 70) {
        for (let y = 100; y < MAP_H; y += 70) {
          const [dx, dy] = velocity(x, y);
          const len = Math.hypot(dx, dy);
          if (len < 0.05) continue;
          const k = Math.min(18, 6 + len * 8) / len;
          ctx.beginPath();
          ctx.moveTo(x - dx * k, y - dy * k);
          ctx.lineTo(x + dx * k, y + dy * k);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    let raf = 0;
    let lastFrame: Frame | undefined;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (reduce) {
        if (live.current.frame !== lastFrame) { lastFrame = live.current.frame; drawArrows(); }
        return;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // Fade the old trails rather than clearing, so each stroke leaves a short tail.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.045)";
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      ctx.globalCompositeOperation = "source-over";
      const rain = (live.current.frame?.rain ?? 0) >= 0.2;
      ctx.strokeStyle = rain ? "rgba(44,104,168,0.8)" : "rgba(40,36,30,0.68)";
      ctx.lineWidth = rain ? 1.25 : 1.05;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const p of particles) {
        const [dx, dy] = velocity(p.x, p.y);
        const nx = p.x + dx, ny = p.y + dy;
        p.age += 1;
        if (p.age > p.life || !inside(nx, ny) || Math.hypot(dx, dy) < 0.01) {
          spawn(p);
          continue;
        }
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        p.x = nx;
        p.y = ny;
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
