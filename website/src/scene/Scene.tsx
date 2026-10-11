// The 3D dive (React Three Fiber). Loaded lazily: the page works without it.
// World: the chart is S x S units, centred on the origin; height is (log-loss - max) * K,
// so the surface is y = 0 at the highest loss and the floor goes down from there.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { dive } from "../lib/dive";
import { STATION_COUNT, distOf, type Terrain } from "../lib/terrain";
import { rgba, token } from "../lib/theme";
import { STATION_BY_ID } from "../lib/content";
import markers from "../../content/markers.json";
import { islandOf } from "../lib/island";
import { getLearners, learnerColor, learnersVersion, MAX_STEPS } from "../lib/learner";
import { setPicker } from "../lib/pick";
import { toponyms } from "../lib/toponyms";
import { DriftField, STREAK, driftOn, glow, onDrift } from "../lib/drift";
import { planktonFrag, planktonVert, terrainFrag, terrainVert, wallFrag, wallVert } from "./shaders";
import { K, S, fogU, grid, islandTexture, rgb, v3, world, type V3 } from "./world";
import { Life } from "./Life";

const UP = new THREE.Vector3(0, 1, 0);
const smooth = (t: number) => t * t * (3 - 2 * t);

function palette() {
  return {
    bg: token("--abyss"),
    ramp: ["--d0", "--d1", "--d2", "--d3", "--d4", "--d5", "--d6"].map((v) => rgb(token(v))),
    iso: rgba(token("--isobath")),
    isoIndex: rgba(token("--isobath-index")),
    isoLit: rgba(token("--isobath-lit")),
    isoShade: rgba(token("--isobath-shade")),
    basic: token("--route-basic"),
    advanced: token("--route-advanced"),
    thread: token("--route-thread"),
    plankton: token("--plankton"),
    // water: lit teal on the shelf, black in the abyss (the fog and background colour)
    shallow: rgb(token("--d3")).multiplyScalar(0.8),
    chart: document.documentElement.dataset.theme === "chart",
  };
}
type Palette = ReturnType<typeof palette>;

