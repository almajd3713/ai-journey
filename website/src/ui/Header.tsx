import { SHOW_GLOSSARY, SITE, assetUrl } from "../lib/content";
import { enterDive } from "../lib/dive";
import type { Mode } from "../lib/theme";
import { Icon } from "./Icon";

export function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <button
      className="sq"
      type="button"
      onClick={() => setMode(mode === "3d" ? "2d" : "3d")}
      aria-label={mode === "3d" ? "Switch to the flat 2D chart" : "Switch to the 3D dive"}
      title={mode === "3d" ? "2D chart" : "3D relief"}
    >
      <Icon name={mode === "3d" ? "chart2d" : "relief"} />
    </button>
  );
}

export function Header({ mode, setMode, webgl }: { mode: Mode; setMode: (m: Mode) => void; webgl: boolean }) {
  return (
    <header className="header">
      <div className="wrap">
        <a className="brand" href="#surface" aria-label={`${SITE.title}, back to the top`}>
          <img src={assetUrl("brand/etc-mark.svg")} alt="" width={36} height={36} />
          <span className="az">{SITE.title}</span>
          <span className="sep" aria-hidden="true" />
          <span className="label label-s">{SITE.cellShort} · {SITE.clubShort}</span>
        </a>
        <nav className="nav" aria-label="Sections">
          <a className="navlink" href="#kit">Sessions</a>
          {SHOW_GLOSSARY && <a className="navlink" href="#glossary">Glossary</a>}
          <a className="navlink" href="#guides">Guides</a>
          <a className="navlink" href="#method">The chart</a>
        </nav>
        <div className="controls">
          {webgl && <ModeToggle mode={mode} setMode={setMode} />}
          <button type="button" className="btn btn-glow btn-s chamfer" onClick={() => enterDive(0)}>
            <Icon name="descent" size={18} /> Dive
          </button>
        </div>
      </div>
    </header>
  );
}
