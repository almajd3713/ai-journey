// Inline markdown as it appears in the notebooks' text: **bold**, *italics*, `code` and
// a little TeX. The input is our own extracted content, escaped before formatting.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tex(s: string): string {
  return s
    .replace(/\\sqrt\{([^}]*)\}/g, "√$1")
    .replace(/_\{?([a-z0-9])\}?/gi, "<sub>$1</sub>")
    .replace(/\^\{([^}]*)\}/g, "<sup>$1</sup>")
    .replace(/\\(times|cdot|approx|le|ge|sim|to)\b/g, (_, k) => ({ times: "×", cdot: "·", approx: "≈", le: "≤", ge: "≥", sim: "~", to: "→" })[k as string]!)
    .replace(/\\[a-z]+/gi, "");
}

export function md(s: string): string {
  let out = esc(s);
  const codes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  out = out.replace(/\$([^$]+)\$/g, (_, t) => tex(t));
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<em>$2</em>");
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  return out;
}

export const plain = (s: string) => md(s).replace(/<[^>]+>/g, "");
