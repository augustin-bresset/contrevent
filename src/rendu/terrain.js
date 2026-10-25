// Le sol. Une seule maille qui suit la caméra par anneaux concentriques, fine sous les pieds, large à l'horizon ;
// et une vraie matière : des scans réels, mêlés selon la pente, l'altitude et la contrée, éclairés par le ciel et le soleil.
// Les courbes de niveau restent : elles reviennent quand on demande à lire le relief.
import * as THREE from 'three';
import { FENETRE } from './lignes.js';
import { GLSL_COMMUN, GLSL_OMBRE } from './communs.js';
import { COUCHE } from '../monde/contrees.js';

const N = 64;     // demi-côté d'un anneau, en mailles

const GLSL_HAUT = /* glsl */`
uniform sampler2D tH; uniform vec2 uTexel;
float hCub(vec2 uv) {
  vec2 st = uv / uTexel - 0.5, f = fract(st), i = st - f;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 p0 = (i - 1.0 + w1 / g0 + 0.5) * uTexel, p1 = (i + 1.0 + w3 / g1 + 0.5) * uTexel;
  float a = mix(texture2D(tH, vec2(p1.x, p1.y)).r, texture2D(tH, vec2(p0.x, p1.y)).r, g0.x);
  float b = mix(texture2D(tH, vec2(p1.x, p0.y)).r, texture2D(tH, vec2(p0.x, p0.y)).r, g0.x);
  return mix(a, b, g0.y);
}`;

