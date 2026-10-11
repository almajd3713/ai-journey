"""Build the field kit: every download the site offers, with a manifest.

For each course it writes, under public/kit/<course>/:
  <notebook>.ipynb      the notebook with its saved outputs
  read/<notebook>.html  a static render for reading in the browser (nbconvert)
  <course>.zip          all notebooks + README, CHANGES, requirements (and the advanced
                        course's shared files and data/)
  requirements.txt
  figures/<id>.png      the course's figures, when <course>/site/figures.json exists (the
                        course enhancement plan); the dive shows a session's ★ figures
and public/kit/manifest.json (sizes and SHA-256), copied to content/kit.json for the build.

The advanced course's cache/ (348 MB) is left out: the notebooks rebuild it.

    python -I tools/build_downloads.py
"""
import hashlib
import json
import shutil
import sys
import zipfile
from datetime import date
from pathlib import Path

import nbformat
from nbconvert import HTMLExporter

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
KIT = SITE / "public" / "kit"
COURSES = {
    "basic": {
        "dir": "ai_journey_third_edition",
        "zip": "ai-journey-basic",
        "extra": ["README.md", "CHANGES.md", "requirements.txt"],
    },
    "advanced": {
        "dir": "advanced_ai_journey_third_edition",
        "zip": "ai-journey-advanced",
        "extra": ["README.md", "CHANGES.md", "requirements.txt", "aij_common.py", "tinygpt.py", "data"],
    },
}


def entry(path):
    data = path.read_bytes()
    return {"path": path.relative_to(SITE / "public").as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    if KIT.exists():
        shutil.rmtree(KIT)
    exporter = HTMLExporter(template_name="lab")
    exporter.exclude_input_prompt = True
    exporter.exclude_output_prompt = True
    manifest = {"built": date.today().isoformat(), "courses": {}}
    for cid, c in COURSES.items():
        src = ROOT / c["dir"]
        out = KIT / cid
        (out / "read").mkdir(parents=True)
        sessions = {}
        notebooks = sorted(src.glob("session_*.ipynb"))
        for nb_path in notebooks:
            n = int(nb_path.name.split("_")[1])
            dst = out / nb_path.name
            shutil.copy2(nb_path, dst)
            nb = nbformat.read(nb_path, as_version=4)
            title = nb.cells[0].source.splitlines()[0].lstrip("# ").strip()
            exporter_body, _ = exporter.from_notebook_node(nb, resources={"metadata": {"name": title}})
            html = out / "read" / (nb_path.stem + ".html")
            html.write_text(exporter_body)
            sessions[f"{cid}-{n:02d}"] = {"ipynb": entry(dst), "html": entry(html)}
            print(f"  {cid}-{n:02d}  {dst.stat().st_size / 1e3:7.0f} KB  html {html.stat().st_size / 1e3:7.0f} KB")
        zpath = out / f"{c['zip']}.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for nb_path in notebooks:
                z.write(nb_path, f"{c['zip']}/{nb_path.name}")
            for name in c["extra"]:
                p = src / name
                files = [p] if p.is_file() else sorted(x for x in p.rglob("*") if x.is_file())
                for f in files:
                    z.write(f, f"{c['zip']}/{f.relative_to(src).as_posix()}")
        shutil.copy2(src / "requirements.txt", out / "requirements.txt")
        figures = []
        fig_index = src / "site" / "figures.json"
        if fig_index.exists():
            (out / "figures").mkdir()
            for f in json.loads(fig_index.read_text()):
                png = src / "site" / f["file"]
                if not png.is_file():
                    sys.exit(f"{fig_index}: {f['id']} names {f['file']}, which does not exist")
                dst = out / "figures" / png.name
                shutil.copy2(png, dst)
                figures.append({
                    "id": f["id"], "session": f["session"], "star": f.get("priority") == "\u2605",
                    "caption": f["caption"], "alt": f["alt"], "licence": f.get("licence"), "file": entry(dst),
                })
            print(f"{cid}: {len(figures)} figures")
        manifest["courses"][cid] = {
            "zip": entry(zpath),
            "requirements": entry(out / "requirements.txt"),
            "sessions": sessions,
            "figures": figures,
        }
        print(f"{cid}: {len(sessions)} notebooks, zip {zpath.stat().st_size / 1e6:.1f} MB")
    (KIT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    (SITE / "content" / "kit.json").write_text(json.dumps(manifest, indent=1))
    total = sum(f.stat().st_size for f in KIT.rglob("*") if f.is_file())
    print(f"kit total {total / 1e6:.1f} MB")
    if total > 90e6:
        sys.exit("kit is larger than 90 MB")


if __name__ == "__main__":
    main()
