import { useState } from "react";
import { COURSES, KIT_BUILT, KIT_BYTES, REPO_URL, SHOW_DOWNLOADS, assetUrl, nextSession, sessionOf, size, whenText, type Course, type Prelim, type Station } from "../lib/content";
import { enterDive } from "../lib/dive";
import { clearLog, useLog } from "../lib/log";
import { Icon } from "./Icon";
import { Html } from "./Station";
import { CoursePractice, PracticeLinks } from "./Extras";

const Label = ({ long, short, compact }: { long: string; short: string; compact: boolean }) =>
  compact ? <span>{short}</span> : <><span className="l-long">{long}</span><span className="l-short">{short}</span></>;

/** The three ways into one session: download, read, run. Full labels shorten on a phone. */
export function Downloads({ st, compact = false }: { st: Station; compact?: boolean }) {
  const files = st.files;
  if (!files) return null;
  return (
    <div className={`dl${compact ? " dl-compact" : ""}`}>
      <a className="dl-a dl-main" href={assetUrl(files.ipynb.path)} download={st.notebook} title={`SHA-256 ${files.ipynb.sha256}`}>
        <Icon name="notebook" size={18} />
        <Label long="Notebook" short=".ipynb" compact={compact} />
        <span className="sz">{size(files.ipynb.bytes)}</span>
      </a>
      <a className="dl-a" href={assetUrl(files.html.path)} target="_blank" rel="noopener">
        <Icon name="render" size={18} />
        <Label long="Read in the browser" short="Read" compact={compact} />
      </a>
      {st.course === "basic" && (
        <a className="dl-a" href={st.colab} target="_blank" rel="noopener">
          <Icon name="cloud" size={18} />
          <Label long="Open in Colab" short="Colab" compact={compact} />
        </a>
      )}
    </div>
  );
}

/** One session in the list: its title and files at a glance, the rest on request. */
function SessionRow({ st, seen, pinged }: { st: Station; seen: boolean; pinged: boolean }) {
  const [open, setOpen] = useState(false);
  const id = `row-${st.id}`;
  const when = sessionOf(st.id), isNext = !!when && nextSession()?.station === st.id;
  return (
    <li className="srow" data-route={st.course} data-nodl={st.files || st.practice.exercise || st.practice.solutions ? undefined : ""} data-open={open ? "" : undefined}>
      <button type="button" className="srow-t" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="code-link">{st.code}</span>
        <span className="nm">
          {st.title}
          {seen && <span className="seen-mark" title={pinged ? "Visited in your dive, ping answered" : "Visited in your dive"}>{pinged ? "visited · pinged" : "visited"}</span>}
        </span>
        <span className="fog meta">{when ? <span className={`when${isNext ? " is-next" : ""}`}>{isNext ? "next · " : ""}{whenText(when.date)}</span> : <>{st.minutes} min{st.hardware ? ` · ${st.hardware.device}` : ""}</>}</span>
        <Icon name={open ? "minus" : "plus"} size={16} />
      </button>
      <Downloads st={st} compact />
      <PracticeLinks st={st} compact />
      <button type="button" className="sq srow-dive" onClick={() => enterDive(st.i)} aria-label={`Dive to ${st.code}, ${st.title}`} title="Dive here">
        <Icon name="descent" size={18} />
      </button>
      {open && (
        <div className="srow-more" id={id}>
          <span className="label label-s">By the end you can</span>
          <ol className="outcomes">{st.outcomes.map((o, k) => <Html key={k} as="li" s={o} />)}</ol>
          <p className="srow-sounding"><Icon name="sounding" size={16} /> <strong className="mono">{st.sounding.value}</strong> <Html s={st.sounding.label} /></p>
        </div>
      )}
    </li>
  );
}

