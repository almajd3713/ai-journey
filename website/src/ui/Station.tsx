import { useState } from "react";
import { COURSES, STATION_BY_ID, type Station } from "../lib/content";
import { goTo } from "../lib/dive";
import { md } from "../lib/md";
import { Icon } from "./Icon";
import { Downloads } from "./Kit";

const Html = ({ s, as: Tag = "span", className }: { s: string; as?: "span" | "p" | "li" | "strong"; className?: string }) => (
  <Tag className={className} dangerouslySetInnerHTML={{ __html: md(s) }} />
);

export function StationStop({ st }: { st: Station }) {
  const course = COURSES.find((c) => c.id === st.course)!;
  return (
    <section className="stop" id={st.id} data-stop={st.i} aria-labelledby={`${st.id}-t`}>
      <div className="wrap">
        <div className="stop-col">
          <article className="station card" data-route={st.course}>
            <header className="station-head">
              <span className="code">{st.code}</span>
              <span className={`route route-${st.course}`}>{course.title} · Session {st.n}</span>
            </header>
            <h3 className="h-3" id={`${st.id}-t`}>{st.title}</h3>
            <Html as="p" className="summary" s={st.summary[0]} />
            <div className="outcomes">
              <span className="label label-s">By the end you can</span>
              <ol>{st.outcomes.map((o, k) => <Html key={k} as="li" s={o} />)}</ol>
            </div>
            <div className="sounding">
              <span className="label label-s"><Icon name="sounding" size={14} /> Sounding</span>
              <span className="v">{st.sounding.value}</span>
              <Html s={st.sounding.label} />
              <span className="src">{st.notebook} · {st.sounding.src}</span>
            </div>
            <Downloads st={st} />
            <footer className="station-foot">
              <span className="chip">{st.minutes} min</span>
              {st.hardware && <span className="chip" title={`On a CPU only: ${st.hardware.cpu}`}>{st.hardware.device} · {st.hardware.time}</span>}
              <span className="chip">{st.sections.length} sections</span>
              {st.guides.length > 0 && <span className="chip"><Icon name="guide" size={14} /> {st.guides.map((g) => g.name).join(", ")}</span>}
            </footer>
            {st.currents.length > 0 && (
              <ul className="currents" aria-label="Currents: real links to the other course">
                {st.currents.map((c) => {
                  const to = STATION_BY_ID[c.to];
                  return (
                    <li key={c.to}>
                      <a href={`#${to.id}`} onClick={(e) => { e.preventDefault(); goTo(to.i); }}>
                        <Icon name="current" size={18} />
                        <span><strong>{to.code}</strong> {c.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
          <PingCard st={st} />
        </div>
      </div>
    </section>
  );
}

export function PingCard({ st }: { st: Station }) {
  const [pick, setPick] = useState<number | null>(null);
  const p = st.ping;
  const right = pick === p.answer;
  return (
    <div className="ping card" data-answered={pick !== null ? "" : undefined}>
      <span className="label label-s"><Icon name="ping" size={14} /> Ping · guess before you see</span>
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

