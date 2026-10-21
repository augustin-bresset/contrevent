// Morceaux de GLSL partagés. Tout le rendu travaille directement en valeurs d'écran :
// c'est un dessin à plat, pas une scène physique.
export const NB_REMOUS = 8;

// Le vent de jeu, identique à `ventInstant` dans jeu/vent.js.
export const GLSL_VENT = /* glsl */`
uniform sampler2D tVent;
uniform vec2 uAnneau;
uniform vec4 uRemous[${NB_REMOUS}];     // x, s, rayon, force (signe = sens)
uniform vec3 uFront;                    // front (s), queue (s), multiplicateur
uniform vec4 uNavire;                   // x, s, rayon, présence
uniform float uRespir;                  // rafales globales

float masqueTempete(float s) {
  return smoothstep(uFront.x - 34.0, uFront.x + 34.0, s) * (1.0 - smoothstep(uFront.y - 90.0, uFront.y + 90.0, s));
}
vec2 ventIci(vec2 p) {
  vec2 w = texture2D(tVent, p / uAnneau).xy * uRespir;
  float m = masqueTempete(p.y);
  w *= 1.0 + (uFront.z - 1.0) * m;
  if (uNavire.w > 0.0) {
    vec2 d = (p - uNavire.xy) / vec2(uNavire.z * 0.8, uNavire.z * 1.5);
    d.y += 0.6;
    w *= 1.0 - 0.9 * uNavire.w * exp(-dot(d, d));
  }
  for (int i = 0; i < ${NB_REMOUS}; i++) {
    vec4 r = uRemous[i];
    if (r.z <= 0.0) continue;
    vec2 d = p - r.xy; float q = dot(d, d) / (r.z * r.z), e = exp(-q);
    w += vec2(-d.y, d.x) / r.z * r.w * e;           // rotation
    w -= d / r.z * abs(r.w) * 0.34 * e;             // aspiration
  }
  return w;
}`;

