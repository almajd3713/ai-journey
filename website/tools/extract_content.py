"""Read the course notebooks and READMEs into content/courses/*.json.

Everything a station card shows about a session (title, summary, outcomes, sections,
pause questions, takeaways, run note, hardware) comes from the notebook itself, so the
site never drifts from the course. Run it whenever the notebooks change:

    python -I tools/extract_content.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "content" / "courses"

COURSES = {
    "basic": {
        "dir": "ai_journey_third_edition",
        "code": "B",
        "title": "AI Journey",
        "subtitle": "Machine learning from the ground up",
        "route": "basic",
    },
    "advanced": {
        "dir": "advanced_ai_journey_third_edition",
        "code": "A",
        "title": "Advanced AI Journey",
        "subtitle": "Inside the language models",
        "route": "advanced",
    },
}


def md(cell):
    return "".join(cell["source"]) if cell["cell_type"] == "markdown" else ""


def inline(s):
    """Keep inline markdown the site renders (bold, italics, code); trim whitespace."""
    return re.sub(r"\s+", " ", s).strip()


def parse_title(text):
    lines = text.strip().split("\n")
    m = re.match(r"#\s*Session\s+(\d+)\s*[—-]\s*(.+)", lines[0])
    n, title = int(m.group(1)), m.group(2).strip()
    body = "\n".join(lines[1:])
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    summary = []
    outcomes, run = [], ""
    i = 0
    while i < len(paras) and not paras[i].startswith("**By the end"):
        summary.append(inline(paras[i]))
        i += 1
    for p in paras[i:]:
        if p.startswith("**By the end"):
            continue
        if re.match(r"1\.", p):
            outcomes = [inline(re.sub(r"^\d+\.\s*", "", x)).rstrip(";.") for x in re.split(r"\n(?=\d+\.)", p)]
        elif p.startswith("**To run it yourself**"):
            run = inline(p.replace("**To run it yourself**", "To run it yourself", 1))
    return n, title, summary, outcomes, run


def parse(nb_path):
    nb = json.loads(nb_path.read_text())
    cells = nb["cells"]
    n, title, summary, outcomes, run = parse_title(md(cells[0]))
    # The main path: every markdown line before "# Going deeper", split by "## " headings
    lines = []
    for c in cells[1:]:
        text = md(c)
        if re.search(r"^# Going deeper", text, re.M):
            lines += text[: re.search(r"^# Going deeper", text, re.M).start()].split("\n")
            break
        lines += text.split("\n") + [""]
    blocks, head = {}, None
    order = []
    for line in lines:
        h = re.match(r"##\s+(.+)", line)
        if h:
            head = h.group(1).strip()
            order.append(head)
            blocks[head] = []
        elif head:
            blocks[head].append(line)
    sections = [re.sub(r"^\d+\.\s*", "", h) for h in order if re.match(r"\d+\.", h)]
    pauses, takeaways = [], []
    for h in order:
        text = "\n".join(blocks[h])
        if "take away" in h.lower():
            items = re.findall(r"^(?:-|\d+\.) (.+(?:\n(?!- |\d+\. )\S.*)*)", text, re.M)
            takeaways = [inline(x).rstrip(";") for x in items]
            continue
        for q in re.findall(r"^>\s*\*\*Pause:?\*\*:?\s*(.+(?:\n>.+)*)", text, re.M):
            pauses.append({"section": re.sub(r"^\d+\.\s*", "", h), "q": inline(re.sub(r"\n>\s*", " ", q))})
    return {
        "n": n,
        "title": title,
        "summary": summary,
        "outcomes": outcomes,
        "sections": sections,
        "pauses": pauses,
        "takeaways": takeaways,
        "run": run,
        "notebook": nb_path.name,
        "bytes": nb_path.stat().st_size,
    }


def hardware(readme):
    """Rows of the 'Hardware' table: session spec -> {device/time, cpu}."""
    text = readme.read_text()
    m = re.search(r"## Hardware[^\n]*\n(.*?)(?:\n## |\Z)", text, re.S)
    rows = {}
    for line in m.group(1).splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3 or not re.match(r"[\d]", cells[0]):
            continue
        spec = cells[0]
        nums = []
        for part in spec.split(","):
            part = part.strip()
            r = re.match(r"(\d+)\s*[–-]\s*(\d+)", part)
            nums += list(range(int(r.group(1)), int(r.group(2)) + 1)) if r else [int(part)]
        for k in nums:
            rows[k] = cells[1:]
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for cid, meta in COURSES.items():
        d = ROOT / meta["dir"]
        hw = hardware(d / "README.md")
        sessions = []
        for nb in sorted(d.glob("session_*.ipynb")):
            s = parse(nb)
            s["id"] = f"{cid}-{s['n']:02d}"
            s["code"] = f"{meta['code']}{s['n']:02d}"
            s["minutes"] = 90 if re.search(r"about 90 minutes|\(90 min\)|90 minutes", " ".join(s["summary"])) else 60
            row = hw.get(s["n"])
            if row:
                if cid == "basic":
                    s["hardware"] = {"device": row[0], "time": row[1], "cpu": row[2]}
                else:
                    s["hardware"] = {"device": "GPU", "time": row[0], "cpu": row[1]}
            sessions.append(s)
        out = {k: v for k, v in meta.items()} | {"id": cid, "sessions": sessions}
        (OUT / f"{cid}.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
        print(f"{cid}: {len(sessions)} sessions, {sum(len(s['pauses']) for s in sessions)} pauses")
        for s in sessions:
            problems = [k for k in ("summary", "outcomes", "takeaways", "pauses") if not s[k]]
            if len(s["outcomes"]) != 3:
                problems.append(f"{len(s['outcomes'])} outcomes")
            if problems:
                print(f"  {s['code']}: check {problems}", file=sys.stderr)


if __name__ == "__main__":
    main()
