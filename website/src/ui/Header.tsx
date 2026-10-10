import { SITE, assetUrl } from "../lib/content";
import type { Mode, Theme } from "../lib/theme";
import { Icon } from "./Icon";

export function Header({ theme, setTheme, mode, setMode, webgl }: {
  theme: Theme; setTheme: (t: Theme) => void; mode: Mode; setMode: (m: Mode) => void; webgl: boolean;
}) {
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
          <a className="navlink" href="#basic-00">The dive</a>
          <a className="navlink" href="#kit">Field kit</a>
          <a className="navlink" href="#guides">Guides</a>
          <a className="navlink" href="#method">The chart</a>
        </nav>
        <div className="controls">
          {webgl && (
            <button
              className="sq"
              type="button"
              onClick={() => setMode(mode === "3d" ? "2d" : "3d")}
              aria-label={mode === "3d" ? "Switch to the flat 2D chart" : "Switch to the 3D dive"}
              title={mode === "3d" ? "2D chart" : "3D dive"}
            >
              <Icon name={mode === "3d" ? "chart2d" : "relief"} />
            </button>
          )}
          <button
            className="sq"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "chart" : "dark")}
            aria-label={theme === "dark" ? "Switch to the light chart-paper theme" : "Switch to the dark theme"}
            title={theme === "dark" ? "Chart paper" : "Dark water"}
          >
            <Icon name="theme" />
          </button>
        </div>
      </div>
    </header>
  );
}
