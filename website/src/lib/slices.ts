// Other slices through the final weights, and the same network trained at other learning
// rates ("other dives"), from tools/make_landscape.py (public/terrain/slices.json). Loaded
// only by "How this chart was made".
import { assetUrl } from "./content";
import { prepare, type Terrain } from "./terrain";

interface RawSlice {
  id: string; label: string; n: number; x: [number, number]; y: [number, number]; min: number; max: number;
  moved: number; trail: [number, number][]; trailSurfaceLoss: number[];
}
export interface Run { lr: number; fit: number; depthErr: number; onChart: boolean; trueLoss: number[]; trail?: [number, number][] }
export interface Slice { id: string; label: string; moved: number; T: Terrain }
export interface SliceSet { chartMoved: number; fitMin: number; depthMax: number; slices: Slice[]; runs: Run[] }

let cache: Promise<SliceSet> | null = null;

export function loadSlices(main: Terrain): Promise<SliceSet> {
  if (cache) return cache;
  cache = fetch(assetUrl("terrain/slices.json"))
    .then((r) => r.json() as Promise<{ chartMoved: number; fitMin: number; depthMax: number; slices: RawSlice[]; runs: Run[] }>)
    .then(async (raw) => {
      const slices = await Promise.all(raw.slices.map(async (s) => {
        const buf = await fetch(assetUrl(`terrain/slice-${s.id}.f32`)).then((r) => r.arrayBuffer());
        const T = prepare({ ...main.meta, n: s.n, x: s.x, y: s.y, min: s.min, max: s.max, trail: s.trail, trailSurfaceLoss: s.trailSurfaceLoss }, new Float32Array(buf));
        return { id: s.id, label: s.label, moved: s.moved, T };
      }));
      return { chartMoved: raw.chartMoved, fitMin: raw.fitMin, depthMax: raw.depthMax, slices, runs: raw.runs };
    });
  cache.catch(() => { cache = null; });
  return cache;
}

/** a run's path in the chart's grid coordinates */
export function runGrid(T: Terrain, run: Run): [number, number][] {
  const m = T.meta, n = T.n;
  return (run.trail ?? []).map(([a, b]) => [((a - m.x[0]) / (m.x[1] - m.x[0])) * (n - 1), ((b - m.y[0]) / (m.y[1] - m.y[0])) * (n - 1)]);
}
