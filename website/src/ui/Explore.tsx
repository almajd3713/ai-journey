import { useEffect, useState, type ReactNode } from "react";
import { assetUrl } from "../lib/content";
import { Html } from "./Station";
import { Bars, GridMap, LineChart } from "./Charts";

/** A kernel-free explorable: one slider over a grid of results measured by the course's own notebooks (content in public/explorables). */
interface Explorable {
  id: string; title: string; intro: string;
  control: { label: string; values: number[]; format: string; mark?: { value: number; label: string } };
  columns?: string[]; rows?: number[][];
  [k: string]: unknown;
}

const show = (v: number, f: string) =>
  f === "0.00" ? v.toFixed(2) : f === "0" ? String(v) : f === "e" ? v.toExponential(1) : String(v);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function useExplorable(id: string) {
  const [data, setData] = useState<Explorable | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setData(null); setError(false);
    fetch(assetUrl(`explorables/${id}.json`)).then((r) => r.json()).then(setData).catch(() => setError(true));
  }, [id]);
  return { data, error };
}

export function ExplorableCard({ id }: { id: string }) {
  const { data, error } = useExplorable(id);
  const [i, setI] = useState<number | null>(null);
  if (error) return <p className="fog small">This explorable could not be loaded.</p>;
  if (!data) return <p className="fog small">Loading…</p>;
  const c = data.control;
  const nearest = c.mark ? c.values.reduce((b, v, k) => (Math.abs(v - c.mark!.value) < Math.abs(c.values[b] - c.mark!.value) ? k : b), 0) : -1;
  const idx = i ?? (nearest >= 0 ? nearest : Math.floor(c.values.length / 2));
  const marked = nearest >= 0 && idx === nearest;
  return (
    <section className="explore" aria-label={data.title}>
      <h3 className="h-4">{data.title}</h3>
      <Html as="p" className="fog small" s={data.intro} />
      <label className="slider">
        <span className="label label-s">{c.label}</span>
        <input type="range" min={0} max={c.values.length - 1} step={1} value={idx} onChange={(e) => setI(+e.target.value)} aria-valuetext={`${c.label} ${show(c.values[idx], c.format)}`} />
        <strong className="mono">{show(c.values[idx], c.format)}</strong>
      </label>
      {c.mark && <p className="small mark-note" data-on={marked ? "" : undefined}>{marked ? "★ " : ""}{c.mark.label}: {c.mark.value}</p>}
      <div className="explore-body">{render(data, idx)}</div>
      <p className="fog small">Every number here was measured by running the notebook's own code on the saved data; nothing is drawn by hand.</p>
    </section>
  );
}

const Readout = ({ items }: { items: [string, string][] }) => (
  <dl className="readout">{items.map(([a, b]) => <div key={a}><dt>{a}</dt><dd className="mono">{b}</dd></div>)}</dl>
);

