"""Collect the course data the site reads: each course's site/pauses.json, warmups.json, glossary.json and explorables/*.json.

Writes content/extras.json (pauses, warm-ups, glossary and the list of explorables per session) and copies the explorables
to public/explorables/. These files are committed; CI re-runs this and fails if they are out of date.

    python -I tools/collect_site_data.py
"""
import json
import shutil
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
DIRS = {"basic": "ai_journey_third_edition", "advanced": "advanced_ai_journey_third_edition"}


def main():
    out = {"pauses": {}, "warmups": {}, "glossary": [], "explorables": {}}
    pub = SITE / "public" / "explorables"
    if pub.exists():
        shutil.rmtree(pub)
    pub.mkdir(parents=True)
    for cid, d in DIRS.items():
        base = ROOT / d / "site"
        for p in json.loads((base / "pauses.json").read_text()):
            out["pauses"].setdefault(p["session"], []).append({
                "id": p["id"], "question": p["question"],
                "choices": [{"text": c["text"], "correct": c["correct"]} for c in p["choices"]],
                "answer": p["answer"]["text"],
            })
        for w in json.loads((base / "warmups.json").read_text()):
            out["warmups"].setdefault(w["session"], []).append({"from": w["from"], "q": w["question"], "a": w["answer"], "src": w["source"]})
        for g in json.loads((base / "glossary.json").read_text()):
            out["glossary"].append({**g, "course": cid})
        for f in sorted((base / "explorables").glob("*.json")):
            e = json.loads(f.read_text())
            shutil.copy2(f, pub / f.name)
            out["explorables"].setdefault(e["session"], []).append({"id": e["id"], "title": e["title"]})
    out["glossary"].sort(key=lambda g: g["term"].lower())
    (SITE / "content" / "extras.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"pauses {sum(map(len, out['pauses'].values()))}, warm-ups {sum(map(len, out['warmups'].values()))}, glossary {len(out['glossary'])}, explorables {sum(map(len, out['explorables'].values()))}")


if __name__ == "__main__":
    sys.exit(main())
