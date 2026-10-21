// Les lieux du roman. Un petit kit d'architecte (tours à étages, galeries, créneaux, dômes, ponts suspendus, colosses)
// et un seul matériau qui sait être pierre appareillée, mur percé, tuile, cuivre, glace ou lave.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_COMMUN, GLSL_OMBRE } from './communs.js';
import { alea } from '../monde/bruit.js';
import { HORDIERS } from '../jeu/hordiers.js';
import { ECHELLE } from '../monde/contrees.js';

const PIERRE = 0, MUR = 1, TUILE = 2, CUIVRE = 3, GLACE = 4, LAVE = 5, TOILE = 6, METAL = 7;

const VERT = /* glsl */`
attribute float aMat; attribute vec3 aTon;
uniform mat4 uOmbreM;
varying vec3 vW, vN, vTon; varying vec2 vUv; varying float vProf, vMat, vH; varying vec4 vOm;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = vec3(w.x, w.y, -w.z); vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vMat = aMat; vTon = aTon; vH = position.y;
  vOm = uOmbreM * w;
  vec4 mv = viewMatrix * w; vProf = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision highp float;
varying vec3 vW, vN, vTon; varying vec2 vUv; varying float vProf, vMat, vH; varying vec4 vOm;
${GLSL_COMMUN}
${GLSL_OMBRE}
float arche(vec2 q) {                                   // la distance à une baie cintrée, centrée sur la cellule
  vec2 d = abs(q - vec2(0.0, -0.1)) - vec2(0.17, 0.25);
  float rect = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return min(rect, length(q - vec2(0.0, 0.15)) - 0.17);
}
void main() {
  float sv = vW.z / uBande, m = floor(vMat + 0.5);
  vec3 ombre = palette(0, sv), lum = palette(1, sv), encre = palette(2, sv);
  vec3 n = normalize(vN), P = vec3(vW.x, vW.y, -vW.z), V = normalize(P - cameraPosition);
  vec3 base = vTon.x < 0.0 ? mix(lum, ombre, 0.14) : vTon;
  float fres = pow(1.0 - max(dot(-V, n), 0.0), 3.0);
  float pres = smoothstep(420.0, 60.0, vProf);
  vec3 emis = vec3(0.0); float reflet = 0.08;
  float nz = fbm3(vec2(vUv.x * 1.4 + vW.x * 0.03, vW.y * 0.12 + vW.z * 0.03));

  if (m < 1.5) {                                         // la pierre : assises, joints, coulures
    float y = vW.y / 1.15, ry = floor(y), fy = fract(y);
    float ux = (vW.x + vW.z) / 2.3 + ry * 0.5, fx = fract(ux);
    float wy = fwidth(y), wx = fwidth(ux);
    float joints = max(1.0 - smoothstep(0.02, 0.06 + wy, fy), (1.0 - smoothstep(0.015, 0.04 + wx, fx)));
    base *= 1.0 - joints * 0.16 * pres;
    base *= 0.92 + 0.16 * hash(vec2(floor(ux), ry));
    base *= 1.0 - 0.26 * smoothstep(0.46, 0.72, fbm3(vec2(vUv.x * 5.0 + vW.x * 0.2, vW.y * 0.05)));
  }
  if (m > 0.5 && m < 1.5) {                              // le mur percé de baies cintrées
    vec2 c = floor(vUv), q = fract(vUv) - 0.5;
    float sd = arche(q), e = fwidth(q.x) * 1.4;
    float dedans = 1.0 - smoothstep(-e, e, sd), cadre = (1.0 - smoothstep(0.03, 0.03 + e, abs(sd - 0.02))) * (1.0 - dedans);
    base = mix(base, base * 1.14, cadre * 0.8);
    base *= 1.0 - 0.3 * smoothstep(0.1, 0.0, sd) * (1.0 - dedans) * step(q.y, 0.0);    // l'ombre sous l'appui
    if (hash(c + 7.0) > 0.26) {
      vec3 vitre = mix(encre * 0.42, couleurCiel(reflect(V, normalize(n + vec3(0.0, 0.1, 0.0)))), 0.34 + fres * 0.5);
      base = mix(base, vitre, dedans);
      float allume = step(0.5, hash(c + 3.0));
      emis += vec3(1.5, 0.92, 0.5) * dedans * allume * (0.65 + 0.35 * hash(c + 9.0));
    } else base *= 1.0 - dedans * 0.25;
  } else if (m > 1.5 && m < 2.5) {                       // les tuiles, en écailles décalées
    float r = floor(vUv.y), dx = fract(vUv.x + r * 0.5) - 0.5, dy = fract(vUv.y);
    float ecaille = smoothstep(0.0, 0.7, dy + dx * dx * 1.6);
    base *= 0.74 + 0.36 * ecaille;
    base *= 0.9 + 0.2 * hash(vec2(floor(vUv.x + r * 0.5), r));
  } else if (m > 2.5 && m < 3.5) {                       // le cuivre : du vert-de-gris qui coule des arêtes
    float pat = smoothstep(0.36, 0.62, fbm3(vec2(vUv.x * 9.0, vUv.y * 4.0)));
    base = mix(base * 0.62, base * 1.22, pat);
    reflet = 0.34;
  } else if (m > 3.5 && m < 4.5) {                       // la glace : profonde dans les creux, claire aux arêtes
    float veine = smoothstep(0.03, 0.0, abs(fbm3(vec2(vW.x + vW.z, vW.y * 0.6) * 0.09) - 0.5));
    base = mix(vec3(0.24, 0.47, 0.6), vec3(0.8, 0.93, 0.98), clamp(0.3 + fres + nz * 0.5, 0.0, 1.0));
    base += vec3(0.5, 0.62, 0.7) * veine * 0.5;
    base += vec3(0.46, 0.62, 0.72) * pow(max(dot(V, uSoleilC), 0.0), 3.0) * 0.8;       // le soleil qui la traverse
    reflet = 0.7;
  } else if (m > 4.5 && m < 5.5) {                       // la lave : une croûte qui descend, fendue de lumière
    float p1 = fbm3(vec2(vUv.x * 28.0, vUv.y * 9.0 + uTemps * 0.1));
    float p2 = fbm3(vec2(vUv.x * 28.0 + 3.0, vUv.y * 9.0 + uTemps * 0.19) + p1 * 2.0);
    float faille = smoothstep(0.03, 0.0, abs(p2 - 0.5));
    base = mix(vec3(0.05, 0.04, 0.045), vec3(0.2, 0.13, 0.11), p1);
    emis += mix(vec3(2.6, 0.72, 0.14), vec3(3.6, 2.2, 0.8), faille) * (faille + smoothstep(0.56, 0.72, p2) * 0.7);
  } else if (m > 5.5 && m < 6.5) {                       // la toile
    base *= 0.86 + 0.2 * sin(vUv.x * 40.0) * 0.5 + 0.1 * nz;
  } else {                                               // le métal
    base *= 0.72 + 0.4 * nz; reflet = 0.4;
  }

  float l = clamp(dot(n, uSoleil), 0.0, 1.0);
  float sh = ombrePortee(vOm, gl_FragCoord.xy);
  l *= 1.0 - 0.9 * sh;
  float haut = 0.5 + 0.5 * n.y;
  vec3 ciel = mix(ombre * 0.82, palette(4, sv), haut);
  // Le ciel d'un côté, le sol clair de l'autre : même à contre-jour, une façade se lit.
  vec3 rebond = lum * 0.3 * (1.0 - haut);
  vec3 c = base * (ciel * 0.92 + rebond + vec3(1.0, 0.96, 0.88) * l * 0.62);
  c *= mix(0.74, 1.0, smoothstep(0.0, 13.0, vH));         // le pied du mur reçoit moins de ciel
  if (reflet > 0.0) c = mix(c, couleurCiel(reflect(V, n)), clamp((0.04 + fres) * reflet, 0.0, 1.0));
  vec3 fin = atmosphere(c, l, vW, vProf);
  float noir = max(uNuit, tempeteA(vW.z));
  fin += emis * (m > 4.5 && m < 5.5 ? 1.0 : noir * (1.0 - smoothstep(uBrouillard * 0.5, uBrouillard, vProf)));
  gl_FragColor = vec4(fin, 1.0);
}`;