function Floor({ T, P, uniforms }: { T: Terrain; P: Palette; uniforms: Record<string, THREE.IUniform> }) {
  const geometry = useMemo(() => {
    const n = T.n, H = T.H, cell = S / (n - 1);
    const pos = new Float32Array(n * n * 3), h = new Float32Array(n * n), g = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = (i / (n - 1) - 0.5) * S;
      pos[k * 3 + 1] = (H[k] - T.max) * K;
      pos[k * 3 + 2] = (j / (n - 1) - 0.5) * S;
      h[k] = H[k];
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
      g[k * 2] = (H[j * n + i1] - H[j * n + i0]) / ((i1 - i0) * cell);
      g[k * 2 + 1] = (H[j1 * n + i] - H[j0 * n + i]) / ((j1 - j0) * cell);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let q = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.set([a, c, b, b, c, d], q);
      q += 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aH", new THREE.BufferAttribute(h, 1));
    geo.setAttribute("aG", new THREE.BufferAttribute(g, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [T]);

  // layout effects: passive effects inside the R3F tree were not applied before drawing
  useLayoutEffect(() => {
    uniforms.uRamp.value = P.ramp;
    uniforms.uIso.value = new THREE.Vector4(...P.iso);
    uniforms.uIsoIndex.value = new THREE.Vector4(...P.isoIndex);
    uniforms.uIsoLit.value = new THREE.Vector4(...P.isoLit);
    uniforms.uIsoShade.value = new THREE.Vector4(...P.isoShade);
    uniforms.uBg.value = rgb(P.bg);
    uniforms.uPingColor.value = rgb(P.plankton);
    uniforms.uShadeBase.value = P.chart ? 0.92 : 0.8;
    uniforms.uShadeAmp.value = P.chart ? 0.3 : 0.62;
    uniforms.uCaustic.value = P.chart ? 0 : 1;
  }, [P, uniforms]);

  // built here rather than as <shaderMaterial uniforms={...}>, so that the material holds
  // this exact uniforms object and the per-frame updates reach the shader
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: terrainVert, fragmentShader: terrainFrag, uniforms, side: THREE.DoubleSide }),
    [uniforms],
  );
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** The island's cut face: one wall under each coastline (see wallVert in shaders.ts). */
function Wall({ T, uniforms }: { T: Terrain; uniforms: Record<string, THREE.IUniform> }) {
  const geometry = useMemo(() => {
    const pos: number[] = [], top: number[] = [], ys: number[] = [], nrm: number[] = [], idx: number[] = [];
    // the main island only: the islets belong to the flat chart (see ISLAND_GLSL)
    for (const ring of islandOf(T).coasts.slice(0, 1)) {
      const base = pos.length / 3, m = ring.length;
      ring.forEach(([x, z], k) => {
        const [px, pz] = ring[(k + m - 1) % m], [nx, nz] = ring[(k + 1) % m];
        const [gx, gy] = grid(T, x, z);
        const y = (T.h(gx, gy) - T.max) * K;
        for (const t of [1, 0]) { pos.push(x, 0, z); top.push(t); ys.push(y); nrm.push(nz - pz, -(nx - px)); }
        const a = base + k * 2, b = base + ((k + 1) % m) * 2;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aTop", new THREE.BufferAttribute(new Float32Array(top), 1));
    g.setAttribute("aY", new THREE.BufferAttribute(new Float32Array(ys), 1));
    g.setAttribute("aN", new THREE.BufferAttribute(new Float32Array(nrm), 2));
    g.setIndex(idx);
    return g;
  }, [T]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: wallVert,
    fragmentShader: wallFrag,
    side: THREE.DoubleSide,
    uniforms: {
      ...fogU(uniforms),
      uBottom: { value: (T.min - T.max) * K - 1.4 },
      uTopC: { value: rgb(token("--d4")).multiplyScalar(0.75) },
      uIsoC: { value: rgb(token("--signal")) },
      uMaxH: { value: T.max },
      uK: { value: K },
    },
  }), [T, uniforms]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** The route: travelled part as a glowing tube, the rest dashed; stations as sounding
 *  lines with rings; currents as arcs between the courses. */
function Route({ T, P, dRef }: { T: Terrain; P: Palette; dRef: RefObject<number> }) {
  const tube = useRef<THREE.Mesh>(null);
  const stationRefs = useRef<(THREE.Group | null)[]>([]);
  const threadRefs = useRef<(THREE.Line | null)[]>([]);

  const built = useMemo(() => {
    const step = 2;
    const points: V3[] = [];
    for (let i = 0; i < T.pts.length; i += step) points.push(world(T, T.pts[i][0], T.pts[i][1], 0.035));
    const last = T.pts[T.pts.length - 1];
    points.push(world(T, last[0], last[1], 0.035));
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const segs = 900, radial = 6;
    const tubeGeo = new THREE.TubeGeometry(curve, segs, 0.045, radial, false);
    const cb = new THREE.Color(P.basic), ca = new THREE.Color(P.advanced);
    const col = new Float32Array(tubeGeo.attributes.position.count * 3);
    for (let s = 0; s <= segs; s++) {
      const c = cb.clone().lerp(ca, s / segs);
      for (let r = 0; r <= radial; r++) col.set([c.r, c.g, c.b], (s * (radial + 1) + r) * 3);
    }
    tubeGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const linePts = curve.getPoints(700);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lcol = new Float32Array(linePts.length * 3);
    linePts.forEach((_, i) => { const c = cb.clone().lerp(ca, i / (linePts.length - 1)); lcol.set([c.r, c.g, c.b], i * 3); });
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lcol, 3));
    const ahead = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 0.16, gapSize: 0.14, transparent: true, opacity: 0.55 }));
    ahead.computeLineDistances();

    const stations = T.stations.map((st, i) => ({
      pos: world(T, st.x, st.y, 0.02),
      color: cb.clone().lerp(ca, i / (STATION_COUNT - 1)),
    }));
    const threads = markers.currents.map((c) => {
      const a = stations[STATION_BY_ID[c.from].i].pos, b = stations[STATION_BY_ID[c.to].i].pos;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y = Math.max(a.y, b.y) + 1.6 + a.distanceTo(b) * 0.18;
      const pts = new THREE.QuadraticBezierCurve3(a.clone().setY(a.y + 0.9), mid, b.clone().setY(b.y + 0.9)).getPoints(80);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: new THREE.Color(P.thread), dashSize: 0.1, gapSize: 0.1, transparent: true, opacity: 0.3 }));
      line.computeLineDistances();
      return { line, from: STATION_BY_ID[c.from].i, to: STATION_BY_ID[c.to].i };
    });
    return { tubeGeo, segs, radial, ahead, stations, threads };
  }, [T, P]);

  const ring = useMemo(() => new THREE.RingGeometry(0.1, 0.15, 40).rotateX(-Math.PI / 2), []);
  const mast = useMemo(() => new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6).translate(0, 0.45, 0), []);
  const buoy = useMemo(() => new THREE.OctahedronGeometry(0.055).translate(0, 0.92, 0), []);

  useFrame(() => {
    const d = dRef.current ?? 0;
    const frac = d / T.total;
    if (tube.current) {
      const segsDone = Math.round(frac * built.segs);
      tube.current.geometry.setDrawRange(0, segsDone * built.radial * 6);
    }
    const now = dive.station;
    stationRefs.current.forEach((g, i) => {
      if (!g) return;
      const target = i === now ? 1.7 : 1;
      const s = g.scale.x + (target - g.scale.x) * 0.12;
      g.scale.setScalar(s);
      const past = i <= Math.round(dive.p + 0.001);
      g.children.forEach((m) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = i === now ? 1 : past ? 0.85 : 0.45;
      });
    });
    built.threads.forEach((t, k) => {
      const l = threadRefs.current[k];
      if (!l) return;
      const on = now === t.from || now === t.to;
      const m = l.material as THREE.LineDashedMaterial;
      m.opacity += ((on ? 0.95 : 0.22) - m.opacity) * 0.1;
    });
  });

  return (
    <group>
      <mesh ref={tube} geometry={built.tubeGeo}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <primitive object={built.ahead} />
      {built.stations.map((s, i) => (
        <group key={i} position={s.pos} ref={(g) => { stationRefs.current[i] = g; }}>
          <mesh geometry={ring}><meshBasicMaterial color={s.color} transparent side={THREE.DoubleSide} toneMapped={false} /></mesh>
          <mesh geometry={mast}><meshBasicMaterial color={s.color} transparent toneMapped={false} /></mesh>
          <mesh geometry={buoy}><meshBasicMaterial color={s.color} transparent toneMapped={false} /></mesh>
        </group>
      ))}
      {built.threads.map((t, k) => (
        <primitive key={k} object={t.line} ref={(l: THREE.Line | null) => { threadRefs.current[k] = l; }} />
      ))}
    </group>
  );
}

