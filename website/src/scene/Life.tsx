// Life on the seafloor. None of it is data: the ground and the route are the measured loss
// surface and training path; this layer only makes the chart read as a sea. It follows
// real ocean zonation by depth, which here is loss:
//   the shelf (shallow, the basic route)   kelp, seagrass, sunlight shafts, silver fish
//   the slope                              rocks, coral, manta rays, larger fish
//   the trench and abyss (advanced route)  darkness, tube worms, anglerfish with lures,
//                                          lanternfish, jellyfish, siphonophores
// Each station stands in a small reef in its route's colour. Everything is procedural and
// instanced (one draw call per kind), grows out of the floor as the chart lifts, and lives
// only on the island (lib/island.ts).
import { useMemo } from "react";
import * as THREE from "three";
import { BASIC_COUNT, STATION_BY_ID, WRECKS } from "../lib/content";
import type { Terrain } from "../lib/terrain";
import { token } from "../lib/theme";
import { FOG_GLSL, K, S, fogU, grid, rgb, rng, v3, world } from "./world";
import { islandOf } from "../lib/island";

type U = Record<string, THREE.IUniform>;
type Attrs = Record<string, [Float32Array, number]>;

function instanced(base: THREE.BufferGeometry, count: number, attrs: Attrs) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const [k, v] of Object.entries(base.attributes)) g.setAttribute(k, v);
  for (const [k, [arr, size]] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, size));
  g.instanceCount = count;
  return g;
}

const mixHex = (a: string, b: string, t: number) => rgb(a).lerp(rgb(b), t);

/** Where things can grow: depth (0 shallow .. 1 abyss), slope, and distance from the route. */
function seabed(T: Terrain) {
  const trail: [number, number][] = [];
  for (let i = 0; i < T.pts.length; i += 3) {
    const w = world(T, T.pts[i][0], T.pts[i][1]);
    trail.push([w.x, w.z]);
  }
  const clearance = (x: number, z: number) => {
    let m = Infinity;
    for (const [a, b] of trail) m = Math.min(m, (a - x) ** 2 + (b - z) ** 2);
    return Math.sqrt(m);
  };
  const at = (x: number, z: number) => {
    const [gx, gy] = grid(T, x, z);
    const h = T.h(gx, gy);
    const d = 0.15, [ax, ay] = grid(T, x + d, z), [bx, by] = grid(T, x, z + d);
    const slope = Math.hypot(T.h(ax, ay) - h, T.h(bx, by) - h) / d;
    return { y: (h - T.max) * K, t: (T.max - h) / (T.max - T.min), slope };
  };
  const lim = S * 0.45;
  // only on the island (lib/island.ts), with a margin from its coast
  const I = islandOf(T);
  const inside = (x: number, z: number, margin = 0.25) => I.mainAt(x, z) > margin;
  return { at, clearance, lim, inside };
}

// ---------------------------------------------------------------- plants (kelp, seagrass)
const plantVert = /* glsl */ `
uniform float uTime;
uniform float uLift;
attribute vec3 aBase;
attribute float aHeight;
attribute float aPhase;
attribute float aWidth;
varying float vY;
varying float vSide;
varying float vDist;
varying vec3 vW;
void main() {
  float y = position.y;
  float h = aHeight * smoothstep(0.3, 0.95, uLift);
  float a = aPhase * 6.2831853;
  float x = position.x * aWidth * (1.0 - 0.7 * y);
  vec3 p = vec3(cos(a) * x, y * h, sin(a) * x);
  float bend = y * y * h;
  p.x += sin(uTime * 0.7 + aPhase * 9.0 + y * 2.4) * 0.22 * bend;
  p.z += cos(uTime * 0.55 + aPhase * 5.0 + y * 1.9) * 0.16 * bend;
  vec3 w = vec3(aBase.x, aBase.y * uLift, aBase.z) + p;
  vY = y;
  vSide = position.x;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const plantFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uRoot;
uniform vec3 uTip;
varying float vY;
varying float vSide;
varying float vDist;
varying vec3 vW;
void main() {
  vec3 c = mix(uRoot, uTip, pow(vY, 1.3));
  c *= 0.72 + 0.4 * (0.5 + 0.5 * vSide);
  gl_FragColor = vec4(fogged(c, vDist, vW), 1.0);
}
`;

