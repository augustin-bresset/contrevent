// Les lieux du roman. Des pièces sculptées, peu nombreuses, posées selon le plan des villes (monde/villes.js).
// Ce sont des masses claires, avec l'ombre de leurs creux cuite dedans : tout l'effet vient de la forme et de la lumière.
import * as THREE from 'three';
import { GLSL_COMMUN, GLSL_OMBRE, GLSL_GLACE } from './communs.js';
import { BATI } from './bati-maillage.js';

const lire = (b64, C) => { const s = atob(b64), o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return new C(o.buffer); };
export function geometrie(nom, lod) {
  const P = BATI[nom], m = P.lods[lod], g = new THREE.BufferGeometry(), pos = lire(m.p, Int16Array), F = new Float32Array(pos.length), k = P.k / 32767;
  for (let i = 0; i < pos.length; i++) F[i] = pos[i] * k;
  g.setAttribute('position', new THREE.BufferAttribute(F, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(lire(m.n, Int8Array), 3, true));
  g.setAttribute('aI', new THREE.BufferAttribute(lire(m.a, Uint8Array), 4, true));
  g.setIndex(new THREE.BufferAttribute(lire(m.i, Uint16Array), 1));
  return g;
}

const VERT = /* glsl */`
attribute vec4 aI; attribute vec3 iTon; attribute float iMat; varying vec3 vP, vN, vTon; varying vec4 vI; varying float vH, vM, vL;
void main() {
  #ifdef USE_INSTANCING
    mat4 M = modelMatrix * instanceMatrix;
  #else
    mat4 M = modelMatrix;
  #endif
  vec4 w = M * vec4(position, 1.0);
  vP = w.xyz; vN = normalize(mat3(M) * normal); vI = aI; vTon = iTon; vH = position.y; vM = iMat; vL = fract(sin(dot(M[3].xz, vec2(12.98, 78.23))) * 43758.5);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */`
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray tBatC; varying vec3 vP, vN, vTon; varying vec4 vI; varying float vH, vM, vL;
${GLSL_COMMUN}
${GLSL_OMBRE}
${GLSL_GLACE}
void main() {
  vec3 n = normalize(vN), P = vP, emis = vec3(0.0);
  float ao = vI.x, ar = vI.y, creux = vI.z, accent = vI.w, m = floor(vM + 0.5), rug = 0.86, dv = clamp(-P.z / uBande, 0.0, 1.0);
  float vis = soleilVu(P, gl_FragCoord.xy) * soleilRelief(P, vH);
  float noir = max(uNuit, tempeteA(P.x, -P.z));
  if (m > 2.5 && m < 3.5) { gl_FragColor = vec4(glace(P, normalize(cross(dFdx(P), dFdy(P))), ao, ar, vis), 1.0); return; }
  vec3 lum = palette(1, dv); lum *= lum;
  float grand = fbm3(vec2(P.x + P.z, P.y) * 0.03);
  vec3 alb = vTon * (0.86 + 0.28 * grand);
  if (m < 0.5) {                                   // la pierre : un enduit épais, patiné par le vent
    vec2 pa = abs(n.x) > abs(n.z) ? vec2(P.z, P.y) : vec2(P.x, P.y);
    vec3 d = texture(tBatC, vec3((abs(n.y) > 0.7 ? P.xz : pa) / 17.0, 1.0)).rgb / vec3(0.058, 0.053, 0.039);
    alb *= mix(vec3(1.0), d, 0.18);
    float coul = smoothstep(0.42, 0.72, fbm3(vec2((P.x + P.z) * 0.13, P.y * 0.012)));   // les coulées, sous ce qui dépasse
    alb *= mix(1.0, 0.8, coul * 0.7);
    alb *= 1.0 + (ar - 0.5) * 0.5;                 // les arêtes usées, plus claires
    alb = mix(alb, lum * 0.7, (1.0 - smoothstep(0.0, 5.0 + 5.0 * grand, vH)) * 0.75);   // le sable remonte le long des murs
  } else if (m < 4.5) {                            // la roche de Krafla, et sa lave
    float p1 = fbm3(P.xz * 0.08 + P.y * 0.05), p2 = fbm3(P.xz * 0.2 + vec2(uTemps * 0.05, p1 * 6.0));
    float f = smoothstep(0.05, 0.0, abs(p2 - 0.5));
    alb *= 0.6 + 0.8 * p1;
    emis = mix(vec3(9.0, 2.2, 0.3), vec3(18.0, 9.0, 2.2), f) * (f + smoothstep(0.54, 0.7, p2) * 0.7) * creux;
    creux = 0.0;
  } else alb *= 0.8 + 0.4 * bruit(vec2(P.x + P.z, P.y) * 3.0);   // la toile
  // Le cuivre des toits : éteint, vert de gris, plus clair aux arêtes.
  if (accent > 0.01) {
    vec3 cu = mix(vec3(0.05, 0.085, 0.08), vec3(0.2, 0.28, 0.25), clamp(ao * 0.5 + grand * 0.7, 0.0, 1.0));
    cu = mix(cu, vec3(0.42, 0.3, 0.17), smoothstep(0.66, 0.92, ar));
    alb = mix(alb, cu, accent); rug = mix(rug, 0.5, accent);
  }
  // Les creux : l'ombre. Le soir, une lumière d'habitants s'y allume.
  alb *= 1.0 - 0.6 * creux;
  emis += vec3(2.6, 1.15, 0.36) * noir * creux * step(0.45, vL);   // une maison sur deux veille
  vec3 c = eclairer(alb, n, P, rug, vis * mix(0.7, 1.0, ao), mix(0.26, 1.0, ao));
  gl_FragColor = vec4(c + emis, 1.0);
}`;

const coul = (hex) => new THREE.Color(hex);
const TONS = {
  aberlaas: ['#a9b8c2', '#bcc6cc'], portchoon: ['#d8c8aa'], chawondasee: ['#e4d6ba'], alticcio: ['#dcbda6'], urle: ['#a8b5aa'],
  egine: ['#cfc6d2'], boban: ['#a38a60', '#8d6a4c', '#b09d74'], brakauer: ['#d5dde0'], krafla: ['#2e2422'],
};

export class Monuments {
  constructor(monde, u, matieres) {
    this.groupe = new THREE.Group(); this.u = u;
    const mat = new THREE.ShaderMaterial({ uniforms: { ...u, tBatC: { value: matieres.tBatC } }, vertexShader: VERT, fragmentShader: FRAG });
    const geo = {}, G = (n, l) => geo[n + l] || (geo[n + l] = geometrie(n, l));
    const o = new THREE.Object3D();
    this.items = []; this.tournent = [];
    for (const l of monde.lieux) {
      if (!l.bati?.length) continue;
      const parPiece = {};
      for (const q of l.bati) (parPiece[q.p] = parPiece[q.p] || []).push(q);
      const it = { l, g: new THREE.Group(), lods: [[], []] };
      for (const [nom, liste] of Object.entries(parPiece)) for (const lod of [0, 1]) {
        const g = G(nom, lod).clone(), ton = new Float32Array(liste.length * 3), im = new THREE.InstancedMesh(g, mat, liste.length);
        g.setAttribute('iMat', new THREE.InstancedBufferAttribute(new Float32Array(liste.length).fill(BATI[nom].base), 1));
        liste.forEach((q, i) => {
          o.position.set(q.x, q.y0, -q.s); o.rotation.set(0, q.ry, 0); o.rotateX(q.pench); o.scale.setScalar(q.e); o.updateMatrix();
          im.setMatrixAt(i, o.matrix);
          const t = coul((TONS[l.id] || TONS.aberlaas)[q.ton % (TONS[l.id] || TONS.aberlaas).length]);
          ton.set([t.r, t.g, t.b], i * 3);
        });
        g.setAttribute('iTon', new THREE.InstancedBufferAttribute(ton, 3));
        im.frustumCulled = false; im.layers.enable(1); im.visible = lod === 0;
        it.g.add(im); it.lods[lod].push(im);
      }
      // Les ailes des moulins tournent.
      const ton1 = new THREE.BufferAttribute(new Float32Array([0.8, 0.72, 0.56]), 3);
      for (const q of parPiece.moulin || []) {
        const g = G('ailes', 0).clone(); g.setAttribute('iTon', new THREE.InstancedBufferAttribute(ton1.array, 3)); g.setAttribute('iMat', new THREE.InstancedBufferAttribute(new Float32Array([5]), 1));
        const m = new THREE.InstancedMesh(g, mat, 1); m.setMatrixAt(0, new THREE.Matrix4());
        const c = Math.sin(q.ry), d = Math.cos(q.ry);
        m.position.set(q.x + c * 11 * q.e, q.y0 + 48 * q.e, -q.s + d * 11 * q.e); m.rotation.set(0, q.ry, 0); m.rotation.order = 'YXZ'; m.scale.setScalar(q.e);
        m.frustumCulled = false; m.layers.enable(1); it.g.add(m); this.tournent.push({ e: m, axe: 'z', v: 1 + (q.e % 0.3) * 3 });
      }
      // Les écueils qui tournent autour du volcan.
      if (parPiece.volcan) {
        const q = parPiece.volcan[0], n = 44, g = G('ecueil', 1).clone(), ton = new Float32Array(n * 3), im = new THREE.InstancedMesh(g, mat, n);
        g.setAttribute('iMat', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(4), 1));
        for (let i = 0; i < n; i++) {
          const a = i * 2.399, d = 170 + (i * 37 % 110), s = 0.5 + (i * 13 % 10) * 0.14;
          o.position.set(Math.cos(a) * d, -60 + (i * 29 % 140), Math.sin(a) * d); o.rotation.set(a, a * 2, 0); o.scale.setScalar(s); o.updateMatrix();
          im.setMatrixAt(i, o.matrix); ton.set([0.2, 0.15, 0.13], i * 3);
        }
        g.setAttribute('iTon', new THREE.InstancedBufferAttribute(ton, 3));
        im.position.set(q.x, q.y0, -q.s); im.frustumCulled = false; im.layers.enable(1); it.g.add(im); this.tournent.push({ e: im, axe: 'y', v: 0.05 });
      }
      it.g.visible = false; this.groupe.add(it.g); this.items.push(it);
    }
  }
  maj(s, portee, dt) {
    for (const it of this.items) {
      const d = Math.abs(it.l.s - s), proche = d < 900 + it.l.rayon;
      it.g.visible = d < portee;
      for (const m of it.lods[0]) m.visible = proche;
      for (const m of it.lods[1]) m.visible = !proche;
    }
    for (const t of this.tournent) t.e.rotation[t.axe] += t.v * dt;
  }
}
