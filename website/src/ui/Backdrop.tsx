// The fixed background: the 3D seafloor when WebGL is available and wanted, otherwise the
// 2D chart. The 3D chunk loads lazily; the 2D chart shows until it is ready.
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BathyChart } from "../lib/chart2d";
import { dive, onDive } from "../lib/dive";
import { onLearners } from "../lib/learner";
import { setPicker } from "../lib/pick";
import { DriftField, STREAK, driftOn, glow, onDrift } from "../lib/drift";
import { token } from "../lib/theme";
import { toponyms } from "../lib/toponyms";
import { STATIONS } from "../lib/content";
import type { Terrain } from "../lib/terrain";
import type { Mode } from "../lib/theme";

const Scene = lazy(() => import("../scene/Scene"));

class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Flat({ T }: { T: Terrain }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<BathyChart | null>(null);
  useEffect(() => {
    const c = new BathyChart(ref.current!, T);
    chart.current = c;
    c.set(dive.p);
    const off = onDive(() => c.set(dive.p));
    const offL = onLearners(() => c.set(dive.p));
    setPicker((x, y) => c.gridAt(x, y));
    return () => { off(); offL(); setPicker(null); c.destroy(); };
  }, [T]);
  return (
    <>
      <canvas ref={ref} className="flat-chart" aria-hidden="true" />
      <FlatDrift T={T} under={ref} />
    </>
  );
}

/** The drift over the flat chart: a canvas on top of it, with fading streaks. */
function FlatDrift({ T, under }: { T: Terrain; under: RefObject<HTMLCanvasElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(driftOn());
  useEffect(() => onDrift(() => setShown(driftOn())), []);
  useEffect(() => {
    if (!shown) return;
    const cv = ref.current!, base = under.current!;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const f = new DriftField(T, window.innerWidth < 700 ? 500 : 1200);
    const color = token("--plankton");
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // a tool for the flat chart: not while diving, nor when the hero is out of sight
      if (dive.on || window.scrollY > window.innerHeight) { ctx.clearRect(0, 0, cv.width, cv.height); raf = requestAnimationFrame(frame); return; }
      if (cv.width !== base.width) { cv.width = cv.height = base.width; }
      const s = cv.width / T.n;
      f.step(dt);
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.86)";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, cv.width / 640);
      for (let i = 0; i < f.count; i++) {
        const tail = f.speed[i] * STREAK;
        ctx.globalAlpha = glow(f.life[i]) * 0.8;
        ctx.beginPath();
        ctx.moveTo((f.x[i] + 0.5) * s, (f.y[i] + 0.5) * s);
        ctx.lineTo((f.x[i] - f.dx[i] * tail + 0.5) * s, (f.y[i] - f.dy[i] * tail + 0.5) * s);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, cv.width, cv.height); };
  }, [shown, T, under]);
  return <canvas ref={ref} className="flat-chart flat-drift" aria-hidden="true" style={{ display: shown ? undefined : "none" }} />;
}

export function Backdrop({ T, mode, active, onFail, onSlow }: {
  T: Terrain | null; mode: Mode; active: boolean; onFail: () => void; onSlow: () => void;
}) {
  const tag = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const [station, setStation] = useState(0);
  useEffect(() => onDive(() => setStation((s) => (s === dive.station ? s : dive.station))), []);
  if (!T) return <div className="backdrop" aria-hidden="true" />;
  const st = STATIONS[station];
  return (
    <div className="backdrop" aria-hidden="true" data-mode={mode}>
      {mode === "3d" ? (
        <Guard onError={onFail}>
          <Suspense fallback={<Flat T={T} />}>
            <Scene T={T} active={active} tagRef={tag} namesRef={names} onSlow={onSlow} />
          </Suspense>
        </Guard>
      ) : (
        <Flat T={T} />
      )}
      {mode === "3d" && (
        <div className="names" ref={names}>
          {toponyms(T).map((t) => (
            <span key={t.id} className="name"><span className="nm">{t.name}</span><span className="sub">{t.sub}</span></span>
          ))}
        </div>
      )}
      {mode === "3d" && (
        <div className="tag" ref={tag} data-route={st.course}>
          <span className="code">{st.code}</span>
          <span className="t">{st.title}</span>
        </div>
      )}
      <div className="veil" />
    </div>
  );
}
