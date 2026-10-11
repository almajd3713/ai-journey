// The hero's "drop a learner" panel (lib/learner.ts). Clicking the island, anywhere outside
// the text, starts a learner there with the chosen optimiser.
import { useEffect, useState, useSyncExternalStore } from "react";
import { islandOf } from "../lib/island";
import { OPTS, SCALES, clearLearners, dropLearner, getLearners, learnerColor, learnersVersion, onLearners, type Opt } from "../lib/learner";
import { pick } from "../lib/pick";
import { driftOn, onDrift, setDrift } from "../lib/drift";
import type { Terrain } from "../lib/terrain";
import { ISLAND_S } from "../lib/island";

const scaleLabel = (s: number) => (s === 1 ? "×1" : s < 1 ? "×¼" : `×${s}`);

export function LearnerPanel({ T }: { T: Terrain }) {
  const [opt, setOpt] = useState<Opt>("adam");
  const [scale, setScale] = useState<number>(1);
  useSyncExternalStore(onLearners, learnersVersion, learnersVersion);
  const drift = useSyncExternalStore(onDrift, driftOn, driftOn);
  const list = getLearners();
  const L = list[list.length - 1];

  useEffect(() => {
    const hero = document.getElementById("surface");
    if (!hero) return;
    const I = islandOf(T);
    const toWorld = (g: number) => (g / (T.n - 1) - 0.5) * ISLAND_S;
    const onIsland = (gx: number, gy: number) => I.mainAt(toWorld(gx), toWorld(gy)) > 0;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a, button, input, .hero-col, .learn, .hero-depth")) return;
      const g = pick(e.clientX, e.clientY);
      if (g && onIsland(g[0], g[1])) dropLearner(T, g[0], g[1], opt, scale, onIsland);
    };
    hero.addEventListener("click", onClick);
    return () => hero.removeEventListener("click", onClick);
  }, [T, opt, scale]);

  return (
    <aside className="learn card" aria-label="Drop a learner">
      <div className="learn-head">
        <span className="label label-s">Drop a learner</span>
        <button type="button" className="chip" aria-pressed={drift} onClick={() => setDrift(!drift)} title="Streaks that flow down the surface the steepest way, faster where it is steeper">
          {drift ? "Hide" : "Show"} the drift
        </button>
      </div>
      <p className="small learn-hint">Click anywhere on the island: a learner runs gradient descent from there, on this surface.</p>
      <div className="learn-row" role="radiogroup" aria-label="Optimiser">
        {(Object.keys(OPTS) as Opt[]).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={opt === o} className="chip" onClick={() => setOpt(o)} title={OPTS[o].note}>
            <span className="swatch" style={{ background: learnerColor(o) }} aria-hidden="true" />{OPTS[o].name}
          </button>
        ))}
      </div>
      <div className="learn-row" role="radiogroup" aria-label="Learning rate">
        <span className="fog small">lr {+(OPTS[opt].lr * scale).toFixed(4)}</span>
        {SCALES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={scale === s} className="chip" onClick={() => setScale(s)}>{scaleLabel(s)}</button>
        ))}
      </div>
      <p className="mono small learn-read" aria-live="polite">
        {L
          ? `${OPTS[L.opt].name} · step ${L.pts.length - 1} · loss ${L.loss[L.loss.length - 1].toPrecision(3)}${L.state === "off" ? " · left the chart" : L.state === "done" ? " · 500 steps" : ""}`
          : "No learner yet."}
        {list.length > 0 && <> <button type="button" className="linkish" onClick={clearLearners}>Clear</button></>}
      </p>
      <p className="fog learn-note">A toy: it walks this 2D slice only. The real training moved in all 17 dimensions.</p>
    </aside>
  );
}
