// The seafloor shader. One pass draws the whole chart in relief:
// depth tint (the --d0..--d6 ramp), hillshade lit from the north-west, isobaths every 0.25
// in log-loss with Tanaka lighting (lit on slopes facing the light, shaded on the others),
// an index isobath every e-fold in signal green, the diver's sonar sweep, faint caustics in
// shallow water, and haze into the abyss with distance. Only the island is drawn: outside
// its coast (lib/island.ts) the floor is cut away, and the coast is drawn like a chart's.
import { FOG_GLSL, ISLAND_GLSL } from "./world";

export const terrainVert = /* glsl */ `
attribute float aH;
attribute vec2 aG;
varying float vH;
varying vec2 vG;
varying vec3 vW;
varying float vDist;
void main() {
  vH = aH;
  vG = aG;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const terrainFrag = /* glsl */ `
${ISLAND_GLSL}
uniform vec3 uRamp[7];
uniform float uMin;
uniform float uMax;
uniform float uRelief;
uniform float uShadeBase;
uniform float uShadeAmp;
uniform vec4 uIso;
uniform vec4 uIsoIndex;
uniform vec4 uIsoLit;
uniform vec4 uIsoShade;
uniform vec3 uBg;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform vec3 uDiver;
uniform vec3 uPingColor;
uniform float uPing;
uniform float uCaustic;
varying float vH;
varying vec2 vG;
varying vec3 vW;
varying float vDist;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float isoline(float v, float width) {
  float w = fwidth(v);
  float d = abs(fract(v - 0.5) - 0.5) / max(w, 1e-5);
  return 1.0 - clamp(d - width, 0.0, 1.0);
}

void main() {
  float isl = islandAt(vW.xz);
  if (isl < -0.02) discard;

  // depth tint: high loss is shallow water, low loss the abyss
  float t = clamp((uMax - vH) / (uMax - uMin), 0.0, 1.0);
  float f = t * 6.0;
  vec3 c = uRamp[0];
  c = mix(c, uRamp[1], clamp(f, 0.0, 1.0));
  c = mix(c, uRamp[2], clamp(f - 1.0, 0.0, 1.0));
  c = mix(c, uRamp[3], clamp(f - 2.0, 0.0, 1.0));
  c = mix(c, uRamp[4], clamp(f - 3.0, 0.0, 1.0));
  c = mix(c, uRamp[5], clamp(f - 4.0, 0.0, 1.0));
  c = mix(c, uRamp[6], clamp(f - 5.0, 0.0, 1.0));

  // hillshade from the full relief, so the flat chart is shaded like a printed map
  vec3 n = normalize(vec3(-vG.x * uRelief, 1.0, -vG.y * uRelief));
  vec3 L = normalize(vec3(-0.55, 0.63, -0.55));
  c *= uShadeBase + uShadeAmp * (dot(n, L) - 0.6);

  // the seabed in relief: sand grain everywhere, ripples where the floor is flat
  if (uCaustic > 0.0) {
    float grain = vnoise(vW.xz * 3.0) * 0.6 + vnoise(vW.xz * 13.0) * 0.4;
    float flat1 = 1.0 - smoothstep(0.05, 0.5, length(vG));
    float ripple = sin(dot(vW.xz, vec2(0.8, 0.6)) * 16.0 + vnoise(vW.xz * 1.5) * 7.0);
    c *= 1.0 + uLift * ((grain - 0.5) * 0.22 + ripple * 0.05 * flat1);
  }

  // caustics: faint moving light in shallow water (dark theme only)
  if (uCaustic > 0.0) {
    vec2 q = vW.xz * 1.7;
    float k = sin(q.x + uTime * 0.6) * sin(q.y * 1.3 - uTime * 0.45) + sin((q.x + q.y) * 0.8 + uTime * 0.3);
    c += uCaustic * smoothstep(0.9, 1.9, k) * (1.0 - t) * 0.09 * uLift;
  }

  // Tanaka isobaths
  float slope = length(vG);
  float face = slope > 1e-4 ? dot(-vG / slope, normalize(vec2(-0.55, -0.55))) : 0.0;
  float line = isoline(vH / 0.25, 0.35);
  vec4 tanaka = mix(uIsoShade, uIsoLit, face * 0.5 + 0.5);
  float strength = smoothstep(0.0, 0.15, slope);
  line *= 1.0 - 0.5 * uLift * uCaustic;   // in relief the minor isobaths step back; the index ones stay
  c = mix(c, tanaka.rgb, tanaka.a * line * strength * 1.4);
  c = mix(c, uIso.rgb, uIso.a * line);
  float idx = isoline(vH, 0.25);
  c = mix(c, uIsoIndex.rgb, uIsoIndex.a * idx * 0.6);

  // sonar sweep from the diver, draped on the floor
  float r = distance(vW.xz, uDiver.xz);
  float band = 1.0 - smoothstep(0.0, 0.07, abs(r - uPing * 3.2));
  c += uPingColor * band * (1.0 - uPing) * 0.55;
  c += uPingColor * (1.0 - smoothstep(0.0, 0.5, r)) * 0.06;

  // the coastline: a fine line in the index-isobath colour, as on a printed chart
  float coast = 1.0 - smoothstep(0.0, 0.06 + 1.5 * fwidth(isl), isl);
  c = mix(c, uIsoIndex.rgb, coast * 0.85);

  // haze with distance
  float fog = smoothstep(uFogNear, uFogFar, vDist);
  c = mix(c, uBg, fog);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const planktonVert = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 6.28) * 0.35;
  p.y += sin(uTime * 0.17 + aSeed * 12.1) * 0.25;
  p.z += cos(uTime * 0.09 + aSeed * 3.7) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * (0.6 + aSeed) / -mv.z;
  vA = 0.35 + 0.65 * fract(aSeed * 7.3);
  gl_Position = projectionMatrix * mv;
}
`;

export const planktonFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vA * uAlpha);
}
`;

