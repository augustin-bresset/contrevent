// Morceaux de GLSL partagés. Tout travaille en lumière réelle (valeurs linéaires, au-delà de 1) : le film se fait à la fin.
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

// Ce que partage tout ce qui reçoit de la lumière : le ciel, le soleil, la nuit, le furvent.
export const GLSL_COMMUN = /* glsl */`
uniform sampler2D tPal, tBruit, tCiel, tL;
uniform vec2 uAnneau;                     // le terrain chargé : il tourne sur lui-même, s modulo la longueur de l'anneau
uniform vec3 uFrontT, uSoleil, uSoleilCol, uFeu;
uniform float uTemps, uNuit, uBrouillard, uReve, uSv, uEclair, uBande, uBrume, uBrumeH;
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
const vec3 BLANC_FIN = vec3(1.9, 1.88, 1.85);
const float PI = 3.14159265;
vec2 uvCiel(vec3 d) {
  float l = asin(clamp(d.y, -1.0, 1.0)) / 1.5708;
  return vec2(atan(d.z, d.x) / 6.28318 + 0.5, 0.5 + 0.5 * sign(l) * sqrt(abs(l)));
}
vec3 cielLu(vec3 d) { return textureLod(tCiel, uvCiel(d), 0.0).rgb; }
// La lumière du ciel reçue par une face : la table, très floue.
vec3 cielDiffus(vec3 n) { return textureLod(tCiel, uvCiel(normalize(n + vec3(0.0, 0.5, 0.0))), 5.0).rgb; }
// Le reflet d'un ciel, de plus en plus flou avec la rugosité.
vec3 cielReflet(vec3 r, float rug) { r.y = abs(r.y); return textureLod(tCiel, uvCiel(r), rug * 5.0).rgb; }
// Le lobe de Cook-Torrance, sans la part diffuse. E : ce que reçoit la face.
vec3 ggx(vec3 n, vec3 v, vec3 l, float rug, vec3 f0, vec3 E) {
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0), nv = max(dot(n, v), 1e-3), nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
  float a = rug * rug, a2 = a * a, q = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * q * q);
  float k = (rug + 1.0) * (rug + 1.0) / 8.0, G = 1.0 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  return D * G * F * 0.25 * nl * E;
}
// Le soleil que le relief laisse passer. Haut au-dessus du sol, on sort de l'ombre des collines.
float soleilRelief(vec3 P, float haut) { return mix(texture2D(tL, vec2(P.x, -P.z) / uAnneau).r, 1.0, smoothstep(2.0, 40.0, haut)); }
// Une surface mate ordinaire : pour tout ce qui n'a pas de raison d'être plus compliqué.
vec3 eclairer(vec3 alb, vec3 n, vec3 P, float rug, float vis, float occl) {
  vec3 v = normalize(cameraPosition - P);
  float t = tempeteA(-P.z), nl = max(dot(n, uSoleil), 0.0);
  vec3 sun = uSoleilCol * vis * (1.0 - 0.94 * t);
  vec3 amb = cielDiffus(n) * occl * (1.0 - 0.7 * t);
  // Le sol clair renvoie le soleil par en dessous : c'est lui qui éclaire les faces à l'ombre.
  vec3 rebond = palette(1, clamp(-P.z / uBande, 0.0, 1.0)) * uSoleilCol * 0.09 * (0.6 - 0.4 * n.y) * occl;
  vec3 c = alb * (sun * nl + amb + rebond);
  // Le feu du camp éclaire tout ce qui est autour de lui, du côté où il est.
  if (uFeu.z > 0.01) {
    vec3 d = vec3(uFeu.x - P.x, 1.0, -uFeu.y - P.z); float l2 = dot(d, d);
    c += alb * vec3(1.0, 0.5, 0.2) * uFeu.z * max(dot(n, normalize(d)), 0.0) * 260.0 / (l2 + 40.0) * (0.92 + 0.08 * sin(uTemps * 11.0));
  }
  c += ggx(n, v, uSoleil, rug, vec3(0.04), sun);
  return mix(c, BLANC_FIN, uReve);
}`;

