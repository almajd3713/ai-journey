// Small SVG charts for the explorables. Plain SVG, no dependencies: every point drawn is a number from the data file.
import type { ReactNode } from "react";

const W = 360, H = 200, PAD = { l: 44, r: 12, t: 12, b: 30 };

export function scale(lo: number, hi: number, a: number, b: number, log = false) {
  const f = log ? Math.log10 : (x: number) => x;
  const l = f(lo), h = f(hi);
  return (x: number) => a + ((f(x) - l) / (h - l || 1)) * (b - a);
}

const ticks = (lo: number, hi: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(0) : String(+v.toFixed(2)));

export interface Series { ys: (number | null)[]; color: string; label?: string; dash?: boolean }

/** lines over x values, with an optional vertical marker at one x */
export function LineChart({ xs, series, mark, logx = false, logy = false, ylim, xlabel, ylabel, ariaLabel }: {
  xs: number[]; series: Series[]; mark?: number; logx?: boolean; logy?: boolean; ylim?: [number, number]; xlabel?: string; ylabel?: string; ariaLabel: string;
}) {
  const all = series.flatMap((s) => s.ys.filter((v): v is number => v !== null && (!logy || v > 0)));
  const lo = ylim?.[0] ?? Math.min(...all), hi = ylim?.[1] ?? Math.max(...all);
  const sx = scale(Math.min(...xs), Math.max(...xs), PAD.l, W - PAD.r, logx), sy = scale(lo, hi, H - PAD.b, PAD.t, logy);
  const yt = logy ? [lo, Math.sqrt(lo * hi), hi] : ticks(lo, hi);
  const xt = logx ? xs.filter((_, i) => i % Math.ceil(xs.length / 5) === 0) : ticks(Math.min(...xs), Math.max(...xs));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {yt.map((v) => <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="grid" /><text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="tick">{fmt(v)}</text></g>)}
      {xt.map((v) => <text key={v} x={sx(v)} y={H - PAD.b + 14} textAnchor="middle" className="tick">{fmt(v)}</text>)}
      {series.map((s, k) => {
        const pts = xs.map((x, i) => [x, s.ys[i]] as const).filter(([, y]) => y !== null && (!logy || (y as number) > 0)).map(([x, y]) => `${sx(x).toFixed(1)},${sy(Math.min(hi, Math.max(lo, y as number))).toFixed(1)}`);
        return <polyline key={k} points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={1.8} strokeDasharray={s.dash ? "4 3" : undefined} />;
      })}
      {mark !== undefined && <line x1={sx(mark)} x2={sx(mark)} y1={PAD.t} y2={H - PAD.b} className="mark" />}
      {mark !== undefined && series.map((s, k) => {
        const i = xs.indexOf(mark), y = s.ys[i];
        return y !== null && y !== undefined ? <circle key={k} cx={sx(mark)} cy={sy(Math.min(hi, Math.max(lo, y)))} r={4} fill={s.color} /> : null;
      })}
      {xlabel && <text x={W / 2} y={H - 4} textAnchor="middle" className="axis">{xlabel}</text>}
      {ylabel && <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} className="axis">{ylabel}</text>}
    </svg>
  );
}

/** vertical bars with labels under them; one bar can be highlighted */
export function Bars({ labels, values, color, hi, max, ariaLabel, valueFmt }: {
  labels: string[]; values: number[]; color: string; hi?: number; max?: number; ariaLabel: string; valueFmt?: (v: number) => string;
}) {
  const top = max ?? Math.max(...values, 1e-9), bw = (W - PAD.l - PAD.r) / values.length;
  const sy = scale(0, top, H - PAD.b, PAD.t);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {ticks(0, top).map((v) => <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="grid" /><text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="tick">{fmt(v)}</text></g>)}
      {values.map((v, i) => (
        <g key={i}>
          <rect x={PAD.l + i * bw + bw * 0.12} width={bw * 0.76} y={sy(v)} height={Math.max(0, H - PAD.b - sy(v))} fill={color} opacity={hi === undefined || hi === i ? 1 : 0.4} />
          {values.length <= 14 && <text x={PAD.l + (i + 0.5) * bw} y={H - PAD.b + 13} textAnchor="middle" className="tick" transform={values.length > 8 ? `rotate(-35 ${PAD.l + (i + 0.5) * bw} ${H - PAD.b + 13})` : undefined}>{labels[i]}</text>}
          {hi === i && <text x={PAD.l + (i + 0.5) * bw} y={sy(v) - 4} textAnchor="middle" className="tick strong">{valueFmt ? valueFmt(v) : fmt(v)}</text>}
        </g>
      ))}
    </svg>
  );
}

/** a square grid of 0/1 cells (a decision boundary) with labelled points on top */
export function GridMap({ cells, n, xr, yr, points, ariaLabel, children }: {
  cells: string; n: number; xr: [number, number]; yr: [number, number]; points: number[][]; ariaLabel: string; children?: ReactNode;
}) {
  const S = 260, cs = S / n;
  const px = scale(xr[0], xr[1], 0, S), py = scale(yr[0], yr[1], S, 0);
  return (
    <svg className="chart map" viewBox={`0 0 ${S} ${S}`} role="img" aria-label={ariaLabel}>
      {Array.from(cells).map((c, i) => <rect key={i} x={(i % n) * cs} y={S - (Math.floor(i / n) + 1) * cs} width={cs + 0.4} height={cs + 0.4} className={c === "1" ? "cell-1" : "cell-0"} />)}
      {points.map(([x, y, l], i) => <circle key={i} cx={px(x)} cy={py(y)} r={2.6} className={l ? "pt-1" : "pt-0"} />)}
      {children}
    </svg>
  );
}
