// The fixed background: the 3D seafloor when WebGL is available and wanted, otherwise the
// 2D chart. The 3D chunk loads lazily; the 2D chart shows until it is ready.
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { BathyChart } from "../lib/chart2d";
import { dive, onDive } from "../lib/dive";
import { STATIONS } from "../lib/content";
import type { Terrain } from "../lib/terrain";
import type { Mode, Theme } from "../lib/theme";

const Scene = lazy(() => import("../scene/Scene"));

class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Flat({ T, theme }: { T: Terrain; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<BathyChart | null>(null);
  useEffect(() => {
    const c = new BathyChart(ref.current!, T);
    chart.current = c;
    c.set(dive.p);
    const off = onDive(() => c.set(dive.p));
    return () => { off(); c.destroy(); };
  }, [T]);
  useEffect(() => { chart.current?.redraw(); }, [theme]);
  return <canvas ref={ref} className="flat-chart" aria-hidden="true" />;
}

export function Backdrop({ T, mode, theme, onFail, onSlow }: {
  T: Terrain | null; mode: Mode; theme: Theme; onFail: () => void; onSlow: () => void;
}) {
  const tag = useRef<HTMLDivElement>(null);
  const [station, setStation] = useState(0);
  useEffect(() => onDive(() => setStation((s) => (s === dive.station ? s : dive.station))), []);
  if (!T) return <div className="backdrop" aria-hidden="true" />;
  const st = STATIONS[station];
  return (
    <div className="backdrop" aria-hidden="true" data-mode={mode}>
      {mode === "3d" ? (
        <Guard onError={onFail}>
          <Suspense fallback={<Flat T={T} theme={theme} />}>
            <Scene T={T} theme={theme} tagRef={tag} onSlow={onSlow} />
          </Suspense>
        </Guard>
      ) : (
        <Flat T={T} theme={theme} />
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