/** The learners dropped on the chart (lib/learner.ts): a line per learner and a bead at its
 *  head, drawn on the floor inside the relief group, so they lift with the chart. */
const LEARNER_SLOTS = 5;
function Learners({ T }: { T: Terrain }) {
  const slots = useMemo(() => Array.from({ length: LEARNER_SLOTS }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((MAX_STEPS + 1) * 3), 3));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7, toneMapped: false }));
    // a dot per step, so the spacing shows the step size
    const dots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.5, sizeAttenuation: false, toneMapped: false }));
    dots.frustumCulled = false;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }));
    line.frustumCulled = false;
    head.visible = false;
    return { line, dots, head, id: -1, drawn: 0 };
  }), []);
  const seen = useRef(-1);
  const w = useMemo(() => v3(), []);
  useFrame(() => {
    if (seen.current === learnersVersion()) return;
    seen.current = learnersVersion();
    const list = getLearners();
    slots.forEach((sl, k) => {
      const L = list[k];
      if (!L) { sl.line.geometry.setDrawRange(0, 0); sl.head.visible = false; sl.id = -1; return; }
      if (sl.id !== L.id) {
        sl.id = L.id; sl.drawn = 0;
        const c = new THREE.Color(learnerColor(L.opt));
        (sl.line.material as THREE.LineBasicMaterial).color = c;
        (sl.dots.material as THREE.PointsMaterial).color = c;
        (sl.head.material as THREE.MeshBasicMaterial).color = c;
      }
      const pos = sl.line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = sl.drawn; i < L.pts.length; i++) {
        world(T, L.pts[i][0], L.pts[i][1], 0.05, w);
        pos.setXYZ(i, w.x, w.y, w.z);
      }
      if (L.pts.length !== sl.drawn) { pos.needsUpdate = true; sl.drawn = L.pts.length; }
      sl.line.geometry.setDrawRange(0, L.pts.length);
      sl.head.position.set(pos.getX(L.pts.length - 1), pos.getY(L.pts.length - 1) + 0.04, pos.getZ(L.pts.length - 1));
      sl.head.visible = true;
    });
  });
  return <group>{slots.map((sl, k) => <group key={k}><primitive object={sl.line} /><primitive object={sl.dots} /><primitive object={sl.head} /></group>)}</group>;
}

