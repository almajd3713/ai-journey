/* Bathymetric chart renderer (2D). Draws a loss surface as a depth chart: depth tints,
 * hillshade, Tanaka-style isobaths, index isobaths labelled with real loss values, and
 * the training trail with its 27 stations. All colours come from the CSS tokens, so the
 * chart follows the theme. This is the 2D map mode of the site and the reference for the
 * three.js terrain shader. Needs d3 (contours + geoPath) and window.SPIKE_TERRAIN. */
(function () {
  const STATIONS = 27, BASIC = 13;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function rgba(c) {
    const h = c.replace("#", "");
    const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    return [0, 2, 4, 6].map((i) => (i < n.length ? parseInt(n.slice(i, i + 2), 16) : 255));
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const str = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a ?? c[3] / 255})`;

  function prepare(T) {
    const n = T.n, L = T.logLoss;
    let lo = Infinity, hi = -Infinity;
    for (const v of L) { if (v < lo) lo = v; if (v > hi) hi = v; }
    // trail in grid units (pixel centres at +0.5)
    const gx = (a) => ((a - T.x[0]) / (T.x[1] - T.x[0])) * (n - 1) + 0.5;
    const gy = (b) => ((b - T.y[0]) / (T.y[1] - T.y[0])) * (n - 1) + 0.5;
    const pts = T.trail.map(([a, b]) => [gx(a), gy(b)]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    // stations spaced by arc length along the real trajectory
    const at = (d) => {
      let k = cum.findIndex((c) => c >= d); if (k <= 0) k = 1;
      const t = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
      return { x: pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, y: pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t, k: k - 1 + t };
    };
    const stations = Array.from({ length: STATIONS }, (_, i) => at((i / (STATIONS - 1)) * total));
    return { n, L, lo, hi, pts, cum, total, at, stations };
  }

  function drawBase(ctx, P, size) {
    const { n, L, lo, hi } = P;
    const ramp = ["--d0", "--d1", "--d2", "--d3", "--d4", "--d5", "--d6"].map((v) => rgba(css(v)));
    const chartTheme = document.documentElement.dataset.theme === "chart";
    // 1. depth tint + hillshade at grid resolution, then scaled up smoothly
    const off = document.createElement("canvas"); off.width = off.height = n;
    const oc = off.getContext("2d"), img = oc.createImageData(n, n);
    const lx = -0.55, ly = -0.55, lz = 0.63; // light from the north-west
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = L[j * n + i], t = (hi - v) / (hi - lo); // 0 = shallow (high loss), 1 = abyss
      const f = t * 6, a = Math.min(5, Math.floor(f));
      const c = mix(ramp[a], ramp[a + 1], f - a);
      const dx = (L[j * n + Math.min(n - 1, i + 1)] - L[j * n + Math.max(0, i - 1)]) * 6;
      const dy = (L[Math.min(n - 1, j + 1) * n + i] - L[Math.max(0, j - 1) * n + i]) * 6;
      const len = Math.hypot(dx, dy, 1), dot = (-dx * lx - dy * ly + lz) / len;
      const shade = chartTheme ? 0.9 + 0.25 * (dot - 0.6) : 0.78 + 0.6 * (dot - 0.6);
      const p = (j * n + i) * 4;
      img.data[p] = c[0] * shade; img.data[p + 1] = c[1] * shade; img.data[p + 2] = c[2] * shade; img.data[p + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, size, size);

    // 2. isobaths every 0.1 in log-loss; every fourth is an index isobath
    const step = 0.1, levels = [];
    for (let v = Math.ceil(lo / step) * step; v < hi; v += step) levels.push(+v.toFixed(3));
    const s = size / n, dpr = size / 640;
    const path = d3.geoPath(d3.geoTransform({ point(x, y) { this.stream.point(x * s, y * s); } })).context(ctx);
    const contours = d3.contours().size([n, n]).thresholds(levels)(L);
    const lit = css("--isobath-lit"), shade = css("--isobath-shade"), iso = css("--isobath"), idx = css("--isobath-index");
    const o = 0.9 * dpr;
    contours.forEach((c, k) => {
      const index = Math.round(c.value / step) % 4 === 0;
      ctx.lineJoin = "round";
      // Tanaka: a light edge offset toward the light, a dark edge away from it, then the line
      ctx.lineWidth = (index ? 1.6 : 1) * dpr;
      ctx.save(); ctx.translate(-o, -o); ctx.beginPath(); path(c); ctx.strokeStyle = lit; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(o, o); ctx.beginPath(); path(c); ctx.strokeStyle = shade; ctx.stroke(); ctx.restore();
      ctx.beginPath(); path(c); ctx.strokeStyle = index ? idx : iso; ctx.lineWidth = (index ? 1.4 : 0.8) * dpr; ctx.stroke();
    });
    // 3. soundings: label index isobaths with the real loss value, on their longest ring
    ctx.font = `${Math.round(10 * dpr)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    contours.forEach((c) => {
      if (Math.round(c.value / step) % 4 !== 0) return;
      let best = null;
      c.coordinates.forEach((poly) => poly.forEach((ring) => { if (!best || ring.length > best.length) best = ring; }));
      if (!best || best.length < 40) return;
      // first point along the ring that keeps the label clear of the chart edge
      const m = 6, pt = best.slice(Math.floor(best.length * 0.37)).concat(best).find(([x, y]) => x > m && y > m && x < n - m && y < n - m);
      if (!pt) return;
      const [x, y] = pt;
      const label = Math.exp(c.value).toFixed(2);
      const w = ctx.measureText(label).width + 8 * dpr;
      ctx.fillStyle = css("--d5"); ctx.fillRect(x * s - w / 2, y * s - 7 * dpr, w, 14 * dpr);
      ctx.fillStyle = css("--sounding"); ctx.fillText(label, x * s, y * s + 0.5 * dpr);
    });
  }

  function drawRoute(ctx, P, size, progress) {
    const s = size / P.n, dpr = size / 640;
    const cb = rgba(css("--route-basic")), ca = rgba(css("--route-advanced"));
    const colorAt = (d) => mix(cb, ca, Math.min(1, Math.max(0, d / P.total)));
    const until = progress * P.total;
    // dashed: the part still ahead
    ctx.setLineDash([4 * dpr, 5 * dpr]); ctx.lineWidth = 1.6 * dpr;
    for (let i = 1; i < P.pts.length; i++) {
      if (P.cum[i] <= until) continue;
      ctx.beginPath(); ctx.moveTo(P.pts[i - 1][0] * s, P.pts[i - 1][1] * s); ctx.lineTo(P.pts[i][0] * s, P.pts[i][1] * s);
      ctx.strokeStyle = str(colorAt(P.cum[i]), 0.55); ctx.stroke();
    }
    // solid with a soft glow: the part already travelled
    ctx.setLineDash([]); ctx.lineWidth = 2.6 * dpr; ctx.lineCap = "round";
    ctx.shadowBlur = 10 * dpr;
    for (let i = 1; i < P.pts.length && P.cum[i - 1] < until; i++) {
      const c = colorAt(P.cum[i]);
      ctx.shadowColor = str(c, 0.8);
      ctx.beginPath(); ctx.moveTo(P.pts[i - 1][0] * s, P.pts[i - 1][1] * s); ctx.lineTo(P.pts[i][0] * s, P.pts[i][1] * s);
      ctx.strokeStyle = str(c, 1); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // stations
    const now = Math.min(STATIONS - 1, Math.floor(progress * (STATIONS - 1) + 1e-6));
    ctx.font = `${Math.round(10 * dpr)}px "JetBrains Mono", monospace`;
    P.stations.forEach((st, i) => {
      const c = colorAt((i / (STATIONS - 1)) * P.total), r = (i === now ? 6 : 4) * dpr;
      ctx.beginPath(); ctx.arc(st.x * s, st.y * s, r, 0, Math.PI * 2);
      ctx.fillStyle = css("--d6"); ctx.fill();
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = str(c, i <= now ? 1 : 0.6); ctx.stroke();
      if (i === now) { ctx.beginPath(); ctx.arc(st.x * s, st.y * s, 2.4 * dpr, 0, Math.PI * 2); ctx.fillStyle = str(c, 1); ctx.fill(); }
      if ([0, STATIONS - 1, now].includes(i) && !(i !== now && Math.abs(i - now) < 2)) {
        ctx.fillStyle = css("--foam"); ctx.textAlign = "left";
        ctx.fillText(code(i), st.x * s + 10 * dpr, st.y * s - 10 * dpr);
      }
    });
    // the diver
    const d = P.at(until);
    ctx.beginPath(); ctx.arc(d.x * s, d.y * s, 3.4 * dpr, 0, Math.PI * 2);
    ctx.shadowBlur = 16 * dpr; ctx.shadowColor = css("--plankton"); ctx.fillStyle = css("--plankton"); ctx.fill(); ctx.shadowBlur = 0;
    return { now, k: d.k };
  }

  const code = (i) => (i < BASIC ? "B" + String(i).padStart(2, "0") : "A" + String(i - BASIC).padStart(2, "0"));

  window.BathyChart = function (canvas, T, onMove) {
    const P = prepare(T);
    const base = document.createElement("canvas");
    let size = 0, progress = 0;
    function render(rebuild) {
      const w = Math.round(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1));
      if (w !== size || rebuild) {
        size = canvas.width = canvas.height = base.width = base.height = w;
        drawBase(base.getContext("2d"), P, size);
      }
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size); ctx.drawImage(base, 0, 0);
      const r = drawRoute(ctx, P, size, progress);
      if (onMove) {
        const i = Math.min(T.trailLoss.length - 1, Math.max(0, r.k));
        const a = Math.floor(i), b = Math.min(T.trailLoss.length - 1, a + 1);
        const loss = T.trailLoss[a] + (T.trailLoss[b] - T.trailLoss[a]) * (i - a);
        onMove({ station: r.now, code: code(r.now), loss, step: Math.round(i * 10), progress });
      }
    }
    new ResizeObserver(() => render(false)).observe(canvas);
    return {
      set(p) { progress = Math.min(1, Math.max(0, p)); render(false); },
      redraw() { render(true); },
      stations: STATIONS, basic: BASIC, code,
    };
  };
})();