function plants(T: Terrain, shared: U, mobile: boolean) {
  const B = seabed(T);
  const r = rng(7);
  const build = (kind: "kelp" | "grass") => {
    const kelp = kind === "kelp";
    const patches = kelp ? (mobile ? 30 : 64) : (mobile ? 60 : 130);
    const per = kelp ? 14 : 22;
    const base: number[] = [], height: number[] = [], phase: number[] = [], width: number[] = [];
    let tries = 0, made = 0;
    while (made < patches && tries++ < 6000) {
      const cx = (r() * 2 - 1) * B.lim, cz = (r() * 2 - 1) * B.lim;
      if (!B.inside(cx, cz, 0.6)) continue;
      const { t } = B.at(cx, cz);
      const maxT = kelp ? 0.5 : 0.62;
      if (t > maxT || r() > 1 - t / maxT) continue;   // denser in shallow water
      if (B.clearance(cx, cz) < (kelp ? 1.1 : 0.55)) continue;
      made++;
      for (let k = 0; k < per; k++) {
        const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * (kelp ? 0.75 : 0.6);
        const x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad;
        const c = B.clearance(x, z);
        if (c < (kelp ? 0.9 : 0.35) || !B.inside(x, z)) continue;
        const s = B.at(x, z);
        let h = kelp ? 0.9 + r() * 1.2 : 0.15 + r() * 0.3;
        h *= 1 - s.t * 0.8;
        if (kelp) h = Math.min(h, 0.35 + (c - 0.9) * 0.85);   // keep tall kelp off the camera's path
        base.push(x, s.y - 0.02, z);
        height.push(h);
        phase.push(r());
        width.push(kelp ? 0.1 + r() * 0.07 : 0.025 + r() * 0.02);
      }
    }
    const count = height.length;
    const geo = instanced(new THREE.PlaneGeometry(1, 1, 1, kelp ? 10 : 3).translate(0, 0.5, 0), count, {
      aBase: [new Float32Array(base), 3],
      aHeight: [new Float32Array(height), 1],
      aPhase: [new Float32Array(phase), 1],
      aWidth: [new Float32Array(width), 1],
    });
    const signal = token("--signal"), deep = token("--deep"), abyss = token("--abyss");
    const mat = new THREE.ShaderMaterial({
      vertexShader: plantVert,
      fragmentShader: plantFrag,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
        uRoot: { value: mixHex(abyss, signal, kelp ? 0.1 : 0.14) },
        uTip: { value: mixHex(deep, signal, kelp ? 0.42 : 0.55) },
      },
    });
    return new THREE.Mesh(geo, mat);
  };
  return [build("kelp"), build("grass")];
}

// ---------------------------------------------------------------- rocks
const rockVert = /* glsl */ `
uniform float uLift;
attribute vec3 aBase;
attribute vec3 aScale;
attribute float aYaw;
varying vec3 vN;
varying float vDist;
varying vec3 vW;
void main() {
  float g = smoothstep(0.15, 0.85, uLift);
  float c = cos(aYaw), s = sin(aYaw);
  vec3 p = position * aScale * g;
  p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  vec3 n = normal / aScale;
  vN = normalize(vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z));
  vec3 w = vec3(aBase.x, aBase.y * uLift, aBase.z) + p;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const rockFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uRock;
varying vec3 vN;
varying float vDist;
varying vec3 vW;
void main() {
  float lit = 0.32 + 0.68 * max(dot(normalize(vN), normalize(vec3(-0.45, 1.0, -0.35))), 0.0);
  gl_FragColor = vec4(fogged(uRock * lit, vDist, vW), 1.0);
}
`;