/** The drift (lib/drift.ts): streaks flowing down the surface, drawn on the floor. */
function Drift({ T, P, count }: { T: Terrain; P: Palette; count: number }) {
  const [shown, setShown] = useState(driftOn());
  useEffect(() => onDrift(() => setShown(driftOn())), []);
  const built = useMemo(() => {
    const field = new DriftField(T, count);
    const pos = new Float32Array(count * 6), col = new Float32Array(count * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    lines.frustumCulled = false;
    lines.renderOrder = 5;
    return { field, pos, col, geo, lines, c: new THREE.Color(P.plankton), w: v3() };
  }, [T, P, count]);
  useFrame((_, dt) => {
    // a tool for the flat chart: hidden while diving
    built.lines.visible = !dive.on;
    if (!shown || dive.on) return;
    const { field: f, pos, col, c, w } = built;
    f.step(Math.min(dt, 0.05));
    for (let i = 0; i < f.count; i++) {
      const tail = f.speed[i] * STREAK;
      world(T, f.x[i], f.y[i], 0.04, w);
      pos[i * 6] = w.x; pos[i * 6 + 1] = w.y; pos[i * 6 + 2] = w.z;
      world(T, f.x[i] - f.dx[i] * tail, f.y[i] - f.dy[i] * tail, 0.04, w);
      pos[i * 6 + 3] = w.x; pos[i * 6 + 4] = w.y; pos[i * 6 + 5] = w.z;
      const g = glow(f.life[i]) * 0.9;
      col[i * 6] = c.r * g; col[i * 6 + 1] = c.g * g; col[i * 6 + 2] = c.b * g;
      col[i * 6 + 3] = col[i * 6 + 4] = col[i * 6 + 5] = 0;
    }
    built.geo.attributes.position.needsUpdate = true;
    built.geo.attributes.color.needsUpdate = true;
  });
  return shown ? <primitive object={built.lines} /> : null;
}

/** Answers "where on the chart is this screen point?" for the hero (lib/pick.ts): a ray
 *  from the camera to the flat chart's plane. Only asked while the chart is flat. */
function Picker({ T }: { T: Terrain }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(UP, 0), hit = v3(), ndc = new THREE.Vector2();
    setPicker((x, y) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const [gx, gy] = grid(T, hit.x, hit.z);
      return gx >= 0 && gy >= 0 && gx <= T.n - 1 && gy <= T.n - 1 ? [gx, gy] : null;
    });
    return () => setPicker(null);
  }, [T, camera, gl]);
  return null;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function Diver({ P, posRef }: { P: Palette; posRef: RefObject<V3> }) {
  const g = useRef<THREE.Group>(null);
  const tex = useMemo(glowTexture, []);
  useFrame((state) => {
    if (!g.current) return;
    g.current.position.copy(posRef.current);
    g.current.position.y += 0.16 + Math.sin(state.clock.elapsedTime * 1.6) * 0.03;
  });
  return (
    <group ref={g}>
      <mesh><sphereGeometry args={[0.07, 20, 14]} /><meshBasicMaterial color={P.plankton} toneMapped={false} /></mesh>
      <sprite scale={[0.9, 0.9, 0.9]}>
        <spriteMaterial map={tex} color={P.plankton} transparent opacity={P.chart ? 0.35 : 0.8} blending={P.chart ? THREE.NormalBlending : THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

function Plankton({ T, P, count }: { T: Terrain; P: Palette; count: number }) {
  const geo = useMemo(() => {
    const I = islandOf(T);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0;
      for (let k = 0; k < 20; k++) {   // over the island and just off its coast
        x = (Math.random() - 0.5) * S * 0.95; z = (Math.random() - 0.5) * S * 0.95;
        if (I.mainAt(x, z) > -1.2) break;
      }
      pos.set([x, -7 + Math.random() * 9, z], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [T, count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uScale: { value: 60 }, uColor: { value: v3() }, uAlpha: { value: 0.5 } }), []);
  useLayoutEffect(() => {
    uniforms.uColor.value = rgb(P.chart ? token("--fog") : P.plankton);
    uniforms.uAlpha.value = P.chart ? 0.35 : 0.55;
  }, [P, uniforms]);
  const { size } = useThree();
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime;
    uniforms.uScale.value = 9 * Math.min(2, s.viewport.dpr) * (size.height / 800);
  });
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: planktonVert, fragmentShader: planktonFrag, uniforms, transparent: true, depthWrite: false }),
    [uniforms],
  );
  material.blending = P.chart ? THREE.NormalBlending : THREE.AdditiveBlending;
  return <points geometry={geo} material={material} frustumCulled={false} />;
}