/** The notebook before Session 0: a row like a session's, without a dive station. */
function PrelimRow({ p }: { p: Prelim }) {
  const [open, setOpen] = useState(false);
  const files = p.files;
  return (
    <li className="srow srow-prelim" data-route="basic" data-nodl={files ? undefined : ""} data-open={open ? "" : undefined}>
      <button type="button" className="srow-t" aria-expanded={open} aria-controls="row-prelim" onClick={() => setOpen(!open)}>
        <span className="code-link">PRE</span>
        <span className="nm">{p.title}</span>
        <span className="fog meta">{p.minutes} min · optional</span>
        <Icon name={open ? "minus" : "plus"} size={16} />
      </button>
      {files && (
        <div className="dl dl-compact">
          <a className="dl-a dl-main" href={assetUrl(files.ipynb.path)} download={p.notebook} title={`SHA-256 ${files.ipynb.sha256}`}>
            <Icon name="notebook" size={18} /><span>.ipynb</span><span className="sz">{size(files.ipynb.bytes)}</span>
          </a>
          <a className="dl-a" href={assetUrl(files.html.path)} target="_blank" rel="noopener"><Icon name="render" size={18} /><span>Read</span></a>
          <a className="dl-a" href={p.colab} target="_blank" rel="noopener"><Icon name="cloud" size={18} /><span>Colab</span></a>
        </div>
      )}
      {open && (
        <div className="srow-more" id="row-prelim">
          <Html as="p" className="fog" s={p.summary[0]} />
          <span className="label label-s">By the end you can</span>
          <ol className="outcomes">{p.outcomes.map((o, k) => <Html key={k} as="li" s={o} />)}</ol>
        </div>
      )}
    </li>
  );
}

function CourseBlock({ c }: { c: Course }) {
  const log = useLog();
  return (
    <div className="course" data-route={c.id} id={`route-${c.id}`}>
      <header className="course-head">
        <div className="course-t">
          <span className={`route route-${c.id}`}>{c.id === "basic" ? "Route B · the shelf" : "Route A · the floor"} · {c.stations.length} sessions</span>
          <h3 className="h-2 az">{c.title}</h3>
          <p className="fog">
            {c.id === "basic"
              ? "For anyone new to machine learning. New to notebooks or Python as well? Start with Before You Start. Runs on a laptop or in Colab."
              : "After the basic course. Read from the saved outputs; re-running needs a GPU."}
          </p>
        </div>
        {(c.stations.some((s) => s.files) || c.zip) && <div className="course-files">
          {c.zip && <a className="btn btn-glow btn-s chamfer" href={assetUrl(c.zip.path)} download>
            <Icon name="zip" size={18} /> {c.stations.every((s) => s.files) ? "Whole course" : "Released sessions"} <span className="sz mono">{size(c.zip.bytes)}</span>
          </a>}
          {c.requirements && <a className="btn btn-line btn-s" href={assetUrl(c.requirements.path)} download>requirements.txt</a>}
          <a className="btn btn-line btn-s" href={c.github} target="_blank" rel="noopener">GitHub <Icon name="arrow-ne" size={14} /></a>
        </div>}
      </header>
      <CoursePractice c={c} />
      <ul className="srows" role="list">
        {c.prelim && <PrelimRow p={c.prelim} />}
        {c.stations.map((s) => <SessionRow key={s.id} st={s} seen={log.visited.includes(s.id)} pinged={s.id in log.pings} />)}
      </ul>
    </div>
  );
}

function LogNote() {
  const log = useLog();
  if (!log.visited.length && !Object.keys(log.pings).length) return null;
  return (
    <p className="fog small log-note">
      Your dive log: {log.visited.length} of 27 stations visited, {Object.keys(log.pings).length} pings answered. It is kept in this browser
      only. <button type="button" className="linkish" onClick={clearLog}>Clear it</button>
    </p>
  );
}

export function Kit() {
  return (
    <section className="sec solid kit-sec" id="kit" aria-labelledby="kit-t">
      <div className="wrap">
        <div className="sec-head">
          {SHOW_DOWNLOADS ? (
            <>
              <span className="label"><Icon name="kit" size={16} /> Field kit · {KIT_BYTES ? size(KIT_BYTES) : ""} · built {KIT_BUILT}</span>
              <h2 className="az h-1" id="kit-t">Sessions, released as we go</h2>
              <p className="lead">Each session is one notebook with its outputs saved, so you can read it without running anything. Downloads appear on a session as it is released.</p>
            </>
          ) : (
            <>
              <span className="label"><Icon name="kit" size={16} /> The journeys</span>
              <h2 className="az h-1" id="kit-t">Every session on the way down</h2>
              <p className="lead">Two routes, 27 sessions. Open any of them to see what you will be able to do by the end.</p>
            </>
          )}
        </div>
        {COURSES.map((c) => <CourseBlock key={c.id} c={c} />)}
        <LogNote />
        {SHOW_DOWNLOADS && <p className="fog small">
          Not included: the models and datasets the notebooks download on first run (each course's README lists them). Everything is also in
          the{" "}
          <a href={REPO_URL} target="_blank" rel="noopener">public repository</a>.
        </p>}
      </div>
    </section>
  );
}