function rocks(T: Terrain, shared: U, mobile: boolean) {
  const B = seabed(T);
  const r = rng(11);
  const ico = new THREE.IcosahedronGeometry(1, 2);
  const pos = ico.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = v3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const k = 1 + 0.18 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7) + 0.12 * Math.sin(v.z * 4.3 + v.x * 2.0);
    v.multiplyScalar(k);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;   // flat-ish underside
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  ico.computeVertexNormals();
  const N = mobile ? 90 : 180;
  const base: number[] = [], scale: number[] = [], yaw: number[] = [];
  let tries = 0;
  while (yaw.length < N && tries++ < 8000) {
    const x = (r() * 2 - 1) * B.lim, z = (r() * 2 - 1) * B.lim;
    if (!B.inside(x, z, 0.4)) continue;
    const s = B.at(x, z);
    if (s.t < 0.15 || s.t > 0.9) continue;
    if (r() > 0.25 + s.slope * 1.5) continue;   // more on steep ground
    const sx = 0.07 + r() ** 2 * 0.3;
    if (B.clearance(x, z) < 0.45 + sx) continue;
    const sy = sx * (0.5 + r() * 0.4);
    base.push(x, s.y - sy * 0.3, z);
    scale.push(sx, sy, sx * (0.7 + r() * 0.5));
    yaw.push(r() * Math.PI * 2);
  }
  const geo = instanced(ico, yaw.length, {
    aBase: [new Float32Array(base), 3],
    aScale: [new Float32Array(scale), 3],
    aYaw: [new Float32Array(yaw), 1],
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: rockVert,
    fragmentShader: rockFrag,
    uniforms: {
      uLift: shared.uLift, ...fogU(shared),
      uRock: { value: mixHex(token("--d3"), token("--fog"), 0.16) },
    },
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- reefs: coral and tube worms
const tubeVert = /* glsl */ `
uniform float uTime;
uniform float uLift;
attribute vec3 aBase;
attribute float aHeight;
attribute float aRadius;
attribute float aPhase;
attribute vec3 aTip;
attribute float aGlow;
varying float vY;
varying vec3 vTip;
varying float vGlow;
varying float vPhase;
varying float vDist;
varying vec3 vW;
void main() {
  float y = position.y;
  float h = aHeight * smoothstep(0.35, 1.0, uLift);
  float r = aRadius * (1.0 - 0.25 * y) * (1.0 + 0.3 * smoothstep(0.85, 1.0, y));
  vec3 p = vec3(position.x * r, y * h, position.z * r);
  p.x += sin(uTime * 1.1 + aPhase * 6.28) * 0.05 * y * y * h;
  p.z += cos(uTime * 0.9 + aPhase * 4.0) * 0.04 * y * y * h;
  vec3 w = vec3(aBase.x, aBase.y * uLift, aBase.z) + p;
  vY = y; vTip = aTip; vGlow = aGlow; vPhase = aPhase; vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const tubeFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uStem;
uniform float uTime;
varying float vY;
varying vec3 vTip;
varying float vGlow;
varying float vPhase;
varying float vDist;
varying vec3 vW;
void main() {
  float tip = smoothstep(0.7, 0.97, vY);
  float pulse = 0.65 + 0.35 * sin(uTime * 1.8 + vPhase * 6.28);
  vec3 c = mix(uStem * (0.7 + 0.5 * vY), vTip, tip * mix(0.55, pulse, vGlow));
  float f = fogAmount(vDist, vW) * (1.0 - 0.7 * vGlow * tip);   // bioluminescence cuts through the haze
  gl_FragColor = vec4(mix(c, uBg, f), 1.0);
}
`;

function reefs(T: Terrain, shared: U, mobile: boolean) {
  const B = seabed(T);
  const r = rng(23);
  const basic = token("--route-basic"), advanced = token("--route-advanced"), plankton = token("--plankton");
  const base: number[] = [], height: number[] = [], radius: number[] = [], phase: number[] = [], tip: number[] = [], glow: number[] = [];
  const add = (x: number, z: number, h: number, rad: number, col: THREE.Vector3, g: number) => {
    const s = B.at(x, z);
    base.push(x, s.y - 0.02, z); height.push(h); radius.push(rad); phase.push(r()); tip.push(col.x, col.y, col.z); glow.push(g);
  };
  // a reef around every station, in its route's colour
  T.stations.forEach((st, i) => {
    const w = world(T, st.x, st.y);
    const adv = i >= BASIC_COUNT;
    const col = rgb(adv ? advanced : basic);
    const n = mobile ? 4 : 7;
    let made = 0;
    for (let k = 0; k < 40 && made < n; k++) {
      const ang = r() * Math.PI * 2, rad = 0.3 + r() * 0.6;
      const x = w.x + Math.cos(ang) * rad, z = w.z + Math.sin(ang) * rad;
      if (B.clearance(x, z) < 0.22) continue;
      made++;
      add(x, z, (adv ? 0.12 : 0.08) + r() * (adv ? 0.22 : 0.14), adv ? 0.008 + r() * 0.006 : 0.012 + r() * 0.008, col, adv ? 1 : 0.35);
    }
  });
  // vent fields of glowing tube worms in the abyss
  let fields = 0, tries = 0;
  while (fields < (mobile ? 6 : 12) && tries++ < 4000) {
    const cx = (r() * 2 - 1) * B.lim, cz = (r() * 2 - 1) * B.lim;
    if (!B.inside(cx, cz, 0.8) || B.at(cx, cz).t < 0.66 || B.clearance(cx, cz) < 2.2) continue;   // away from the camera's path
    fields++;
    for (let k = 0; k < (mobile ? 12 : 20); k++) {
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.5;
      const x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad;
      add(x, z, 0.12 + r() * 0.32, 0.008 + r() * 0.007, rgb(r() < 0.6 ? plankton : advanced), 1);
    }
  }
  const geo = instanced(new THREE.CylinderGeometry(1, 1, 1, 7, 6).translate(0, 0.5, 0), height.length, {
    aBase: [new Float32Array(base), 3],
    aHeight: [new Float32Array(height), 1],
    aRadius: [new Float32Array(radius), 1],
    aPhase: [new Float32Array(phase), 1],
    aTip: [new Float32Array(tip), 3],
    aGlow: [new Float32Array(glow), 1],
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: tubeVert,
    fragmentShader: tubeFrag,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
      uStem: { value: mixHex(token("--deep"), token("--fog"), 0.22) },
    },
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- swimmers
// Everything that swims follows one path model: a school centre circling an ellipse, each
// member offset from it, all facing along the path. Shared by fish, anglerfish lures and
// lanternfish sparks so a lure stays on its fish.
const SWIM_GLSL = /* glsl */ `
uniform float uTime;
uniform float uLift;
attribute vec3 aCenter;
attribute vec2 aRadius;
attribute float aSpeed;
attribute float aPhase;
attribute vec3 aOffset;
attribute float aSize;
vec3 swimPath(out float yaw) {
  float ang = uTime * aSpeed + aPhase;
  vec3 c = vec3(aCenter.x, aCenter.y * uLift, aCenter.z);
  vec3 path = c + vec3(cos(ang) * aRadius.x, sin(ang * 0.8) * 0.25, sin(ang) * aRadius.y);
  vec3 tang = vec3(-sin(ang) * aRadius.x, 0.0, cos(ang) * aRadius.y) * sign(aSpeed);
  yaw = atan(tang.x, tang.z);
  return path;
}
vec3 swimWorld(vec3 local, vec3 path, float yaw) {
  vec3 l = local + aOffset + vec3(sin(uTime * 1.3 + aPhase * 7.0) * 0.07, sin(uTime * 1.7 + aPhase * 3.0) * 0.05, 0.0);
  float cy = cos(yaw), sy = sin(yaw);
  return path + vec3(cy * l.x + sy * l.z, l.y, -sy * l.x + cy * l.z);
}
float grown() { return smoothstep(0.55, 1.0, uLift); }
`;

const fishVert = /* glsl */ `
${SWIM_GLSL}
uniform float uWiggle;
varying float vBelly;
varying float vDist;
varying vec3 vW;
void main() {
  float yaw;
  vec3 path = swimPath(yaw);
  vec3 p = position * aSize * grown();
  p.x += sin(uTime * uWiggle + aPhase * 13.0 + position.z * 7.0) * 0.18 * aSize * smoothstep(0.0, -0.55, position.z);
  vec3 w = swimWorld(p, path, yaw);
  vBelly = smoothstep(0.03, -0.06, position.y);
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const fishFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uBack;
uniform vec3 uBelly;
varying float vBelly;
varying float vDist;
varying vec3 vW;
void main() {
  gl_FragColor = vec4(fogged(mix(uBack, uBelly, vBelly), vDist, vW), 1.0);
}
`;

/** glowing points that swim: anglerfish lures and lanternfish */
const sparkVert = /* glsl */ `
${SWIM_GLSL}
uniform float uScale;
uniform float uPx;
attribute vec3 aLocal;
varying float vA;
varying float vDist;
varying vec3 vW;
void main() {
  float yaw;
  vec3 path = swimPath(yaw);
  vec3 w = swimWorld(aLocal * aSize, path, yaw);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_PointSize = uScale * uPx * aSize / -mv.z;
  vA = grown() * (0.65 + 0.35 * sin(uTime * 2.3 + aPhase * 17.0));
  vW = w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const sparkFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uColor;
varying float vA;
varying float vDist;
varying vec3 vW;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float g = pow(smoothstep(0.5, 0.0, d), 2.0);
  float a = g * vA * (1.0 - 0.6 * fogAmount(vDist, vW));
  gl_FragColor = vec4(uColor * a, a);
}
`;

function fishGeometry() {
  // a small low-poly fish, nose along +z: body diamond and a forked tail
  const P = {
    nose: [0, 0, 0.5], top: [0, 0.13, 0.02], bot: [0, -0.11, 0.02], l: [-0.06, 0, 0.05], r: [0.06, 0, 0.05],
    tj: [0, 0, -0.32], tt: [0, 0.15, -0.55], tb: [0, -0.15, -0.55],
  } as const;
  const tris: (keyof typeof P)[][] = [
    ["nose", "top", "l"], ["nose", "l", "bot"], ["nose", "bot", "r"], ["nose", "r", "top"],
    ["top", "tj", "l"], ["l", "tj", "bot"], ["bot", "tj", "r"], ["r", "tj", "top"],
    ["tj", "tt", "tb"],
  ];
  const pos = new Float32Array(tris.flatMap((t) => t.flatMap((k) => P[k])));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

interface SchoolSpec {
  seed: number;
  stations: number[];      // schools gather near these stations
  per: number;             // members per school
  size: [number, number];
  spread: number;          // how loose the school is
  height: [number, number];// above the floor
  radius: [number, number];
  speed: [number, number];
  away: [number, number];  // distance from the route
}

function schoolData(T: Terrain, spec: SchoolSpec) {
  const r = rng(spec.seed);
  const A = { c: [] as number[], rad: [] as number[], sp: [] as number[], ph: [] as number[], off: [] as number[], sz: [] as number[] };
  spec.stations.forEach((i, k) => {
    const st = T.stations[Math.min(T.stations.length - 1, i)];
    const w = world(T, st.x, st.y);
    const side = k % 2 ? 1 : -1;
    const d = spec.away[0] + r() * (spec.away[1] - spec.away[0]);
    const cx = w.x + side * d, cz = w.z + side * d * 0.6;
    const [gx, gy] = grid(T, cx, cz);
    const floor = (T.h(gx, gy) - T.max) * K;
    const cy = Math.max(floor, w.y) + spec.height[0] + r() * (spec.height[1] - spec.height[0]);
    const rx = spec.radius[0] + r() * (spec.radius[1] - spec.radius[0]);
    const rz = rx * (0.55 + r() * 0.3);
    const speed = (spec.speed[0] + r() * (spec.speed[1] - spec.speed[0])) * (r() < 0.5 ? -1 : 1);
    const ph = r() * 6.28;
    for (let f = 0; f < spec.per; f++) {
      A.c.push(cx, cy, cz); A.rad.push(rx, rz); A.sp.push(speed); A.ph.push(ph + (r() - 0.5) * 0.3 * spec.spread);
      A.off.push((r() - 0.5) * spec.spread, (r() - 0.5) * spec.spread * 0.6, (r() - 0.5) * spec.spread);
      A.sz.push(spec.size[0] + r() * (spec.size[1] - spec.size[0]));
    }
  });
  return A;
}

const swimAttrs = (A: ReturnType<typeof schoolData>): Attrs => ({
  aCenter: [new Float32Array(A.c), 3], aRadius: [new Float32Array(A.rad), 2], aSpeed: [new Float32Array(A.sp), 1],
  aPhase: [new Float32Array(A.ph), 1], aOffset: [new Float32Array(A.off), 3], aSize: [new Float32Array(A.sz), 1],
});

function fishSchool(T: Terrain, shared: U, spec: SchoolSpec, back: THREE.Vector3, belly: THREE.Vector3, wiggle: number) {
  const A = schoolData(T, spec);
  const geo = instanced(fishGeometry(), A.sp.length, swimAttrs(A));
  const mat = new THREE.ShaderMaterial({
    vertexShader: fishVert,
    fragmentShader: fishFrag,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
      uBack: { value: back }, uBelly: { value: belly }, uWiggle: { value: wiggle },
    },
  });
  return { mesh: new THREE.Mesh(geo, mat), A };
}

function sparks(shared: U, A: ReturnType<typeof schoolData>, local: number[], color: THREE.Vector3, scale: number) {
  const g = new THREE.InstancedBufferGeometry();
  // one vertex per point: draw the instances as points
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  for (const [k, [arr, size]] of Object.entries(swimAttrs(A))) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, size));
  g.setAttribute("aLocal", new THREE.InstancedBufferAttribute(new Float32Array(local), 3));
  g.instanceCount = A.sp.length;
  const mat = new THREE.ShaderMaterial({
    vertexShader: sparkVert,
    fragmentShader: sparkFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
      uColor: { value: color }, uScale: { value: scale }, uPx: shared.uPx,
    },
  });
  return new THREE.Points(g, mat);
}

/** The swimmers, zoned by depth like the plants: you meet new ones as you go down. */
function swimmers(T: Terrain, shared: U, mobile: boolean) {
  const B = BASIC_COUNT;
  const out: THREE.Object3D[] = [];
  // the shelf: quick schools of small silver fish
  out.push(fishSchool(T, shared, {
    seed: 31, stations: mobile ? [1, 4, 7, 10] : [1, 3, 5, 8, 10, 12], per: mobile ? 22 : 34, size: [0.11, 0.17], spread: 0.5,
    height: [0.8, 1.6], radius: [1.4, 2.6], speed: [0.2, 0.32], away: [1.4, 2.4],
  }, mixHex(token("--d2"), token("--fog"), 0.35), mixHex(token("--fog"), token("--foam"), 0.6), 11).mesh);
  // the slope: fewer, bigger, darker fish, slower
  out.push(fishSchool(T, shared, {
    seed: 37, stations: [B - 2, B + 1, B + 4], per: mobile ? 6 : 9, size: [0.3, 0.42], spread: 1.1,
    height: [0.9, 1.8], radius: [2.0, 3.2], speed: [0.09, 0.14], away: [1.8, 3.0],
  }, mixHex(token("--d4"), token("--cyan"), 0.12), mixHex(token("--d2"), token("--fog"), 0.4), 6).mesh);
  // the trench: anglerfish close to the floor, each with a glowing lure
  const angler = fishSchool(T, shared, {
    seed: 41, stations: [B + 5, B + 8, B + 11, B + 13], per: 1, size: [0.55, 0.7], spread: 0,
    height: [0.25, 0.45], radius: [0.8, 1.3], speed: [0.05, 0.08], away: [1.2, 2.0],
  }, mixHex(token("--abyss"), token("--d3"), 0.5), mixHex(token("--d4"), token("--fog"), 0.2), 4);
  out.push(angler.mesh);
  const lures: number[] = [];
  for (let k = 0; k < angler.A.sp.length; k++) lures.push(0, 0.32, 0.78);
  out.push(sparks(shared, angler.A, lures, mixHex(token("--plankton"), token("--signal"), 0.25), 120));
  // the abyss: lanternfish, seen only as moving sparks of light
  const lantern = schoolData(T, {
    seed: 47, stations: [B + 6, B + 9, B + 12, B + 13], per: mobile ? 26 : 44, size: [0.5, 1], spread: 1.6,
    height: [0.8, 2.4], radius: [1.2, 2.2], speed: [0.12, 0.2], away: [1.5, 3.2],
  });
  const zero = new Array(lantern.sp.length * 3).fill(0);
  out.push(sparks(shared, lantern, zero, mixHex(token("--cyan"), token("--plankton"), 0.5), 42));
  return out;
}

// ---------------------------------------------------------------- manta rays over the slope
const mantaVert = /* glsl */ `
${SWIM_GLSL}
varying float vDist;
varying vec3 vW;
varying float vSpan;
void main() {
  float yaw;
  vec3 path = swimPath(yaw);
  float x = position.x;
  float ax = abs(x) / 0.75;
  vec3 p = vec3(x, 0.0, position.z * (1.0 - pow(ax, 1.25)) - 0.16 * ax * ax);
  p.y = sin(uTime * 1.3 + aPhase * 6.28 - ax * 1.2) * 0.22 * pow(ax, 1.6) + 0.05 * (1.0 - ax);
  vec3 w = swimWorld(p * aSize * grown(), path, yaw);
  vSpan = ax;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const mantaFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uBack;
uniform vec3 uBelly;
varying float vDist;
varying vec3 vW;
varying float vSpan;
void main() {
  vec3 c = gl_FrontFacing ? uBack * (0.85 + 0.3 * (1.0 - vSpan)) : uBelly;
  gl_FragColor = vec4(fogged(c, vDist, vW), 1.0);
}
`;

function mantas(T: Terrain, shared: U, mobile: boolean) {
  const B = BASIC_COUNT;
  const A = schoolData(T, {
    seed: 59, stations: mobile ? [7, B] : [6, 10, B + 1], per: 1, size: [1.1, 1.5], spread: 0,
    height: [1.6, 2.4], radius: [2.6, 3.6], speed: [0.07, 0.1], away: [1.6, 2.6],
  });
  // a flat sheet, nose along +z, wings along x; the shader shapes and flaps it
  const geo = instanced(new THREE.PlaneGeometry(1.5, 0.7, 14, 3).rotateX(-Math.PI / 2), A.sp.length, swimAttrs(A));
  const mat = new THREE.ShaderMaterial({
    vertexShader: mantaVert,
    fragmentShader: mantaFrag,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
      uBack: { value: mixHex(token("--abyss"), token("--d2"), 0.55) },
      uBelly: { value: mixHex(token("--fog"), token("--foam"), 0.4) },
    },
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- siphonophores in the abyss
const chainVert = /* glsl */ `
uniform float uTime;
uniform float uLift;
uniform float uScale;
uniform float uPx;
attribute vec3 aCenter;
attribute float aPhase;
attribute float aT;
varying float vA;
varying float vDist;
varying vec3 vW;
void main() {
  vec3 c = vec3(aCenter.x, aCenter.y * uLift, aCenter.z);
  c.x += sin(uTime * 0.07 + aPhase * 6.0) * 0.6;
  c.z += cos(uTime * 0.05 + aPhase * 4.0) * 0.6;
  float s = aT * 3.4;
  vec3 w = c + vec3(sin(uTime * 0.4 + s * 1.7 + aPhase * 6.28) * 0.35 * aT, -s, cos(uTime * 0.33 + s * 1.3) * 0.25 * aT);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  float travel = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * 2.2 - aT * 14.0 + aPhase * 6.28), 4.0);
  gl_PointSize = uScale * uPx * (1.0 - 0.6 * aT) / -mv.z;
  vA = travel * smoothstep(0.65, 1.0, uLift);
  vW = w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

function siphonophores(T: Terrain, shared: U, mobile: boolean) {
  const B = BASIC_COUNT;
  const r = rng(61);
  const beads = 46;
  const ids = mobile ? [B + 10] : [B + 7, B + 10, B + 13];
  const c: number[] = [], ph: number[] = [], tt: number[] = [], pos: number[] = [];
  ids.forEach((i) => {
    const st = T.stations[Math.min(T.stations.length - 1, i)];
    const w = world(T, st.x, st.y);
    const ang = r() * Math.PI * 2;
    const x = w.x + Math.cos(ang) * (2 + r() * 1.5), z = w.z + Math.sin(ang) * (2 + r() * 1.5);
    const p = r();
    for (let k = 0; k < beads; k++) { c.push(x, w.y + 3.6 + r() * 0.6, z); ph.push(p); tt.push(k / (beads - 1)); pos.push(0, 0, 0); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aCenter", new THREE.BufferAttribute(new Float32Array(c), 3));
  g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(ph), 1));
  g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(tt), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: chainVert,
    fragmentShader: sparkFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared),
      uColor: { value: mixHex(token("--plankton"), token("--signal"), 0.35) }, uScale: { value: 46 }, uPx: shared.uPx,
    },
  });
  return new THREE.Points(g, mat);
}

// ---------------------------------------------------------------- jellyfish (the club's emblem)
const JELLY_MOTION = /* glsl */ `
uniform float uTime;
uniform float uLift;
attribute vec3 aCenter;
attribute float aScale;
attribute float aPhase;
float pulseAt(float ph) { return pow(0.5 + 0.5 * sin(uTime * 1.4 + ph * 6.28), 3.0); }
vec3 jellyCentre() {
  vec3 c = vec3(aCenter.x, aCenter.y * uLift, aCenter.z);
  c.y += sin(uTime * 0.35 + aPhase * 6.28) * 0.35;
  c.x += sin(uTime * 0.11 + aPhase * 4.0) * 0.4;
  c.z += cos(uTime * 0.09 + aPhase * 3.0) * 0.4;
  return c;
}
float show() { return smoothstep(0.55, 1.0, uLift); }
`;
const bellVert = /* glsl */ `
${JELLY_MOTION}
varying vec3 vN;
varying vec3 vView;
varying vec3 vLocal;
varying float vDist;
varying vec3 vW;
void main() {
  float pulse = pulseAt(aPhase);
  vec3 k = vec3(1.0 + 0.16 * pulse, 1.0 - 0.2 * pulse, 1.0 + 0.16 * pulse);
  vec3 w = jellyCentre() + position * k * aScale * show();
  vN = normalize(normal / k);
  vView = normalize(cameraPosition - w);
  vLocal = position;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const bellFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uCore;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vView;
varying vec3 vLocal;
varying float vDist;
varying vec3 vW;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  float ribs = smoothstep(0.9, 1.0, cos(atan(vLocal.z, vLocal.x) * 8.0)) * 0.35;   // the emblem's ribbed dome
  float a = (0.1 + 0.7 * fres + ribs) * (1.0 - 0.8 * fogAmount(vDist, vW));
  gl_FragColor = vec4(mix(uCore, uRim, fres) * a, a);
}
`;
const tentacleVert = /* glsl */ `
${JELLY_MOTION}
attribute float aAng;
attribute float aT;
varying float vT;
varying float vDist;
varying vec3 vW;
void main() {
  float pulse = pulseAt(aPhase);
  float s = aScale * show();
  vec3 rim = vec3(cos(aAng), 0.0, sin(aAng)) * 0.8 * (1.0 + 0.16 * pulse);
  vec3 sway = vec3(sin(uTime * 1.1 + aT * 5.0 + aPhase * 6.28 + aAng), 0.0, cos(uTime * 0.9 + aT * 4.0 + aAng)) * 0.22 * aT;
  vec3 w = jellyCentre() + (rim * (1.0 - 0.4 * aT) + sway + vec3(0.0, -aT * 3.2, 0.0)) * s;
  vT = aT;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const tentacleFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uRim;
varying float vT;
varying float vDist;
varying vec3 vW;
void main() {
  float a = (1.0 - vT) * 0.55 * (1.0 - 0.8 * fogAmount(vDist, vW));
  gl_FragColor = vec4(uRim * a, a);
}
`;

function jellies(T: Terrain, shared: U, mobile: boolean) {
  const B = seabed(T);
  const r = rng(43);
  const c: number[] = [], sc: number[] = [], ph: number[] = [];
  // the big one hangs over the last station, like the emblem over the club
  const last = world(T, T.stations[T.stations.length - 1].x, T.stations[T.stations.length - 1].y);
  c.push(last.x + 0.8, last.y + 2.6, last.z - 1.2); sc.push(0.55); ph.push(0.1);
  let tries = 0;
  while (sc.length < (mobile ? 8 : 15) && tries++ < 4000) {
    const x = (r() * 2 - 1) * B.lim * 0.9, z = (r() * 2 - 1) * B.lim * 0.9;
    if (!B.inside(x, z, 0.5)) continue;
    const s = B.at(x, z);
    if (s.t < 0.42 && r() > 0.15) continue;   // mostly in deep water
    const cl = B.clearance(x, z);
    if (cl < 1.2 || cl > 5) continue;
    c.push(x, s.y + 1.4 + r() * 1.8, z); sc.push(0.16 + r() * 0.16); ph.push(r());
  }
  const n = sc.length;
  const bellGeo = instanced(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), n, {
    aCenter: [new Float32Array(c), 3], aScale: [new Float32Array(sc), 1], aPhase: [new Float32Array(ph), 1],
  });
  // tentacles: line segments, 10 strands of 14 points per jelly, all in one geometry
  const strands = 10, pts = 14;
  const tc: number[] = [], ts: number[] = [], tp: number[] = [], ta: number[] = [], tt: number[] = [], tpos: number[] = [];
  for (let j = 0; j < n; j++) for (let s = 0; s < strands; s++) {
    const ang = (s / strands) * Math.PI * 2 + r() * 0.3;
    for (let k = 0; k < pts - 1; k++) for (const e of [k, k + 1]) {
      tc.push(c[j * 3], c[j * 3 + 1], c[j * 3 + 2]); ts.push(sc[j]); tp.push(ph[j]); ta.push(ang); tt.push(e / (pts - 1)); tpos.push(0, 0, 0);
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tpos), 3));
  tg.setAttribute("aCenter", new THREE.BufferAttribute(new Float32Array(tc), 3));
  tg.setAttribute("aScale", new THREE.BufferAttribute(new Float32Array(ts), 1));
  tg.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(tp), 1));
  tg.setAttribute("aAng", new THREE.BufferAttribute(new Float32Array(ta), 1));
  tg.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(tt), 1));
  const colors = {
    uCore: { value: mixHex(token("--deep"), token("--cyan"), 0.35) },
    uRim: { value: mixHex(token("--plankton"), token("--cyan"), 0.3) },
  };
  const common = { uTime: shared.uTime, uLift: shared.uLift, ...fogU(shared) };
  const glow = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true } as const;
  const bells = new THREE.Mesh(bellGeo, new THREE.ShaderMaterial({ vertexShader: bellVert, fragmentShader: bellFrag, side: THREE.DoubleSide, uniforms: { ...common, ...colors }, ...glow }));
  const tentacles = new THREE.LineSegments(tg, new THREE.ShaderMaterial({ vertexShader: tentacleVert, fragmentShader: tentacleFrag, uniforms: { ...common, uRim: colors.uRim }, ...glow }));
  return [bells, tentacles];
}

// ---------------------------------------------------------------- sunlight shafts over the shelf
const shaftVert = /* glsl */ `
uniform float uLift;
attribute vec3 aBase;
attribute float aWidth;
attribute float aLen;
attribute float aPhase;
varying vec2 vUv2;
varying float vPhase;
varying float vDist;
varying vec3 vW;
void main() {
  vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  vec3 slant = normalize(vec3(0.22, 1.0, 0.14));
  vec3 w = vec3(aBase.x, aBase.y * uLift, aBase.z) + right * position.x * aWidth + slant * position.y * aLen;
  vUv2 = vec2(position.x, position.y);
  vPhase = aPhase;
  vW = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const shaftFrag = /* glsl */ `
${FOG_GLSL}
uniform float uTime;
uniform float uShaft;
uniform vec3 uLight;
varying vec2 vUv2;
varying float vPhase;
varying float vDist;
varying vec3 vW;
void main() {
  float across = pow(1.0 - abs(vUv2.x * 2.0), 2.2);
  float along = smoothstep(0.0, 0.3, vUv2.y) * (0.3 + 0.7 * vUv2.y) * (1.0 - smoothstep(0.85, 1.0, vUv2.y));
  float flicker = 0.7 + 0.3 * sin(uTime * 0.45 + vPhase * 6.28);
  float a = across * along * flicker * uShaft * 0.075 * (1.0 - smoothstep(uFogNear, uFogFar * 1.2, vDist));
  gl_FragColor = vec4(uLight * a, a);
}
`;

function shafts(T: Terrain, shared: U, mobile: boolean) {
  const r = rng(53);
  const base: number[] = [], width: number[] = [], len: number[] = [], phase: number[] = [];
  const n = mobile ? 7 : 13;
  for (let k = 0; k < n; k++) {
    const st = T.stations[Math.floor(r() * (BASIC_COUNT + 2))];
    const w = world(T, st.x, st.y);
    const ang = r() * Math.PI * 2, rad = 1 + r() * 3;
    base.push(w.x + Math.cos(ang) * rad, w.y - 0.2, w.z + Math.sin(ang) * rad);
    width.push(0.6 + r() * 1.4); len.push(7 + r() * 3); phase.push(r());
  }
  const geo = instanced(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), n, {
    aBase: [new Float32Array(base), 3], aWidth: [new Float32Array(width), 1], aLen: [new Float32Array(len), 1], aPhase: [new Float32Array(phase), 1],
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: shaftVert,
    fragmentShader: shaftFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime, uLift: shared.uLift, uShaft: shared.uShaft, ...fogU(shared),
      uLight: { value: mixHex(token("--foam"), token("--plankton"), 0.3) },
    },
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- wrecks (content/wrecks.json)
// A sunken hull beside each station that has a wreck: an open half-cylinder lying on the
// floor, with the rock shading. Decoration that marks real content: the wreck's card in
// the dive holds its number.
function wrecks(T: Terrain, shared: U) {
  if (!WRECKS.length) return null;
  const B = seabed(T);
  const hull = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, true, Math.PI / 2, Math.PI)
    .rotateZ(Math.PI / 2)            // the axis lies along x, the open side up
    .scale(1, 0.75, 1);
  hull.computeVertexNormals();
  const base: number[] = [], scale: number[] = [], yaw: number[] = [];
  WRECKS.forEach((w, k) => {
    const i = STATION_BY_ID[w.station].i, st = T.stations[i];
    const p = world(T, st.x, st.y);
    // to one side of the route (across its direction here), where the island continues
    const d = (i / (T.stations.length - 1)) * T.total, a = T.at(d - 2), c = T.at(d + 2);
    const dir = Math.atan2(c.y - a.y, c.x - a.x) + Math.PI / 2;
    for (const side of [1, -1]) {
      const x = p.x + Math.cos(dir) * side * (1.0 + k * 0.4), z = p.z + Math.sin(dir) * side * (1.0 + k * 0.4);
      if (!B.inside(x, z, 0.5)) continue;
      const s = B.at(x, z);
      base.push(x, s.y + 0.05, z); scale.push(0.9, 0.38, 0.32); yaw.push(dir + 0.6);
      break;
    }
  });
  if (!yaw.length) return null;
  const geo = instanced(hull, yaw.length, { aBase: [new Float32Array(base), 3], aScale: [new Float32Array(scale), 3], aYaw: [new Float32Array(yaw), 1] });
  const mat = new THREE.ShaderMaterial({
    vertexShader: rockVert, fragmentShader: rockFrag, side: THREE.DoubleSide,
    uniforms: { uLift: shared.uLift, ...fogU(shared), uRock: { value: mixHex(token("--d4"), token("--fog"), 0.3) } },
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- the diver's bubbles
const bubbleVert = /* glsl */ `
uniform float uTime;
uniform float uLift;
uniform float uScale;
uniform float uPx;
uniform vec3 uDiver;
attribute float aSeed;
varying float vA;
void main() {
  float t = fract(uTime * 0.22 + aSeed);
  vec3 p = uDiver + vec3(sin(aSeed * 91.0) * 0.1 + sin(uTime * 2.0 + aSeed * 40.0) * 0.05 * t, 0.2 + t * 2.6, cos(aSeed * 57.0) * 0.1);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * uPx * (0.5 + aSeed * 0.8) * (0.6 + t) / -mv.z;
  vA = (1.0 - t) * smoothstep(0.0, 0.08, t) * smoothstep(0.8, 1.0, uLift);
  gl_Position = projectionMatrix * mv;
}
`;
const bubbleFrag = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float ring = smoothstep(0.5, 0.42, d) * (0.35 + 0.65 * smoothstep(0.22, 0.38, d));
  gl_FragColor = vec4(uColor, ring * vA * 0.7);
}
`;

function bubbles(shared: U) {
  const n = 36;
  const seed = new Float32Array(n).map((_, i) => (i * 0.618034) % 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: bubbleVert,
    fragmentShader: bubbleFrag,
    transparent: true, depthWrite: false,
    uniforms: { uTime: shared.uTime, uLift: shared.uLift, uDiver: shared.uDiver, uScale: { value: 70 }, uPx: shared.uPx, uColor: { value: rgb(token("--foam")) } },
  });
  return new THREE.Points(g, mat);
}

export function Life({ T, uniforms, mobile }: { T: Terrain; uniforms: U; mobile: boolean }) {
  const objects = useMemo(() => {
    const list: THREE.Object3D[] = [
      ...plants(T, uniforms, mobile),
      rocks(T, uniforms, mobile),
      reefs(T, uniforms, mobile),
      ...swimmers(T, uniforms, mobile),
      mantas(T, uniforms, mobile),
      ...jellies(T, uniforms, mobile),
      siphonophores(T, uniforms, mobile),
      shafts(T, uniforms, mobile),
      bubbles(uniforms),
    ];
    const hulls = wrecks(T, uniforms);
    if (hulls) list.push(hulls);
    list.forEach((o) => {
      o.frustumCulled = false;
      // transparent glows draw after the solid life
      const m = (o as THREE.Mesh).material as THREE.Material;
      if (m.transparent) o.renderOrder = 10;
    });
    return list;
  }, [T, uniforms, mobile]);
  return (
    <group>
      {objects.map((o, i) => <primitive key={i} object={o} />)}
    </group>
  );
}