const coul = (hex) => { const c = new THREE.Color(hex).convertLinearToSRGB(); return [c.r, c.g, c.b]; };
// Tout passe par là : le matériau, sa teinte, l'échelle de ses UV (une cellule = une baie, une rangée de tuiles...).
function pose(g, { mat = PIERRE, ton = null, uvs = [1, 1] } = {}) {
  const q = g.index ? g.toNonIndexed() : g, n = q.getAttribute('position').count;
  const uv = q.getAttribute('uv');
  for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) * uvs[0], uv.getY(i) * uvs[1]);
  q.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(mat), 1));
  const t = ton ? coul(ton) : [-1, -1, -1], a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(t, i * 3);
  q.setAttribute('aTon', new THREE.BufferAttribute(a, 3));
  return q;
}
const cyl = (x, y, z, r1, r2, h, seg, o) => pose(new THREE.CylinderGeometry(r2, r1, h, seg, 1).translate(x, y + h / 2, z), o);
const bo = (x, y, z, l, h, p, ry, o) => pose(new THREE.BoxGeometry(l, h, p).translate(0, h / 2, 0).rotateY(ry || 0).translate(x, y, z), o);
const tour2 = (profil, seg, x, y, z, o) => pose(new THREE.LatheGeometry(profil.map(([a, b]) => new THREE.Vector2(Math.max(0.001, a), b)), seg).translate(x, y, z), o);

