// Place names on the chart, as a sea chart names its banks and deeps. Every name marks a
// feature this surface or this training run really has, found by a rule below, and carries
// its real number. Nothing is placed by hand.
import { islandOf, ISLAND_S } from "./island";
import type { Terrain } from "./terrain";

export interface Toponym { id: string; name: string; sub: string; gx: number; gy: number }

const fmt = (v: number) => (v >= 0.1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(4) : v.toPrecision(3));

export function toponymsOf(T: Terrain): Toponym[] {
  const n = T.n, H = T.H, I = islandOf(T), L = T.meta.trueLoss;
  const w = (g: number) => (g / (n - 1) - 0.5) * ISLAND_S;
  const on = (i: number, j: number, m = 0.6) => I.mainAt(w(i), w(j)) > m;
  const out: Toponym[] = [];

  // the 50/50 plateau: loss within 0.5% of ln 2 = 0.693, the loss of a network that answers
  // 0.5 to every input; and a saddle point, where the floor goes down two ways and up two
  const LN2 = Math.log(2);
  let fx = 0, fy = 0, fc = 0;
  let sad: { i: number; j: number; g: number } | null = null;
  for (let j = 2; j < n - 2; j++) for (let i = 2; i < n - 2; i++) {
    if (!on(i, j)) continue;
    const v = H[j * n + i];
    if (Math.abs(Math.exp(v) - LN2) < LN2 * 0.005) { fx += i; fy += j; fc++; }
    const ring = [H[(j - 1) * n + i - 1], H[(j - 1) * n + i], H[(j - 1) * n + i + 1], H[j * n + i + 1], H[(j + 1) * n + i + 1], H[(j + 1) * n + i], H[(j + 1) * n + i - 1], H[j * n + i - 1]];
    let changes = 0;
    for (let k = 0; k < 8; k++) if ((ring[k] > v) !== (ring[(k + 1) % 8] > v)) changes++;
    if (changes >= 4) {
      const g = Math.hypot(H[j * n + i + 1] - H[j * n + i - 1], H[(j + 1) * n + i] - H[(j - 1) * n + i]);
      if (!sad || g < sad.g) sad = { i, j, g };
    }
  }
  if (fc > 20) {
    const cx = fx / fc, cy = fy / fc;
    const saddleHere = sad && Math.hypot(sad.i - cx, sad.j - cy) < 30;
    out.push({
      id: "flat", name: saddleHere ? "Fifty-Fifty Saddle" : "Fifty-Fifty Flat",
      sub: `loss ${fmt(LN2)} = ln 2: the net answers 0.5 to everything`,
      gx: saddleHere ? sad!.i : cx, gy: saddleHere ? sad!.j : cy,
    });
  } else if (sad) {
    out.push({ id: "saddle", name: "The Saddle", sub: `loss ${fmt(Math.exp(H[sad.j * n + sad.i]))}`, gx: sad.i, gy: sad.j });
  }

  // the drop and the floor, from the true training loss: the loss halves by step a, is under
  // 0.1 by step b, and creeps down for the rest of the run
  const a = L.findIndex((v) => v < L[0] / 2), b = L.findIndex((v) => v < 0.1);
  const at = (k: number) => T.pts[Math.min(T.pts.length - 1, Math.max(0, Math.round(k)))];
  if (a > 0 && b > a) {
    const [x, y] = at((a + b) / 2);
    out.push({ id: "drop", name: "The Drop", sub: `steps ${a}–${b}: loss ${fmt(L[a])} → ${fmt(L[b])}`, gx: x, gy: y });
    const last = L.length - 1;
    const [x2, y2] = at(b + (last - b) * 0.45);
    out.push({ id: "floor", name: "The Long Floor", sub: `steps ${b}–${last}: ${fmt(L[b])} → ${fmt(L[last])}`, gx: x2, gy: y2 });
  }

  // the highest and the lowest ground on the island
  let hi = { i: 0, j: 0, v: -Infinity }, lo = { i: 0, j: 0, v: Infinity };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!on(i, j, 1.0)) continue;
    const v = H[j * n + i];
    if (v > hi.v) hi = { i, j, v };
    if (v < lo.v) lo = { i, j, v };
  }
  if (hi.v > -Infinity) out.push({ id: "shoulder", name: "High Shoulder", sub: `loss ${fmt(Math.exp(hi.v))}`, gx: hi.i, gy: hi.j });
  const endSurface = T.meta.trailSurfaceLoss[T.meta.trailSurfaceLoss.length - 1];   // same surface, so comparable
  if (lo.v < Infinity && Math.exp(lo.v) < endSurface) {
    out.push({ id: "deep", name: "The Deep", sub: `loss ${fmt(Math.exp(lo.v))}: below where training stopped`, gx: lo.i, gy: lo.j });
  }
  // names sit beside the route, not on it: push any name within CLEAR cells of the route
  // out to that distance, on whichever side stays on the island
  const CLEAR = 16;
  for (const t of out) {
    let best = Infinity, bx = 0, by = 0, bi = 0;
    T.pts.forEach(([x, y], i) => { const d = Math.hypot(x - t.gx, y - t.gy); if (d < best) { best = d; bx = x; by = y; bi = i; } });
    if (best >= CLEAR) continue;
    let nx = t.gx - bx, ny = t.gy - by;
    if (Math.hypot(nx, ny) < 1e-3) {   // on the route: use its normal
      const [ax, ay] = T.pts[Math.max(0, bi - 3)], [cx, cy] = T.pts[Math.min(T.pts.length - 1, bi + 3)];
      nx = -(cy - ay); ny = cx - ax;
    }
    const len = Math.hypot(nx, ny) || 1;
    const sides = [1, -1].map((sgn) => [bx + (sgn * nx / len) * CLEAR, by + (sgn * ny / len) * CLEAR]);
    const [px, py] = sides.find(([x, y]) => on(x, y, 0.8)) ?? sides[0];
    t.gx = px; t.gy = py;
  }
  // and apart from each other: a name too close to an earlier one moves down the chart
  out.forEach((t, k) => {
    for (const u of out.slice(0, k)) if (Math.hypot(t.gx - u.gx, t.gy - u.gy) < 14) t.gy = u.gy + 14;
  });
  return out;
}

let cache: { T: Terrain; v: Toponym[] } | null = null;
export const toponyms = (T: Terrain) => (cache?.T === T ? cache.v : (cache = { T, v: toponymsOf(T) }).v);
