import { useEffect, useRef } from "react";
import { BASIC_COUNT, COURSES, KIT_BYTES, OPEN_SLOTS, OPEN_SLOT_NOTE, PEOPLE, REPO_URL, SITE, STATIONS, assetUrl, size } from "../lib/content";
import { goTo } from "../lib/dive";
import { BathyChart } from "../lib/chart2d";
import type { Terrain } from "../lib/terrain";
import type { Theme } from "../lib/theme";
import { Icon } from "./Icon";

const fileCount = STATIONS.length * 2 + COURSES.length * 2;

export function Hero({ T }: { T: Terrain | null }) {
  const start = T ? T.meta.trueLoss[0] : null;
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
            Two courses, 27 sessions, one dive. The seafloor below is real: it is the loss surface of the small network you train in basic
            Session 6, and the line across it is the path that network took to the bottom, one training step at a time.
          </p>
          <div className="hero-cta">
            <a className="btn btn-glow chamfer" href="#basic-00" onClick={(e) => { e.preventDefault(); goTo(0); }}>
              Begin the descent <span className="arr" aria-hidden="true">→</span>
            </a>
            <a className="btn btn-line" href="#kit">Field kit</a>
          </div>
          <div className="stats">
            <div className="stat"><div className="dot" /><div className="num">27</div><div className="label">sessions</div></div>
            <div className="stat"><div className="dot" /><div className="num">2</div><div className="label">routes</div></div>
            <div className="stat"><div className="dot" /><div className="num">500</div><div className="label">real training steps</div></div>
            <div className="stat"><div className="dot" /><div className="num">{fileCount}</div><div className="label">files to download{KIT_BYTES ? ` · ${size(KIT_BYTES)}` : ""}</div></div>
          </div>
        </div>
        <p className="hero-depth label">
          <Icon name="surface" size={16} /> 0 m · Surface{start ? ` · loss ${start.toFixed(3)}` : ""} · scroll to dive
        </p>
      </div>
    </section>
  );
}

export function Key() {
  return (
    <section className="key" aria-labelledby="key-t">
      <div className="wrap">
        <div className="key-card card">
          <h2 className="h-3" id="key-t">How to read the dive</h2>
          <ul className="legend">
            <li><span className="ramp" aria-hidden="true" /><span><strong>Loss is depth.</strong> Light water is a high loss, the abyss a low one. Isobaths are lines of equal loss; the green ones are labelled with the loss itself.</span></li>
            <li><span className="route route-basic" aria-hidden="true" /><span><strong>The basic route</strong> ({BASIC_COUNT} stations) crosses the steep shelf, where most of the loss falls.</span></li>
            <li><span className="route route-advanced" aria-hidden="true" /><span><strong>The advanced route</strong> ({STATIONS.length - BASIC_COUNT} stations) follows the long, flat floor, where progress is slow and careful.</span></li>
            <li><Icon name="sounding" size={22} /><span><strong>Soundings</strong> are measured numbers, each from a notebook's saved output.</span></li>
            <li><Icon name="ping" size={22} /><span><strong>Pings</strong> are the sessions' own pause questions. Guess, then read the measured answer.</span></li>
          </ul>
          <p className="fog small">Use the arrow keys ← → to move between stations, or the 2D button in the header for a flat chart.</p>
        </div>
      </div>
    </section>
  );
}

export function RouteHead({ course }: { course: "basic" | "advanced" }) {
  const c = COURSES.find((x) => x.id === course)!;
  return (
    <div className="route-head wrap" id={`route-${course}`}>
      <span className={`route route-${course}`}>{course === "basic" ? "Route B · the shelf" : "Route A · the floor"}</span>
      <h2 className="az h-1">{c.title}</h2>
      <p className="lead">{c.subtitle}. {c.stations.length} sessions{course === "advanced" ? ", for those who finished the basic course" : ", for engineers new to machine learning"}.</p>
    </div>
  );
}