function coupole(x, y, z, r, ton = '#5f9a86') {
  const p = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI / 2; p.push([Math.cos(a) * r * (1 + 0.1 * Math.sin(a * 2)), Math.sin(a) * r * 1.3]); }
  p.push([0.05, r * 1.34]);
  return [tour2(p, 26, x, y, z, { mat: CUIVRE, ton, uvs: [1, 1] }), cyl(x, y + r * 1.32, z, r * 0.1, 0.03, r * 0.8, 8, { mat: METAL, ton: '#3c3a3a' })];
}

// Une tour d'habitation : socle, étages en retrait, galeries, corniches, créneaux, puis un toit.
function tour(x, z, r, h, { seg = 20, toit = 'cone', ton = null, tonToit = '#8f5c4a', base = 0, creneaux = true } = {}, g = []) {
  g.push(cyl(x, base, z, r * 1.34, r * 1.2, 2.6, seg, { ton }));
  const hEt = 11 + (r * 3 % 3), n = Math.max(2, Math.round((h - 2.6) / hEt));
  let y = base + 2.6, ra = r * 1.06;
  for (let i = 0; i < n; i++) {
    const rb = ra * (i % 3 === 2 ? 0.86 : 0.97), cols = Math.max(4, Math.round(2 * Math.PI * ra / 3.5)), H = (h - 2.6) / n;
    g.push(cyl(x, y, z, ra, rb, H, seg, { mat: MUR, ton, uvs: [cols, Math.max(2, Math.round(H / 4.4))] }));
    y += H; ra = rb;
    g.push(cyl(x, y - 0.25, z, ra * 1.11, ra * 1.14, 0.55, seg, { ton }));
    g.push(cyl(x, y + 0.3, z, ra * 1.04, ra * 1.0, 0.5, seg, { ton }));
  }
  if (creneaux) for (let k = 0; k < seg; k += 2) { const a = k / seg * 6.283; g.push(bo(x + Math.cos(a) * ra * 1.02, y + 0.55, z + Math.sin(a) * ra * 1.02, ra * 0.3, 1.3, 0.5, -a + Math.PI / 2, { ton })); }
  if (toit === 'cone') {
    const p = [[ra * 0.98, 0], [ra * 0.76, ra * 0.5], [ra * 0.5, ra * 1.25], [ra * 0.22, ra * 2.3], [0.05, ra * 3.1]];
    g.push(tour2(p, seg, x, y, z, { mat: TUILE, ton: tonToit, uvs: [Math.round(ra * 5), Math.round(ra * 3.2)] }));
    g.push(cyl(x, y + ra * 3.05, z, 0.1, 0.02, 2.4, 6, { mat: METAL, ton: '#3c3a3a' }));
  } else if (toit === 'dome') g.push(cyl(x, y, z, ra * 0.8, ra * 0.76, 1.8, seg, { ton }), ...coupole(x, y + 1.8, z, ra * 0.76));
  return g;
}

