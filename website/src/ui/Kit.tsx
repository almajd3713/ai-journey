import { COURSES, KIT_BUILT, KIT_BYTES, REPO_URL, assetUrl, size, type Course, type Station } from "../lib/content";
import { goTo } from "../lib/dive";
import { Icon } from "./Icon";

/** The three ways into one session: download, read, run. */
export function Downloads({ st, compact = false }: { st: Station; compact?: boolean }) {
  return (
    <div className={`dl${compact ? " dl-compact" : ""}`}>
      <a className="dl-a dl-main" href={assetUrl(st.files.ipynb.path)} download={st.notebook} title={`SHA-256 ${st.files.ipynb.sha256}`}>
        <Icon name="notebook" size={18} />
        <span>{compact ? ".ipynb" : "Notebook"}</span>
        <span className="sz">{size(st.files.ipynb.bytes)}</span>
      </a>
      <a className="dl-a" href={assetUrl(st.files.html.path)} target="_blank" rel="noopener">
        <Icon name="render" size={18} />
        <span>{compact ? "Read" : "Read in the browser"}</span>
      </a>
      {st.course === "basic" && (
        <a className="dl-a" href={st.colab} target="_blank" rel="noopener">
          <Icon name="cloud" size={18} />
          <span>{compact ? "Colab" : "Open in Colab"}</span>
        </a>
      )}
    </div>
  );
}

function CoursePack({ c }: { c: Course }) {
  const extra = c.id === "advanced" ? "the shared files aij_common.py and tinygpt.py, data/, " : "";
  return (
    <div className="pack card" data-route={c.id}>
      <header className="pack-head">
        <span className={`route route-${c.id}`}>{c.id === "basic" ? "Basic route" : "Advanced route"} · {c.stations.length} sessions</span>
        <h3 className="h-3">{c.title}</h3>
        <p className="fog">{c.subtitle}</p>
      </header>
      <ul className="kit">
        <li>
          <a href={assetUrl(c.zip.path)} download>
            <Icon name="zip" size={24} />
            <span className="name">The whole course<span className="what">All {c.stations.length} notebooks, {extra}README, CHANGES and requirements.txt</span></span>
            <span className="size">{size(c.zip.bytes)}</span>
            <Icon name="kit" size={20} />
          </a>
        </li>
        <li>
          <a href={assetUrl(c.requirements.path)} download>
            <Icon name="notebook" size={24} />
            <span className="name">requirements.txt<span className="what">The package versions the saved outputs came from</span></span>
            <span className="size">{size(c.requirements.bytes)}</span>
            <Icon name="kit" size={20} />
          </a>
        </li>
        <li>
          <a href={c.github} target="_blank" rel="noopener">
            <Icon name="code" size={24} />
            <span className="name">Source on GitHub<span className="what">{c.dir}/, with the README's setup, downloads and run times</span></span>
            <span className="size">public</span>
            <Icon name="arrow-ne" size={20} />
          </a>
        </li>
      </ul>
      <p className="pack-note">
        {c.id === "basic"
          ? "The notebooks run on a laptop or in Colab. Sessions 8–10 and 12 are much faster with a GPU; the README lists times per session."
          : "These notebooks are made to be read from their saved outputs. Re-running them needs a GPU and several gigabytes of models; the README lists times and downloads per session."}
      </p>
      <table className="sessions">
        <caption className="label label-s">Sessions</caption>
        <thead><tr><th scope="col">Station</th><th scope="col">Session</th><th scope="col"><span className="vh">Files</span></th></tr></thead>
        <tbody>
          {c.stations.map((s) => (
            <tr key={s.id}>
              <th scope="row"><a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); goTo(s.i); }} className="code-link">{s.code}</a></th>
              <td>{s.title}{s.minutes !== 60 && <span className="fog"> · {s.minutes} min</span>}</td>
              <td><Downloads st={s} compact /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Kit() {
  return (
    <section className="sec solid" id="kit" aria-labelledby="kit-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label"><Icon name="kit" size={16} /> Field kit</span>
          <h2 className="az h-1" id="kit-t">Take it with you</h2>
          <p className="lead">
            Every session is a notebook with its outputs saved, so you can read the whole course without running anything. Download it, read it in
            the browser, or open a basic-course notebook in Colab. {KIT_BYTES ? `${size(KIT_BYTES)} in all, ` : ""}built {KIT_BUILT}.
          </p>
        </div>
        <div className="grid g2 packs">
          {COURSES.map((c) => <CoursePack key={c.id} c={c} />)}
        </div>
        <p className="fog small">
          Not included: the advanced course's <code>cache/</code> folder (348 MB), which the notebooks rebuild, and the models and datasets they
          download on first run (listed with sizes in each README). Everything is also in the{" "}
          <a href={REPO_URL} target="_blank" rel="noopener">public repository</a>.
        </p>
      </div>
    </section>
  );
}