function render(d: Explorable, i: number): ReactNode {
  const v = d.control.values, rows = (d.rows ?? []) as number[][];
  switch (d.id) {
    case "b04-threshold": {
      const [tp, fp, fn, tn] = rows[i];
      const precision = tp + fp ? tp / (tp + fp) : NaN, recall = tp / (tp + fn);
      return (
        <>
          <table className="cm" aria-label="Confusion matrix on the validation set">
            <thead><tr><th /><th>flagged malignant</th><th>cleared</th></tr></thead>
            <tbody>
              <tr><th>really malignant ({tp + fn})</th><td className="good">{tp}</td><td className="bad">{fn}</td></tr>
              <tr><th>really benign ({fp + tn})</th><td className="bad">{fp}</td><td className="good">{tn}</td></tr>
            </tbody>
          </table>
          <Readout items={[["precision", Number.isNaN(precision) ? "no cases flagged" : pct(precision)], ["recall", pct(recall)], ["malignant cases missed", `${fn} of ${tp + fn}`], ["benign cases flagged", `${fp} of ${fp + tn}`]]} />
        </>
      );
    }
    case "b06-descent": {
      const [w0, w1, b, loss, acc] = rows[i], pts = d.points as number[][];
      const S = 260, px = (x: number) => ((x + 2.5) / 5) * S, py = (y: number) => S - ((y + 2.5) / 5) * S;
      const line = Math.abs(w1) > 1e-6 ? [-2.5, 2.5].map((x) => [x, -(w0 * x + b) / w1]) : null;
      return (
        <>
          <svg className="chart map" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="The boundary of the unit on the 100 flowers">
            {pts.map(([x, y, l], k) => <circle key={k} cx={px(x)} cy={py(y)} r={3} className={l ? "pt-1" : "pt-0"} />)}
            {line && <line x1={px(line[0][0])} y1={py(line[0][1])} x2={px(line[1][0])} y2={py(line[1][1])} className="boundary" />}
            <rect x={0} y={0} width={S} height={S} className="frame" />
          </svg>
          <Readout items={[["weights", `[${w0.toFixed(2)}, ${w1.toFixed(2)}], bias ${b.toFixed(2)}`], ["loss", loss.toFixed(3)], ["accuracy", pct(acc)]]} />
        </>
      );
    }
    case "b07-learning-rate": {
      const cu = (d.curves as { loss: number[]; val_loss: number[]; val_accuracy: number }[])[i];
      return (
        <>
          <LineChart xs={cu.loss.map((_, k) => k + 1)} series={[{ ys: cu.loss, color: "var(--signal)" }, { ys: cu.val_loss, color: "#CF6E14" }]} ylim={[0, 1.5]} xlabel="epoch (green: training loss, orange: validation loss)" ariaLabel="Training and validation loss per epoch" />
          <Readout items={[["final training loss", cu.loss[cu.loss.length - 1].toFixed(3)], ["final validation loss", cu.val_loss[cu.val_loss.length - 1].toFixed(3)], ["validation accuracy", pct(cu.val_accuracy)]]} />
        </>
      );
    }
    case "b07-l2": case "b03-knn-k": {
      const fr = (d.frames as { boundary: string; train_loss?: number; val_loss?: number; val_accuracy?: number; train_accuracy?: number; test_accuracy?: number }[])[i];
      const xr = (d.xrange as [number, number] | undefined) ?? (d.range as [number, number]), yr = (d.yrange as [number, number] | undefined) ?? xr;
      return (
        <>
          <GridMap cells={fr.boundary} n={d.grid as number} xr={xr} yr={yr} points={d.points as number[][]} ariaLabel="The decision regions on the plane" />
          <Readout items={d.id === "b03-knn-k" ? [["training accuracy", pct(fr.train_accuracy!)], ["test accuracy", pct(fr.test_accuracy!)]] : [["training loss", fr.train_loss!.toFixed(3)], ["validation loss", fr.val_loss!.toFixed(3)], ["validation accuracy", pct(fr.val_accuracy!)]]} />
        </>
      );
    }
    case "a01-dk": {
      const col = (j: number) => rows.map((r) => r[j]);
      return (
        <>
          <div className="two">
            <LineChart xs={v} logx mark={v[i]} series={[{ ys: col(1), color: "#CF6E14", label: "unscaled" }, { ys: col(3), color: "var(--signal)", label: "scaled" }]} ylim={[0, 1]} xlabel="key size (orange: unscaled, green: scaled)" ylabel="largest weight" ariaLabel="Largest softmax weight against key size" />
            <LineChart xs={v} logx mark={v[i]} series={[{ ys: col(2), color: "#CF6E14" }, { ys: col(4), color: "var(--signal)" }]} ylim={[0, 0.3]} xlabel="key size" ylabel="gradient size" ariaLabel="Softmax gradient size against key size" />
          </div>
          <Readout items={[["spread of the raw scores", rows[i][0].toFixed(1)], ["largest weight, unscaled / scaled", `${rows[i][1].toFixed(3)} / ${rows[i][3].toFixed(3)}`], ["gradient size, unscaled / scaled", `${rows[i][2].toFixed(3)} / ${rows[i][4].toFixed(3)}`]]} />
        </>
      );
    }
    case "a03-temperature": case "a03-top-p": {
      const fr = (d.frames as { top: number[]; kept: number; entropy_bits: number; samples: string[] }[])[i];
      return (
        <>
          <Bars labels={(d.tokens as string[]).map((t) => JSON.stringify(t).slice(1, -1))} values={fr.top} color="var(--signal)" max={1} ariaLabel="Probabilities of the twelve likeliest next tokens" valueFmt={(x) => x.toFixed(2)} />
          <Readout items={[["tokens kept", String(fr.kept)], ["entropy of what is sampled from", `${fr.entropy_bits} bits`]]} />
          <ol className="samples">{fr.samples.map((s, k) => <li key={k}>…{s}</li>)}</ol>
        </>
      );
    }
    case "a05-budget": {
      const r = rows[i];
      return (
        <>
          <LineChart xs={v.map((c) => Math.log10(c))} mark={Math.log10(v[i])} series={[{ ys: rows.map((x) => x[0]), color: "var(--signal)" }, { ys: rows.map((x) => x[1]), color: "#CF6E14" }]} xlabel="log10 compute (green: parameters, orange: tokens)" ariaLabel="Best model size and tokens against compute" />
          <Readout items={[["best parameters N", `${(10 ** r[0] / 1e6).toFixed(2)}M`], ["tokens D", `${(10 ** r[1] / 1e6).toFixed(0)}M`], ["tokens per parameter", r[3].toFixed(0)], ["predicted loss", r[2].toFixed(2)], ["inside the 37M tokens we trained on?", r[4] ? "yes" : "no, an extrapolation"]]} />
        </>
      );
    }
    case "a09-batch": {
      const r = rows[i];
      return (
        <>
          <div className="two">
            <Bars labels={v.map(String)} values={rows.map((x) => x[1])} color="var(--signal)" hi={i} ariaLabel="Tokens per second for all requests" valueFmt={(x) => x.toFixed(0)} />
            <Bars labels={v.map(String)} values={rows.map((x) => x[0])} color="#CF6E14" hi={i} ariaLabel="Seconds each request waits for 100 tokens" valueFmt={(x) => x.toFixed(1)} />
          </div>
          <Readout items={[["time for 100 tokens", `${r[0]} s`], ["tokens/s, all requests", String(r[1])], ["tokens/s, each request", String(r[2])]]} />
        </>
      );
    }
    case "a11-tweaks": {
      const r = rows[i];
      return (
        <>
          <LineChart xs={v} mark={v[i]} series={[{ ys: rows.map((x) => x[0]), color: "#CF6E14" }, { ys: rows.map((x) => x[1]), color: "var(--signal)" }, { ys: rows.map((x) => x[2]), color: "#9AABAE", dash: true }]} ylim={[0, 0.7]} xlabel="tweaks tried" ylabel="false discoveries" ariaLabel="Share of studies with a false discovery against the number of tweaks" />
          <Readout items={[["orange: studies with a false discovery", pct(r[0])], ["green: with Bonferroni", pct(r[1])], ["grey dashed: independent-test formula", pct(r[2])]]} />
        </>
      );
    }
    default: return <p className="fog small">No view for this explorable.</p>;
  }
}
