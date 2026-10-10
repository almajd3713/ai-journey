// The dive: an optional fullscreen mode over the page (see lib/dive.ts). One step is one
// station: a wheel notch, a swipe, an arrow key, or a click on the rail. Esc leaves.
import { useEffect, useRef, useState } from "react";
import { BASIC_COUNT, STATIONS, SITE, assetUrl } from "../lib/content";
import { END, stepBy, stepTo } from "../lib/dive";
import type { Terrain } from "../lib/terrain";
import type { Mode } from "../lib/theme";
import { ModeToggle } from "./Header";
import { Icon } from "./Icon";
import { DiveEnd } from "./Sections";
import { DiveCard } from "./Station";
import { useDive } from "./useDive";

const LEGEND_SEEN = "aij-legend-seen";
const seen = () => { try { return localStorage.getItem(LEGEND_SEEN) === "1"; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(LEGEND_SEEN, "1"); } catch { /* not available */ } };

/** true when the card under the pointer can still scroll that way (then it scrolls, not the dive) */
function cardScrolls(target: EventTarget | null, dir: number) {
  const el = (target as HTMLElement | null)?.closest?.(".dive-panel") as HTMLElement | null;
  if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
  return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
}

function useDiveInput(on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return;
    let acc = 0, lastStep = 0, lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;   // pinch zoom
      const dy = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
      if (cardScrolls(e.target, dy)) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - lastWheel > 180;
      lastWheel = now;
      if (quiet) acc = 0;
      // one gesture is one step: a trackpad's inertia keeps sending events, so wait for a
      // pause in them (or a long gap) before the next step
      if (now - lastStep < 380 || (!quiet && now - lastStep < 1000)) return;
      acc += dy;
      if (Math.abs(acc) > 30) { stepBy(Math.sign(acc)); acc = 0; lastStep = now; }
    };
    let t0: { x: number; y: number; target: EventTarget | null } | null = null;
    const onStart = (e: TouchEvent) => { const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, target: e.target }; };
    const onEnd = (e: TouchEvent) => {
      if (!t0) return;
      const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 48 && !cardScrolls(t0.target, -dy)) stepBy(dy < 0 ? 1 : -1);
      else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) stepBy(dx < 0 ? 1 : -1);
      t0 = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement;
      const onControl = !!el.closest("button, a, input, textarea, select");
      const next = ["ArrowRight", "ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !onControl && !e.shiftKey);
      const prev = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && !onControl && e.shiftKey);
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (next) { e.preventDefault(); stepBy(1); }
      else if (prev) { e.preventDefault(); stepBy(-1); }
      else if (e.key === "Home") { e.preventDefault(); stepTo(0); }
      else if (e.key === "End") { e.preventDefault(); stepTo(END); }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [on, close]);
}

function Legend({ onClose }: { onClose: () => void }) {
  return (
    <div className="dcard card legend-card" role="note" aria-labelledby="legend-t">
      <h2 className="h-3" id="legend-t">How to read the dive</h2>
      <ul className="legend">
        <li><span className="ramp" aria-hidden="true" /><span><strong>Loss is depth.</strong> Light water is a high loss, the abyss a low one.</span></li>
        <li><span className="route route-basic" aria-hidden="true" /><span><strong>Basic route</strong> across the steep shelf; the <strong className="t-adv">advanced route</strong> along the flat floor.</span></li>
        <li><Icon name="sounding" size={22} /><span><strong>Soundings</strong> are measured numbers from the notebooks. <strong>Pings</strong>: guess, then see.</span></li>
        <li><Icon name="trench" size={22} /><span>The sea life is decoration, placed by depth. None of it is data.</span></li>
      </ul>
      <p className="fog small">Scroll, swipe or use ← → to move one station. Esc leaves the dive.</p>
      <button type="button" className="btn btn-glow btn-s chamfer" onClick={onClose}>Start <span className="arr" aria-hidden="true">→</span></button>
    </div>
  );
}

