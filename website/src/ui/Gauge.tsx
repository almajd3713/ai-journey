// The depth gauge: the club's right-hand depth rail, extended with a live readout of the
// real training run. It updates from the dive state without React re-renders.
import { useEffect, useRef } from "react";
import { STATIONS, ZONES, zoneOf } from "../lib/content";
import { dive, onDive } from "../lib/dive";
import { STATION_COUNT, distOf, type Terrain } from "../lib/terrain";

const VISITED = "aij-visited";
function loadVisited(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(VISITED) ?? "[]")); } catch { return new Set(); }
}

export function Gauge({ T }: { T: Terrain | null }) {
  const root = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLSpanElement>(null);
  const loss = useRef<HTMLSpanElement>(null);
  const step = useRef<HTMLSpanElement>(null);
  const zone = useRef<HTMLSpanElement>(null);
  const seen = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!T) return;
    const visited = loadVisited();
    let last = -1;
    const update = () => {
      const el = root.current;
      if (!el) return;
      const i = dive.station;
      const k = T.at(distOf(T, dive.p)).k;
      el.style.setProperty("--p", `${(dive.p / (STATION_COUNT - 1)) * 100}%`);
      el.dataset.on = dive.lift > 0.5 && dive.end < 0.6 ? "1" : "0";
      code.current!.textContent = STATIONS[i].code;
      loss.current!.textContent = T.lossAt(k).toPrecision(3);
      step.current!.textContent = String(Math.round(k));
      const z = zoneOf(i);
      zone.current!.textContent = z;
      el.querySelectorAll<HTMLElement>(".zone").forEach((n) => n.toggleAttribute("aria-current", n.dataset.zone === z));
      if (i !== last && dive.lift > 0.9) {
        last = i;
        visited.add(STATIONS[i].id);
        try { localStorage.setItem(VISITED, JSON.stringify([...visited])); } catch { /* not available */ }
      }
      seen.current!.textContent = `${visited.size} / ${STATION_COUNT}`;
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
      </div>
    </aside>
  );
}