// Un pont suspendu : un tablier qui s'affaisse à peine, des câbles, des suspentes.
function pont(a, b, g) {
  const N = 26, lon = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = -Math.atan2(b[2] - a[2], b[0] - a[0]);
  const pt = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * lon * 0.035, a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < N; i++) {
    const p = pt((i + 0.5) / N);
    g.push(bo(p[0], p[1], p[2], lon / N * 1.04, 0.45, 2.1, ry));
    if (i % 2 === 0) for (const s of [-1, 1]) {
      const c = Math.sin(ry), d = Math.cos(ry);
      g.push(bo(p[0] - c * s * 1.02 * 0 + s * c * 1.02, p[1] + 0.45, p[2] + s * d * 1.02, 0.1, 1.05, 0.1, ry, { mat: METAL, ton: '#4a4542' }));
    }
  }
  for (const s of [-1, 1]) {
    const c = Math.sin(ry), d = Math.cos(ry), pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, p = pt(t); pts.push(new THREE.Vector3(p[0] + s * c * 1.02, p[1] + 1.5 + Math.sin(t * 3.1416 * 6) * 0.05, p[2] + s * d * 1.02)); }
    g.push(pose(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.08, 4), { mat: METAL, ton: '#4a4542' }));
  }
}

// Un colosse encapuchonné, marcheur de pierre : le gardien de la porte.
function colosse(x, z, H, ry, g, ton = '#6f8f85') {
  const k = H / 10;
  const p = [[2.3, 0], [2.2, 0.8], [1.95, 2.6], [1.7, 4.6], [1.55, 6], [1.3, 7.1], [0.96, 7.7], [0.82, 8.1], [0.98, 8.6], [1.02, 9.1], [0.86, 9.6], [0.42, 10], [0.05, 10.1]].map(([a, b]) => [a * k, b * k]);
  const c = pose(new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), 30).scale(1, 1, 0.74).rotateY(ry).translate(x, 0, z), { ton });
  g.push(c);
  const av = [Math.sin(ry) * -1, Math.cos(ry) * -1];
  // Le bâton, tenu devant, et le creux noir du visage.
  g.push(cyl(x + 2.4 * k, 0, z - 0.8 * k, 0.16 * k, 0.12 * k, 11.5 * k, 10, { ton: '#3a4944' }));
  g.push(pose(new THREE.SphereGeometry(0.62 * k, 14, 10).scale(1, 1.1, 0.5).translate(x, 9 * k, z - 0.58 * k), { ton: '#0f1413' }));
  return av;
}

const CRISTAL = (x, z, r, h, ry = 0, pench = 0, o = { mat: GLACE }) => pose(new THREE.CylinderGeometry(r * 0.1, r, h, 7, 1).translate(0, h / 2, 0).scale(1, 1, 0.62).rotateZ(pench).rotateY(ry).translate(x, 0, z), o);