const VERT = /* glsl */`
attribute vec3 iNiv;                    // pas, centre x, centre s
uniform sampler2D tVent, tBruit; uniform vec2 uAnneau; uniform float uBande;
${GLSL_HAUT}
varying vec3 vW, vVent; varying float vProf;
float montagne(vec2 p) {
  float a = texture2D(tBruit, p * 0.0000034).r, b = texture2D(tBruit, p * 0.000011 + 0.4).g, c = texture2D(tBruit, p * 0.00004 + 0.7).b;
  return (1.0 - abs(2.0 * a - 1.0)) * 300.0 + (1.0 - abs(2.0 * b - 1.0)) * 130.0 + c * 44.0;
}
void main() {
  float pas = iNiv.x; vec2 g = position.xz;
  vec2 rel = abs(g) / ${N.toFixed(1)}; float m = smoothstep(0.7, 0.93, max(rel.x, rel.y)) * step(0.5, position.y);
  vec2 q = (g - mod(g, 2.0) * m) * pas + iNiv.yz;
  vec2 uv = q / uAnneau;
  float h = pas < 2.5 ? hCub(uv) : texture2D(tH, uv).r;
  // Au-delà des glaces qui bordent le monde, des chaînes que personne n'a jamais remontées.
  float o = max(-q.x, q.x - uAnneau.x);
  if (o > 0.0) h += montagne(q) * smoothstep(0.0, 260.0, o);
  float y = max(h, 0.0);
  vW = vec3(q.x, y, q.y);
  vVent = texture2D(tVent, uv).xyz;
  vec4 mv = modelViewMatrix * vec4(q.x, y, -q.y, 1.0);
  vProf = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
precision highp sampler2DArray;
uniform sampler2D tTrace, tMat;
uniform sampler2DArray tCouleur, tRelief;
uniform vec2 uCentreTrace;
uniform vec4 uNavireO;             // x, s, rayon, présence
uniform sampler2D tNC; uniform vec2 uVentN; uniform float uCouv;   // la carte des nuages, et ce que le vent en a fait
uniform vec4 uRemousT[8];          // les chrones : x, s, rayon, force
uniform float uCarte, uDetail, uAbriV;
varying vec3 vW, vVent; varying float vProf;
${GLSL_COMMUN}
${GLSL_OMBRE}
${GLSL_HAUT}

// Échelle de chaque couche (taille d'une tuile) et force de ses pentes.
const float ECH[8] = float[8](9.0, 34.0, 26.0, 11.0, 12.0, 15.0, 13.0, 11.0);
const float NRM[8] = float[8](0.7, 1.5, 1.5, 1.1, 0.5, 1.0, 1.2, 0.8);
const vec3 MOY[8] = vec3[8](vec3(0.283, 0.238, 0.196), vec3(0.213, 0.092, 0.034), vec3(0.438, 0.296, 0.201), vec3(0.313, 0.183, 0.084), vec3(0.379, 0.378, 0.389), vec3(0.284, 0.233, 0.137), vec3(0.634, 0.403, 0.226), vec3(0.212, 0.187, 0.156));

float lignes(float v, float demi) {
  float w = max(fwidth(v), 1e-5), d = abs(fract(v - 0.5) - 0.5) / w;
  float l = 1.0 - smoothstep(demi - 0.6, demi + 0.6, d);
  return mix(l, min(1.0, demi * 2.0 * w), smoothstep(0.22, 0.6, w));
}
// Une couche, lue à deux échelles qui ne se recoupent jamais : c'est ce qui efface la répétition.
void couche(float i, vec2 p, float pres, inout vec3 c, inout vec3 d) {
  int k = int(i); float e = ECH[k];
  vec2 b = (p / (e * 4.37) + vec2(0.31, 0.17)) * mat2(0.8, 0.6, -0.6, 0.8);
  vec3 cb = texture(tCouleur, vec3(b, i)).rgb, db = texture(tRelief, vec3(b, i)).rgb;
  c = cb / MOY[k]; d = vec3((db.xy - 0.5) * 1.2, db.z);
  if (pres > 0.001) {
    vec2 a = p / e;
    vec3 ca = texture(tCouleur, vec3(a, i)).rgb, da = texture(tRelief, vec3(a, i)).rgb;
    c = mix(c, mix(c, vec3(1.0), 0.55) * ca / MOY[k], pres); d = mix(d, vec3(d.xy * 0.5 + (da.xy - 0.5) * 1.6, da.z * 0.6 + d.z * 0.4), pres);
  }
  d.xy *= NRM[k];
}
void main() {
  vec3 P = vec3(vW.x, vW.y, -vW.z);
  vec2 uv = vW.xz / uAnneau;
  float bord = max(-vW.x, vW.x - uAnneau.x);
  float dv = clamp(vW.z / uBande, 0.0, 1.0);

  // La contrée d'ici, lue à une position bousculée par le bruit : les frontières sont organiques, et une seule contrée se lit par pixel.
  float bk = bruit(vW.xz * 0.012) + 0.5 * bruit(vW.xz * 0.05);
  float rang = clamp(dv * 1024.0 + (bk - 0.75) * 7.0, 0.0, 1023.0);
  vec4 m0 = texelFetch(tMat, ivec2(0, int(rang)), 0), m1 = texelFetch(tMat, ivec2(1, int(rang)), 0);
  float sol1 = floor(m0.r * 255.0 + 0.5), sol2 = floor(m0.g * 255.0 + 0.5), roche = floor(m0.b * 255.0 + 0.5), neigeK = m0.a;
  float penteR = m1.r, prisR = m1.g * 2.0, herbeK = m1.b;

  vec3 ombre = palette(0, dv), lum = palette(1, dv), encre = palette(2, dv);
  ombre *= ombre; lum *= lum; encre *= encre;     // la palette est donnée en valeurs d'écran
  lum = mix(vec3(dot(lum, vec3(0.3, 0.59, 0.11))), lum, 0.72); ombre = mix(vec3(dot(ombre, vec3(0.3, 0.59, 0.11))), ombre, 0.6);
  vec3 reg = palette(5, dv); float pasL = reg.r * 10.0, rides = reg.g, grain = reg.b;

  float h = vProf < 500.0 ? hCub(uv) : texture2D(tH, uv).r;
  float e = 2.0, hx, hz;
  if (vProf < 240.0) {
    hx = hCub((vW.xz + vec2(e, 0.0)) / uAnneau) - hCub((vW.xz - vec2(e, 0.0)) / uAnneau);
    hz = hCub((vW.xz + vec2(0.0, e)) / uAnneau) - hCub((vW.xz - vec2(0.0, e)) / uAnneau);
  } else {
    e = max(2.0, vProf * 0.004);
    hx = texture2D(tH, (vW.xz + vec2(e, 0.0)) / uAnneau).r - texture2D(tH, (vW.xz - vec2(e, 0.0)) / uAnneau).r;
    hz = texture2D(tH, (vW.xz + vec2(0.0, e)) / uAnneau).r - texture2D(tH, (vW.xz - vec2(0.0, e)) / uAnneau).r;
  }
  vec3 nG = normalize(vec3(-hx, 2.0 * e, hz));
  if (bord > 0.0) nG = normalize(cross(dFdy(P), dFdx(P)));
  float pente = 1.0 - nG.y;
  float pres = smoothstep(420.0, 70.0, vProf) * uDetail;

  // Le creux et la bosse : le sable va aux creux, le gravier reste sur les bosses.
  float hb = texture2D(tH, uv + uTexel * vec2(9.0, 0.0)).r + texture2D(tH, uv - uTexel * vec2(9.0, 0.0)).r + texture2D(tH, uv + uTexel * vec2(0.0, 9.0)).r + texture2D(tH, uv - uTexel * vec2(0.0, 9.0)).r;
  float creux = clamp((hb * 0.25 - h) * 0.26, -1.0, 1.0);
  float macro = fbm3(vW.xz * 0.0045) * 0.7 + fbm3(vW.xz * 0.019 + 7.0) * 0.3;

  // Le sol.
  vec3 cS, dS; couche(sol1, vW.xz, pres, cS, dS);
  float qSol2 = smoothstep(0.42, 0.62, macro - creux * 0.25 + (dS.z - 0.5) * 0.14);
  if (sol2 != sol1 && qSol2 > 0.003) {
    vec3 c2, d2; couche(sol2, vW.xz, pres, c2, d2);
    cS = mix(cS, c2, qSol2); dS = mix(dS, d2, qSol2);
  }
  vec3 alb = cS * mix(lum, ombre, 0.3) * 0.86;

  // La roche : posée sur les parois, ses strates suivent l'altitude. On lit le mur par le côté où il regarde.
  float wR = 0.0; vec3 nTex = vec3(dS.xy, 0.0);
  float qR = pente + (macro - 0.5) * 0.14 + creux * -0.05 + (dS.z - 0.5) * 0.05;
  float seuil = 0.04 + penteR * 0.5;
  if (qR > seuil - 0.1) {
    vec2 pR = abs(nG.x) > abs(nG.z) ? vec2(vW.z, vW.y * 1.7) : vec2(vW.x, vW.y * 1.7);
    vec2 pP = nG.y > 0.72 + (bk - 0.75) * 0.3 ? vW.xz : pR;
    vec3 cR, dR; couche(roche, pP + vec2(bruit(vW.xz * 0.04) * 6.0, bruit(vW.xz * 0.07) * 4.0), pres, cR, dR);
    cR = mix(vec3(dot(cR, vec3(0.3, 0.59, 0.11))), cR, 0.3); cR = mix(vec3(1.0), cR, 0.72);
    wR = clamp((qR - seuil) / 0.1 + (dR.z - 0.5) * 1.2, 0.0, 1.0);
    vec3 tR = mix(ombre, lum, 0.42) * prisR * 1.0;
    alb = mix(alb, cR * tR, wR);
    nTex.xy = mix(nTex.xy, dR.xy * 1.7, wR);
  }

  // La neige : elle tient sur ce qui n'est pas trop raide, et s'amasse aux creux.
  float wN = 0.0;
  if (neigeK > 0.003) {
    vec3 cN, dN; couche(${COUCHE.neige.toFixed(1)}, vW.xz, pres, cN, dN);
    wN = smoothstep(0.0, 0.25, neigeK * 1.25 - pente * 1.6 + (macro - 0.5) * 0.5 + creux * 0.3 + (dN.z - 0.5) * 0.1);
    alb = mix(alb, vec3(0.84, 0.88, 0.92) * (0.82 + 0.18 * cN), wN);
    nTex.xy = mix(nTex.xy, dN.xy, wN);
  }

  // Les veines et les taches : ce qui casse les grandes surfaces, vu de loin.
  float veine = fbm3(vec2(vW.x * 0.034, vW.z * 0.0028)) - 0.5;
  alb *= 1.0 + veine * 0.5 * (1.0 - wN) * grain;
  alb *= 0.86 + 0.28 * macro;

  // Les strates : une modulation douce selon l'altitude.
  float q = h * 0.5 + bruit(vW.xz * 0.02) * 1.5, st = mix(bruit(vec2(q, 3.0)), bruit(vec2(q * 2.3, 11.0)), 0.4);
  alb *= mix(1.0, 0.72 + 0.56 * st, wR * 0.8);

  // Sous les prairies, le sol prend la couleur de l'herbe.
  if (herbeK > 0.01 && wR < 0.9) {
    vec3 vert = palette(6, dv); vert *= vert;
    float pre = smoothstep(0.34, 0.6, texture2D(tBruit, vW.xz * 0.0042).g);
    alb = mix(alb, vert * (0.55 + 0.5 * cS.g), clamp(herbeK * 1.5, 0.0, 1.0) * (0.34 + 0.56 * pre) * (1.0 - wR) * (1.0 - wN));
  }

  // Les rides du vent, en travers de lui, qui bossellent la lumière.
  float ondu = vW.z + 5.0 * bruit(vW.xz * 0.05) + 1.4 * bruit(vW.xz * 0.23);
  float rd = cos(ondu * 2.4) * 0.5 + cos(ondu * 5.1 + 1.0) * 0.16;
  float rq = rides * (1.0 - wR) * (1.0 - smoothstep(0.1, 0.5, pente)) * smoothstep(620.0, 90.0, vProf);

  vec3 n = normalize(nG + vec3(nTex.x, 0.0, -nTex.y) * mix(0.25, 1.0, pres) + vec3(0.0, 0.0, rd * 0.13 * rq));

  float rug = mix(0.86, 0.72, wR);
  vec3 f0 = vec3(0.04);

  // La lumière : le soleil, moins ce que le relief, les monuments et les nuages lui prennent.
  vec2 lr = texture2D(tL, uv).rg;
  float porte = vProf < 1380.0 ? soleilVu(P, gl_FragCoord.xy) : 1.0;
  // L'ombre des nuages : la vraie, lue sur leur carte, au point où le rayon du soleil traverse leur couche.
  vec2 pn = P.xz + uSoleil.xz / uSoleil.y * 2100.0 + uVentN;
  float nuage = smoothstep(0.62 - uCouv * 0.24, 0.72 - uCouv * 0.24, texture2D(tNC, pn * 0.000024).r);
  float vis = lr.r * porte * (1.0 - 0.72 * nuage);

  float t = tempeteA(vW.z);
  vec3 V = normalize(cameraPosition - P);
  float ndl = max(dot(n, uSoleil), 0.0);
  vec3 sun = uSoleilCol * vis * (1.0 - 0.96 * t);
  vec3 amb = cielDiffus(n) * mix(0.5, 1.0, lr.g) * (1.0 - 0.72 * t);
  vec3 rebond = alb * uSoleilCol * 0.1 * (1.0 - n.y * 0.5) * lr.g;

  // Les voiles : sable ou neige que le vent fait filer au ras du sol.
  float fv = length(vVent.xy), voile = 0.0;
  if (fv > 0.12 && vProf < 900.0) {
    vec2 dvv = vVent.xy / fv, nv = vec2(-dvv.y, dvv.x);
    vec2 r = vec2(dot(vW.xz, nv) * 0.042, dot(vW.xz, dvv) * 0.0045);
    float ph = uTemps * 0.55, f1 = fract(ph), f2 = fract(ph + 0.5), pousse = 0.5 + fv * 1.1;
    float a = fbm3(r * 10.0 - vec2(0.0, f1 * pousse * 10.0) + 3.7), b = fbm3(r * 10.0 - vec2(0.0, f2 * pousse * 10.0) + 41.0);
    float mm = mix(a, b, abs(2.0 * f1 - 1.0));
    voile = smoothstep(0.52, 0.72, mm) * smoothstep(0.3, 1.1, fv) * (0.16 + 0.5 * max(rides, grain * 0.4)) * (1.0 - wR);
    alb = mix(alb, lum * 0.95, voile * 0.5);
  }

  vec3 col;
  // L'eau de la Flaque : une peau de ciel de quelques centimètres.
  float eau = bord > 0.0 ? 0.0 : smoothstep(0.1, -0.2, h);
  float mouille = smoothstep(1.4, 0.05, h) * (1.0 - eau) * (bord > 0.0 ? 0.0 : 1.0);
  vec3 D = alb * mix(1.0, 0.55, mouille) * (sun * ndl + amb + rebond);
  vec3 S = ggx(n, V, uSoleil, mix(rug, 0.3, mouille), f0, sun);
  S += alb * pow(1.0 - max(dot(nG, V), 0.0), 5.0) * amb * 0.5;                 // le lustre rasant du sable
  // Le grain qui accroche : mica dans le sable, givre dans la neige. Il s'allume quand le regard ou le temps passe dessus.
  vec4 gg = texture2D(tBruit, vW.xz * 1.7 / 2.56);
  vec3 hv = normalize(uSoleil + V);
  float sc = pow(max(dot(normalize(gg.rgb - 0.5 + nG * 0.9), hv), 0.0), 900.0);
  S += uSoleilCol * vis * sc * (wN * 3.0 + rides * 1.1 * (1.0 - wR)) * smoothstep(380.0, 60.0, vProf);
  col = D + S;

  if (eau > 0.0) {
    vec2 vr = vW.xz * vec2(0.14, 0.42) + vec2(0.0, uTemps * 0.7);
    vec2 vr2 = vW.xz * vec2(0.5, 1.1) + vec2(uTemps * 0.2, uTemps * 1.5);
    vec2 pn2 = vec2(bruit(vr) - bruit(vr + vec2(0.7, 0.0)), bruit(vr) - bruit(vr + vec2(0.0, 0.7))) * 0.1 + vec2(bruit(vr2) - bruit(vr2 + vec2(0.7, 0.0)), bruit(vr2) - bruit(vr2 + vec2(0.0, 0.7))) * 0.05;
    vec3 N2 = normalize(vec3(pn2.x * (1.0 + fv * 2.0), 1.0, pn2.y * (1.0 + fv * 2.0)));
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(V, N2), 0.0), 5.0);
    vec3 fondE = mix(ombre, lum, 0.2) * 0.4 * (sun * ndl + amb) * exp(h * 1.1);
    vec3 refl = cielLu(reflect(-V, N2));
    vec3 ceau = mix(fondE, refl, clamp(fres, 0.0, 1.0));
    ceau += ggx(N2, V, uSoleil, 0.12, vec3(0.02), sun);
    ceau = mix(ceau, lum * 1.2 * (sun * 0.4 + amb), voile * 0.3);
    col = mix(col, ceau, eau);
  }

  // Les filets du vent, et les pas.
  vec2 tu = (vW.xz - uCentreTrace) / ${FENETRE.toFixed(1)} + 0.5;
  vec2 cadre = smoothstep(vec2(0.0), vec2(0.1), tu) * smoothstep(vec2(0.0), vec2(0.1), 1.0 - tu);
  vec4 tr = texture2D(tTrace, tu);
  float pied = min(1.0, tr.a) * cadre.x * cadre.y;
  col *= 1.0 - pied * (0.2 + 0.24 * rides) * (1.0 - eau);
  col += pied * 0.24 * eau * amb;

  // Les chrones : le sol s'enroule sous eux.
  for (int i = 0; i < 8; i++) {
    vec4 r = uRemousT[i];
    if (r.z <= 0.0) continue;
    vec2 d = vW.xz - r.xy; float l = length(d) / r.z;
    if (l > 1.4) continue;
    float a = atan(d.y, d.x), bras = sin(a * 3.0 + l * 11.0 - uTemps * 3.2 * sign(r.w));
    float o = smoothstep(1.2, 0.2, l);
    col *= 1.0 - o * (0.3 + 0.36 * smoothstep(0.1, 0.9, bras));
    col *= 1.0 - smoothstep(0.26, 0.05, l) * 0.8;
  }

  // L'ombre du navire.
  if (uNavireO.w > 0.0) {
    vec2 d = (vW.xz - uNavireO.xy) / vec2(uNavireO.z * 0.38, uNavireO.z);
    col *= 1.0 - smoothstep(1.0, 0.55, length(d)) * uNavireO.w * 0.66;
  }

  // Le furvent : le jour s'en va, et le champ dense s'allume comme du cuivre.
  float dense = 1.0 - exp(-tr.r * 0.55), aigu = clamp(tr.b / max(tr.r, 0.001) * 0.5, 0.0, 1.0), brul = dense * dense;
  col += mix(vec3(0.66, 0.36, 0.17), vec3(1.0, 0.8, 0.56), aigu * brul) * brul * cadre.x * cadre.y * t * 1.6;
  col += vec3(0.5, 0.54, 0.68) * uEclair * t * 1.4 * (0.4 + alb);
  float levre = exp(-pow((vW.z - uFrontT.x) / 18.0, 2.0)) * uFrontT.z;
  col = mix(col, vec3(1.7, 1.25, 0.86) * (sun + amb) * 0.5, levre * 0.62 * (0.4 + 0.6 * bruit(vW.xz * vec2(0.04, 0.12) + uTemps * 0.6)));

  // Le feu du camp.
  if (uFeu.z > 0.0) {
    vec2 d = (vW.xz - uFeu.xy);
    float l = dot(d, d), va = 0.92 + 0.08 * sin(uTemps * 11.0) * sin(uTemps * 7.3);
    col += alb * vec3(1.0, 0.5, 0.2) * uFeu.z * va * (exp(-l / 900.0) * 1.8 + exp(-l / 90.0) * 2.4) * (0.4 + 0.6 * uNuit);
  }

  // Où se reposer : les zones que le vent épargne s'éclairent, avec un liseré doré. Les mêmes seuils que le camp.
  if (uAbriV > 0.003) {
    float ab = max(smoothstep(0.36, 0.46, vVent.z), smoothstep(0.56, 0.46, fv)) * (1.0 - eau) * smoothstep(0.34, 0.14, pente);
    float lis = ab * (1.0 - ab) * 4.0, rais = smoothstep(0.42, 0.5, abs(fract((vW.x + vW.z) * 0.05 + uTemps * 0.04) - 0.5));
    vec3 or_ = vec3(1.0, 0.8, 0.42) * (0.3 + dot(amb, vec3(0.33)) + dot(uSoleilCol, vec3(0.1)));
    col = mix(col, or_, (ab * (0.1 + 0.1 * rais) + lis * 0.62) * uAbriV);
  }

  // Lire le relief : les courbes de niveau, à la demande.
  if (uCarte > 0.003) {
    float hl = h, fin = lignes(hl / pasL, 0.5), fort = lignes(hl / (pasL * 5.0), 0.85);
    col = mix(col, encre * 0.3, clamp(fin * 0.42 + fort * 0.8, 0.0, 1.0) * 0.72 * smoothstep(1400.0, 300.0, vProf) * uCarte);
  }

  // Le bout du monde ne se voit pas de loin : il se défait dans le ciel.
  col = mix(col, BLANC_FIN, smoothstep(uBande - 340.0, uBande - 170.0, vW.z));
  gl_FragColor = vec4(col, 1.0);
}`;

