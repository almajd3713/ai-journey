import { useState } from "react";
import { COURSES, KIT_BUILT, KIT_BYTES, REPO_URL, assetUrl, size, type Course, type Station } from "../lib/content";
import { enterDive } from "../lib/dive";
import { Icon } from "./Icon";
import { Html } from "./Station";

const Label = ({ long, short, compact }: { long: string; short: string; compact: boolean }) =>
  compact ? <span>{short}</span> : <><span className="l-long">{long}</span><span className="l-short">{short}</span></>;

/** The three ways into one session: download, read, run. Full labels shorten on a phone. */
export function Downloads({ st, compact = false }: { st: Station; compact?: boolean }) {
  return (
    <div className={`dl${compact ? " dl-compact" : ""}`}>
      <a className="dl-a dl-main" href={assetUrl(st.files.ipynb.path)} download={st.notebook} title={`SHA-256 ${st.files.ipynb.sha256}`}>
        <Icon name="notebook" size={18} />
        <Label long="Notebook" short=".ipynb" compact={compact} />
        <span className="sz">{size(st.files.ipynb.bytes)}</span>
      </a>
      <a className="dl-a" href={assetUrl(st.files.html.path)} target="_blank" rel="noopener">
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
function SessionRow({ st }: { st: Station }) {
  const [open, setOpen] = useState(false);
  const id = `row-${st.id}`;
  return (
    <li className="srow" data-route={st.course} data-open={open ? "" : undefined}>
      <button type="button" className="srow-t" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="code-link">{st.code}</span>
        <span className="nm">{st.title}</span>
        <span className="fog meta">{st.minutes} min{st.hardware ? ` · ${st.hardware.device}` : ""}</span>
        <Icon name={open ? "minus" : "plus"} size={16} />
      </button>
      <Downloads st={st} compact />
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

function CourseBlock({ c }: { c: Course }) {
  return (
    <div className="course" data-route={c.id} id={`route-${c.id}`}>
      <header className="course-head">
        <div className="course-t">
          <span className={`route route-${c.id}`}>{c.id === "basic" ? "Route B · the shelf" : "Route A · the floor"} · {c.stations.length} sessions</span>
          <h3 className="h-2 az">{c.title}</h3>
          <p className="fog">
            {c.id === "basic"
              ? "For engineers new to machine learning. Runs on a laptop or in Colab."
              : "After the basic course. Read from the saved outputs; re-running needs a GPU."}
          </p>
        </div>
        <div className="course-files">
          <a className="btn btn-glow btn-s chamfer" href={assetUrl(c.zip.path)} download>
            <Icon name="zip" size={18} /> Whole course <span className="sz mono">{size(c.zip.bytes)}</span>
          </a>
          <a className="btn btn-line btn-s" href={assetUrl(c.requirements.path)} download>requirements.txt</a>
          <a className="btn btn-line btn-s" href={c.github} target="_blank" rel="noopener">GitHub <Icon name="arrow-ne" size={14} /></a>
        </div>
      </header>
      <ul className="srows" role="list">
        {c.stations.map((s) => <SessionRow key={s.id} st={s} />)}
      </ul>
    </div>
  );
}

export function Kit() {
  return (
    <section className="sec solid kit-sec" id="kit" aria-labelledby="kit-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label"><Icon name="kit" size={16} /> Field kit · {KIT_BYTES ? size(KIT_BYTES) : ""} · built {KIT_BUILT}</span>
          <h2 className="az h-1" id="kit-t">Every session, ready to take</h2>
          <p className="lead">Each session is one notebook with its outputs saved, so you can read it without running anything.</p>
        </div>
        {COURSES.map((c) => <CourseBlock key={c.id} c={c} />)}
        <p className="fog small">
          Not included: the advanced course's <code>cache/</code> folder (348 MB), which the notebooks rebuild, and the models and datasets
          they download on first run (listed in each README). Everything is also in the{" "}
          <a href={REPO_URL} target="_blank" rel="noopener">public repository</a>.
        </p>
      </div>
    </section>
  );
}