const FABRIQUES = {
  aberlaas(r, anim) {
    const g = [];
    // Une ville taillée dans la glace : de grandes aiguilles translucides, et des tours claires à leur pied.
    for (let i = 0; i < 34; i++) { const a = -1.55 + i / 33 * 3.1, d = 40 + r() * 34; g.push(CRISTAL(Math.sin(a) * d * 1.6, -Math.cos(a) * d * 0.6 + 18, 3 + r() * 5.5, 20 + r() * 52, r() * 3, (r() - 0.5) * 0.14)); }
    for (let i = 0; i < 11; i++) tour(-58 + i * 11.5 + r() * 3, 8 + r() * 14, 3 + r() * 2, 16 + r() * 22, { seg: 14, toit: i % 3 ? 'cone' : 'dome', tonToit: '#5e7f92' }, g);
    tour(0, 20, 6.5, 52, { seg: 24, toit: 'cone', tonToit: '#4d7488' }, g);
    for (let i = -6; i < 6; i++) g.push(bo(i * 12 + 6, 0, 2, 11.4, 5, 3.4));
    return g;
  },
  portchoon(r, anim) {
    const g = [];
    for (let i = 0; i < 9; i++) {
      const x = -44 + i * 11, z = 6 - r() * 18, h = 7 + r() * 10, l = 9, p = 12;
      g.push(bo(x, 0, z, l, h, p, 0, { mat: MUR, uvs: [3, Math.round(h / 4.2)] }));
      g.push(pose(new THREE.CylinderGeometry(l * 0.6, l * 0.6, p * 1.04, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 6).scale(1, 0.62, 1).translate(x, h + l * 0.2, z), { mat: TUILE, ton: '#8f5c4a', uvs: [10, 8] }));
    }
    tour(54, -8, 4.4, 34, { seg: 20, toit: 'dome' }, g);
    for (let i = 0; i < 16; i++) g.push(bo(-56 + i * 8, 0, -30, 7.6, 2.2, 7), bo(-56 + i * 8, 0, -33.6, 1, 3.6, 0.6, 0, { mat: METAL, ton: '#4a4542' }));
    // Les moulins de la ville : ils tournent.
    for (let i = 0; i < 4; i++) {
      const x = -30 + i * 19, z = -18, y = 26 + r() * 7;
      g.push(cyl(x, 0, z, 0.8, 0.44, y, 10, { ton: '#a9a48b' }));
      anim.push({ x, y, z, axe: 'z', v: 1.5 + r(), ailes: pales(6.8) });
    }
    return g;
  },
  chawondasee(r) {
    const g = [];
    for (let i = 0; i < 12; i++) {
      const x = -52 + r() * 104, z = -28 + r() * 56, ra = 5 + r() * 7, h = 4 + r() * 5;
      g.push(cyl(x, 0, z, ra * 1.04, ra, h, 22, { mat: MUR, uvs: [Math.round(ra * 1.6), 2] }), cyl(x, h, z, ra * 1.08, ra * 1.1, 0.5, 22), ...coupole(x, h + 0.5, z, ra * 0.92));
    }
    for (let i = 0; i < 4; i++) tour(-36 + i * 24, -6 + r() * 12, 2.3, 26 + r() * 8, { seg: 14, toit: 'dome', creneaux: false }, g);
    return g;
  },
  alticcio(r, anim) {
    const g = [], pos = [];
    for (let i = 0; i < 24; i++) {
      const c = i % 2 ? 1 : -1, x = c * (34 + r() * 44), z = -112 + i * 9.6 + r() * 6, h = 34 + r() * 44, ra = 4 + r() * 4.2;
      pos.push([x, z, h, ra]);
      tour(x, z, ra, h, { seg: 20, toit: i % 3 === 0 ? 'dome' : 'cone', tonToit: i % 2 ? '#8f5c4a' : '#7a4a44' }, g);
    }
    // Les ponts d'une rive à l'autre : les Tourangeaux ne touchent pas le sol des Racleurs.
    for (let i = 0; i + 1 < pos.length; i += 5) {
      const [ax, az, ah, ar] = pos[i], [bx, bz, bh, br] = pos[i + 1], y = Math.min(ah, bh) * 0.74;
      const n = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / n, uz = (bz - az) / n;
      pont([ax + ux * ar, y, az + uz * ar], [bx - ux * br, y, bz - uz * br], g);
    }
    // La Tour d'Ær, bibliothèque des ærudits : un fût, une rampe en hélice, une lanterne qui veille.
    tour(66, -32, 8, 78, { seg: 28, toit: 'dome', creneaux: false }, g);
    const pts = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * 6.283 * 7, y = 3 + i / 200 * 70; pts.push(new THREE.Vector3(66 + Math.cos(a) * 11.2, y, -32 + Math.sin(a) * 11.2)); }
    g.push(pose(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 1.1, 6), { ton: '#c79b8b' }));
    for (let i = 0; i < 80; i += 4) { const a = i / 80 * 6.283 * 7, y = i / 80 * 70; g.push(cyl(66 + Math.cos(a) * 11.4, 0, -32 + Math.sin(a) * 11.4, 0.4, 0.34, y + 3, 8)); }
    // Sur les tours du centre, des hélices : Alticcio tire tout du vent.
    for (let i = 0; i < 5; i++) { const q = pos[i * 4 + 1]; anim.push({ x: q[0], y: q[2] + q[3] * 3.4 + 3, z: q[1], axe: 'z', v: 1.1 + r(), ailes: pales(q[3] * 1.2) }); }
    return g;
  },
  urle(r) {
    const g = [];
    // Deux pylônes, un linteau, deux gardiens de pierre : le seul passage du massif.
    for (const c of [-1, 1]) {
      g.push(pose(new THREE.CylinderGeometry(6.4, 8.8, 44, 4, 1).rotateY(Math.PI / 4).translate(c * 22, 22, 0).scale(1, 1, 0.8), { ton: '#7ea498' }));
      for (let y = 4; y < 42; y += 7) g.push(bo(c * 22, y, 0, 19 - y * 0.16, 0.8, 16 - y * 0.14));
      colosse(c * 34, -8, 38, 0, g);
    }
    g.push(bo(0, 40, 0, 66, 5, 13, 0, { ton: '#7ea498' }), bo(0, 45, 0, 72, 1.6, 15, 0, { ton: '#648b7f' }), bo(0, 46.6, 0, 40, 3.4, 9, 0, { ton: '#7ea498' }));
    for (let i = 0; i < 9; i++) {
      const x = -16 + i * 4, l = 8 + r() * 11, pts = [];
      for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(x + Math.sin(k) * 0.3, 40 - k / 8 * l, 0));
      g.push(pose(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.16, 5), { mat: METAL, ton: '#37423e' }));
    }
    return g;
  },
  egine(r) {
    // La 27e Horde : des stèles dans la formation qu'elle tenait, tournées vers l'amont. Deux sont tombées.
    const g = [];
    HORDIERS.forEach((h, i) => {
      const H = 7 + (i * 7 % 5) * 1.2, x = h.slot[0] * 3.1, z = h.slot[1] * 3.1;
      if (i % 11 === 7) { g.push(pose(new THREE.CylinderGeometry(0.9, 1.5, H, 8).rotateX(1.5).rotateY(r() * 3).translate(x, 1.2, z))); return; }
      g.push(cyl(x, 0, z, 2.1, 1.9, 0.6, 10), cyl(x, 0.6, z, 1.5, 0.92, H, 10), cyl(x, 2.4, z, 1.5, 1.42, 0.26, 10), cyl(x, H * 0.7, z, 1.14, 1.08, 0.26, 10), pose(new THREE.SphereGeometry(1, 10, 8).scale(0.95, 1.2, 0.95).translate(x, H + 1.2, z)));
    });
    return g;
  },
  boban(r) {
    const g = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * 6.283, d = 20 + r() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d, ra = 3.4 + r() * 1.8, h = 6 + r() * 3;
      g.push(pose(new THREE.ConeGeometry(ra, h, 16, 1, true).translate(x, h / 2, z), { mat: TOILE, ton: ['#b3a06f', '#9f7f5a', '#a88a66'][i % 3] }));
      g.push(cyl(x, h - 0.4, z, 0.05, 0.03, 2, 5, { mat: METAL, ton: '#3a3530' }));
      g.push(pose(new THREE.SphereGeometry(0.22, 8, 6).translate(x, h * 0.45, z - ra * 0.6), { mat: LAVE, ton: '#ffffff' }));
    }
    for (let i = 0; i < 4; i++) {
      const x = -10 + i * 7, z = r() * 8 - 4; g.push(cyl(x, 0, z, 0.26, 0.14, 15, 8, { mat: TOILE, ton: '#6e5a47' }));
      g.push(pose(new THREE.PlaneGeometry(4, 2, 6, 1).translate(2, 13.6, 0).rotateY(r()).translate(x, 0, z), { mat: TOILE, ton: ['#8a3f30', '#486878'][i % 2] }));
    }
    g.push(pose(new THREE.ConeGeometry(2, 3, 8).translate(0, 1.5, 0), { mat: LAVE }));
    return g;
  },
  brakauer(r) {
    const g = [];
    for (let i = 0; i < 38; i++) { const a = 0.42 + i / 37 * 5.44, d = 70 + r() * 20; g.push(CRISTAL(Math.sin(a) * d, Math.cos(a) * d, 5 + r() * 6, 18 + r() * 34, a, 0.2 * Math.sign(Math.sin(a * 1.0)) + (r() - 0.5) * 0.1)); }
    return g;
  },
  krafla(r, anim) {
    const g = [], y = 66;
    // Le volcan suspendu : une goutte de roche renversée, et sa bouche de lave.
    const geo = new THREE.SphereGeometry(52, 72, 54), p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), t = Y / 52;
      const bas = t < 0 ? 1 + t * t * 0.62 : 0.5 - t * 0.2, fl = t < 0 ? 1 + t * 0.92 : 1;
      const a = Math.atan2(Z, X), ride = 1 + 0.07 * Math.sin(a * 13 + t * 9) + 0.05 * Math.sin(a * 29 - t * 13) + 0.03 * Math.sin(a * 53);
      p.setXYZ(i, X * fl * ride, (t < 0 ? Y * bas * 1.16 : Y * bas), Z * fl * ride);
    }
    geo.computeVertexNormals();
    g.push(pose(geo.translate(0, y, 0), { mat: LAVE, uvs: [1, 1] }));
    const cr = []; for (let i = 0; i <= 10; i++) { const t = i / 10; cr.push([50 - t * 8 + Math.sin(t * 3.1) * 3, t * 7]); }
    g.push(tour2(cr, 48, 0, y + 14, 0, { ton: '#3a2b28' }));
    g.push(cyl(0, y + 16, 0, 44, 44, 0.5, 48, { mat: LAVE, uvs: [2, 2] }));
    const o = [];
    for (let i = 0; i < 40; i++) {
      const a = r() * 6.283, d = 64 + r() * 56, ra = 1.4 + r() * 3.6, ge = new THREE.IcosahedronGeometry(ra, 2), q = ge.getAttribute('position');
      for (let k = 0; k < q.count; k++) { const f = 0.78 + 0.34 * Math.sin(q.getX(k) * 2.1 / ra + a) * Math.cos(q.getY(k) * 2.7 / ra) + 0.14 * Math.sin(q.getZ(k) * 6 / ra); q.setXYZ(k, q.getX(k) * f, q.getY(k) * f, q.getZ(k) * f); }
      ge.computeVertexNormals();
      o.push(pose(ge.translate(Math.cos(a) * d, y - 26 + r() * 52, Math.sin(a) * d), { mat: PIERRE, ton: '#4a3a36' }));
    }
    anim.push({ x: 0, y: 0, z: 0, axe: 'y', v: 0.05, ailes: mergeGeometries(o) });
    return g;
  },
};

