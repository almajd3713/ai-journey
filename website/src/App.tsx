import { useEffect, useState } from "react";
import { COURSES, STATIONS, STATION_BY_ID } from "./lib/content";
import { bindDive, dive, goTo, onDive } from "./lib/dive";
import { loadTerrain, type Terrain } from "./lib/terrain";
import { applyTheme, canWebGL2, choseThreeD, initialMode, initialTheme, saveMode, type Mode, type Theme } from "./lib/theme";
import { Backdrop } from "./ui/Backdrop";
import { Gauge } from "./ui/Gauge";
import { Header } from "./ui/Header";
import { Sprite } from "./ui/Icon";
import { Kit } from "./ui/Kit";
import { Converged, Footer, Guides, Hero, Key, Method, RouteHead, Shelf } from "./ui/Sections";
import { StationStop } from "./ui/Station";

export default function App() {
  const [T, setT] = useState<Terrain | null>(null);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [webgl] = useState(canWebGL2);

  useEffect(() => { loadTerrain().then(setT).catch((e) => console.error("terrain", e)); }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const setMode = (m: Mode) => { setModeState(m); saveMode(m); };

  // scroll -> dive state, deep links, keyboard and the address bar
  useEffect(() => {
    const unbind = bindDive();
    const id = decodeURIComponent(location.hash.slice(1));
    if (STATION_BY_ID[id]) requestAnimationFrame(() => goTo(STATION_BY_ID[id].i, false));
    else if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const from = dive.lift < 0.5 ? -1 : dive.station;
        goTo(from + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);

    let shown = "";
    const off = onDive(() => {
      const inDive = dive.lift > 0.95 && dive.end < 0.05;
      const want = inDive ? STATIONS[dive.station].id : "";
      if (want && want !== shown) {
        shown = want;
        history.replaceState(null, "", `#${want}`);
      }
    });
    return () => { unbind(); off(); window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <>
      <Sprite />
      <a className="skip" href="#basic-00">Skip to the first session</a>
      <Header theme={theme} setTheme={setThemeState} mode={mode} setMode={setMode} webgl={webgl} />
      <Backdrop T={T} mode={mode} theme={theme} onFail={() => setMode("2d")} onSlow={() => { if (!choseThreeD()) setModeState("2d"); }} />
      <Gauge T={T} />
      <main id="main">
        <Hero T={T} />
        <Key />
        {COURSES.map((c) => (
          <div key={c.id} className="route-block">
            {c.id === "advanced" && <Shelf T={T} />}
            <RouteHead course={c.id} />
            {c.stations.map((s) => <StationStop key={s.id} st={s} />)}
          </div>
        ))}
        <Converged T={T} />
        <Kit />
        <Guides />
        <Method T={T} theme={theme} />
      </main>
      <Footer />
    </>
  );
}