/** Scroll drives everything: lift, the diver's distance along the route, and the camera. */
function Rig({ T, P, uniforms, relief, dRef, diverRef, tagRef, namesRef, onSlow }: {
  T: Terrain;
  P: Palette;
  onSlow: () => void;
  uniforms: Record<string, THREE.IUniform>;
  relief: RefObject<THREE.Group | null>;
  dRef: RefObject<number>;
  diverRef: RefObject<V3>;
  tagRef: RefObject<HTMLDivElement | null>;
  namesRef: RefObject<HTMLDivElement | null>;
}) {
  const { camera, size } = useThree();
  const names = useMemo(() => toponyms(T).map((t) => world(T, t.gx, t.gy)), [T]);
  const heroRight = useRef(0);
  const look = useRef(v3(0, 0, 0));
  const tmp = useMemo(() => ({ a: v3(), b: v3(), dir: v3(), side: v3(), pos: v3(), at: v3(), p: v3(), tag: v3() }), []);
  const wide = size.width >= 1000;
  const water = useMemo(() => ({ abyss: rgb(P.bg), shallow: P.shallow, chart: P.chart }), [P]);
  // frame-time guard for weak GPUs: first drop to 1x resolution, then give up on 3D
  const perf = useRef({ t0: 0, frames: 0, stage: 0 });

  // Wide screens: the cards are on the left, so the scene moves right. Narrow screens: in the
  // dive the card is at the bottom, so the scene moves up into the band above it.
  const shift = useRef(0);
  useEffect(() => { shift.current = -1; }, [size]);

  useFrame((state, dtRaw) => {
    const pf = perf.current, now = performance.now();
    if (dtRaw > 0.25) { pf.t0 = now; pf.frames = 0; }   // resumed after a pause: not a slow frame
    if (state.clock.elapsedTime > 1.5 && pf.stage < 2) {
      if (!pf.t0) pf.t0 = now;
      pf.frames++;
      if (now - pf.t0 > 2500) {
        const ms = (now - pf.t0) / pf.frames;
        if (ms > 50 && pf.stage === 0) { state.setDpr(1); pf.stage = 1; }
        else if (ms > 50) { pf.stage = 2; onSlow(); }
        else pf.stage = 2;
        pf.t0 = now; pf.frames = 0;
      }
    }
    const dt = Math.min(dtRaw, 0.05);
    {
      const cam = camera as THREE.PerspectiveCamera;
      const want = wide ? 0 : dive.on ? 0.3 : 0.06;
      const was = shift.current;
      shift.current = was < 0 ? want : was + (want - was) * (1 - Math.exp(-dt * 4));
      if (Math.abs(shift.current - was) > 1e-4) {
        if (wide) cam.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height);
        else cam.setViewOffset(size.width, size.height, 0, size.height * shift.current, size.width, size.height);
        cam.updateProjectionMatrix();
      }
    }
    const lift = smooth(dive.lift);
    const end = smooth(dive.end);
    if (relief.current) relief.current.scale.y = Math.max(lift, 1e-4);

    // the diver eases toward the scroll position
    const target = distOf(T, dive.p);
    dRef.current += (target - dRef.current) * (1 - Math.exp(-dt * 5));
    const d = dRef.current;
    const pt = T.at(d);
    world(T, pt.x, pt.y, 0.02, tmp.p);
    tmp.p.y *= Math.max(lift, 1e-4);
    diverRef.current.copy(tmp.p);

    // heading: from slightly behind to a little ahead along the route
    const a = T.at(d - T.total * 0.03), b = T.at(d + T.total * 0.06);
    world(T, a.x, a.y, 0, tmp.a);
    world(T, b.x, b.y, 0, tmp.b);
    tmp.dir.subVectors(tmp.b, tmp.a).setY(0).normalize();
    tmp.side.crossVectors(tmp.dir, UP).normalize();

    const aspect = size.width / size.height;
    // a little higher on the flat floor, where the far side of the valley rises into view
    const far = d / T.total;
    const back = aspect < 1 ? 6.4 : 4.6, up = (aspect < 1 ? 2.6 : 1.7) + far * 0.9;
    // follow view
    const fx = tmp.p.x - tmp.dir.x * back + tmp.side.x * 1.3, fy = tmp.p.y + up, fz = tmp.p.z - tmp.dir.z * back + tmp.side.z * 1.3;
    const lx = tmp.p.x + tmp.dir.x * 2.6, ly = tmp.p.y - 0.35, lz = tmp.p.z + tmp.dir.z * 2.6;
    // chart view (top-down) and overview (after the last station)
    const top = aspect < 1 ? [0, 44, 9] : [0, 30, 6.5];
    const over = aspect < 1 ? [-3, 17, 21] : [-2, 12.5, 15.5];
    let px = top[0] + (fx - top[0]) * lift, py = top[1] + (fy - top[1]) * lift, pz = top[2] + (fz - top[2]) * lift;
    let ax = lx * lift, ay = ly * lift, az = lz * lift;
    px += (over[0] - px) * end; py += (over[1] - py) * end; pz += (over[2] - pz) * end;
    ax += (1 - ax) * end; ay += (-2.6 - ay) * end; az += (-0.5 - az) * end;

    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(tmp.pos.set(px, py, pz), k);
    look.current.lerp(tmp.at.set(ax, ay, az), k);
    camera.lookAt(look.current);

    // uniforms
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uDiver.value.copy(tmp.p);
    uniforms.uPing.value = (t % 2.8) / 2.8;
    const dist = camera.position.distanceTo(look.current);
    uniforms.uFogNear.value = dist * 0.85;
    uniforms.uFogFar.value = dist * 2.6;
    uniforms.uLift.value = lift;
    uniforms.uCut.value = smooth(Math.max(0, lift - 0.5) * 2) * (1 - end);
    uniforms.uPx.value = Math.min(2, state.viewport.dpr) * (size.height / 800);
    // the water darkens as you go down; the chart view keeps the page's background
    const depth = smooth(Math.min(1, d / T.total));
    const lit = water.chart ? 0 : lift * (1 - 0.9 * depth) * (1 - 0.6 * end);
    uniforms.uBg.value.copy(water.abyss).lerp(water.shallow, lit);
    uniforms.uShaft.value = lift * Math.max(0, 1 - depth * 1.6);
    const bg = uniforms.uBg.value as V3;
    (state.scene.background as THREE.Color | null)?.setRGB(bg.x, bg.y, bg.z, THREE.SRGBColorSpace);

    // the current station's tag, placed over its buoy
    const el = tagRef.current;
    if (el) {
      const st = T.stations[dive.station];
      world(T, st.x, st.y, 0, tmp.tag);
      tmp.tag.y = tmp.tag.y * Math.max(lift, 1e-4) + 1.55 * lift + 0.1;
      tmp.tag.project(camera);
      const vis = tmp.tag.z < 1 && lift > 0.6 && end < 0.5;
      el.style.opacity = vis ? "1" : "0";
      // keep the tag clear of the depth gauge on the right
      const tx = Math.min(((tmp.tag.x + 1) / 2) * size.width, size.width - 430);
      el.style.transform = `translate(${tx}px, ${((1 - tmp.tag.y) / 2) * size.height}px)`;
    }

    // place names (lib/toponyms.ts): on the flat chart they keep clear of the hero's text;
    // in the dive they show near the camera and fade with distance
    const box = namesRef.current;
    if (box) {
      if (!dive.on) {
        const col = document.querySelector(".hero-col")?.getBoundingClientRect();
        heroRight.current = col && col.bottom > 0 ? col.right + 16 : 0;
      }
      const kids = box.children as HTMLCollectionOf<HTMLElement>;
      names.forEach((p, i) => {
        const node = kids[i];
        if (!node) return;
        tmp.tag.set(p.x, p.y * Math.max(lift, 1e-4) + 0.25 * lift, p.z);
        const dist = camera.position.distanceTo(tmp.tag);
        tmp.tag.project(camera);
        const sy = ((1 - tmp.tag.y) / 2) * size.height;
        const raw = ((tmp.tag.x + 1) / 2) * size.width, sx = Math.min(size.width - 130, Math.max(130, raw));
        let o = tmp.tag.z < 1 && raw > 0 && raw < size.width && sy > 70 && sy < size.height - 90 ? 1 : 0;
        if (!dive.on) o *= wide && sx - 120 > heroRight.current ? 1 - lift : 0;
        else o *= lift * (1 - end) * (1 - smooth(Math.min(1, Math.max(0, (dist - 6) / 8)))) * (wide && sx > size.width - 300 ? 0 : 1);   // clear of the gauge
        node.style.opacity = o.toFixed(2);
        if (o > 0) node.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px)`;
      });
    }
  });
  return null;
}

export default function Scene({ T, active, tagRef, namesRef, onSlow }: {
  T: Terrain; active: boolean; tagRef: RefObject<HTMLDivElement | null>; namesRef: RefObject<HTMLDivElement | null>; onSlow: () => void;
}) {
  const P = useMemo(palette, []);
  const relief = useRef<THREE.Group>(null);
  const dRef = useRef(distOf(T, dive.p));
  const diverRef = useRef(v3());
  const uniforms = useMemo<Record<string, THREE.IUniform>>(() => ({
    uRamp: { value: Array.from({ length: 7 }, () => v3()) },
    uMin: { value: T.min },
    uMax: { value: T.max },
    uRelief: { value: K * 1.2 },
    uShadeBase: { value: 0.8 },
    uShadeAmp: { value: 0.62 },
    uIso: { value: new THREE.Vector4() },
    uIsoIndex: { value: new THREE.Vector4() },
    uIsoLit: { value: new THREE.Vector4() },
    uIsoShade: { value: new THREE.Vector4() },
    uBg: { value: v3() },
    uFogNear: { value: 20 },
    uFogFar: { value: 60 },
    uHalf: { value: S / 2 },
    uTime: { value: 0 },
    uDiver: { value: v3() },
    uPingColor: { value: v3() },
    uPing: { value: 0 },
    uCaustic: { value: 1 },
    uLift: { value: 0 },      // 0 flat chart .. 1 full relief
    uShaft: { value: 0 },     // sunlight strength, fading with depth
    uPx: { value: 1 },        // point-size scale for the screen
    uIsland: { value: islandTexture(islandOf(T)) },
    uCut: { value: 0 },       // the cutaway along the line of sight (see FOG_GLSL)
  }), [T]);
  const mobile = typeof window !== "undefined" && window.innerWidth < 700;

  // R3F 9.8 measures its container with a ResizeObserver whose first report can arrive
  // before the measuring hook's own effect has run; that report is dropped and the canvas
  // stays 300 x 150 with no renderer. A resize event after mount measures it again.
  useEffect(() => {
    const ids = [60, 400].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event("resize")), ms));
    return () => ids.forEach(clearTimeout);
  }, []);

  return (
    <Canvas
      flat
      dpr={[1, mobile ? 1.5 : 1.75]}
      gl={{ antialias: true, powerPreference: "default", alpha: false }}
      camera={{ fov: 40, near: 0.1, far: 220, position: [0, 30, 6.5] }}
      aria-hidden
      resize={{ scroll: false, debounce: 0 }}
      frameloop={active ? "always" : "never"}
    >
      <color attach="background" args={[P.bg]} />
      <group ref={relief}>
        <Floor T={T} P={P} uniforms={uniforms} />
        <Wall T={T} uniforms={uniforms} />
        <Learners T={T} />
        <Drift T={T} P={P} count={mobile ? 500 : 1400} />
        <Route T={T} P={P} dRef={dRef} />
      </group>
      {!P.chart && <Life T={T} uniforms={uniforms} mobile={mobile} />}
      <Diver P={P} posRef={diverRef} />
      <Plankton T={T} P={P} count={mobile ? 420 : 900} />
      <Picker T={T} />
      <Rig T={T} P={P} uniforms={uniforms} relief={relief} dRef={dRef} diverRef={diverRef} tagRef={tagRef} namesRef={namesRef} onSlow={onSlow} />
    </Canvas>
  );
}