function pales(R) {
  const g = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.283;
    g.push(pose(new THREE.BoxGeometry(R * 0.86, R * 0.24, 0.05, 6, 1, 1).translate(R * 0.56, R * 0.08, 0).rotateZ(a), { mat: TOILE, ton: '#ece2c6' }));
    g.push(pose(new THREE.CylinderGeometry(0.05, 0.08, R, 5).rotateZ(Math.PI / 2).translate(R / 2, 0, 0.1).rotateZ(a), { mat: METAL, ton: '#4a4542' }));
  }
  g.push(pose(new THREE.SphereGeometry(R * 0.07, 10, 8), { mat: METAL, ton: '#4a4542' }));
  return mergeGeometries(g);
}

export class Monuments {
  constructor(monde, u) {
    this.groupe = new THREE.Group(); this.u = u;
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG });
    this.items = []; this.tournent = [];
    for (const l of monde.lieux) {
      const f = FABRIQUES[l.id];
      if (!f || l.sansMonument) continue;
      const anim = [];
      const geo = mergeGeometries(f(alea(monde.graine + l.s | 0), anim), false);
      const m = new THREE.Mesh(geo, mat);
      // Le sol a été fait pour lui : il n'y a qu'à lire l'altitude de son ancre.
      m.position.set(l.x, Math.max(0, l.ancre?.y ?? 0), -l.s);
      m.scale.setScalar(ECHELLE.monument);
      m.visible = false; m.renderOrder = 0; m.layers.enable(1);
      for (const a of anim) {
        const e = new THREE.Mesh(a.ailes, mat); e.position.set(a.x, a.y, a.z); e.layers.enable(1); e.frustumCulled = false;
        m.add(e); this.tournent.push({ e, axe: a.axe, v: a.v });
      }
      this.groupe.add(m); this.items.push({ m, l });
    }
  }
  maj(s, portee, dt) {
    for (const i of this.items) i.m.visible = Math.abs(i.l.s - s) < portee;
    for (const t of this.tournent) t.e.rotation[t.axe] += t.v * dt;
  }
}