// The island's cut face: a wall under each coastline, like the side of a relief model cut
// out of the sea. It carries faint strata at the chart's isobath levels (every 0.25 in
// ln(loss)) and fades into the water with depth. It sits inside the relief group, so it
// flattens with the chart.
export const wallVert = /* glsl */ `
uniform float uBottom;
attribute float aTop;
attribute float aY;
attribute vec2 aN;
varying float vY;
varying float vTopY;
varying vec3 vW;
varying float vDist;
varying float vLit;
void main() {
  vec4 w = modelMatrix * vec4(position.x, mix(uBottom, aY + 0.004, aTop), position.z, 1.0);
  vTopY = (modelMatrix * vec4(position.x, aY, position.z, 1.0)).y;
  vY = w.y;
  vW = w.xyz;
  vLit = 0.5 + 0.5 * abs(dot(normalize(aN), normalize(vec2(-0.55, -0.55))));
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
export const wallFrag = /* glsl */ `
${FOG_GLSL}
uniform vec3 uTopC;
uniform vec3 uIsoC;
uniform float uMaxH;
uniform float uK;
varying float vY;
varying float vTopY;
varying vec3 vW;
varying float vDist;
varying float vLit;
void main() {
  cutaway(vW);
  // the face nearest the camera dissolves, so the outside of the coast never fills the view
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (smoothstep(3.0, 6.5, distance(vW, cameraPosition)) < ign) discard;
  float below = vTopY - vY;
  float fade = smoothstep(0.0, 2.8, below);
  vec3 c = mix(uTopC * vLit, uBg, fade);
  float lv = (vY / uK + uMaxH) / 0.25;
  float line = 1.0 - smoothstep(0.0, 1.2 * fwidth(lv), abs(fract(lv - 0.5) - 0.5));
  c = mix(c, uIsoC, line * 0.4 * (1.0 - fade));
  c = mix(c, uBg, smoothstep(uFogNear, uFogFar, vDist));
  gl_FragColor = vec4(c, 1.0);
}
`;
