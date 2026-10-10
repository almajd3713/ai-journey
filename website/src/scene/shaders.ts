// The seafloor shader. One pass draws the whole chart in relief:
// depth tint (the --d0..--d6 ramp), hillshade lit from the north-west, isobaths every 0.25
// in log-loss with Tanaka lighting (lit on slopes facing the light, shaded on the others),
// an index isobath every e-fold in signal green, the diver's sonar sweep, faint caustics in
// shallow water, and haze into the abyss with distance.
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
uniform float uHalf;
uniform float uTime;
uniform vec3 uDiver;
uniform vec3 uPingColor;
uniform float uPing;
uniform float uCaustic;
varying float vH;
varying vec2 vG;
varying vec3 vW;
varying float vDist;

float isoline(float v, float width) {
  float w = fwidth(v);
  float d = abs(fract(v - 0.5) - 0.5) / max(w, 1e-5);
  return 1.0 - clamp(d - width, 0.0, 1.0);
}

void main() {
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

  // caustics: faint moving light in shallow water (dark theme only)
  if (uCaustic > 0.0) {
    vec2 q = vW.xz * 1.7;
    float k = sin(q.x + uTime * 0.6) * sin(q.y * 1.3 - uTime * 0.45) + sin((q.x + q.y) * 0.8 + uTime * 0.3);
    c += uCaustic * smoothstep(0.9, 1.9, k) * (1.0 - t) * 0.05;
  }

  // Tanaka isobaths
  float slope = length(vG);
  float face = slope > 1e-4 ? dot(-vG / slope, normalize(vec2(-0.55, -0.55))) : 0.0;
  float line = isoline(vH / 0.25, 0.35);
  vec4 tanaka = mix(uIsoShade, uIsoLit, face * 0.5 + 0.5);
  float strength = smoothstep(0.0, 0.15, slope);
  c = mix(c, tanaka.rgb, tanaka.a * line * strength * 1.4);
  c = mix(c, uIso.rgb, uIso.a * line);
  float idx = isoline(vH, 0.25);
  c = mix(c, uIsoIndex.rgb, uIsoIndex.a * idx * 0.6);

  // sonar sweep from the diver, draped on the floor
  float r = distance(vW.xz, uDiver.xz);
  float band = 1.0 - smoothstep(0.0, 0.07, abs(r - uPing * 3.2));
  c += uPingColor * band * (1.0 - uPing) * 0.55;
  c += uPingColor * (1.0 - smoothstep(0.0, 0.5, r)) * 0.06;

  // haze with distance, and fade the square edges into the background
  float fog = smoothstep(uFogNear, uFogFar, vDist);
  float edge = smoothstep(uHalf * 0.72, uHalf * 0.98, max(abs(vW.x), abs(vW.z)));
  c = mix(c, uBg, max(fog, edge));
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
