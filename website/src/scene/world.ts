// World units shared by the scene's parts. The chart is S x S units centred on the origin;
// height is (log-loss - max) * K, so the highest loss is y = 0 and the floor goes down.
import * as THREE from "three";
import type { Terrain } from "../lib/terrain";
import { rgba } from "../lib/theme";

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

/** fog and edge fade into the water colour, shared by every shader in the scene */
export const FOG_GLSL = /* glsl */ `
uniform vec3 uBg;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHalf;
float fogAmount(float dist, vec3 w) {
  float f = smoothstep(uFogNear, uFogFar, dist);
  float e = smoothstep(uHalf * 0.72, uHalf * 0.98, max(abs(w.x), abs(w.z)));
  return max(f, e);
}
vec3 fogged(vec3 c, float dist, vec3 w) { return mix(c, uBg, fogAmount(dist, w)); }
`;