export function Shelf({ T }: { T: Terrain | null }) {
  const k = T ? T.stations[BASIC_COUNT - 1].k : null;
  return (
    <section className="shelf" aria-labelledby="shelf-t">
      <div className="wrap">
        <div className="panel panel-grad cut shelf-card">
          <span className="label">Shelf break · checkpoint saved</span>
          <h2 className="az h-2" id="shelf-t">basic.pt</h2>
          <p>
            The basic course ends here, at the edge of the shelf{k !== null && T ? `: step ${Math.round(k)}, loss ${T.lossAt(k).toFixed(4)}` : ""}. The
            advanced course resumes training from this checkpoint. It opens up the language models that the basic course used as tools.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Converged({ T }: { T: Terrain | null }) {
  const last = T ? T.meta.trueLoss[T.meta.trueLoss.length - 1] : null;
  return (
    <section className="converged" id="converged" aria-labelledby="conv-t">
      <div className="wrap">
        <div className="conv-col card">
          <span className="label"><Icon name="trench" size={16} /> Past station A13 · after 500 steps{last ? ` · loss ${last.toFixed(5)}` : ""}</span>
          <h2 className="az h-hero outline" id="conv-t">Converged?</h2>
          <p className="lead">
            Not quite. The chart keeps going down past the last station: with more steps the loss would keep falling. A minimum is a checkpoint, not
            an ending. The notebooks are yours to run, change and argue with.
          </p>
          <div className="hero-cta">
            <a className="btn btn-glow chamfer" href="#kit">Get the field kit <span className="arr" aria-hidden="true">→</span></a>
            <a className="btn btn-line" href="#surface">Back to the surface</a>
          </div>
        </div>
      </div>
    </section>
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

export function Method({ T, theme }: { T: Terrain | null; theme: Theme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<BathyChart | null>(null);
  useEffect(() => {
    if (!T || !canvas.current) return;
    const c = new BathyChart(canvas.current, T, { labels: "all" });
    c.set(STATIONS.length - 1);
    chart.current = c;
    return () => c.destroy();
  }, [T]);
  useEffect(() => { chart.current?.redraw(); }, [theme]);
  const m = T?.meta;
  const pct = m ? (m.explained[0] + m.explained[1]) * 100 : null;
  return (
    <section className="sec solid" id="method" aria-labelledby="method-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label"><Icon name="gauge" size={16} /> How this chart was made</span>
          <h2 className="az h-1" id="method-t">The ground is real</h2>
        </div>
        <div className="method">
          <figure className="chart">
            <canvas
              ref={canvas}
              role="img"
              aria-label="Bathymetric chart of the loss surface with the 27 stations along the training path"
              onClick={(e) => { const i = chart.current?.hit(e.clientX, e.clientY) ?? -1; if (i >= 0) goTo(i); }}
            />
            <figcaption>
              <span>Session 6 · XOR network · {m ? m.params : 17} parameters</span>
              <span>Isobaths every 0.25 in ln(loss)</span>
            </figcaption>
          </figure>
          <div className="method-text">
            <ol className="steps">
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Train the real network</span>
                <p className="s">Basic Session 6's XOR network: 2 inputs, 4 tanh units, a sigmoid output, Adam at 0.05 for 500 epochs, seed 42. The script reproduces the notebook's printed losses exactly (0.760, 0.025, 0.00229) and saves the weights after every step.</p>
              </div></li>
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Find the plane of the path</span>
                <p className="s">Principal component analysis of the weights along the way (minus the final weights) gives the two directions the training moved in most. They hold {pct ? pct.toFixed(1) : "99.9"}% of the path's movement (Li et al., 2018).</p>
              </div></li>
              <li className="st" data-state="done"><span className="dot" /><span className="bar" /><div>
                <span className="t">Measure the loss on a grid</span>
                <p className="s">The true training loss at {m ? `${m.n} × ${m.n}` : "257 × 257"} points of that plane, centred on the final weights. Depth is the logarithm of the loss, so each isobath is the same ratio of loss.</p>
              </div></li>
              <li className="st" data-state="now"><span className="dot" /><span className="bar" /><div>
                <span className="t">Place the stations</span>
                <p className="s">The path is the training run projected onto the plane. The 27 stations are spaced evenly along it, so the basic course covers the steep fall and the advanced course the long floor.</p>
              </div></li>
            </ol>
            <div className="panel panel-line honest">
              <span className="label label-s">What the chart does not show</span>
              <p className="small">
                The plane is 2 of the network's 17 dimensions. The line is drawn on the surface at the projected point, while the depth gauge shows
                the network's true loss at that step: at step 0 the surface reads {T ? T.meta.trailSurfaceLoss[0].toFixed(3) : "0.693"} and the true loss
                is {T ? T.meta.trueLoss[0].toFixed(3) : "0.760"}. Stations mark sessions, not training steps: no session trains this network.
              </p>
              <p className="small fog">
                Source: <a href={`${REPO_URL}/blob/${SITE.branch}/website/tools/make_landscape.py`} target="_blank" rel="noopener">make_landscape.py</a>
                {m ? ` · Python ${m.provenance.python}, PyTorch ${m.provenance.torch}, NumPy ${m.provenance.numpy}` : ""}
              </p>
            </div>
          </div>
        </div>
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
          <li><a href={REPO_URL} target="_blank" rel="noopener">Source on GitHub <Icon name="arrow-ne" size={14} /></a></li>
          <li><a href="#kit">Field kit</a></li>
          <li><a href="#method">How the chart was made</a></li>
        </ul>
        <p className="fog small foot-note">
          Built from the notebooks: every number on this site is checked against their saved outputs. {SITE.edition}, {SITE.year}.
        </p>
      </div>
    </footer>
  );
}
