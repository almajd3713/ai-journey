// "How this chart was made": the chart with its other slices and the other dives, the
// steps that made it, and what it does not show.
import { useEffect, useMemo, useRef, useState } from "react";
import { STATIONS } from "../lib/content";
import { BathyChart } from "../lib/chart2d";
import { enterDive } from "../lib/dive";
import { loadSlices, runGrid, type Run, type SliceSet } from "../lib/slices";
import type { Terrain } from "../lib/terrain";
import { Icon } from "./Icon";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt = (v: number) => (v >= 0.01 ? v.toFixed(3) : v.toPrecision(2));
const MAIN_LR = 0.05;

/** The true loss of every run, step by step (log scale). Only real runs; the chart's own
 *  run is the green line. Hover reads every run at one step. */
function RunCurves({ T, runs }: { T: Terrain; runs: Run[] }) {
  const all = useMemo(() => [{ lr: MAIN_LR, trueLoss: T.meta.trueLoss, onChart: true, main: true }, ...runs.map((r) => ({ ...r, main: false }))]
    .sort((a, b) => a.lr - b.lr), [T, runs]);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const W = 600, H = 250, L = 46, R = 104, Tp = 12, B = 30;
  const lo = Math.floor(Math.log10(Math.min(...all.map((r) => Math.min(...r.trueLoss))))), hi = 0;
  const x = (k: number) => L + (k / 500) * (W - L - R);
  const y = (v: number) => Tp + ((hi - Math.log10(v)) / (hi - lo)) * (H - Tp - B);
  const path = (ls: number[]) => ls.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("");
  // direct labels at the right end, pushed apart where they would collide
  const ends = all.map((r) => ({ r, y: y(r.trueLoss[500]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
  const cls = (r: { main: boolean; onChart: boolean }) => (r.main ? "main" : r.onChart ? "on" : "off");
  const onMove = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const k = Math.round((((e.clientX - rect.left) / rect.width) * W - L) / (W - L - R) * 500);
    setHover(k >= 0 && k <= 500 ? k : null);
  };
  return (
    <div className="curves">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="True training loss of each run over 500 steps, log scale"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).map((d) => (
          <g key={d} className="grid">
            <line x1={L} x2={W - R} y1={y(10 ** d)} y2={y(10 ** d)} />
            <text x={L - 6} y={y(10 ** d) + 4} textAnchor="end">{d === 0 ? "1" : `10${String(d).replace("-", "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c])}`}</text>
          </g>
        ))}
        {[0, 100, 200, 300, 400, 500].map((k) => <text key={k} className="tick" x={x(k)} y={H - 10} textAnchor="middle">{k}</text>)}
        {all.map((r) => <path key={r.lr} d={path(r.trueLoss)} className={`run ${cls(r)}`} />)}
        {ends.map(({ r, y: ly }) => (
          <text key={r.lr} x={W - R + 6} y={ly + 4} className={`end ${cls(r)}`}>lr {r.lr}{r.main ? " · chart" : ""}</text>
        ))}
        {hover !== null && (
          <g className="hover">
            <line x1={x(hover)} x2={x(hover)} y1={Tp} y2={H - B} />
            {all.map((r) => <circle key={r.lr} cx={x(hover)} cy={y(r.trueLoss[hover])} r={3} className={cls(r)} />)}
          </g>
        )}
        <text className="tick" x={L} y={H - 10} textAnchor="start" dx={-40}>step</text>
      </svg>
      {hover !== null && (
        <div className="curves-tip mono" style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > 300 ? "translateX(calc(-100% - 8px))" : undefined }}>
          <strong>step {hover}</strong>
          {all.map((r) => <span key={r.lr}>lr {r.lr}: {fmt(r.trueLoss[hover])}</span>)}
        </div>
      )}
    </div>
  );
}