function grille(N0, trou) {
  const pos = [], idx = [], v = (i, j) => (j + N0) * (2 * N0 + 1) + i + N0;
  for (let j = -N0; j <= N0; j++) for (let i = -N0; i <= N0; i++) pos.push(i, trou ? 1 : 0, j);
  for (let j = -N0; j < N0; j++) for (let i = -N0; i < N0; i++) {
    if (trou && i >= -trou && i < trou && j >= -trou && j < trou) continue;
    idx.push(v(i, j), v(i + 1, j), v(i, j + 1), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1));
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

export class Terrain {
  constructor(monde, tex, matieres, tTrace, tBruit, commun) {
    this.niveaux = 7;
    this.u = {
      ...commun, tCouleur: { value: matieres.tCouleur }, tRelief: { value: matieres.tRelief },
      tH: { value: tex.tH }, tPal: { value: tex.tPal }, tMat: { value: tex.tMat }, tTrace: { value: tTrace }, tBruit: { value: tBruit }, tVent: { value: tex.tV }, tL: { value: tex.tL },
      uAnneau: { value: new THREE.Vector2(monde.W, monde.anneau) }, uBande: { value: monde.L },
      uTexel: { value: new THREE.Vector2(1 / monde.nx, 1 / monde.ns) },
      uCentreTrace: { value: new THREE.Vector2() },
      uFrontT: { value: new THREE.Vector3(-1e6, -1e6, 0) },
      uTemps: { value: 0 }, uNuit: { value: 0 }, uBrouillard: { value: 700 }, uReve: { value: 0 }, uSv: { value: 0 }, uEclair: { value: 0 },
      uFeu: { value: new THREE.Vector3() }, uNavireO: { value: new THREE.Vector4() },
      uRemousT: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uCarte: { value: 0 }, uDetail: { value: 1 }, uAbriV: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG });
    // Le cœur, sans trou, puis des anneaux qui doublent de pas à chaque fois ; ils mordent un peu l'un sur l'autre.
    const coeur = grille(N / 2 + 2, 0), anneaux = grille(N, N / 2 - 2);
    this.iC = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    this.iA = new THREE.InstancedBufferAttribute(new Float32Array((this.niveaux - 1) * 3), 3);
    this.iC.setUsage(THREE.DynamicDrawUsage); this.iA.setUsage(THREE.DynamicDrawUsage);
    coeur.setAttribute('iNiv', this.iC); coeur.instanceCount = 1;
    anneaux.setAttribute('iNiv', this.iA); anneaux.instanceCount = this.niveaux - 1;
    this.coeur = new THREE.Mesh(coeur, mat); this.anneaux = new THREE.Mesh(anneaux, mat);
    this.coeur.frustumCulled = this.anneaux.frustumCulled = false;
    this.coeur.renderOrder = 3; this.anneaux.renderOrder = 4;
    this.mesh = new THREE.Group(); this.mesh.add(this.coeur, this.anneaux);
  }
  finir() {}
  // La maille suit la caméra ; chaque anneau se cale sur le double de son pas pour que rien ne glisse.
  maj(x, s) {
    const c = this.iC.array, a = this.iA.array;
    c[0] = 1; c[1] = Math.round(x / 2) * 2; c[2] = Math.round(s / 2) * 2;
    for (let i = 0; i < this.niveaux - 1; i++) {
      const p = 1 << i, q = 2 * p;
      a[i * 3] = p; a[i * 3 + 1] = Math.round(x / q) * q; a[i * 3 + 2] = Math.round(s / q) * q;
    }
    this.iC.needsUpdate = this.iA.needsUpdate = true;
  }
}
