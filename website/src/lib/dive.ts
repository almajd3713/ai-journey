// The dive is optional. The page scrolls like any page (sessions, downloads, guides); the
// dive is a fullscreen mode over it, entered from the hero, from a session ("dive here"),
// or by a deep link (#basic-06). Inside, each step moves one station along the route:
// a wheel notch, a swipe, an arrow key, or a click on the rail.
//
// The state below is read every frame by the scene and the gauge (no React re-render):
//   on     the dive is open
//   lift   0..1  the flat chart rises into relief as the dive opens
//   p      0..26 position along the route, in stations (fractional while moving)
//   end    0..1  past the last station the camera rises to see the whole route
// Steps are 0..26 for the stations and 27 (END) for "converged?".
import { STATION_COUNT } from "./terrain";

export interface DiveState { on: boolean; lift: number; p: number; end: number; station: number; step: number }

export const END = STATION_COUNT;
export const dive: DiveState = { on: false, lift: 0, p: 0, end: 0, station: 0, step: 0 };

const listeners = new Set<() => void>();
export const onDive = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const notify = () => listeners.forEach((f) => f());

type Key = "lift" | "p" | "end";
interface Tween { from: number; to: number; t0: number; dur: number }
const tweens: Partial<Record<Key, Tween>> = {};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let running = false;

function frame(now: number) {
  let busy = false;
  for (const k of Object.keys(tweens) as Key[]) {
    const tw = tweens[k]!;
    const t = Math.min(1, (now - tw.t0) / tw.dur);
    dive[k] = tw.from + (tw.to - tw.from) * ease(t);
    if (t < 1) busy = true;
    else delete tweens[k];
  }
  dive.station = Math.min(STATION_COUNT - 1, Math.max(0, Math.round(dive.p)));
  notify();
  running = busy;
  if (busy) requestAnimationFrame(frame);
}

function animate(k: Key, to: number, seconds: number) {
  if (reduced() || seconds <= 0) { delete tweens[k]; dive[k] = to; }
  else tweens[k] = { from: dive[k], to, t0: performance.now(), dur: seconds * 1000 };
  if (!running) { running = true; requestAnimationFrame(frame); }
}

/** Move to a step: 0..26 a station, END the overview after the last one. */
export function stepTo(s: number) {
  s = Math.min(END, Math.max(0, Math.round(s)));
  if (s === dive.step && dive.on) return;
  const from = dive.step;
  dive.step = s;
  if (s === END) {
    animate("p", STATION_COUNT - 1, from === END ? 0 : Math.min(2.6, 0.6 + 0.12 * Math.abs(STATION_COUNT - 1 - dive.p)));
    animate("end", 1, 1.4);
  } else {
    animate("end", 0, dive.end > 0 ? 1.1 : 0);
    animate("p", s, Math.min(2.6, 0.75 + 0.12 * Math.abs(s - dive.p)));
  }
  notify();
}
export const stepBy = (d: number) => stepTo(dive.step + d);

/** Open the dive at a station (the chart lifts into relief there). */
export function enterDive(s = 0) {
  s = Math.min(END, Math.max(0, s));
  if (!dive.on) {
    dive.on = true;
    // start at the chosen station, so that the camera descends straight onto it
    dive.step = Math.min(s, STATION_COUNT - 1);
    dive.p = dive.step;
    dive.station = dive.step;
    animate("lift", 1, 1.3);
  }
  stepTo(s);
}

/** Close the dive: the relief settles back into the flat chart behind the hero. */
export function exitDive() {
  if (!dive.on) return;
  dive.on = false;
  animate("lift", 0, 0.9);
  animate("end", 0, 0.9);
  notify();
}
