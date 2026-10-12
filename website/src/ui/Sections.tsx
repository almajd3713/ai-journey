import { type ReactNode } from "react";
import { STATION_BY_ID, COURSES, KIT_BYTES, SHOW_DOWNLOADS, nextSession, whenText, OPEN_SLOTS, OPEN_SLOT_NOTE, PEOPLE, REPO_URL, SITE, STATIONS, assetUrl, size } from "../lib/content";
import { enterDive, stepTo } from "../lib/dive";
import { useLog } from "../lib/log";
import type { Terrain } from "../lib/terrain";
import { Icon } from "./Icon";

const fileCount =
  STATIONS.reduce((n, s) => n + (s.files ? 2 : 0) + (s.practice.exercise ? 1 : 0) + (s.practice.solutions ? 1 : 0), 0) +
  COURSES.reduce((n, c) => n + (c.zip ? 1 : 0) + (c.requirements ? 1 : 0) + Object.values(c.extras).filter(Boolean).length, 0);

export function Hero({ T, learner }: { T: Terrain | null; learner?: ReactNode }) {
  const start = T ? T.meta.trueLoss[0] : null;
  const { last } = useLog();
  const resume = last > 0 && last < STATIONS.length ? STATIONS[last] : null;
  const next = nextSession();
  const nextSt = next ? STATION_BY_ID[next.station] : null;
  return (
    <section className="hero" id="surface" aria-labelledby="hero-t">
      <div className="wrap">
        <div className="hero-col">
          <p className="label hero-kicker">
            <img src={assetUrl("brand/ensia-light.webp")} alt="ENSIA" className="ensia" width={60} height={22} />
            <span>{SITE.club} · {SITE.cell} · {SITE.edition} {SITE.year}</span>
          </p>
          <h1 className="az h-hero" id="hero-t">
            {SITE.title}
            <span className="outline hero-sub">{SITE.tagline}.</span>
          </h1>
          <p className="lead">
            Two courses, 27 sessions. The island beside this text is real: it is the loss surface of the network you train in basic Session 6,
            and the line across it is the path that network took to the bottom.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn btn-glow chamfer" onClick={() => enterDive(resume ? resume.i : 0)}>
              {resume ? `Resume at ${resume.code}` : "Begin the descent"} <span className="arr" aria-hidden="true">→</span>
            </button>
            <a className="btn btn-line" href="#kit">{SHOW_DOWNLOADS ? "Sessions and downloads" : "The sessions"}</a>
          </div>
          {resume && <button type="button" className="linkish small hero-restart" onClick={() => enterDive(0)}>or start again at B00</button>}
          {next && nextSt && (
            <p className="next-session">
              <span className="label label-s">Next session</span>
              <button type="button" className="linkish" onClick={() => enterDive(nextSt.i)}><strong className="az">{nextSt.code}</strong> {nextSt.title}</button>
              <span className="mono small">{whenText(next.date)}{next.place ? ` · ${next.place}` : ""}</span>
            </p>
          )}
          <div className="stats">
            <div className="stat"><div className="dot" /><div className="num">27</div><div className="label">sessions</div></div>
            <div className="stat"><div className="dot" /><div className="num">2</div><div className="label">routes</div></div>
            {SHOW_DOWNLOADS && <div className="stat"><div className="dot" /><div className="num">{fileCount}</div><div className="label">files to download{KIT_BYTES ? ` · ${size(KIT_BYTES)}` : ""}</div></div>}
          </div>
        </div>
        {learner}
        <p className="hero-depth label">
          <Icon name="surface" size={16} /> 0 m · Surface{start ? ` · loss ${start.toFixed(3)}` : ""} · the dive is optional, everything is listed below
        </p>
      </div>
    </section>
  );
}

/** The last step of the dive, past station A13. */
export function DiveEnd({ T, onKit }: { T: Terrain | null; onKit: () => void }) {
  const last = T ? T.meta.trueLoss[T.meta.trueLoss.length - 1] : null;
  return (
    <article className="dcard dend card" aria-labelledby="dend-t">
      <span className="label"><Icon name="trench" size={16} /> Past A13 · after 500 steps{last ? ` · loss ${last.toFixed(5)}` : ""}</span>
      <h2 className="az h-2 outline" id="dend-t">Converged?</h2>
      <p>Not quite: with more steps the loss would keep falling. A minimum is a checkpoint, not an ending.</p>
      <div className="hero-cta">
        <button type="button" className="btn btn-glow btn-s chamfer" onClick={onKit}>{SHOW_DOWNLOADS ? "Get the field kit" : "See the sessions"} <span className="arr" aria-hidden="true">→</span></button>
        <button type="button" className="btn btn-line btn-s" onClick={() => stepTo(0)}>Back to B00</button>
      </div>
    </article>
  );
}

const monogram = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

export function Guides() {
  const slots = Array.from({ length: OPEN_SLOTS });
  return (
    <section className="sec solid" id="guides" aria-labelledby="guides-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label"><Icon name="guide" size={16} /> Guides</span>
          <h2 className="az h-1" id="guides-t">Who leads the dive</h2>
          <p className="lead">The instructors of this edition. {OPEN_SLOT_NOTE}</p>
        </div>
        <ul className="guides" role="list">
          {PEOPLE.map((p) => (
            <li className="guide" key={p.id}>
              <div className="port cut">
                {p.photo ? <img src={assetUrl(p.photo)} alt="" /> : <span className="mono-gram" aria-hidden="true">{monogram(p.name)}</span>}
              </div>
              <div className="who">
                <span className="nm xp">{p.name}</span>
                <span className="label label-s">{p.role}</span>
                <span className="fog small">
                  {p.sessions?.length ? `Stations ${p.sessions.join(", ")}` : (p.courses ?? ["basic", "advanced"]).map((c) => COURSES.find((x) => x.id === c)!.title).join(" · ")}
                </span>
                {p.bio && <p className="fog small">{p.bio}</p>}
              </div>
            </li>
          ))}
          {slots.map((_, i) => (
            <li className="guide guide-slot" key={`slot-${i}`} aria-label="Guide to be announced">
              <div className="port"><Icon name="guide" size={40} /></div>
              <div className="who">
                <span className="nm xp fog">To be announced</span>
                <span className="label label-s">Guide</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-brand">
          <img src={assetUrl("brand/etc-emblem.svg")} alt="ENSIA Tech Community" width={72} height={74} />
          <div>
            <span className="az">{SITE.title}</span>
            <span className="label label-s">{SITE.club} · {SITE.cell}</span>
          </div>
        </div>
        <ul className="foot-links">
          <li><a href={SITE.clubUrl} target="_blank" rel="noopener">etclub.online <Icon name="arrow-ne" size={14} /></a></li>
          <li><a href="#kit">{SHOW_DOWNLOADS ? "Field kit" : "Sessions"}</a></li>
          <li><a href="#glossary">Glossary</a></li>
          <li><a href="#method">How the chart was made</a></li>
        </ul>
        <p className="fog small foot-note">
          Built from the notebooks: every number on this site is checked against their saved outputs. {SITE.edition}, {SITE.year}.
        </p>
      </div>
    </footer>
  );
}
