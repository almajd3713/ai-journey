// "Drop a learner": a toy optimiser on the chart. Click the island and a learner runs
// gradient descent from there on this surface: the real loss of the Session 6 network,
// restricted to the chart's 2D plane. Its steps are real arithmetic on that surface, but it
// is a toy all the same: the real training moved in all 17 dimensions, not on this slice.
// Plane coordinates are the chart's own (meta.x, meta.y): the weights' offsets from the
// final weights along the two principal directions.
import type { Terrain } from "./terrain";
import { token } from "./theme";

export type Opt = "sgd" | "momentum" | "adam";
export const OPTS: Record<Opt, { name: string; lr: number; note: string }> = {
  sgd: { name: "SGD", lr: 1, note: "plain steps down the slope" },
  momentum: { name: "Momentum", lr: 0.5, note: "β 0.9: speed builds up" },
  adam: { name: "Adam", lr: 0.05, note: "lr 0.05, as in the notebook" },
};
export const SCALES = [0.25, 1, 4] as const;
export const MAX_STEPS = 500;   // the real run's length
const KEEP = 5;

export interface Learner {
  id: number;
  opt: Opt;
  lr: number;
  /** grid coordinates, one per step (the start first) */
  pts: [number, number][];
  loss: number[];
  /** "running", "done" after MAX_STEPS, "off" when it leaves the chart */
  state: "running" | "done" | "off";
}

let learners: Learner[] = [];
let nextId = 1;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => { version++; listeners.forEach((f) => f()); };
export const onLearners = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const getLearners = () => learners;
export const learnersVersion = () => version;
export const clearLearners = () => { learners = []; notify(); };

/** Start a learner at grid coordinates (gx, gy); `inside(gx, gy)` says if a point is still on the chart. */
export function dropLearner(T: Terrain, gx: number, gy: number, opt: Opt, scale: number, inside: (gx: number, gy: number) => boolean) {
  const n = T.n, m = T.meta;
  const sx = (m.x[1] - m.x[0]) / (n - 1), sy = (m.y[1] - m.y[0]) / (n - 1);
  const lr = OPTS[opt].lr * scale;
  const L: Learner = { id: nextId++, opt, lr, pts: [[gx, gy]], loss: [Math.exp(T.h(gx, gy))], state: "running" };
  learners = [...learners.slice(-(KEEP - 1)), L];
  // optimiser state, in plane units
  let a = m.x[0] + gx * sx, b = m.y[0] + gy * sy;
  let va = 0, vb = 0, ma = 0, mb = 0, sa = 0, sb = 0, t = 0;
  const grad = () => {
    const x = (a - m.x[0]) / sx, y = (b - m.y[0]) / sy, e = 0.5;
    const L0 = Math.exp(T.h(x, y));
    // d(loss)/d(plane) = loss * d(ln loss)/d(plane)
    return [L0 * (T.h(x + e, y) - T.h(x - e, y)) / (2 * e * sx), L0 * (T.h(x, y + e) - T.h(x, y - e)) / (2 * e * sy)];
  };
  const step = () => {
    t++;
    const [ga, gb] = grad();
    if (opt === "sgd") { a -= lr * ga; b -= lr * gb; }
    else if (opt === "momentum") { va = 0.9 * va + ga; vb = 0.9 * vb + gb; a -= lr * va; b -= lr * vb; }
    else {
      ma = 0.9 * ma + 0.1 * ga; mb = 0.9 * mb + 0.1 * gb;
      sa = 0.999 * sa + 0.001 * ga * ga; sb = 0.999 * sb + 0.001 * gb * gb;
      const c1 = 1 - 0.9 ** t, c2 = 1 - 0.999 ** t;
      a -= (lr * ma / c1) / (Math.sqrt(sa / c2) + 1e-8);
      b -= (lr * mb / c1) / (Math.sqrt(sb / c2) + 1e-8);
    }
    const x = (a - m.x[0]) / sx, y = (b - m.y[0]) / sy;
    if (!(x >= 0 && y >= 0 && x <= n - 1 && y <= n - 1) || !inside(x, y)) { L.state = "off"; return false; }
    L.pts.push([x, y]);
    L.loss.push(Math.exp(T.h(x, y)));
    if (t >= MAX_STEPS) { L.state = "done"; return false; }
    return true;
  };
  // about four seconds for the whole run; with reduced motion, all at once
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const perFrame = reduce ? MAX_STEPS : 2;
  const tick = () => {
    if (!learners.includes(L)) return;
    let go = true;
    for (let k = 0; k < perFrame && go; k++) go = step();
    notify();
    if (go) requestAnimationFrame(tick);
  };
  notify();
  requestAnimationFrame(tick);
}

/** each optimiser's colour, from the palette: foam, plankton, and a pale signal green */
export function learnerColor(opt: Opt): string {
  if (opt === "sgd") return token("--foam");
  if (opt === "momentum") return token("--plankton");
  const a = token("--signal"), b = token("--foam");
  const mix = (i: number) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}
