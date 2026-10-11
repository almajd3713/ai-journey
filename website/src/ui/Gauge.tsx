// The depth gauge: the club's right-hand depth rail, extended with a live readout of the
// real training run. It updates from the dive state without React re-renders.
import { useEffect, useRef } from "react";
import { STATIONS, ZONES, zoneOf } from "../lib/content";
import { dive, onDive } from "../lib/dive";
import { getLog, markVisited } from "../lib/log";
import { STATION_COUNT, distOf, type Terrain } from "../lib/terrain";


export function Gauge({ T }: { T: Terrain | null }) {
  const root = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLSpanElement>(null);
  const loss = useRef<HTMLSpanElement>(null);
  const step = useRef<HTMLSpanElement>(null);
  const zone = useRef<HTMLSpanElement>(null);
  const seen = useRef<HTMLSpanElement>(null);
  const needle = useRef<SVGGElement>(null);
  const off = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!T) return;
    let last = -1;
    const update = () => {
      const el = root.current;
      if (!el) return;
      const i = dive.station;
      const k = T.at(distOf(T, dive.p)).k;
      el.style.setProperty("--p", `${(dive.p / (STATION_COUNT - 1)) * 100}%`);
      el.dataset.on = dive.on && dive.lift > 0.5 && dive.end < 0.6 ? "1" : "0";
      code.current!.textContent = STATIONS[i].code;
      loss.current!.textContent = T.lossAt(k).toPrecision(3);
      step.current!.textContent = String(Math.round(k));
      const z = zoneOf(i);
      zone.current!.textContent = z;
      el.querySelectorAll<HTMLElement>(".zone").forEach((n) => n.toggleAttribute("aria-current", n.dataset.zone === z));
      // the dive log: a station counts as visited once the dive has settled on it
      if (i !== last && dive.on && dive.lift > 0.9 && dive.step === i && Math.abs(dive.p - i) < 0.05) {
        last = i;
        markVisited(STATIONS[i].id, i);
      }
      seen.current!.textContent = `${getLog().visited.length} / ${STATION_COUNT}`;
      // the compass: "up" is the way training actually went at this step (the projected real
      // step); the needle is the steepest way down the chart's surface at that point
      const pt = T.at(distOf(T, dive.p));
      const j = Math.min(T.pts.length - 2, Math.floor(pt.k));
      let tx = 0, ty = 0;
      for (let a = j; a < T.pts.length - 1 && Math.hypot(tx, ty) < 1e-6; a++) { tx = T.pts[a + 1][0] - T.pts[j][0]; ty = T.pts[a + 1][1] - T.pts[j][1]; }
      const gx = -(T.h(pt.x + 1, pt.y) - T.h(pt.x - 1, pt.y)), gy = -(T.h(pt.x, pt.y + 1) - T.h(pt.x, pt.y - 1));
      const ang = Math.atan2(tx * gy - ty * gx, tx * gx + ty * gy) * 180 / Math.PI;
      needle.current?.setAttribute("transform", `rotate(${ang.toFixed(1)})`);
      if (off.current) off.current.textContent = `${Math.abs(ang).toFixed(0)}°`;
    };
    update();
    return onDive(update);
  }, [T]);

  return (
    <aside className="hud" ref={root} data-on="0" aria-label="Depth gauge">
      <div className="hud-rail gauge">
        <div className="rail"><div className="fill" /><div className="bob" /></div>
        <div className="zones">
          {ZONES.map((z) => (
            <span key={z.name} className="zone" data-zone={z.name} style={{ ["--at" as string]: `${(z.from / (STATION_COUNT - 1)) * 100}%` }}>{z.name}</span>
          ))}
        </div>
      </div>
      <div className="readout">
        <span className="label label-s">Station · <span ref={zone} /></span>
        <span className="v az" ref={code}>B00</span>
        <span className="label label-s">Loss</span>
        <span className="mono lossv" ref={loss}>—</span>
        <span className="label label-s">Step <span ref={step}>0</span> of 500</span>
        <span className="label label-s seen">Visited <span ref={seen}>0</span></span>
        <span className="compass" title="Up: the way training went at this step. Needle: the steepest way down the chart's surface.">
          <svg viewBox="-20 -20 40 40" width="44" height="44" aria-hidden="true">
            <circle r="17" className="ring" />
            <path d="M0 -19.5V-13" className="up" />
            <g ref={needle}><path d="M0 9V-12M-3.6 -7.5 0 -12.5 3.6 -7.5" className="needle" /></g>
          </svg>
          <span className="label label-s"><span ref={off}>0°</span> off the steepest way down</span>
        </span>
      </div>
    </aside>
  );
}
