"""Fail if a number quoted on the site is not in its notebook.

Every number in a station's sounding and ping (value, echo) must appear in that
notebook's markdown or saved outputs. Same idea as the courses' _build/checknums.py.

    python -I tools/check_markers.py
"""
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
DIRS = {"basic": "ai_journey_third_edition", "advanced": "advanced_ai_journey_third_edition"}
NUM = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?")


def norm(s):
    return s.replace("−", "-").replace(" ", " ")


def numbers(s):
    out = set()
    for m in NUM.findall(norm(s)):
        n = m.replace(",", "")
        out.add(n.lstrip("-"))
    return out


def notebook_text(path):
    nb = json.loads(path.read_text())
    parts = []
    for c in nb["cells"]:
        parts.append("".join(c["source"]))
        for o in c.get("outputs", []):
            parts.append("".join(o.get("text", "")))
            parts.append("".join(o.get("data", {}).get("text/plain", "")))
            parts.append("".join(o.get("data", {}).get("text/html", "")))
    return norm("\n".join(parts))


def main():
    markers = json.loads((SITE / "content" / "markers.json").read_text())
    courses = {c: json.loads((SITE / "content" / "courses" / f"{c}.json").read_text()) for c in DIRS}
    bad = 0
    for sid, m in markers["stations"].items():
        course, n = sid.split("-")
        s = next(x for x in courses[course]["sessions"] if x["n"] == int(n))
        have = numbers(notebook_text(ROOT / DIRS[course] / s["notebook"]))
        ping = m["ping"]
        if ping["pause"] >= len(s["pauses"]):
            print(f"{sid}: pause {ping['pause']} does not exist ({len(s['pauses'])} pauses)")
            bad += 1
        if not 0 <= ping["answer"] < len(ping["choices"]):
            print(f"{sid}: answer index out of range")
            bad += 1
        for field, text in [("sounding", m["sounding"]["value"] + " " + m["sounding"]["label"]), ("echo", ping["echo"])]:
            missing = sorted(x for x in numbers(text) if x not in have and not re.fullmatch(r"\d", x))
            if missing:
                print(f"{sid} {field}: not in the notebook: {missing}")
                bad += 1
    print(f"{len(markers['stations'])} stations checked, {bad} problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
