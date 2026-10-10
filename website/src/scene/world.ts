// World units shared by the scene's parts. The chart is S x S units centred on the origin;
// height is (log-loss - max) * K, so the highest loss is y = 0 and the floor goes down.
import * as THREE from "three";
import type { Terrain } from "../lib/terrain";
import { rgba } from "../lib/theme";
import { ISLAND_N, type Island } from "../lib/island";

export const S = 24;
export const K = 1.0;

export type V3 = THREE.Vector3;
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rgb = (hex: string) => v3(...(rgba(hex).slice(0, 3) as [number, number, number]));

/** grid coordinates to world, at full relief */
export function world(T: Terrain, gx: number, gy: number, lift = 0, out: V3 = v3()): V3 {
  return out.set((gx / (T.n - 1) - 0.5) * S, (T.h(gx, gy) - T.max) * K + lift, (gy / (T.n - 1) - 0.5) * S);
}

/** world x, z to grid coordinates */
export const grid = (T: Terrain, x: number, z: number) => [(x / S + 0.5) * (T.n - 1), (z / S + 0.5) * (T.n - 1)] as const;

/** seeded random numbers, so the seafloor looks the same on every visit */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The island mask as a texture: the field from lib/island.ts, 8 bits, signed distance
 *  in world units mapped from [-ISLAND_RANGE, ISLAND_RANGE] to 0..1 (8-bit, so linear
 *  filtering works on every WebGL2 device; float textures may not filter on phones). */
export const ISLAND_RANGE = 4;
export function islandTexture(I: Island) {
  const data = new Uint8Array(I.n * I.n * 2);
  const enc = (v: number) => Math.round(Math.min(1, Math.max(0, v / (2 * ISLAND_RANGE) + 0.5)) * 255);
  for (let k = 0; k < I.n * I.n; k++) { data[k * 2] = enc(I.field[k]); data[k * 2 + 1] = enc(I.main[k]); }
  const tex = new THREE.DataTexture(data, I.n, I.n, THREE.RGFormat, THREE.UnsignedByteType);
  tex.unpackAlignment = 2;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** GLSL: the island field at world x, z (texel centres sit on the field's samples). The
 *  islets (red channel only) belong to the flat chart and sink away as it lifts. */
export const ISLAND_GLSL = /* glsl */ `
uniform sampler2D uIsland;
uniform float uHalf;
uniform float uLift;
float islandAt(vec2 xz) {
  vec2 uv = (xz / (2.0 * uHalf) + 0.5) * ${((ISLAND_N - 1) / ISLAND_N).toFixed(6)} + ${(0.5 / ISLAND_N).toFixed(6)};
  vec2 f = (texture2D(uIsland, uv).rg - 0.5) * ${(2 * ISLAND_RANGE).toFixed(1)};
  return mix(f.x, f.y, smoothstep(0.05, 0.45, uLift));
}
`;

/** Fog, the island's edge, and the cutaway, shared by every sea-life shader. The cutaway
 *  dissolves whatever stands between the camera and the diver (kelp, rocks, a passing
 *  fish), so the view along the route is never blocked; it fades in with the relief. */
export const FOG_GLSL = /* glsl */ `
${ISLAND_GLSL}
uniform vec3 uBg;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCutTo;
uniform float uCut;
void cutaway(vec3 w) {
  if (uCut < 0.01) return;
  vec3 a = cameraPosition;
  vec3 ab = uCutTo + vec3(0.0, 0.12, 0.0) - a;
  float t = clamp(dot(w - a, ab) / dot(ab, ab), 0.0, 1.0);
  float d = distance(w, a + ab * t);
  float r = mix(1.25, 0.45, t);
  // keep what is beside the line of sight, and what is right at the diver (the station's reef)
  float keep = max(smoothstep(r * 0.5, r, d), smoothstep(0.88, 0.98, t));
  keep = mix(1.0, keep, uCut);
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (keep < ign) discard;
}
float fogAmount(float dist, vec3 w) {
  cutaway(w);
  float f = smoothstep(uFogNear, uFogFar, dist);
  float e = 1.0 - smoothstep(-0.7, 0.25, islandAt(w.xz));   // off the island, into the water
  return max(f, e);
}
vec3 fogged(vec3 c, float dist, vec3 w) { return mix(c, uBg, fogAmount(dist, w)); }
`;

type U = Record<string, THREE.IUniform>;
/** the uniforms FOG_GLSL needs, taken from the scene's shared set */
export const fogU = (shared: U): U => ({
  uBg: shared.uBg, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uHalf: shared.uHalf,
  uIsland: shared.uIsland, uCutTo: shared.uDiver, uCut: shared.uCut, uLift: shared.uLift,
});