// La glace : profonde dans les creux, traversée de lumière, vive sur ses arêtes. Elle a besoin de GLSL_COMMUN.
export const GLSL_GLACE = /* glsl */`
vec3 glace(vec3 P, vec3 n, float ao, float ar, float vis) {
  if (dot(n, cameraPosition - P) < 0.0) n = -n;
  vec3 V = normalize(cameraPosition - P);
  float t = tempeteA(-P.z), fr = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 amb = cielDiffus(n) * (1.0 - 0.7 * t), sun = uSoleilCol * vis * (1.0 - 0.94 * t);
  // On voit à travers : le ciel, teinté par l'épaisseur.
  vec3 r = refract(-V, n, 0.76);
  vec3 dedans = cielLu(normalize(vec3(r.x, abs(r.y) + 0.25, r.z))) * vec3(0.3, 0.66, 0.84);
  vec3 prof = mix(vec3(0.012, 0.075, 0.14), vec3(0.09, 0.36, 0.52), ao) * (amb * 1.4 + sun * max(dot(n, uSoleil), 0.0) * 0.5);
  vec3 c = mix(prof, dedans, 0.5);
  c += vec3(0.16, 0.5, 0.66) * uSoleilCol * vis * pow(max(dot(-V, uSoleil), 0.0), 4.0) * 0.5;      // le soleil qui la traverse
  c += vec3(0.8, 0.95, 1.0) * smoothstep(0.58, 0.9, ar) * (amb * 0.7 + sun * 0.16);                // les arêtes accrochent
  c = mix(c, cielReflet(reflect(-V, n), 0.04), clamp(0.03 + fr, 0.0, 1.0));
  c += ggx(n, V, uSoleil, 0.16, vec3(0.03), sun);
  return mix(c, BLANC_FIN, uReve);
}`;

// L'ombre des monuments, des rochers et des corps : deux cartes vues du soleil, une serrée autour de la Horde, une large.
export const GLSL_OMBRE = /* glsl */`
uniform highp sampler2DShadow tOmbre, tOmbreP; uniform float uOmbreOn; uniform mat4 uOmbreM, uOmbrePM; uniform vec2 uOmbreT;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float pcf(highp sampler2DShadow t, vec3 p, float R, float a) {
  float s = sin(a), c = cos(a), o = 0.0; mat2 m = mat2(c, -s, s, c);
  o += texture(t, vec3(p.xy + m * vec2(0.53, 0.2) * R, p.z));
  o += texture(t, vec3(p.xy + m * vec2(-0.2, 0.62) * R, p.z));
  o += texture(t, vec3(p.xy + m * vec2(-0.72, -0.17) * R, p.z));
  o += texture(t, vec3(p.xy + m * vec2(0.3, -0.72) * R, p.z));
  return o * 0.25;
}
// La part de soleil qui arrive jusque-là : 1 en pleine lumière.
float soleilVu(vec3 P, vec2 frag) {
  if (uOmbreOn < 0.5) return 1.0;
  float a = ign(frag) * 6.283;
  vec4 q = uOmbrePM * vec4(P, 1.0); vec3 p = q.xyz * 0.5 + 0.5;
  if (all(greaterThan(p.xy, vec2(0.02))) && all(lessThan(p.xy, vec2(0.98)))) {
    p.z -= 0.00022;
    return pcf(tOmbreP, p, uOmbreT.y * 1.6, a);
  }
  q = uOmbreM * vec4(P, 1.0); p = q.xyz * 0.5 + 0.5;
  if (any(lessThan(p.xy, vec2(0.01))) || any(greaterThan(p.xy, vec2(0.99))) || p.z > 1.0) return 1.0;
  p.z -= 0.00032;
  return pcf(tOmbre, p, uOmbreT.x * 1.4, a);
}`;
