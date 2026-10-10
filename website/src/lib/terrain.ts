// The ground: the measured loss surface of basic Session 6's XOR network on the plane of
// its training trajectory (tools/make_landscape.py). Shared by the 2D chart and 3D scene.
import { assetUrl } from "./content";

export interface TerrainMeta {
  about: string;
  n: number;
  x: [number, number];
  y: [number, number];
  min: number;
  max: number;
  explained: number[];
  steps: number;
  params: number;
  trail: [number, number][];
  trailSurfaceLoss: number[];
  trueLoss: number[];
  provenance: Record<string, unknown> & { torch: string; python: string; numpy: string; notebook: string };
}

export interface Terrain {
  meta: TerrainMeta;
  n: number;
  /** natural log of the loss, row-major (row = y), n x n */
  H: Float32Array;
  min: number;
  max: number;
  /** trajectory in grid units (0..n-1), one point per training step */
  pts: [number, number][];
  cum: number[];
  total: number;
  stations: Point[];
  /** point at arc distance d along the trajectory; k is the fractional step index */
  at(d: number): Point;
  /** bilinear log-loss at grid coordinates */
  h(gx: number, gy: number): number;
  /** the true training loss at fractional step k (what the gauge shows) */
  lossAt(k: number): number;
}

export interface Point { x: number; y: number; k: number }

export const STATION_COUNT = 27;

export async function loadTerrain(): Promise<Terrain> {
  const [meta, buf] = await Promise.all([
    fetch(assetUrl("terrain/terrain.json")).then((r) => r.json() as Promise<TerrainMeta>),
    fetch(assetUrl("terrain/height.f32")).then((r) => r.arrayBuffer()),
  ]);
  return prepare(meta, new Float32Array(buf));
}

export function prepare(meta: TerrainMeta, H: Float32Array): Terrain {
  const n = meta.n;
  const gx = (a: number) => ((a - meta.x[0]) / (meta.x[1] - meta.x[0])) * (n - 1);
  const gy = (b: number) => ((b - meta.y[0]) / (meta.y[1] - meta.y[0])) * (n - 1);
  const pts = meta.trail.map(([a, b]) => [gx(a), gy(b)] as [number, number]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];

  const at = (d: number): Point => {
    d = Math.min(total, Math.max(0, d));
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] >= d) hi = m; else lo = m + 1; }
    const k = lo;
    const t = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
    return { x: pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, y: pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t, k: k - 1 + t };
  };
  const stations = Array.from({ length: STATION_COUNT }, (_, i) => at((i / (STATION_COUNT - 1)) * total));

  const h = (x: number, y: number) => {
    x = Math.min(n - 1, Math.max(0, x));
    y = Math.min(n - 1, Math.max(0, y));
    const i = Math.min(n - 2, Math.floor(x)), j = Math.min(n - 2, Math.floor(y));
    const fx = x - i, fy = y - j;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };
  const L = meta.trueLoss;
  const lossAt = (k: number) => {
    k = Math.min(L.length - 1, Math.max(0, k));
    const a = Math.floor(k), b = Math.min(L.length - 1, a + 1);
    // interpolate in log space: the loss falls by orders of magnitude
    return Math.exp(Math.log(L[a]) + (Math.log(L[b]) - Math.log(L[a])) * (k - a));
  };
  return { meta, n, H, min: meta.min, max: meta.max, pts, cum, total, stations, at, h, lossAt };
}

/** Station float (0..26) to arc distance. */
export const distOf = (T: Terrain, p: number) => (Math.min(STATION_COUNT - 1, Math.max(0, p)) / (STATION_COUNT - 1)) * T.total;
