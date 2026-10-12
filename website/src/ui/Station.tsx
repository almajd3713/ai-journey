import { useEffect, useState } from "react";
import { STATION_BY_ID, assetUrl, type Station } from "../lib/content";
import { stepTo } from "../lib/dive";
import { answerPing, getLog } from "../lib/log";
import { md } from "../lib/md";
import { Icon } from "./Icon";
import { Downloads } from "./Kit";
import { ExplorableCard } from "./Explore";
import { PausesList, PracticeLinks, WarmupList } from "./Extras";

export const Html = ({ s, as: Tag = "span", className }: { s: string; as?: "span" | "p" | "li" | "strong"; className?: string }) => (
  <Tag className={className} dangerouslySetInnerHTML={{ __html: md(s) }} />
);

/** One station in the dive: kept short. The title, its sounding and the downloads show at
 *  once; the outcomes and the ping open on request. */
export function DiveCard({ st }: { st: Station }) {
  const [open, setOpen] = useState<"" | "more" | "ping" | "figs" | "wreck" | "pauses" | "warm" | "explore">("");
  useEffect(() => setOpen(""), [st.id]);
  const toggle = (k: "more" | "ping" | "figs" | "wreck" | "pauses" | "warm" | "explore") => setOpen((o) => (o === k ? "" : k));
  const figs = st.figures.filter((f) => f.star);
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
      <PracticeLinks st={st} />
      <div className="dcard-tabs">
        <button type="button" className="chip" aria-expanded={open === "ping"} onClick={() => toggle("ping")}>
          <Icon name="ping" size={14} /> Ping · guess first
        </button>
        <button type="button" className="chip" aria-expanded={open === "more"} onClick={() => toggle("more")}>
          <Icon name={open === "more" ? "minus" : "plus"} size={14} /> What you learn
        </button>
        {st.pauses.length > 1 && (
          <button type="button" className="chip" aria-expanded={open === "pauses"} onClick={() => toggle("pauses")}>
            <Icon name="ping" size={14} /> All pauses · {st.pauses.length}
          </button>
        )}
        {st.explorables.length > 0 && (
          <button type="button" className="chip" aria-expanded={open === "explore"} onClick={() => toggle("explore")}>
            <Icon name="descent" size={14} /> Explore · {st.explorables.length}
          </button>
        )}
        {st.warmups.length > 0 && (
          <button type="button" className="chip" aria-expanded={open === "warm"} onClick={() => toggle("warm")}>
            <Icon name="plus" size={14} /> Warm-up
          </button>
        )}
        {figs.length > 0 && (
          <button type="button" className="chip" aria-expanded={open === "figs"} onClick={() => toggle("figs")}>
            <Icon name="render" size={14} /> Figures · {figs.length}
          </button>
        )}
        {st.wrecks.length > 0 && (
          <button type="button" className="chip chip-wreck" aria-expanded={open === "wreck"} onClick={() => toggle("wreck")}>
            <Icon name="trench" size={14} /> Wreck{st.wrecks.length > 1 ? `s · ${st.wrecks.length}` : ""}
          </button>
        )}
        <span className="chip chip-quiet">{st.minutes} min{st.hardware ? ` · ${st.hardware.device}` : ""}</span>
      </div>
      {open === "ping" && <PingCard st={st} />}
      {open === "wreck" && <WreckList st={st} />}
      {open === "pauses" && <PausesList st={st} />}
      {open === "warm" && <WarmupList st={st} />}
      {open === "explore" && st.explorables.map((e) => <ExplorableCard key={e.id} id={e.id} />)}
      {open === "figs" && (
        <ul className="figs" aria-label="Figures from this session's notebook">
          {figs.map((f) => (
            <li key={f.id}>
              <a href={assetUrl(f.file.path)} target="_blank" rel="noopener">
                <img src={assetUrl(f.file.path)} alt={f.alt} loading="lazy" />
              </a>
              <Html as="p" className="cap" s={f.caption} />
              {f.licence && (
                <p className="credit">
                  {(Array.isArray(f.licence) ? f.licence : [f.licence]).filter((c) => c.author).map((c, k) => (
                    <span key={k}>
                      {k ? " · " : "Images: "}
                      <a href={c.url ?? c.source_url} target="_blank" rel="noopener">{c.author}</a>
                      {c.licence ?? c.name ? `, ${c.licence ?? c.name}` : ""}{c.changes ? ` (${c.changes})` : ""}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
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

/** the wrecks beside a station: what went wrong, and the number that shows it */
export function WreckList({ st }: { st: Station }) {
  return (
    <ul className="wrecks">
      {st.wrecks.map((w) => (
        <li key={w.id} className="wreck">
          <span className="label label-s">Wreck · {st.code}</span>
          <strong className="wt">{w.title}</strong>
          <span className="v">{w.number}</span>
          <Html as="p" s={w.claim} />
          <span className="src">{st.notebook} · code cell {w.cell + 1}</span>
        </li>
      ))}
    </ul>
  );
}

export function PingCard({ st }: { st: Station }) {
  // a ping answered before (the dive log) opens already answered
  const [pick, setPickState] = useState<number | null>(() => getLog().pings[st.id] ?? null);
  const setPick = (k: number) => { setPickState(k); answerPing(st.id, k); };
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
