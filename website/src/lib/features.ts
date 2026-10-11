// Feature switches. Downloads (notebooks, zips, Colab links, the "field kit" wording) are off while
// the site is shown as a preview of the journeys. Turn them on with VITE_SHOW_DOWNLOADS=true at
// build time, or by flipping the default below.
export const SHOW_DOWNLOADS: boolean = (import.meta.env.VITE_SHOW_DOWNLOADS ?? "false") === "true";
