// Typed access to the site's content. Everything here is data from content/*.json:
// the courses are extracted from the notebooks, markers are curated and checked against
// the notebooks, and kit.json is written by tools/build_downloads.py.
import site from "../../content/site.json";
import peopleFile from "../../content/people.json";
import basic from "../../content/courses/basic.json";
import advanced from "../../content/courses/advanced.json";
import markers from "../../content/markers.json";
import kit from "../../content/kit.json";

export type CourseId = "basic" | "advanced";

export interface FileEntry { path: string; bytes: number; sha256: string }

export interface Ping {
  q: string;
  choices: string[];
  answer: number;
  echo: string;
  src: string;
  section: string | null;
}

export interface Station {
  i: number;                // 0..26 along the dive
  id: string;               // "basic-06"
  code: string;             // "B06"
  course: CourseId;
  n: number;
  title: string;
  summary: string[];
  outcomes: string[];
  sections: string[];
  takeaways: string[];
  run: string;
  minutes: number;
  hardware?: { device: string; time: string; cpu: string };
  notebook: string;
  sounding: { value: string; label: string; src: string };
  ping: Ping;
  currents: { to: string; label: string }[];
  files: { ipynb: FileEntry; html: FileEntry };
  colab: string;
  github: string;
  guides: Person[];
}

export interface Person {
  id: string;
  name: string;
  role: string;
  courses?: CourseId[];
  sessions?: string[] | null;
  photo?: string | null;
  bio?: string;
  links?: Record<string, string>;
}

export interface Course {
  id: CourseId;
  title: string;
  subtitle: string;
  code: string;
  dir: string;
  stations: Station[];
  zip: FileEntry;
  requirements: FileEntry;
  github: string;
}

export const SITE = site;
export const REPO_URL = `https://github.com/${site.repo}`;
const blob = (dir: string, file: string) => `${REPO_URL}/blob/${site.branch}/${dir}/${file}`;
const colab = (dir: string, file: string) =>
  `https://colab.research.google.com/github/${site.repo}/blob/${site.branch}/${dir}/${file}`;

export const PEOPLE: Person[] = peopleFile.people as Person[];
export const OPEN_SLOTS: number = peopleFile.openSlots;
export const OPEN_SLOT_NOTE: string = peopleFile.openSlotNote;

type RawSession = (typeof basic.sessions)[number];
type RawMarker = {
  sounding: Station["sounding"];
  ping: { pause: number; q?: string; choices: string[]; answer: number; echo: string; src: string };
};

const raw: Record<CourseId, { title: string; subtitle: string; code: string; dir: string; sessions: RawSession[] }> = {
  basic: { ...basic, dir: site.courseDirs.basic },
  advanced: { ...(advanced as unknown as typeof basic), dir: site.courseDirs.advanced },
};

function guidesFor(course: CourseId, id: string): Person[] {
  const leads = PEOPLE.filter((p) => p.sessions?.includes(id));
  if (leads.length) return leads;
  return PEOPLE.filter((p) => !p.sessions && (!p.courses || p.courses.includes(course)));
}

let index = 0;
export const COURSES: Course[] = (["basic", "advanced"] as CourseId[]).map((cid) => {
  const c = raw[cid];
  const k = kit.courses[cid];
  const stations = c.sessions.map((s): Station => {
    const m = (markers.stations as Record<string, RawMarker>)[s.id];
    const pause = s.pauses[m.ping.pause];
    const currents = markers.currents
      .filter((x) => x.from === s.id || x.to === s.id)
      .map((x) => ({ to: x.from === s.id ? x.to : x.from, label: x.label }));
    const files = (k.sessions as Record<string, { ipynb: FileEntry; html: FileEntry }>)[s.id];
    return {
      i: index++,
      id: s.id,
      code: s.code,
      course: cid,
      n: s.n,
      title: s.title,
      summary: s.summary,
      outcomes: s.outcomes,
      sections: s.sections,
      takeaways: s.takeaways,
      run: s.run,
      minutes: s.minutes,
      hardware: s.hardware,
      notebook: s.notebook,
      sounding: m.sounding,
      ping: { q: m.ping.q ?? pause.q, choices: m.ping.choices, answer: m.ping.answer, echo: m.ping.echo, src: m.ping.src, section: pause?.section ?? null },
      currents,
      files,
      colab: colab(c.dir, s.notebook),
      github: blob(c.dir, s.notebook),
      guides: guidesFor(cid, s.id),
    };
  });
  return {
    id: cid,
    title: c.title,
    subtitle: c.subtitle,
    code: c.code,
    dir: c.dir,
    stations,
    zip: k.zip,
    requirements: k.requirements,
    github: `${REPO_URL}/tree/${site.branch}/${c.dir}`,
  };
});

export const STATIONS: Station[] = COURSES.flatMap((c) => c.stations);
export const BASIC_COUNT = COURSES[0].stations.length;
export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const KIT_BUILT: string = kit.built;
export const KIT_BYTES = COURSES.reduce(
  (t, c) => t + c.zip.bytes + c.requirements.bytes + c.stations.reduce((u, s) => u + s.files.ipynb.bytes + s.files.html.bytes, 0),
  0,
);

/** Depth zones on the gauge, by station: the club rail's "Surface ..." idea, applied to the dive. */
export const ZONES = [
  { name: "Surface", from: 0 },
  { name: "Shelf", from: 3 },
  { name: "Slope", from: 8 },
  { name: "Trench", from: BASIC_COUNT },
  { name: "Abyss", from: BASIC_COUNT + 7 },
];
export const zoneOf = (i: number) => [...ZONES].reverse().find((z) => i >= z.from)!.name;

export function size(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export const assetUrl = (p: string) => `${import.meta.env.BASE_URL}${p}`;
