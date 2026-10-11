// The drift: particles that flow down the chart's surface the steepest way, faster where it
// is steeper, like a current chart. It shows the slope of the measured surface and nothing
// else: gradient descent's "downhill" made visible. Shared by the 3D scene and the 2D chart.
import { ISLAND_S, islandOf } from "./island";
import type { Terrain } from "./terrain";

let on = false;
const listeners = new Set<() => void>();
export const driftOn = () => on;
export const setDrift = (v: boolean) => { on = v; listeners.forEach((f) => f()); };
export const onDrift = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export class DriftField {
  /** grid coordinates, unit direction of flow, life left (s), speed (cells/s) */
  x: Float32Array; y: Float32Array; dx: Float32Array; dy: Float32Array; life: Float32Array; speed: Float32Array;
  private inside: (gx: number, gy: number) => boolean;
  constructor(private T: Terrain, readonly count: number) {
    const I = islandOf(T), w = (g: number) => (g / (T.n - 1) - 0.5) * ISLAND_S;
    this.inside = (gx, gy) => I.mainAt(w(gx), w(gy)) > 0.1;
    this.x = new Float32Array(count); this.y = new Float32Array(count);
    this.dx = new Float32Array(count); this.dy = new Float32Array(count);
    this.life = new Float32Array(count); this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) { this.spawn(i); this.life[i] *= Math.random(); }
  }
  private spawn(i: number) {
    const n = this.T.n;
    for (let k = 0; k < 30; k++) {
      const gx = Math.random() * (n - 1), gy = Math.random() * (n - 1);
      if (this.inside(gx, gy)) { this.x[i] = gx; this.y[i] = gy; break; }
    }
    this.life[i] = 1.5 + Math.random() * 2.5;
    this.speed[i] = 0;
  }
  /** advance by dt seconds */
  step(dt: number) {
    const h = this.T.h;
    for (let i = 0; i < this.count; i++) {
      const x = this.x[i], y = this.y[i];
      const gx = -(h(x + 1, y) - h(x - 1, y)) / 2, gy = -(h(x, y + 1) - h(x, y - 1)) / 2;
      const m = Math.hypot(gx, gy);
      // speed in grid cells per second, by the square root of the slope (in ln loss per cell)
      const v = Math.min(40, 90 * Math.sqrt(m));
      if (m > 1e-7) { this.dx[i] = gx / m; this.dy[i] = gy / m; this.x[i] = x + this.dx[i] * v * dt; this.y[i] = y + this.dy[i] * v * dt; }
      this.speed[i] = v;
      this.life[i] -= dt;
      if (this.life[i] <= 0 || !this.inside(this.x[i], this.y[i])) this.spawn(i);
    }
  }
}

/** how long a streak is, in seconds of travel */
export const STREAK = 0.18;
/** how bright a particle is: it fades out before it ends */
export const glow = (life: number) => Math.min(1, life / 0.6);
