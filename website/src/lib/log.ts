// The dive log: which stations this visitor has seen, the pings they answered, and where
// they left off. A per-visitor convenience kept in this browser only (localStorage, every
// access wrapped: storage can be unavailable, and then the log simply starts empty).
import { useSyncExternalStore } from "react";

interface Log { visited: string[]; pings: Record<string, number>; last: number }

const KEY = "aij-log";
const OLD = "aij-visited";   // the first version kept only the visited list

function load(): Log {
  const empty: Log = { visited: [], pings: {}, last: -1 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { visited: Array.isArray(v.visited) ? v.visited : [], pings: v.pings && typeof v.pings === "object" ? v.pings : {}, last: Number.isInteger(v.last) ? v.last : -1 };
    }
    const old = localStorage.getItem(OLD);
    if (old) return { ...empty, visited: JSON.parse(old) };
  } catch { /* not available */ }
  return empty;
}

let log: Log = load();
const listeners = new Set<() => void>();
function save(next: Log) {
  log = next;
  try { localStorage.setItem(KEY, JSON.stringify(log)); localStorage.removeItem(OLD); } catch { /* not available */ }
  listeners.forEach((f) => f());
}

export const getLog = () => log;
export function markVisited(id: string, step: number) {
  if (log.last === step && log.visited.includes(id)) return;
  save({ ...log, visited: log.visited.includes(id) ? log.visited : [...log.visited, id], last: step });
}
export const markLast = (step: number) => { if (log.last !== step) save({ ...log, last: step }); };
export const answerPing = (id: string, choice: number) => save({ ...log, pings: { ...log.pings, [id]: choice } });
export const clearLog = () => save({ visited: [], pings: {}, last: -1 });

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useLog = () => useSyncExternalStore(subscribe, getLog, getLog);
