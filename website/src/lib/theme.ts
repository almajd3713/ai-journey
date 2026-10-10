// The view mode (3D or the flat 2D chart) is a per-visitor convenience kept in localStorage
// (wrapped in try/catch: storage can be unavailable). The site is dark only; the light
// "chart paper" tokens stay in the design system for print and the poster.
export type Mode = "3d" | "2d";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not available */ } };

/** Visitors who picked the old light theme would be stuck in it without its toggle. */
export function clearOldTheme() {
  delete document.documentElement.dataset.theme;
  try { localStorage.removeItem("aij-theme"); } catch { /* not available */ }
}

export function canWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch { return false; }
}
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function initialMode(): Mode {
  const saved = read("aij-mode");
  if (saved === "2d" || saved === "3d") return saved === "3d" && !canWebGL2() ? "2d" : saved;
  return canWebGL2() && !reducedMotion() ? "3d" : "2d";
}
export const saveMode = (m: Mode) => write("aij-mode", m);
/** true when the visitor chose 3D with the header button (then a slow device keeps it) */
export const choseThreeD = () => read("aij-mode") === "3d";

/** A CSS custom property's value, e.g. token("--abyss"). */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** "#RRGGBB" or "#RRGGBBAA" to [r, g, b, a] in 0..1 */
export function rgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const v = [0, 2, 4, 6].map((i) => (i < full.length ? parseInt(full.slice(i, i + 2), 16) / 255 : 1));
  return v as [number, number, number, number];
}
