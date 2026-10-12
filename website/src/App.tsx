import { useCallback, useEffect, useRef, useState } from "react";
import { STATIONS, STATION_BY_ID, SHOW_DOWNLOADS } from "./lib/content";
import { END, dive, enterDive, exitDive, onDive } from "./lib/dive";
import { loadTerrain, type Terrain } from "./lib/terrain";
import { canWebGL2, choseThreeD, clearOldTheme, initialMode, saveMode, type Mode } from "./lib/theme";
import { Backdrop } from "./ui/Backdrop";
import { Dive } from "./ui/Dive";
import { Gauge } from "./ui/Gauge";
import { Header } from "./ui/Header";
import { Sprite } from "./ui/Icon";
import { Glossary } from "./ui/Glossary";
import { Kit } from "./ui/Kit";
import { LearnerPanel } from "./ui/Learner";
import { Method } from "./ui/Method";
import { Footer, Guides, Hero } from "./ui/Sections";
import { useDive } from "./ui/useDive";

const hashOf = (step: number) => (step === END ? "converged" : STATIONS[step].id);
const stepOf = (hash: string) => (hash === "converged" ? END : STATION_BY_ID[hash]?.i ?? -1);

export default function App() {
  const [T, setT] = useState<Terrain | null>(null);
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [webgl] = useState(canWebGL2);
  const [heroSeen, setHeroSeen] = useState(true);
  const { on } = useDive();
  const saved = useRef({ y: 0, then: "" });

  useEffect(() => { clearOldTheme(); loadTerrain().then(setT).catch((e) => console.error("terrain", e)); }, []);
  const setMode = (m: Mode) => { setModeState(m); saveMode(m); };

  // the 3D scene renders only while it can be seen: behind the hero, or in the dive
  useEffect(() => {
    const hero = document.getElementById("surface");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setHeroSeen(e.isIntersecting), { rootMargin: "0px 0px -10% 0px" });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // after leaving: back to where the page was, or on to a section (the field kit)
  const settle = () => {
    const then = saved.current.then;
    saved.current.then = "";
    if (then) document.getElementById(then)?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo(0, saved.current.y);
  };

  // The address bar follows the dive: opening it adds a history entry (so Back leaves the
  // dive, as on a phone), moving between stations replaces it.
  useEffect(() => {
    history.scrollRestoration = "manual";
    let wasOn = false, shown = "";
    const off = onDive(() => {
      // while diving, the page behind keeps its place and can't be scrolled or tabbed into
      // (set here, synchronously, so that leaving can restore the scroll position at once)
      if (dive.on !== wasOn) {
        if (dive.on) saved.current.y = window.scrollY;
        document.documentElement.classList.toggle("diving", dive.on);
      }
      if (dive.on) {
        const want = `#${hashOf(dive.step)}`;
        if (!wasOn && !history.state?.dive) history.pushState({ dive: 1 }, "", want);
        else if (want !== shown) history.replaceState({ dive: 1 }, "", want);
        shown = want;
      }
      wasOn = dive.on;
    });
    const onPop = (e: PopStateEvent) => {
      if (dive.on && !e.state?.dive) { exitDive(); settle(); }
      else if (!dive.on && e.state?.dive) {
        const s = stepOf(decodeURIComponent(location.hash.slice(1)));
        if (s >= 0) enterDive(s);
      }
    };
    window.addEventListener("popstate", onPop);

    // a deep link opens the dive there; Back then returns to the page
    const s = stepOf(decodeURIComponent(location.hash.slice(1)));
    if (s >= 0) {
      history.replaceState(null, "", location.pathname + location.search);
      requestAnimationFrame(() => enterDive(s));
    } else if (location.hash) {
      const id = location.hash.slice(1);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    }
    return () => { off(); window.removeEventListener("popstate", onPop); };
  }, []);

  const close = useCallback((then = "") => {
    if (!dive.on) return;
    saved.current.then = then;
    exitDive();
    if (history.state?.dive) history.back();   // popstate settles the page
    else { history.replaceState(null, "", location.pathname + location.search); settle(); }
  }, []);
  const closeDive = useCallback(() => close(), [close]);
  const toKit = useCallback(() => close("kit"), [close]);

  return (
    <>
      <Sprite />
      <a className="skip" href="#kit">{SHOW_DOWNLOADS ? "Skip to the sessions and downloads" : "Skip to the sessions"}</a>
      <Header mode={mode} setMode={setMode} webgl={webgl} />
      <Backdrop T={T} mode={mode} active={on || heroSeen} onFail={() => setMode("2d")} onSlow={() => { if (!choseThreeD()) setModeState("2d"); }} />
      <Gauge T={T} />
      <main id="main">
        <Hero T={T} learner={T ? <LearnerPanel T={T} /> : null} />
        <Kit />
        <Glossary />
        <Guides />
        <Method T={T} />
      </main>
      <Footer />
      <Dive T={T} mode={mode} setMode={setMode} webgl={webgl} onClose={closeDive} onKit={toKit} />
    </>
  );
}
