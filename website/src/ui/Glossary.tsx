import { useMemo, useState } from "react";
import { GLOSSARY, STATIONS, type GlossaryTerm } from "../lib/content";
import { enterDive } from "../lib/dive";
import { Html } from "./Station";

const stationOf = (code: string) => STATIONS.find((s) => s.code === code)!;

function Chip({ code }: { code: string }) {
  const st = stationOf(code);
  return (
    <button type="button" className="chip chip-s" data-route={st.course} title={st.title} onClick={() => enterDive(st.i)}>{code}</button>
  );
}

/** the words the notebooks define, with where each is defined, where it comes back, and the terms its definition leans on */
export function Glossary() {
  const [q, setQ] = useState("");
  const [route, setRoute] = useState<"all" | "basic" | "advanced">("all");
  const terms = useMemo(() => {
    const low = q.trim().toLowerCase();
    return GLOSSARY.filter((g) => (route === "all" || g.course === route) && (!low || g.term.toLowerCase().includes(low) || g.definition.toLowerCase().includes(low)));
  }, [q, route]);
  const byName = useMemo(() => Object.fromEntries(GLOSSARY.map((g) => [g.term, g])), []);
  return (
    <section className="sec glossary" id="glossary" aria-labelledby="glossary-t">
      <div className="wrap">
        <div className="sec-head">
          <span className="label">Glossary</span>
          <h2 className="az h-1" id="glossary-t">The words, and where they live</h2>
          <p className="lead">Every term the notebooks define in bold, in plain words, with the session that defines it and the sessions where it comes back. {GLOSSARY.length} terms.</p>
        </div>
        <div className="gloss-tools">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms and definitions" aria-label="Search the glossary" />
          <div role="group" aria-label="Show terms from" className="seg">
            {(["all", "basic", "advanced"] as const).map((r) => <button key={r} type="button" className="chip" aria-pressed={route === r} onClick={() => setRoute(r)}>{r === "all" ? "Both courses" : r === "basic" ? "Basic" : "Advanced"}</button>)}
          </div>
        </div>
        <ul className="gloss" role="list">
          {terms.map((g: GlossaryTerm) => (
            <li key={g.course + g.term} data-route={g.course}>
              <h3 className="h-4">{g.term}</h3>
              <Html as="p" s={g.definition} />
              <p className="small gloss-where">
                <span className="label label-s">Defined in</span> <Chip code={g.defined} />
                {g.used.length > 0 && <> <span className="label label-s">Comes back in</span> {g.used.map((u) => <Chip key={u} code={u} />)}</>}
              </p>
              {g.related.length > 0 && <p className="small fog">See also: {g.related.map((r, k) => <span key={r}>{k ? ", " : ""}{byName[r] ? <a href={`#glossary`} onClick={(e) => { e.preventDefault(); setQ(r); }}>{r}</a> : r}</span>)}</p>}
            </li>
          ))}
          {terms.length === 0 && <li className="fog">No term matches.</li>}
        </ul>
      </div>
    </section>
  );
}
