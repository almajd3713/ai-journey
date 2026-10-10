// The outline of the chart: an island cut out of the measured surface around the route.
// The terrain inside is untouched; the outline only decides how much of it is shown.
// It is a distance field: positive inside, in world units (the chart is S x S, centred on
// the origin), zero on the coast. The radius around the route swells in the middle and
// wanders with seeded noise, so the shape is an island rather than a square or a tube.
// The 3D floor, its cut-away wall, the sea life and the 2D chart all read this one field.
import { contours as d3contours } from "d3-contour";
import type { Terrain } from "./terrain";

export const ISLAND_S = 24;       // same as the scene's S
export const ISLAND_N = 160;      // field resolution

export interface Island {
  n: number;
  /** signed distance to the coast in world units, row-major (row = z), n x n over [-S/2, S/2]^2 */
  field: Float32Array;
  /** the same without the islets (they show on the flat chart only; in relief they would float) */
  main: Float32Array;
  /** bilinear field at world x, z; mainAt without the islets */
  at(x: number, z: number): number;
  mainAt(x: number, z: number): number;
  /** the coastlines, world x, z, each closed: the island first, then its islets */
  coasts: [number, number][][];
}

function noise2(seed: number) {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export function buildIsland(T: Terrain): Island {
  const S = ISLAND_S, n = ISLAND_N, half = S / 2;
  const toWorld = (g: number) => (g / (T.n - 1) - 0.5) * S;
  const trail: [number, number][] = [];
  for (let i = 0; i < T.pts.length; i += 2) trail.push([toWorld(T.pts[i][0]), toWorld(T.pts[i][1])]);
  const nz = noise2(5), nz2 = noise2(9), nz3 = noise2(13);
  // a few islets offshore, as on any chart (decoration: no route goes there)
  const islets = [[-6.5, 6.3, 1.0], [5.6, -5.4, 0.8], [9.8, 4.9, 0.6], [-2.0, -6.8, 0.55]];
  const field = new Float32Array(n * n), main = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * S, z = (j / (n - 1) - 0.5) * S;
    let m = Infinity;
    for (const [a, b] of trail) m = Math.min(m, (a - x) ** 2 + (b - z) ** 2);
    const d = Math.sqrt(m);
    // wide in the middle of the route, narrower at its two ends; the noise makes bays and capes
    const r = 2.1 + 3.0 * Math.exp(-(x * x) / 40) + 2.0 * (nz(x * 0.22, z * 0.22) - 0.5) + 0.9 * (nz2(x * 0.6, z * 0.6) - 0.5)
      + 0.45 * (nz3(x * 1.4, z * 1.4) - 0.5);
    let isl = -Infinity;
    for (const [cx, cz, rr] of islets) isl = Math.max(isl, rr + 0.35 * (nz3(x * 1.1 + 7, z * 1.1) - 0.5) - Math.hypot(x - cx, z - cz));
    // keep inside the measured square, with a margin for the wall
    const box = Math.min(half - 0.5 - Math.abs(x), half - 0.5 - Math.abs(z));
    field[j * n + i] = Math.min(Math.max(r - d, isl), box);
    main[j * n + i] = Math.min(r - d, box);
  }
  const sample = (F: Float32Array) => (x: number, z: number) => {
    const gx = Math.min(n - 1, Math.max(0, (x / S + 0.5) * (n - 1)));
    const gz = Math.min(n - 1, Math.max(0, (z / S + 0.5) * (n - 1)));
    const i = Math.min(n - 2, Math.floor(gx)), j = Math.min(n - 2, Math.floor(gz)), fx = gx - i, fz = gz - j;
    const a = F[j * n + i], b = F[j * n + i + 1], c = F[(j + 1) * n + i], d = F[(j + 1) * n + i + 1];
    return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
  };
  // d3-contour puts cell centres at +0.5; convert back to world units
  const [c] = d3contours().size([n, n]).thresholds([0])(Array.from(field));
  const coasts = c.coordinates
    .map((poly) => poly[0].map(([gx, gz]) => [((gx - 0.5) / (n - 1) - 0.5) * S, ((gz - 0.5) / (n - 1) - 0.5) * S] as [number, number]))
    .sort((a, b) => b.length - a.length);
  return { n, field, main, at: sample(field), mainAt: sample(main), coasts };
}

let cache: { T: Terrain; I: Island } | null = null;
/** The island for this terrain, built once and shared by the scene and the charts. */
export function islandOf(T: Terrain): Island {
  if (!cache || cache.T !== T) cache = { T, I: buildIsland(T) };
  return cache.I;
}
