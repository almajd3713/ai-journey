import { useEffect, useState } from "react";
import { STATION_BY_ID, type Station } from "../lib/content";
import { stepTo } from "../lib/dive";
import { md } from "../lib/md";
import { Icon } from "./Icon";
import { Downloads } from "./Kit";

export const Html = ({ s, as: Tag = "span", className }: { s: string; as?: "span" | "p" | "li" | "strong"; className?: string }) => (
  <Tag className={className} dangerouslySetInnerHTML={{ __html: md(s) }} />
);

/** One station in the dive: kept short. The title, its sounding and the downloads show at
 *  once; the outcomes and the ping open on request. */
export function DiveCard({ st }: { st: Station }) {
  const [open, setOpen] = useState<"" | "more" | "ping">("");
  useEffect(() => setOpen(""), [st.id]);
  const toggle = (k: "more" | "ping") => setOpen((o) => (o === k ? "" : k));
  return (
    <article className="dcard card" data-route={st.course} aria-labelledby="dcard-t">
      <header className="dcard-head">
        <span className="code az">{st.code}</span>
        <span className={`route route-${st.course}`}>{st.course === "basic" ? "Basic" : "Advanced"} · Session {st.n}</span>
      </header>
      <h2 className="h-3" id="dcard-t">{st.title}</h2>
      <div className="sounding">
        <span className="v">{st.sounding.value}</span>
        <Html s={st.sounding.label} />
        <span className="src">{st.notebook} · {st.sounding.src}</span>
      </div>
      <Downloads st={st} />
      <div className="dcard-tabs">
        <button type="button" className="chip" aria-expanded={open === "ping"} onClick={() => toggle("ping")}>
          <Icon name="ping" size={14} /> Ping · guess first
        </button>
        <button type="button" className="chip" aria-expanded={open === "more"} onClick={() => toggle("more")}>
          <Icon name={open === "more" ? "minus" : "plus"} size={14} /> What you learn
        </button>
        <span className="chip chip-quiet">{st.minutes} min{st.hardware ? ` · ${st.hardware.device}` : ""}</span>
      </div>
      {open === "ping" && <PingCard st={st} />}
      {open === "more" && (
        <div className="dcard-more">
          <ol className="outcomes">{st.outcomes.map((o, k) => <Html key={k} as="li" s={o} />)}</ol>
          {st.currents.length > 0 && (
            <ul className="currents" aria-label="Currents: real links to the other course">
              {st.currents.map((c) => {
                const to = STATION_BY_ID[c.to];
                return (
                  <li key={c.to}>
                    <a href={`#${to.id}`} onClick={(e) => { e.preventDefault(); stepTo(to.i); }}>
                      <Icon name="current" size={18} />
                      <span><strong>{to.code}</strong> {c.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

export function PingCard({ st }: { st: Station }) {
  const [pick, setPick] = useState<number | null>(null);
  const p = st.ping;
  const right = pick === p.answer;
  return (
    <div className="ping" data-answered={pick !== null ? "" : undefined}>
      <Html as="p" className="q" s={p.q} />
      <div className="choices" role="radiogroup" aria-label="Your guess">
        {p.choices.map((c, k) => (
          <button
            key={k}
            type="button"
            role="radio"
            className="lv"
            aria-checked={pick === k}
            data-verdict={k === p.answer ? "right" : "wrong"}
            data-reveal={pick !== null && k === p.answer ? "" : undefined}
            onClick={() => setPick(k)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="echo" aria-live="polite">
        {pick !== null && (
          <>
            <strong className="verdict">{right ? "Echo: as you guessed." : `Echo: ${p.choices[p.answer]}.`}</strong>
            <Html as="p" s={p.echo} />
            <span className="src">{st.notebook} · {p.src}{p.section ? ` · ${p.section}` : ""}</span>
          </>
        )}
      </div>
    </div>
  );
}