export const GLSL_ECRAN_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Ce que partagent le sol, les monuments, les semis et le ciel : même lumière, même nuit, même furvent.
export const GLSL_COMMUN = /* glsl */`
uniform sampler2D tPal, tBruit;
uniform vec2 uAnneau;                     // le terrain chargé : il tourne sur lui-même, s modulo la longueur de l'anneau
uniform vec3 uFrontT, uSoleil, uSoleilC;   // front, queue, présence ; soleil du dessin ; soleil du ciel
uniform float uTemps, uNuit, uBrouillard, uReve, uSv, uEclair, uBande;
vec3 palette(int col, float s) { return texture2D(tPal, vec2((float(col) + 0.5) / 7.0, s)).rgb; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) { return texture2D(tBruit, p / 256.0).r; }
float fbm3(vec2 p) {
  vec4 a = texture2D(tBruit, p / 256.0), b = texture2D(tBruit, (p * 2.1 + 3.1) / 256.0);
  return 0.55 * a.r + 0.3 * b.g + 0.15 * texture2D(tBruit, (p * 4.3 + 7.7) / 256.0).b;
}
float tempeteA(float s) {
  return smoothstep(uFrontT.x - 34.0, uFrontT.x + 34.0, s) * (1.0 - smoothstep(uFrontT.y - 90.0, uFrontT.y + 90.0, s)) * uFrontT.z;
}
const vec3 BLANC_FIN = vec3(0.984, 0.98, 0.973);
vec3 horizon() {
  vec3 c = mix(palette(4, uSv), vec3(0.06, 0.09, 0.17), uNuit);
  return mix(c, vec3(0.03, 0.028, 0.034), tempeteA(uSv * uBande));
}
vec3 couleurCiel(vec3 d) {
  vec3 hor = horizon();
  float t = tempeteA(uSv * uBande), y = max(d.y, 0.0);
  vec3 zen = mix(mix(palette(0, uSv), vec3(0.34, 0.5, 0.74), 0.55) * 0.95, vec3(0.012, 0.02, 0.05), uNuit);
  zen = mix(zen, vec3(0.012, 0.011, 0.014), t);
  vec3 c = mix(hor, zen, 1.0 - exp(-y * 3.4));
  c += vec3(0.62, 0.66, 0.8) * uEclair * t;
  // Le soleil et sa nappe, tant qu'il fait jour.
  float s = max(dot(d, uSoleilC), 0.0), jour = (1.0 - uNuit) * (1.0 - t);
  c += vec3(1.0, 0.86, 0.66) * (pow(s, 7.0) * 0.14 + pow(s, 60.0) * 0.22) * jour;
  c += vec3(1.6, 1.5, 1.35) * smoothstep(0.9993, 0.9997, s) * jour;
  // Les nuages : le même lavis que le sol, posés sur un plan haut.
  if (d.y > 0.01) {
    vec2 q = d.xz / (d.y + 0.14) * 1.5 + vec2(0.0, uTemps * 0.012);
    float n = smoothstep(0.42, 0.74, fbm3(q) + 0.12 * bruit(q * 7.0));
    float bord = smoothstep(0.0, 0.16, d.y);
    vec3 cn = mix(mix(palette(1, uSv), vec3(1.0), 0.45), hor * 0.74, smoothstep(0.55, 0.95, fbm3(q + 0.14)));
    cn = mix(cn, vec3(0.07, 0.1, 0.18), uNuit); cn = mix(cn, vec3(0.12, 0.08, 0.06), t);
    c = mix(c, cn, n * bord * 0.86);
  }
  if (uNuit > 0.0 && d.y > 0.0) {
    vec2 g = floor(d.xz / (d.y + 0.3) * 150.0);
    c += vec3(0.9, 0.93, 1.0) * step(0.9965, hash(g)) * hash(g + 3.0) * uNuit * smoothstep(0.02, 0.2, d.y);
  }
  return mix(c, BLANC_FIN, uReve);
}
// La brume s'allume du côté du soleil : c'est ce qui donne l'air, entre la Horde et l'horizon.
vec3 brume(vec3 pos) {
  vec3 d = normalize(vec3(pos.x, pos.y, -pos.z) - cameraPosition);
  float s = pow(max(dot(d, uSoleilC), 0.0), 6.0) * (1.0 - uNuit) * (1.0 - tempeteA(pos.z));
  return horizon() + vec3(0.42, 0.33, 0.2) * s;
}
// Lumière, furvent, nuit, lointain, pour tout ce qui n'est pas le sol. pos : x, y, s.
vec3 atmosphere(vec3 col, float l, vec3 pos, float prof) {
  float t = tempeteA(pos.z);
  col = mix(col, mix(vec3(0.03, 0.028, 0.036), vec3(0.62, 0.42, 0.28), l * 0.6), t);
  col = mix(col, mix(vec3(0.05, 0.075, 0.15), vec3(0.3, 0.4, 0.58), l * 0.7) * mix(vec3(1.0), col * 1.6, 0.35), uNuit * (1.0 - t));
  col += vec3(0.5, 0.52, 0.62) * uEclair * t * (0.3 + l);
  col = mix(col, brume(pos), smoothstep(uBrouillard * 0.5, uBrouillard * 1.25, prof));
  return mix(col, BLANC_FIN, uReve);
}`;

// L'ombre des monuments et des rochers : un cercle de six lectures, tourné d'un angle différent à chaque pixel.
export const GLSL_OMBRE = /* glsl */`
uniform sampler2D tOmbre; uniform float uOmbreOn;
float ombrePortee(vec4 om, vec2 frag) {
  if (uOmbreOn < 0.5) return 0.0;
  vec3 p = om.xyz / om.w * 0.5 + 0.5;
  if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99 || p.z > 1.0) return 0.0;
  float a = hash(frag * 0.137) * 6.283, s = sin(a), c = cos(a), o = 0.0;
  mat2 m = mat2(c, -s, s, c);
  const vec2 D0 = vec2(0.53, 0.2), D1 = vec2(-0.2, 0.62), D2 = vec2(-0.72, -0.17), D3 = vec2(0.3, -0.72), D4 = vec2(0.9, 0.42), D5 = vec2(-0.5, 0.9);
  float R = 0.00048, b = p.z - 0.00032;
  o += step(texture2D(tOmbre, p.xy + m * D0 * R).r, b);
  o += step(texture2D(tOmbre, p.xy + m * D1 * R).r, b);
  o += step(texture2D(tOmbre, p.xy + m * D2 * R).r, b);
  o += step(texture2D(tOmbre, p.xy + m * D3 * R).r, b);
  o += step(texture2D(tOmbre, p.xy + m * D4 * R).r, b);
  o += step(texture2D(tOmbre, p.xy + m * D5 * R).r, b);
  return o / 6.0;
}`;
