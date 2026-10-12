import { useState } from "react";
import { assetUrl, size, type Course, type FileEntry, type Station } from "../lib/content";
import { Icon } from "./Icon";
import { Html } from "./Station";

/** every pause of a session, as the notebooks pose them: pick first, then the measured answer opens */
export function PausesList({ st }: { st: Station }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  return (
    <ol className="pauses">
      {st.pauses.map((p) => {
        const pick = picked[p.id];
        const answered = pick !== undefined;
        return (
          <li key={p.id} className="ping" data-answered={answered ? "" : undefined}>
            <Html as="p" className="q" s={p.question} />
            <div className="choices" role="radiogroup" aria-label="Your guess">
              {p.choices.map((c, k) => (
                <button
                  key={k} type="button" role="radio" className="lv" aria-checked={pick === k}
                  data-verdict={c.correct ? "right" : "wrong"} data-reveal={answered && c.correct ? "" : undefined}
                  onClick={() => setPicked((x) => ({ ...x, [p.id]: k }))}
                >
                  <Html s={c.text} />
                </button>
              ))}
            </div>
            {answered && <Html as="p" className="echo-text" s={p.answer} />}
          </li>
        );
      })}
    </ol>
  );
}

/** three questions about the session two before, with the answers kept closed until asked for */
export function WarmupList({ st }: { st: Station }) {
  return (
    <div className="warmups">
      <p className="fog small">Five minutes at the start: three questions about {st.warmups[0].from}, answered from the numbers its notebook printed.</p>
      <ol>
        {st.warmups.map((w, k) => (
          <li key={k}>
            <Html as="p" className="q" s={w.q} />
            <details><summary>Answer</summary><Html as="p" s={w.a} /><span className="src">{w.src}</span></details>
          </li>
        ))}
      </ol>
    </div>
  );
}

const FileLink = ({ f, label, icon = "notebook" }: { f: FileEntry; label: string; icon?: "notebook" | "zip" | "render" }) => (
  <a className="dl-a" href={assetUrl(f.path)} download title={`SHA-256 ${f.sha256}`}>
    <Icon name={icon} size={18} /> <span>{label}</span> <span className="sz">{size(f.bytes)}</span>
  </a>
);

/** a session's own practice files, when they are released */
export function PracticeLinks({ st, compact = false }: { st: Station; compact?: boolean }) {
  const { exercise, solutions } = st.practice;
  if (!exercise && !solutions) return null;
  return (
    <div className={`dl dl-practice${compact ? " dl-compact" : ""}`}>
      {exercise && <FileLink f={exercise} label={compact ? "Your turn" : "Your turn (exercises)"} />}
      {solutions && <FileLink f={solutions} label="Solutions" />}
    </div>
  );
}

/** the course-wide practice files: bug hunt, capstone, cheat sheet (and the checker the exercises import) */
export function CoursePractice({ c }: { c: Course }) {
  const x = c.extras;
  if (!Object.values(x).some(Boolean)) return null;
  return (
    <div className="course-practice">
      <span className="label label-s">Practice</span>
      <div className="dl">
        {x.bugHunt && <FileLink f={x.bugHunt} label="Bug hunt" />}
        {x.bugHuntAnswers && <FileLink f={x.bugHuntAnswers} label="Bug hunt answers" />}
        {x.capstone && <FileLink f={x.capstone} label="Capstone brief" icon="zip" />}
        {x.cheatSheet && <FileLink f={x.cheatSheet} label="Cheat sheet (PDF)" icon="render" />}
        {x.check && <FileLink f={x.check} label="aij_check.py" />}
      </div>
    </div>
  );
}