export function Dive({ T, mode, setMode, webgl, onClose, onKit }: {
  T: Terrain | null; mode: Mode; setMode: (m: Mode) => void; webgl: boolean; onClose: () => void; onKit: () => void;
}) {
  const { on, step } = useDive();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [legend, setLegend] = useState(false);
  const [toast, setToast] = useState(false);
  const prev = useRef(step);
  useDiveInput(on, onClose);

  // focus moves into the dive and back to whatever opened it
  useEffect(() => {
    if (on) {
      opener.current = document.activeElement;
      root.current?.focus({ preventScroll: true });
      setLegend(!seen());
    } else if (opener.current instanceof HTMLElement) {
      opener.current.focus({ preventScroll: true });
    }
  }, [on]);

  // crossing the shelf break: the basic course's checkpoint is where the advanced one starts
  useEffect(() => {
    const crossed = prev.current < BASIC_COUNT && step >= BASIC_COUNT && step < END;
    prev.current = step;
    if (!crossed) return;
    setToast(true);
    const id = window.setTimeout(() => setToast(false), 4200);
    return () => clearTimeout(id);
  }, [step]);

  const closeLegend = () => { setLegend(false); markSeen(); };
  const st = STATIONS[Math.min(step, STATIONS.length - 1)];
  const k = T ? T.stations[BASIC_COUNT - 1].k : null;

  return (
    <div className="dive" data-on={on ? "" : undefined} role="dialog" aria-modal="true" aria-label="The dive" aria-hidden={!on} ref={root} tabIndex={-1}>
      <div className="dive-bar">
        <span className="brand">
          <img src={assetUrl("brand/etc-mark.svg")} alt="" width={30} height={30} />
          <span className="az">{SITE.tagline}</span>
        </span>
        <div className="controls">
          <button type="button" className="sq" onClick={() => (legend ? closeLegend() : setLegend(true))} aria-label="How to read the dive" aria-pressed={legend} title="How to read the dive">
            <Icon name="help" />
          </button>
          {webgl && <ModeToggle mode={mode} setMode={setMode} />}
          <button type="button" className="btn btn-line btn-s" onClick={onClose}>
            <Icon name="close" size={16} /> Leave <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      <div className="dive-panel">
        {on && (legend ? <Legend onClose={closeLegend} /> : step === END ? <DiveEnd T={T} onKit={onKit} /> : <DiveCard st={st} />)}
      </div>
      <span className="vh" aria-live="polite">{on ? (step === END ? "Past the last station" : `Station ${st.code}, ${st.title}`) : ""}</span>

      {toast && (
        <div className="dive-toast panel-grad cut" role="status">
          <span className="label">Shelf break · checkpoint saved</span>
          <strong className="az">basic.pt</strong>
          <span>The advanced course resumes training from here{k !== null && T ? ` (step ${Math.round(k)}, loss ${T.lossAt(k).toFixed(4)})` : ""}.</span>
        </div>
      )}

      <nav className="dive-rail" aria-label="Stations">
        <button type="button" className="sq" onClick={() => stepBy(-1)} disabled={step === 0} aria-label="Previous station"><Icon name="arrow-l" size={18} /></button>
        <ol className="ticks">
          {STATIONS.map((s) => (
            <li key={s.id} data-route={s.course} data-shelf={s.i === BASIC_COUNT ? "" : undefined}>
              <button type="button" aria-label={`${s.code}: ${s.title}`} aria-current={s.i === step ? "step" : undefined} data-past={s.i < step ? "" : undefined} onClick={() => stepTo(s.i)}>
                <span className="tick-code">{s.code}</span>
              </button>
            </li>
          ))}
          <li data-end="">
            <button type="button" aria-label="Past the last station: converged?" aria-current={step === END ? "step" : undefined} onClick={() => stepTo(END)}>
              <span className="tick-code">End</span>
            </button>
          </li>
        </ol>
        <button type="button" className="sq" onClick={() => stepBy(1)} disabled={step === END} aria-label="Next station"><Icon name="arrow-r" size={18} /></button>
      </nav>
    </div>
  );
}