export function Method({ T }: { T: Terrain | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<BathyChart | null>(null);
  const [set, setSet] = useState<SliceSet | null>(null);
  const [view, setView] = useState("chart");
  const [ghosts, setGhosts] = useState(false);
  useEffect(() => { if (T) loadSlices(T).then(setSet).catch((e) => console.error("slices", e)); }, [T]);
  const slice = set?.slices.find((s) => s.id === view);
  const cur = view === "chart" ? T : slice?.T ?? null;

  useEffect(() => {
    if (!cur || !canvas.current) return;
    const c = new BathyChart(canvas.current, cur, { labels: view === "chart" ? "all" : "few", names: view === "chart" });
    c.set(STATIONS.length - 1);
    chart.current = c;
    return () => { c.destroy(); chart.current = null; };
  }, [cur, view]);
  useEffect(() => {
    if (!chart.current || !set || !T) return;
    chart.current.setGhosts(ghosts && view === "chart" ? set.runs.filter((r) => r.onChart).map((r) => ({ pts: runGrid(T, r), label: `lr ${r.lr}` })) : []);
  }, [ghosts, set, view, T, cur]);

  const m = T?.meta;
  const chartPct = m ? m.explained[0] + m.explained[1] : null;
  const onRuns = set?.runs.filter((r) => r.onChart) ?? [];
  return (
    <section className="sec solid" id="method" aria-labelledby="method-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label"><Icon name="gauge" size={16} /> How this chart was made</span>
          <h2 className="az h-1" id="method-t">The ground is real</h2>
        </div>
        <div className="method">
          <figure className="chart">
            <div className="chart-tools">
              <div className="learn-row" role="radiogroup" aria-label="Slice through the network's weights">
                <button type="button" role="radio" className="chip" aria-checked={view === "chart"} onClick={() => setView("chart")}>
                  The chart{chartPct ? ` · ${pct(chartPct)}` : ""}
                </button>
                {set?.slices.map((s) => (
                  <button key={s.id} type="button" role="radio" className="chip" aria-checked={view === s.id} onClick={() => setView(s.id)}>
                    {s.id === "pc1-pc3" ? "PC1 × PC3" : "Random"} · {pct(s.moved)}
                  </button>
                ))}
              </div>
              {view === "chart" && onRuns.length > 0 && (
                <button type="button" className="chip" aria-pressed={ghosts} onClick={() => setGhosts(!ghosts)}>
                  {ghosts ? "Hide" : "Show"} other dives
                </button>
              )}
            </div>
            <canvas
              ref={canvas}
              role="img"
              aria-label={view === "chart"
                ? "Bathymetric chart of the loss surface with the 27 stations along the training path; click a station to dive there"
                : `The loss surface on another slice: ${slice?.label ?? ""}`}
              onClick={(e) => { if (view !== "chart") return; const i = chart.current?.hit(e.clientX, e.clientY) ?? -1; if (i >= 0) enterDive(i); }}
            />
            <figcaption>
              {view === "chart" ? (
                <span>The chart: the two directions that hold {chartPct ? pct(chartPct) : "99.9%"} of the path's movement{ghosts ? ". Dotted: other learning rates that stay in this plane" : ""}.</span>
              ) : slice?.id === "pc1-pc3" ? (
                <span>The first and third directions: still {pct(slice.moved)} of the movement (the first carries most of it), but another view of the same minimum.</span>
              ) : slice ? (
                <span>Two random directions through the same final weights: {pct(slice.moved)} of the path's movement. A landscape picture depends on the slice it shows.</span>
              ) : null}
              <span>Session 6 · XOR network · {m ? m.params : 17} parameters · isobaths every 0.25 in ln(loss)</span>
            </figcaption>
          </figure>
          <div className="method-text">
            <ol className="steps">
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Train the real network</span>
                <p className="s">Basic Session 6's XOR network: 2 inputs, 4 tanh units, a sigmoid output, Adam at 0.05 for 500 epochs, seed 42. The script reproduces the notebook's printed losses exactly (0.760, 0.025, 0.00229) and saves the weights after every step.</p>
              </div></li>
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Find the plane of the path</span>
                <p className="s">Principal component analysis of the weights along the way (minus the final weights) gives the two directions the training moved in most. They hold {chartPct ? pct(chartPct) : "99.9%"} of the path's movement (Li et al., 2018).</p>
              </div></li>
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Measure the loss on a grid</span>
                <p className="s">The true training loss at {m ? `${m.n} × ${m.n}` : "257 × 257"} points of that plane, centred on the final weights. Depth is the logarithm of the loss, so each isobath is the same ratio of loss.</p>
              </div></li>
              <li className="st" data-state="now"><span className="dot" /><span className="bar" /><div>
                <span className="t">Place the stations</span>
                <p className="s">The path is the training run projected onto the plane. The 27 stations are spaced evenly along it, so the basic course covers the steep fall and the advanced course the long floor.</p>
              </div></li>
            </ol>

            {set && T && (
              <div className="dives">
                <span className="label label-s">Other dives: the same network at other learning rates</span>
                <p className="small fog">
                  Same data, seed and starting weights. A run is drawn on the chart only if it stays in the chart's plane: at least {pct(set.fitMin)} of
                  its movement in the plane, and the surface under its path within {set.depthMax} of its true ln(loss) at every step.
                </p>
                <RunCurves T={T} runs={set.runs} />
                <table className="runs">
                  <thead><tr><th scope="col">lr</th><th scope="col">loss after 500</th><th scope="col">in the plane</th><th scope="col">on the chart?</th></tr></thead>
                  <tbody>
                    {[...set.runs, { lr: MAIN_LR, fit: chartPct ?? 0.999, depthErr: 0, onChart: true, trueLoss: T.meta.trueLoss }].sort((a, b) => a.lr - b.lr).map((r) => (
                      <tr key={r.lr} data-main={r.lr === MAIN_LR ? "" : undefined}>
                        <td className="mono">{r.lr}</td>
                        <td className="mono">{fmt(r.trueLoss[500])}</td>
                        <td className="mono">{pct(r.fit)}</td>
                        <td>{r.lr === MAIN_LR ? "the chart's own run" : r.onChart ? `yes (depth within ${r.depthErr})` : `no: depth off by up to ${r.depthErr}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel panel-line honest">
              <span className="label label-s">What the chart does not show</span>
              <p className="small">
                The plane is 2 of the network's 17 dimensions. The line is drawn on the surface at the projected point, while the depth gauge shows
                the network's true loss at that step: at step 0 the surface reads {T ? T.meta.trailSurfaceLoss[0].toFixed(3) : "0.693"} and the true loss
                is {T ? T.meta.trueLoss[0].toFixed(3) : "0.760"}. Stations mark sessions, not training steps: no session trains this network. The island's
                outline is a crop around the route, not data: the measured square goes on under the water. The place names mark features the surface
                and the run really have; the plants and animals are decoration, placed by depth as in a real sea.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
