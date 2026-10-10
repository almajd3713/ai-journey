import { useSyncExternalStore } from "react";
import { dive, onDive } from "../lib/dive";

// React follows only whether the dive is open and which step it is on; the frame-by-frame
// values (lift, p, end) stay outside React.
let snap = { on: dive.on, step: dive.step };
const get = () => {
  if (snap.on !== dive.on || snap.step !== dive.step) snap = { on: dive.on, step: dive.step };
  return snap;
};
export const useDive = () => useSyncExternalStore(onDive, get, get);
