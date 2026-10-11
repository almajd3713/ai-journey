// The bathymetric chart in 2D (canvas): depth tints, hillshade, Tanaka-lit isobaths,
// index isobaths labelled with the real loss, and the route with its 27 stations.
// It is the site's 2D mode (no WebGL, reduced motion, or by choice) and the figure in
// "How this chart was made". Same drawing as design-system/chart.js, typed.
import { contours as d3contours } from "d3-contour";
import { geoPath, geoTransform } from "d3-geo";
import { STATION_COUNT, distOf, type Terrain } from "./terrain";
import { rgba, token } from "./theme";
import { STATIONS } from "./content";
import { ISLAND_S, islandOf } from "./island";
import { getLearners, learnerColor } from "./learner";
import { toponyms } from "./toponyms";

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
const rgb255 = (hex: string): RGB => rgba(hex).slice(0, 3).map((v) => v * 255) as RGB;
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export interface ChartOptions {
  /** fraction of the chart cropped from each side, to frame the route */
  labels?: "few" | "all";
  /** place names (lib/toponyms.ts); off for the other slices, where they would not apply */
  names?: boolean;
}

/** a route drawn faintly on the chart: another training run, in grid coordinates */
export interface Ghost { pts: [number, number][]; label: string }

// The chart's canvases use CPU-backed contexts (willReadFrequently). With GPU-backed 2D
// canvases, their drawing queued in the GPU process ahead of the 3D scene's WebGL context,
// and creating that context took 20-45 s in testing; with these it takes about 2 s.
export class BathyChart {
  private base = document.createElement("canvas");
  private size = 0;
  private p = 0;
  private ghosts: Ghost[] = [];
  private ro: ResizeObserver;
  constructor(private canvas: HTMLCanvasElement, private T: Terrain, private opts: ChartOptions = {}) {
    this.ro = new ResizeObserver(() => this.render(false));
    this.ro.observe(canvas);
  }
  destroy() { this.ro.disconnect(); }
  set(p: number) { this.p = p; this.render(false); }
  setGhosts(g: Ghost[]) { this.ghosts = g; this.render(false); }
  redraw() { this.render(true); }

  /** grid coordinates under a screen point, or null when it is off the chart */
  gridAt(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const s = r.width / this.T.n;
    const gx = (clientX - r.left) / s - 0.5, gy = (clientY - r.top) / s - 0.5;
    return gx >= 0 && gy >= 0 && gx <= this.T.n - 1 && gy <= this.T.n - 1 ? [gx, gy] : null;
  }

