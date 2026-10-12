// Le sol : un dessin de carte. Lavis à deux tons selon la lumière, courbes de niveau à l'encre, et le vent par-dessus.
// De près, le dessin se charge : rides du sable, gravier, veines d'érosion. Dans le furvent, tout s'inverse.
import * as THREE from 'three';
import { FENETRE } from './lignes.js';
import { GLSL_COMMUN, GLSL_OMBRE } from './communs.js';
import { SOLEIL } from '../monde/contrees.js';

const VERT = /* glsl */`
uniform sampler2D tH, tPal, tVent; uniform vec2 uMonde, uCentreMaille; uniform float uDescente; uniform mat4 uOmbreM;
varying vec3 vW; varying float vProf; varying vec4 vOm;
varying vec3 vOmbre, vLum, vEncre, vTrait, vCiel, vReg, vHerbe; varying vec2 vVent; varying float vDens;
vec3 pal(float c, float s) { return texture2D(tPal, vec2((c + 0.5) / 7.0, s)).rgb; }
void main() {
  vec3 p = position; p.x += uCentreMaille.x; p.z -= uCentreMaille.y;
  vec2 uv = vec2(p.x, -p.z) / uMonde;
  p.y = max(texture2D(tH, uv).r, 0.0) - uDescente;
  vW = vec3(p.x, p.y, -p.z);
  // La palette et le vent varient lentement : au sommet plutôt qu'au pixel, c'est six lectures de moins.
  vOmbre = pal(0.0, uv.y); vLum = pal(1.0, uv.y); vEncre = pal(2.0, uv.y); vTrait = pal(3.0, uv.y); vCiel = pal(4.0, uv.y); vReg = pal(5.0, uv.y); vHerbe = pal(6.0, uv.y);
  vDens = texture2D(tPal, vec2(5.5 / 7.0, uv.y)).a;
  vVent = texture2D(tVent, uv).xy;
  vOm = uOmbreM * vec4(p, 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vProf = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tH, tTrace, tL;
uniform vec2 uTexel, uCentreTrace;
uniform vec3 uFeu;                 // x, s, intensité
uniform vec4 uNavireO;             // x, s, rayon, présence
uniform vec3 uVentMoyen;           // direction pour les nuages
uniform vec4 uRemousT[8];          // les chrones : x, s, rayon, force
varying vec3 vW; varying float vProf; varying vec4 vOm;
varying vec3 vOmbre, vLum, vEncre, vTrait, vCiel, vReg, vHerbe; varying vec2 vVent; varying float vDens;
${GLSL_COMMUN}
${GLSL_OMBRE}

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
}
float lignes(float v, float demi) {
  float w = max(fwidth(v), 1e-5), d = abs(fract(v - 0.5) - 0.5) / w;
  float l = 1.0 - smoothstep(demi - 0.6, demi + 0.6, d);
  return mix(l, min(1.0, demi * 2.0 * w), smoothstep(0.22, 0.6, w));   // trop serré : la couverture moyenne, plus de moiré
}

void main() {
  vec2 uv = vW.xz / uMonde;
  vec3 ombre = vOmbre, lum = vLum, encre = vEncre, trait = vTrait, ciel = vCiel;
  float pas = vReg.r * 10.0, rides = vReg.g, grain = vReg.b;

  float h = hCub(uv);
  float det = (bruit(vW.xz * 0.11) - 0.5) * 0.8 + (bruit(vW.xz * 0.37) - 0.5) * 0.22;
  float e = 2.0;
  float hx = texture2D(tH, (vW.xz + vec2(e, 0.0)) / uMonde).r - texture2D(tH, (vW.xz - vec2(e, 0.0)) / uMonde).r;
  float hz = texture2D(tH, (vW.xz + vec2(0.0, e)) / uMonde).r - texture2D(tH, (vW.xz - vec2(0.0, e)) / uMonde).r;
  float pres = smoothstep(190.0, 34.0, vProf);

  // Les rides du vent, en travers de lui. Elles bossellent la lumière, et on les voit encore de haut.
  float ondu = vW.z + 5.0 * bruit(vW.xz * 0.05) + 1.4 * bruit(vW.xz * 0.23);
  float rd = sin(ondu * 2.4) * 0.5 + sin(ondu * 5.1 + 1.0) * 0.14;
  hz += rides * rd * (0.12 + 0.42 * pres) * (1.0 - smoothstep(0.0, 0.5, abs(hx) * 0.3));

  vec3 n = normalize(vec3(-hx, 2.0 * e, hz));
  float pente = clamp((1.0 - n.y) * 1.6, 0.0, 1.0);

  // La lumière : le soleil, moins ce que le relief et les monuments lui prennent ; le ciel, moins les creux.
  vec2 lr = texture2D(tL, uv).rg;
  float portee = vProf < 520.0 ? ombrePortee(vOm, gl_FragCoord.xy) : 0.0;
  float vu = lr.r * (1.0 - 0.92 * portee);
  // Un sol plat doit rester clair : on mesure la lumière par rapport à ce qu'il reçoit, lui.
  float jour = clamp(dot(n, uSoleil) / uSoleil.y * 0.74, 0.0, 1.0) * mix(0.22, 1.0, vu);
  float lave = smoothstep(0.1, 0.86, jour);

  // L'ombre des nuages passe sur le lavis, poussée par le vent.
  vec2 pn = (vW.xz + vec2(14.0, -11.0)) * 0.0042 + uVentMoyen.xy * uTemps * 0.012;
  float nuage = smoothstep(0.5, 0.72, fbm3(pn));

  // Les strates : une modulation douce selon l'altitude (Symphony of Vines, chapitre 1).
  float q = (h + det) * 0.86, st = mix(bruit(vec2(q, 3.0)), bruit(vec2(q * 2.3, 11.0)), 0.4);
  vec3 col = mix(mix(ombre, lum, 0.34), lum, clamp(lave + (st - 0.5) * (0.14 + pente * 0.5), 0.0, 1.0));
  col = mix(col, ombre, nuage * 0.2);
  col *= mix(vec3(0.8, 0.84, 0.92), vec3(1.0), vu * 0.6 + 0.4);   // l'ombre prend la couleur du ciel
  col *= mix(0.7, 1.0, lr.g);

  // Sous les prairies, le sol prend la couleur de l'herbe : les brins s'y fondent au lieu de faire du chaume.
  if (vDens > 0.01) {
    float pre = smoothstep(0.34, 0.6, texture2D(tBruit, vW.xz * 0.0042).g);
    col = mix(col, vHerbe * (0.84 + 0.3 * lave), clamp(vDens * 2.0, 0.0, 1.0) * (0.42 + 0.5 * pre) * (1.0 - smoothstep(0.1, 0.6, -h + 0.2)));
  }

  // Les veines d'érosion, couchées dans le sens du vent : ce qui donne du grain à la carte vue de haut.
  float veine = fbm3(vec2(vW.x * 0.34, vW.z * 0.028)) - 0.5;
  col = mix(col, veine > 0.0 ? lum : ombre, abs(veine) * (0.3 + 0.2 * grain));

  // Gravier et taches, qui n'apparaissent qu'en approchant.
  vec4 gg = texture2D(tBruit, vW.xz * 1.7 / 256.0);
  float gravier = smoothstep(0.7, 0.8, gg.r) * smoothstep(0.4, 0.6, gg.g);
  float tache = smoothstep(0.55, 0.75, bruit(vW.xz * 0.21 + 40.0));
  col = mix(col, ombre, grain * (gravier * 0.2 * smoothstep(240.0, 50.0, vProf) + tache * 0.1));
  col *= 1.0 + (bruit(vW.xz * 7.0) - 0.5) * 0.07 * grain * pres;

  // Les voiles : sable ou neige que le vent fait filer au ras du sol. Deux phases d'un même bruit, couché dans
  // le sens du vent et poussé par lui, se relaient pour que le mouvement ne finisse jamais.
  float fv = length(vVent), voile = 0.0;
  if (fv > 0.12) {
    vec2 dv = vVent / fv, nv = vec2(-dv.y, dv.x);
    vec2 r = vec2(dot(vW.xz, nv) * 0.42, dot(vW.xz, dv) * 0.045);
    float ph = uTemps * 0.55, f1 = fract(ph), f2 = fract(ph + 0.5);
    float pousse = 5.0 + fv * 11.0;
    float a = fbm3(r - vec2(0.0, f1 * pousse) + 3.7), b = fbm3(r - vec2(0.0, f2 * pousse) + 41.0);
    float m = mix(a, b, abs(2.0 * f1 - 1.0));
    voile = smoothstep(0.52, 0.72, m) * smoothstep(0.3, 1.1, fv) * (0.16 + 0.5 * max(rides, grain * 0.4));
    col = mix(col, mix(lum, vec3(1.0), 0.2), voile * 0.42);
  }

  // Les courbes de niveau : le relief dessine lui-même sa carte.
  float hl = h + det;
  float fin = lignes(hl / pas, 0.5), fort = lignes(hl / (pas * 5.0), 0.85);
  float encrage = clamp(fin * 0.42 + fort * 0.8, 0.0, 1.0);
  col = mix(col, encre, encrage * 0.72 * smoothstep(1400.0, 300.0, vProf));

  // L'eau de la Flaque : une peau de ciel de quelques centimètres.
  float eau = smoothstep(0.08, -0.22, h);
  if (eau > 0.0) {
    vec2 vr = vW.xz * vec2(0.14, 0.42) + vec2(0.0, uTemps * 0.7);
    float rid = bruit(vr) * 0.6 + bruit(vr * 2.7 + 2.0) * 0.4;
    vec3 ceau = mix(mix(ombre, ciel, 0.6), ciel, smoothstep(-1.4, -0.1, h));
    ceau = mix(ceau, lum, smoothstep(0.58, 0.8, rid) * 0.55);
    ceau = mix(ceau, ombre, voile * 0.42);      // les risées qui courent sur l'eau
    ceau = mix(ceau, ombre, nuage * 0.2);
    ceau = mix(ceau, encre, lignes(h / 0.3, 0.5) * 0.09);
    // Vue de près et de biais, elle renvoie le ciel.
    vec3 V = normalize(vW * vec3(1.0, 1.0, -1.0) - cameraPosition);
    vec3 N = normalize(vec3((rid - 0.5) * 0.05, 1.0, (bruit(vr * 1.7) - 0.5) * 0.05));
    float fres = pow(1.0 - max(dot(-V, N), 0.0), 3.0);
    ceau = mix(ceau, couleurCiel(reflect(V, N)), clamp(fres * 1.25, 0.0, 0.96));
    col = mix(col, ceau, eau);
  }
  float rive = smoothstep(0.35, 0.05, abs(h)) * (1.0 - eau);
  col = mix(col, lum, rive * 0.8);

  // Les filets du vent.
  vec2 tu = (vW.xz - uCentreTrace) / ${FENETRE.toFixed(1)} + 0.5;
  vec2 bord = smoothstep(vec2(0.0), vec2(0.1), tu) * smoothstep(vec2(0.0), vec2(0.1), 1.0 - tu);
  vec4 tr = texture2D(tTrace, tu);
  float fil = 0.0;
  float aigu = clamp(tr.b / max(tr.r, 0.001) * 0.5, 0.0, 1.0);

  // Les pas des 23 : un sillon dans le sable et la neige, que le vent comble ; des ronds sur l'eau.
  float pied = min(1.0, tr.a) * bord.x * bord.y;
  col = mix(col, mix(ombre, encre, 0.2), pied * (0.34 + 0.3 * rides) * (1.0 - eau));
  col = mix(col, lum, pied * 0.5 * eau);

  // Le givre et le mica : des éclats qui s'allument quand le regard ou le temps passe dessus.
  float tw = 0.5 + 0.5 * sin(uTemps * 1.6 + gg.a * 40.0);
  float scint = smoothstep(0.88, 0.97, gg.b * (0.62 + 0.38 * tw) + 0.14 * lave);
  col += vec3(1.0, 0.97, 0.9) * scint * (rides * 0.32 + eau * 0.3) * (1.0 - nuage) * smoothstep(260.0, 80.0, vProf);

  vec3 clair = col;

  // Les chrones : le sol s'enroule sous eux.
  for (int i = 0; i < 8; i++) {
    vec4 r = uRemousT[i];
    if (r.z <= 0.0) continue;
    vec2 d = vW.xz - r.xy; float l = length(d) / r.z;
    if (l > 1.4) continue;
    float a = atan(d.y, d.x), bras = sin(a * 3.0 + l * 11.0 - uTemps * 3.2 * sign(r.w));
    float o = smoothstep(1.2, 0.2, l);
    clair = mix(clair, ombre * 0.8, o * (0.24 + 0.32 * smoothstep(0.1, 0.9, bras)));
    clair = mix(clair, encre, smoothstep(0.26, 0.05, l) * 0.8);
  }

  // L'ombre du navire.
  if (uNavireO.w > 0.0) {
    vec2 d = (vW.xz - uNavireO.xy) / vec2(uNavireO.z * 0.38, uNavireO.z);
    float m = smoothstep(1.0, 0.55, length(d)) * uNavireO.w;
    clair = mix(clair, ombre * 0.82, m * 0.62);
  }

  // Le furvent : tout s'inverse derrière le front.
  float t = tempeteA(vW.z);
  vec3 nuitF = mix(vec3(0.03, 0.027, 0.032), ombre * 0.16, lave * 0.6);
  nuitF = mix(nuitF, vec3(0.5, 0.36, 0.26), encrage * 0.2);
  // Le champ dense, enfin allumé : du cuivre au champagne, avec la vitesse.
  float dense = 1.0 - exp(-tr.r * 0.55), brul = dense * dense;
  nuitF += mix(vec3(0.66, 0.36, 0.17), vec3(1.0, 0.8, 0.56), aigu * brul) * brul * bord.x * bord.y * 0.82;
  nuitF += vec3(1.0, 0.72, 0.46) * fil * 0.34;
  nuitF += vec3(0.9, 0.5, 0.26) * voile * 0.5;
  nuitF += vec3(0.5, 0.54, 0.68) * uEclair * (0.34 + lave * 0.6 + encrage * 0.5);
  // La lèvre du front : une crête de poussière claire.
  float levre = exp(-pow((vW.z - uFrontT.x) / 18.0, 2.0)) * uFrontT.z;
  col = mix(clair, nuitF, t);
  col = mix(col, vec3(0.98, 0.86, 0.7), levre * 0.62 * (0.4 + 0.6 * bruit(vW.xz * vec2(0.04, 0.12) + uTemps * 0.6)));

  // La nuit des camps : la carte se couche.
  if (uNuit > 0.0) {
    vec3 cnuit = mix(vec3(0.05, 0.075, 0.15), mix(ombre, vec3(0.2, 0.28, 0.46), 0.7) * 0.42, lave);
    cnuit = mix(cnuit, vec3(0.32, 0.42, 0.6), encrage * 0.3 + fil * 0.3);
    col = mix(col, cnuit, uNuit * (1.0 - t));
  }
  if (uFeu.z > 0.0) {
    vec2 d = (vW.xz - uFeu.xy);
    float l = dot(d, d);
    float va = 0.92 + 0.08 * sin(uTemps * 11.0) * sin(uTemps * 7.3);
    col += vec3(1.0, 0.56, 0.24) * uFeu.z * va * (exp(-l / 900.0) * 0.46 + exp(-l / 90.0) * 0.5) * (0.4 + 0.6 * uNuit);
  }

  // Le bout du monde ne se voit pas de loin : il se défait dans le ciel.
  col = mix(col, horizon(), smoothstep(uMonde.y - 340.0, uMonde.y - 170.0, vW.z));

  // Le lointain se perd dans le ciel.
  col = mix(col, brume(vW), smoothstep(uBrouillard * 0.5, uBrouillard * 1.25, vProf));
  col = mix(col, BLANC_FIN, uReve);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Terrain {
  constructor(monde, tex, tTrace, tBruit) {
    this.pasMaille = 760 / 340;
    this.pasLoin = 32;
    this.u = {
      tH: { value: tex.tH }, tPal: { value: tex.tPal }, tTrace: { value: tTrace }, tBruit: { value: tBruit }, tVent: { value: tex.tV }, tL: { value: tex.tL },
      uMonde: { value: new THREE.Vector2(monde.W, monde.L) },
      uTexel: { value: new THREE.Vector2(1 / monde.nx, 1 / monde.ns) },
      uCentreMaille: { value: new THREE.Vector2() }, uCentreTrace: { value: new THREE.Vector2() },
      uDescente: { value: 0 },
      uFrontT: { value: new THREE.Vector3(-1e6, -1e6, 0) },
      uTemps: { value: 0 }, uNuit: { value: 0 }, uBrouillard: { value: 700 }, uReve: { value: 0 }, uSv: { value: 0 }, uEclair: { value: 0 },
      uFeu: { value: new THREE.Vector3() }, uNavireO: { value: new THREE.Vector4() },
      uRemousT: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uSoleil: { value: new THREE.Vector3(...SOLEIL).normalize() },
      uSoleilC: { value: new THREE.Vector3(-0.62, 0.3, -0.72).normalize() },
      uVentMoyen: { value: new THREE.Vector3(0, -1, 0) },
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(760, 760, 340, 340).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    // Le lointain : une maille lâche, juste sous la fine, qu'on ne voit qu'à hauteur de Horde.
    this.uLoin = this.u;
    this.uLoinPropres = { uCentreMaille: { value: new THREE.Vector2() }, uDescente: { value: 1.4 } };
    this.loin = new THREE.Mesh(new THREE.PlaneGeometry(5760, 5760, 180, 180).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }));
    this.loin.frustumCulled = false; this.loin.visible = false; this.loin.renderOrder = 5;
  }
  // Après la création des ombres : le lointain partage tout, sauf son centre et sa descente.
  finir() {
    this.loin.material.uniforms = { ...this.u, ...this.uLoinPropres };
  }
  maj(x, s) {
    const p = this.pasMaille, q = this.pasLoin;
    this.u.uCentreMaille.value.set(Math.round(x / p) * p, Math.round(s / p) * p);
    this.uLoinPropres.uCentreMaille.value.set(Math.round(x / q) * q, Math.round(s / q) * q);
  }
}
