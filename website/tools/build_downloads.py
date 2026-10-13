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

What is built is decided by content/downloads.json: a session set to false has no notebook or
render in the site at all, and the course zip is built only when its toggle is true, from the
released sessions only. Figures are always built (they are part of the dive, not a download).

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
        "extra": ["README.md", "CHANGES.md", "requirements.txt", "prelim_before_you_start.ipynb"],
    },
    "advanced": {
        "dir": "advanced_ai_journey_third_edition",
        "zip": "ai-journey-advanced",
        "extra": ["README.md", "CHANGES.md", "requirements.txt", "aij_common.py", "tinygpt.py", "data"],
    },
}


PRACTICE_PDF = {"basic": "experiment_checklist.pdf", "advanced": "transformer_at_a_glance.pdf"}


PRELIM = "prelim_before_you_start.ipynb"


def build_prelim(t, src, out, exporter):
    """The notebook before Session 0 (basic only), when 'before_you_start' is on: the notebook and its browser render."""
    if t.get("before_you_start") is not True:
        return None
    dst = out / PRELIM
    shutil.copy2(src / PRELIM, dst)
    nb = nbformat.read(src / PRELIM, as_version=4)
    title = nb.cells[0].source.splitlines()[0].lstrip("# ").strip()
    body, _ = exporter.from_notebook_node(nb, resources={"metadata": {"name": title}})
    html = out / "read" / (dst.stem + ".html")
    html.write_text(body)
    return {"ipynb": entry(dst), "html": entry(html)}


def build_practice(cid, c, t, src, out):
    """The 'Your turn' practice files that are switched on in downloads.json (exercises, solutions, bug hunt, capstone, cheat sheet)."""
    prefix, ex = cid[0], src / "exercises"
    got = {"exercises": {}, "solutions": {}, "bug_hunt": None, "bug_hunt_answers": None, "capstone": None, "cheat_sheet": None, "aij_check": None}
    for kind, folder, pattern in (("exercises", "", "{p}{n:02d}_your_turn.ipynb"), ("solutions", "solutions", "{p}{n:02d}_your_turn_solutions.ipynb")):
        for sid, on in t.get(kind, {}).items():
            if on is not True:
                continue
            f = ex / folder / pattern.format(p=prefix, n=int(sid.split("-")[1]))
            if not f.is_file():
                sys.exit(f"downloads.json releases {kind} {sid}, but {f} does not exist")
            dst = out / "practice" / folder / f.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)
            got[kind][sid] = entry(dst)
    for key, rel in (("bug_hunt", "bug_hunt.ipynb"), ("bug_hunt_answers", "solutions/bug_hunt_answers.ipynb")):
        if t.get(key) is True:
            dst = out / "practice" / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ex / rel, dst)
            got[key] = entry(dst)
    if t.get("capstone") is True:
        dst = out / "practice" / f"{c['zip']}-capstone.zip"
        dst.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted((ex / "capstone").rglob("*")):
                if f.is_file() and ".ipynb_checkpoints" not in f.parts:
                    z.write(f, f"{c['zip']}-capstone/{f.relative_to(ex / 'capstone').as_posix()}")
        got["capstone"] = entry(dst)
    if t.get("cheat_sheet") is True:
        dst = out / "practice" / PRACTICE_PDF[cid]
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src / "site" / PRACTICE_PDF[cid], dst)
        got["cheat_sheet"] = entry(dst)
    if got["exercises"] or got["solutions"] or got["bug_hunt"] or got["bug_hunt_answers"]:
        dst = out / "practice" / "aij_check.py"
        shutil.copy2(ex / "aij_check.py", dst)
        got["aij_check"] = entry(dst)
    return got


def entry(path):
    data = path.read_bytes()
    return {"path": path.relative_to(SITE / "public").as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    toggles = json.loads((SITE / "content" / "downloads.json").read_text())
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
        t = toggles[cid]
        notebooks = sorted(src.glob("session_*.ipynb"))
        unknown = set(t["sessions"]) - {f"{cid}-{int(p.name.split('_')[1]):02d}" for p in notebooks}
        if unknown:
            sys.exit(f"downloads.json names sessions that do not exist: {sorted(unknown)}")
        notebooks = [p for p in notebooks if t["sessions"].get(f"{cid}-{int(p.name.split('_')[1]):02d}") is True]
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
        if t["zip"] and not notebooks:
            sys.exit(f"{cid}: the zip is on but no session is released")
        if t["zip"]:
            with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
                for nb_path in notebooks:
                    z.write(nb_path, f"{c['zip']}/{nb_path.name}")
                for name in c["extra"]:
                    p = src / name
                    files = [p] if p.is_file() else sorted(x for x in p.rglob("*") if x.is_file())
                    for f in files:
                        z.write(f, f"{c['zip']}/{f.relative_to(src).as_posix()}")
        if notebooks:
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
        practice = build_practice(cid, c, t, src, out)
        prelim = build_prelim(t, src, out, exporter) if (src / PRELIM).exists() else None
        manifest["courses"][cid] = {
            "practice": practice,
            "prelim": prelim,
            "zip": entry(zpath) if t["zip"] else None,
            "requirements": entry(out / "requirements.txt") if notebooks else None,
            "sessions": sessions,
            "figures": figures,
        }
        print(f"{cid}: {len(sessions)} notebooks released, zip {'on' if t['zip'] else 'off'}")
    (KIT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    (SITE / "content" / "kit.json").write_text(json.dumps(manifest, indent=1))
    total = sum(f.stat().st_size for f in KIT.rglob("*") if f.is_file())
    print(f"kit total {total / 1e6:.1f} MB")
    if total > 90e6:
        sys.exit("kit is larger than 90 MB")


if __name__ == "__main__":
    main()