  /** grid coordinates of the station nearest to a click, or -1 */
  hit(clientX: number, clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    const s = r.width / this.T.n;
    let best = -1, bd = 16;
    this.T.stations.forEach((st, i) => {
      const d = Math.hypot(st.x * s + s / 2 - (clientX - r.left), st.y * s + s / 2 - (clientY - r.top));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  private render(rebuild: boolean) {
    const w = Math.round(this.canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (!w) return;
    if (w !== this.size || rebuild) {
      this.size = this.canvas.width = this.canvas.height = this.base.width = this.base.height = w;
      this.drawBase(this.base.getContext("2d", { willReadFrequently: true })!);
    }
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, w);
    ctx.drawImage(this.base, 0, 0);
    this.drawGhosts(ctx);
    this.drawRoute(ctx);
    this.drawLearners(ctx);
  }

  private drawGhosts(ctx: CanvasRenderingContext2D) {
    if (!this.ghosts.length) return;
    const s = this.size / this.T.n, k = this.size / 640, X = (v: number) => v * s + s / 2;
    ctx.save();
    ctx.strokeStyle = token("--plankton");
    ctx.fillStyle = token("--plankton");
    ctx.lineWidth = 1.4 * k;
    ctx.setLineDash([2 * k, 3 * k]);
    ctx.font = `${Math.round(9.5 * k)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    for (const g of this.ghosts) {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      g.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), X(y)) : ctx.moveTo(X(x), X(y))));
      ctx.stroke();
      const [ex, ey] = g.pts[g.pts.length - 1];
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(X(ex), X(ey), 2.6 * k, 0, Math.PI * 2); ctx.fill();
      const lw = ctx.measureText(g.label).width;
      ctx.fillText(g.label, Math.min(this.size - lw - 4 * k, X(ex) + 6 * k), Math.min(this.size - 4 * k, X(ey) + 12 * k));
    }
    ctx.restore();
  }

  private drawLearners(ctx: CanvasRenderingContext2D) {
    const s = this.size / this.T.n, k = this.size / 640, X = (v: number) => v * s + s / 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const L of getLearners()) {
      const c = learnerColor(L.opt);
      ctx.beginPath();
      L.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), X(y)) : ctx.moveTo(X(x), X(y))));
      ctx.strokeStyle = c; ctx.lineWidth = 1.8 * k; ctx.stroke();
      ctx.fillStyle = c;
      for (const [x, y] of L.pts) ctx.fillRect(X(x) - 1.2 * k, X(y) - 1.2 * k, 2.4 * k, 2.4 * k);
      const [hx, hy] = L.pts[L.pts.length - 1];
      ctx.beginPath(); ctx.arc(X(hx), X(hy), 3.6 * k, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      const [sx0, sy0] = L.pts[0];
      ctx.beginPath(); ctx.arc(X(sx0), X(sy0), 3 * k, 0, Math.PI * 2); ctx.lineWidth = 1.4 * k; ctx.stroke();
    }
  }

  private drawBase(ctx: CanvasRenderingContext2D) {
    const { n, H, min: lo, max: hi } = this.T;
    const size = this.size;
    const ramp = ["--d0", "--d1", "--d2", "--d3", "--d4", "--d5", "--d6"].map((v) => rgb255(token(v)));
    const chartTheme = document.documentElement.dataset.theme === "chart";
    // only the island is drawn (lib/island.ts): clip to its coasts, then draw the coastline
    const I = islandOf(this.T);
    const toPx = (w: number) => ((w / ISLAND_S + 0.5) * (n - 1) + 0.5) * (size / n);
    const coast = new Path2D();
    I.coasts.forEach((ring) => {
      ring.forEach(([x, z], k) => (k ? coast.lineTo(toPx(x), toPx(z)) : coast.moveTo(toPx(x), toPx(z))));
      coast.closePath();
    });
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.clip(coast);
    const off = document.createElement("canvas");
    off.width = off.height = n;
    const oc = off.getContext("2d", { willReadFrequently: true })!;
    const img = oc.createImageData(n, n);
    const lx = -0.55, ly = -0.55, lz = 0.63;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = H[j * n + i], t = (hi - v) / (hi - lo);
      const f = t * 6, a = Math.min(5, Math.floor(f));
      const c = mix(ramp[a], ramp[a + 1], f - a);
      const dx = (H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)]) * 6;
      const dy = (H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i]) * 6;
      const len = Math.hypot(dx, dy, 1), dot = (-dx * lx - dy * ly + lz) / len;
      const shade = chartTheme ? 0.9 + 0.25 * (dot - 0.6) : 0.78 + 0.6 * (dot - 0.6);
      const p = (j * n + i) * 4;
      img.data[p] = c[0] * shade; img.data[p + 1] = c[1] * shade; img.data[p + 2] = c[2] * shade; img.data[p + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, size, size);

    // isobaths every 0.25 in log-loss; every fourth (one e-fold) is an index isobath
    const step = 0.25, levels: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v < hi; v += step) levels.push(+v.toFixed(3));
    const s = size / n, k = size / 640;
    const path = geoPath(geoTransform({ point(x, y) { this.stream.point(x * s, y * s); } })).context(ctx);
    const rings = d3contours().size([n, n]).thresholds(levels)(Array.from(H));
    const lit = token("--isobath-lit"), shade = token("--isobath-shade"), iso = token("--isobath"), idx = token("--isobath-index");
    const o = 0.9 * k;
    const isIndex = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
    rings.forEach((c) => {
      const index = isIndex(c.value);
      ctx.lineJoin = "round";
      ctx.lineWidth = (index ? 1.6 : 1) * k;
      ctx.save(); ctx.translate(-o, -o); ctx.beginPath(); path(c); ctx.strokeStyle = lit; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(o, o); ctx.beginPath(); path(c); ctx.strokeStyle = shade; ctx.stroke(); ctx.restore();
      ctx.beginPath(); path(c); ctx.strokeStyle = index ? idx : iso; ctx.lineWidth = (index ? 1.4 : 0.8) * k; ctx.stroke();
    });
    ctx.restore();
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.6 * k;
    ctx.strokeStyle = token("--isobath-index");
    ctx.stroke(coast);
    // label index isobaths with the real loss value, on the island
    ctx.font = `${Math.round(10 * k)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    rings.forEach((c) => {
      if (!isIndex(c.value)) return;
      let best: number[][] | null = null;
      c.coordinates.forEach((poly) => poly.forEach((ring) => { if (!best || ring.length > best.length) best = ring; }));
      const ring = best as number[][] | null;
      if (!ring || ring.length < 40) return;
      const m = 8;
      const onIsland = (x: number, y: number) => I.at(((x - 0.5) / (n - 1) - 0.5) * ISLAND_S, ((y - 0.5) / (n - 1) - 0.5) * ISLAND_S) > 0.5;
      const pt = ring.slice(Math.floor(ring.length * 0.37)).concat(ring).find(([x, y]) => x > m && y > m && x < n - m && y < n - m && onIsland(x, y));
      if (!pt) return;
      const [x, y] = pt;
      const v = Math.exp(c.value);
      const label = v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4);
      const w = ctx.measureText(label).width + 8 * k;
      ctx.fillStyle = token("--d5");
      ctx.fillRect(x * s - w / 2, y * s - 7 * k, w, 14 * k);
      ctx.fillStyle = token("--sounding");
      ctx.fillText(label, x * s, y * s + 0.5 * k);
    });
    if (this.opts.names !== false) this.drawNames(ctx);
  }

  /** place names (lib/toponyms.ts), in italics as on a sea chart, each with its number */
  private drawNames(ctx: CanvasRenderingContext2D) {
    const s = this.size / this.T.n, k = this.size / 640;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const t of toponyms(this.T)) {
      const x = t.gx * s + s / 2, y = t.gy * s + s / 2;
      ctx.font = `italic 600 ${Math.round(12 * k)}px Archivo, sans-serif`;
      ctx.fillStyle = token("--foam");
      ctx.globalAlpha = 0.9;
      ctx.fillText(t.name, x, y - 3 * k);
      ctx.font = `${Math.round(8.5 * k)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = token("--fog");
      ctx.fillText(t.sub, x, y + 9 * k);
      ctx.globalAlpha = 1;
    }
  }

  private drawRoute(ctx: CanvasRenderingContext2D) {
    const T = this.T, size = this.size;
    const s = size / T.n, k = size / 640, half = s / 2;
    const cb = rgb255(token("--route-basic")), ca = rgb255(token("--route-advanced"));
    const colorAt = (d: number) => mix(cb, ca, Math.min(1, Math.max(0, d / T.total)));
    const until = distOf(T, this.p);
    const X = (v: number) => v * s + half;
    // The route is drawn in 24 colour bands, one path each: per-segment strokes with a
    // shadow are slow to rasterise (hundreds of blurred strokes per redraw).
    const BANDS = 24;
    const band = (i: number) => Math.min(BANDS - 1, Math.floor((T.cum[i] / T.total) * BANDS));
    const stroke = (from: number, to: number, solid: boolean) => {
      for (let b = band(Math.max(1, from)); from < to && b < BANDS; b++) {
        ctx.beginPath();
        let started = false;
        let i = Math.max(1, from);
        for (; i < to && band(i) <= b; i++) {
          if (band(i) < b) continue;
          if (!started) { ctx.moveTo(X(T.pts[i - 1][0]), X(T.pts[i - 1][1])); started = true; }
          ctx.lineTo(X(T.pts[i][0]), X(T.pts[i][1]));
        }
        if (started) {
          const c = colorAt(((b + 0.5) / BANDS) * T.total);
          ctx.strokeStyle = css(c, solid ? 1 : 0.55);
          if (solid) ctx.shadowColor = css(c, 0.8);
          ctx.stroke();
        }
        from = i;
      }
    };
    let split = 1;
    while (split < T.pts.length && T.cum[split - 1] < until) split++;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([4 * k, 5 * k]);
    ctx.lineWidth = 1.6 * k;
    stroke(split, T.pts.length, false);
    ctx.setLineDash([]);
    ctx.lineWidth = 2.6 * k;
    ctx.shadowBlur = 10 * k;
    stroke(1, split, true);
    ctx.shadowBlur = 0;
    const now = Math.min(STATION_COUNT - 1, Math.round(this.p));
    ctx.font = `${Math.round(10 * k)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = "middle";
    T.stations.forEach((st, i) => {
      const c = colorAt((i / (STATION_COUNT - 1)) * T.total), r = (i === now ? 6 : 4) * k;
      ctx.beginPath(); ctx.arc(X(st.x), X(st.y), r, 0, Math.PI * 2);
      ctx.fillStyle = token("--d6"); ctx.fill();
      ctx.lineWidth = 2 * k; ctx.strokeStyle = css(c, i <= now ? 1 : 0.6); ctx.stroke();
      if (i === now) { ctx.beginPath(); ctx.arc(X(st.x), X(st.y), 2.4 * k, 0, Math.PI * 2); ctx.fillStyle = css(c); ctx.fill(); }
      const show = this.opts.labels === "all" ? i % 2 === 0 || i === now : [0, STATION_COUNT - 1, now].includes(i) && !(i !== now && Math.abs(i - now) < 2);
      if (show) {
        ctx.fillStyle = token("--foam");
        ctx.textAlign = "left";
        ctx.fillText(STATIONS[i]?.code ?? "", X(st.x) + 9 * k, X(st.y) - 10 * k);
      }
    });
    const d = T.at(until);
    ctx.beginPath(); ctx.arc(X(d.x), X(d.y), 3.4 * k, 0, Math.PI * 2);
    ctx.shadowBlur = 16 * k; ctx.shadowColor = token("--plankton"); ctx.fillStyle = token("--plankton"); ctx.fill(); ctx.shadowBlur = 0;
  }
}
