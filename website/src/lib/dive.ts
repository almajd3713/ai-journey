// Scroll is the only input to the dive. This module turns the page's scroll position into
// three numbers, read every frame by the scene and the gauge (no React re-render):
//   lift   0..1  the flat chart rises into relief while the hero scrolls away
//   p      0..26 position along the route, in stations (fractional between them)
//   end    0..1  after the last station the camera rises to see the whole route
import { STATION_COUNT } from "./terrain";

export interface DiveState { lift: number; p: number; end: number; station: number }

export const dive: DiveState = { lift: 0, p: 0, end: 0, station: 0 };
const listeners = new Set<() => void>();
export const onDive = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

let stops: HTMLElement[] = [];
let hero: HTMLElement | null = null;
let after: HTMLElement | null = null;
let queued = false;

function measure() {
  queued = false;
  const vh = window.innerHeight;
  const mid = vh * 0.5;
  if (hero) {
    const r = hero.getBoundingClientRect();
    dive.lift = clamp(-r.top / Math.max(1, r.height * 0.85));
  }
  if (stops.length) {
    // a station is reached when the middle of its card crosses the middle of the screen
    const tops = stops.map((s) => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    let p = 0;
    if (mid >= tops[tops.length - 1]) p = STATION_COUNT - 1;
    else {
      for (let i = 0; i < tops.length - 1; i++) {
        if (mid >= tops[i] && mid < tops[i + 1]) { p = i + (mid - tops[i]) / (tops[i + 1] - tops[i]); break; }
      }
    }
    dive.p = p;
    dive.station = Math.min(STATION_COUNT - 1, Math.round(p));
  }
  if (after) {
    const r = after.getBoundingClientRect();
    dive.end = clamp((vh * 0.85 - r.top) / (vh * 0.9));
  }
  listeners.forEach((f) => f());
}

const queue = () => { if (!queued) { queued = true; requestAnimationFrame(measure); } };

/** Call once the page is rendered. Stops are elements with data-stop="<index>". */
export function bindDive(): () => void {
  stops = [...document.querySelectorAll<HTMLElement>("[data-stop]")].sort((a, b) => +a.dataset.stop! - +b.dataset.stop!);
  hero = document.getElementById("surface");
  after = document.getElementById("converged");
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  const ro = new ResizeObserver(queue);
  ro.observe(document.body);
  measure();
  return () => {
    window.removeEventListener("scroll", queue);
    window.removeEventListener("resize", queue);
    ro.disconnect();
  };
}

/** Scroll so that station i's card is centred on screen. */
export function goTo(i: number, smooth = true) {
  const el = stops[Math.min(stops.length - 1, Math.max(0, i))];
  if (!el) return;
  const r = el.getBoundingClientRect();
  const y = window.scrollY + r.top + r.height / 2 - window.innerHeight * 0.5 + 2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: y, behavior: smooth && !reduce ? "smooth" : "auto" });
}
