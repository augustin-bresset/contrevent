// Ce qui traîne et pousse sur le sol, tiré d'une grille à graine autour de la Horde. Trois grilles : le menu sous les pieds,
// le paysage autour, et au loin les seuls grands blocs, pour que le désert ne s'arrête pas net.
// Les pierres sont des scans : elles s'enfoncent dans le sol, et le vent dépose sur elles ce qu'il transporte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRILLES, semerCase, tirage } from '../monde/semis-plan.js';
import { GLSL_COMMUN, GLSL_OMBRE, GLSL_GLACE } from './communs.js';
import { geometrie } from './monuments.js';
import { ROCHERS } from './rochers-maillage.js';

const MAX = 7000;
const lire = (b64, C) => { const s = atob(b64), o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return new C(o.buffer); };

// Un brin : large au pied, pointu, courbé sous son propre poids.
function brin(l, h, a, ploie) {
  const g = new THREE.PlaneGeometry(l, h, 1, 3).translate(0, h / 2, 0), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setXYZ(i, p.getX(i) * (1 - t * 0.92), p.getY(i) * (1 - ploie * t * t * 0.3), ploie * t * t * h * 0.5);
  }
  return g.rotateY(a).toNonIndexed();
}
const nu = (g, bois) => {
  const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); q.deleteAttribute('normal');
  q.setAttribute('aBois', new THREE.BufferAttribute(new Float32Array(q.getAttribute('position').count).fill(bois), 1));
  return q;
};
function touffe(n, l, h) {
  const g = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 0.2 * Math.sqrt(i / n), b = brin(l, h * (0.65 + 0.35 * (((i * 7) % 5) / 4)), a, 0.5 + 0.5 * ((i * 3) % 4) / 3);
    g.push(nu(b.translate(Math.cos(a) * r, 0, Math.sin(a) * r), 0));
  }
  return mergeGeometries(g);
}
// Un buisson que le vent a peigné : du bois sec, tout penché du même côté, et ce qu'il reste de feuilles au bout.
function buisson() {
  const g = []; let rnd = 12345;
  const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const branche = (o, d, l, e, n) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    g.push(nu(new THREE.CylinderGeometry(e * 0.6, e, l, 3, 1).translate(0, l / 2, 0).applyQuaternion(q).translate(o.x, o.y, o.z), 1));
    const b = o.clone().addScaledVector(d, l);
    if (n === 0) {
      for (let i = 0; i < 7; i++) g.push(nu(new THREE.PlaneGeometry(0.09, 0.06).rotateX(r() * 3).rotateY(r() * 6).translate(b.x + (r() - 0.5) * 0.22, b.y + (r() - 0.5) * 0.15, b.z + (r() - 0.5) * 0.22), 0));
      return;
    }
    for (let i = 0; i < 2 + (n > 1 ? 1 : 0); i++) {
      const v = d.clone().add(new THREE.Vector3((r() - 0.5) * 1.1, r() * 0.4, (r() - 0.5) * 1.1 + 0.25)).normalize();
      branche(b, v, l * (0.62 + r() * 0.18), e * 0.6, n - 1);
    }
  };
  for (let i = 0; i < 4; i++) { const a = i * 1.7; branche(new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), new THREE.Vector3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4 + 0.25).normalize(), 0.52, 0.05, 3); }
  return mergeGeometries(g);
}
// Les côtes d'une bête ou d'une épave, à demi enterrées.
function cotes() {
  const g = [];
  for (let i = 0; i < 6; i++) g.push(nu(new THREE.TorusGeometry(0.9 - Math.abs(i - 2.5) * 0.08, 0.05, 3, 8, Math.PI).rotateY(Math.PI / 2).translate(0, -0.08, -1.2 + i * 0.48), 1));
  return mergeGeometries(g);
}
function pierre(cle, lod, couche) {
  const m = ROCHERS[cle][lod], g = new THREE.BufferGeometry();
  const pos = lire(m.p, Int16Array), uv = lire(m.u, Uint16Array), nor = lire(m.n, Int8Array);
  const P = new Float32Array(pos.length); for (let i = 0; i < pos.length; i++) P[i] = pos[i] / 32767 * 4;
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aU', new THREE.BufferAttribute(uv, 2, true));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setAttribute('aCouche', new THREE.BufferAttribute(new Float32Array(P.length / 3).fill(couche), 1));
  g.setIndex(new THREE.BufferAttribute(lire(m.i, Uint16Array), 1));
  return g;
}
const BOULES = ['b3', 'b4', 'b5'], FLECHES = ['ai', 'fl'], COUCHE_P = { b3: 0, b4: 1, b5: 2, ai: 3, fl: 4 };
const SOUPLES = new Set(['touffe', 'roseau']);

export class Semis {
  constructor(monde, u, matieres) {
    this.monde = monde; this.u = u; this.groupe = new THREE.Group(); this.cle = ''; this.m = {};
    this.uC = { value: new THREE.Vector2() };
    const uP = { ...u, uCentreS: this.uC, tRocC: { value: matieres.tRocC }, tRocN: { value: matieres.tRocN } };
    const mPierre = new THREE.ShaderMaterial({
      uniforms: uP,
      vertexShader: /* glsl */`
        attribute vec3 iCol; attribute vec2 aU; attribute float aCouche, iR; uniform sampler2D tH; uniform vec2 uAnneau, uCentreS;
        varying vec3 vP, vC, vA, vB, vD; varying vec2 vU; varying float vK, vHaut, vT;
        void main() {
          // Au bord de sa grille, une pierre s'enfonce peu à peu : rien n'apparaît ni ne disparaît d'un coup.
          float kf = smoothstep(iR, iR * 0.76, distance(instanceMatrix[3].xz, uCentreS));
          vec4 w = instanceMatrix * vec4(position * kf, 1.0); mat3 m = mat3(instanceMatrix);
          vec3 a = m[0], b = m[1], d = m[2]; vT = length(a);
          vA = a / vT; vB = b / length(b); vD = d / length(d);
          vP = w.xyz; vC = iCol; vU = aU; vK = aCouche;
          vHaut = w.y - max(texture2D(tH, vec2(w.x, -w.z) / uAnneau).r, 0.0);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; precision highp sampler2DArray;
        uniform sampler2DArray tRocC, tRocN;
        varying vec3 vP, vC, vA, vB, vD; varying vec2 vU; varying float vK, vHaut, vT;
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        void main() {
          vec3 o = texture(tRocN, vec3(vU, vK)).xyz * 2.0 - 1.0;
          vec3 n = normalize(vA * o.x + vB * o.y + vD * o.z);
          vec3 alb = texture(tRocC, vec3(vU, vK)).rgb * 1.7 * vC * vC;
          float dv = clamp(-vP.z / uBande, 0.0, 1.0);
          vec3 lum = palette(1, dv); lum *= lum;
          // Ce que le vent dépose : sur les faces du dessus, et au pied, où le sol remonte sur la pierre.
          float n0 = fbm3(vP.xz * 1.3 + vP.y);
          float depot = smoothstep(0.6, 0.92, n.y + (n0 - 0.5) * 0.7);
          float pied = smoothstep(0.0, 0.2 + vT * 0.16, vHaut + (n0 - 0.5) * vT * 0.2);
          alb = mix(alb, lum * 0.74, max(depot * 0.8, 1.0 - pied));
          float occl = mix(0.34, 1.0, smoothstep(0.0, 0.5 + vT * 0.4, vHaut));
          gl_FragColor = vec4(eclairer(alb, n, vP, 0.74, soleilVu(vP, gl_FragCoord.xy) * soleilRelief(vP, vHaut), occl), 1.0);
        }`,
    });
    const mVif = new THREE.ShaderMaterial({
      uniforms: { ...u, uCentreS: this.uC }, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec3 iCol; attribute float iSouple, aBois, iR;
        uniform float uTemps; uniform vec2 uCentreS; varying vec3 vP, vC; varying float vB, vH;
        void main() {
          float kf = smoothstep(iR, iR * 0.76, distance(instanceMatrix[3].xz, uCentreS));
          vec4 w = instanceMatrix * vec4(position * kf, 1.0);
          float h = iSouple * max(position.y, 0.0);
          w.z += h * (0.2 + 0.1 * sin(uTemps * 2.1 + w.x * 0.21 + w.z * 0.17));
          w.x += h * 0.06 * sin(uTemps * 1.7 + w.z * 0.3);
          vP = w.xyz; vC = iCol; vB = aBois; vH = position.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vP, vC; varying float vB, vH;
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        void main() {
          vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
          if (n.y < 0.0) n = -n;
          n = normalize(n + vec3(0.0, 0.9, 0.0));
          vec3 alb = mix(vC * vC, vec3(0.07, 0.05, 0.035), vB) * (0.7 + 0.6 * hash(floor(vP.xz * 3.0)));
          vec3 c = eclairer(alb, n, vP, 0.7, soleilVu(vP, gl_FragCoord.xy) * soleilRelief(vP, 0.0), mix(0.4, 1.0, clamp(vH, 0.0, 1.0)));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    // Les éclats de glace : les mêmes prismes que les orgues d'Aberlaas, en petit.
    const mGlace = new THREE.ShaderMaterial({
      uniforms: { ...u, uCentreS: this.uC },
      vertexShader: /* glsl */`
        attribute vec4 aI; attribute float iR; uniform vec2 uCentreS; varying vec3 vP; varying vec2 vI;
        void main() {
          float kf = smoothstep(iR, iR * 0.76, distance(instanceMatrix[3].xz, uCentreS));
          vec4 w = instanceMatrix * vec4(position * kf, 1.0);
          vP = w.xyz; vI = aI.xy;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vP; varying vec2 vI;
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        ${GLSL_GLACE}
        void main() { gl_FragColor = vec4(glace(vP, normalize(cross(dFdx(vP), dFdy(vP))), vI.x, vI.y, soleilVu(vP, gl_FragCoord.xy) * soleilRelief(vP, 0.0)), 1.0); }`,
    });
    const faire = (nom, g, mat, porteOmbre, souple = 0) => {
      const col = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3), so = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(souple), 1);
      const ir = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
      g.setAttribute('iCol', col); g.setAttribute('iSouple', so); g.setAttribute('iR', ir);
      const im = new THREE.InstancedMesh(g, mat, MAX);
      im.frustumCulled = false; im.count = 0; im.renderOrder = 0;
      if (porteOmbre) im.layers.enable(1);
      this.groupe.add(im); this.m[nom] = { im, col, ir, n: 0 };
    };
    for (const c of [...BOULES, ...FLECHES]) for (const l of [0, 1]) faire(`${c}${l}`, pierre(c, l, COUCHE_P[c]), mPierre, true);
    for (const c of ['glaceB', 'glaceC']) for (const l of [0, 1]) faire(`${c}${l}`, geometrie(c, l), mGlace, true);
    faire('touffe', touffe(14, 0.1, 1), mVif, false, 1);
    faire('roseau', touffe(9, 0.07, 1.7), mVif, false, 1);
    faire('arbuste', buisson(), mVif, true);
    faire('cote', cotes(), mVif, false);
    this.o = new THREE.Object3D(); this.tons = {};
  }
  ton(hex) { return this.tons[hex] || (this.tons[hex] = new THREE.Color(hex).convertLinearToSRGB()); }
  poser = (forme, x, s, taille, hb, k, q0, ton, i, j) => {
    const M = this.monde, g = (n) => tirage(M.graine, i, j, n), proche = Math.hypot(x - this.cx, s - this.cs) < 280, l = proche ? 0 : 1;
    const nom = forme === 'rocher' ? `${BOULES[Math.floor(q0 * 3)]}${l}` : forme === 'eclat' ? `${FLECHES[Math.floor(q0 * 2)]}${l}` : forme === 'glacon' ? `glace${q0 < 0.5 ? 'C' : 'B'}${l}` : forme;
    const q = this.m[nom];
    if (q.n >= MAX) return;
    const o = this.o, glacon = forme === 'glacon', eclat = forme === 'eclat', pierre = eclat || forme === 'rocher' || glacon;
    o.position.set(x, Math.max(hb, 0) - taille * (pierre ? 0.14 : 0.04), -s);
    o.rotation.set((g(k + 41) - 0.5) * (eclat ? 0.16 : 0.3), g(k + 43) * 6.28, (g(k + 47) - 0.5) * (eclat ? 0.16 : 0.3));
    o.scale.setScalar(glacon ? taille * 0.1 : eclat ? taille * 0.52 : taille); o.updateMatrix();
    q.im.setMatrixAt(q.n, o.matrix);
    const t = this.ton(ton), v = 0.86 + g(k + 53) * 0.28;
    q.col.setXYZ(q.n, t.r * v, t.g * v, t.b * v); q.ir.setX(q.n, this.R);
    q.n++;
  };
  maj(x, s) {
    const C = 24, F = 8, L = 120, ci = Math.floor(x / 12), cj = Math.floor(s / 12), cle = ci + ':' + cj;
    this.uC.value.set(x, -s);
    if (cle === this.cle) return;
    this.cle = cle;
    for (const q of Object.values(this.m)) q.n = 0;
    // Des disques, pas des rectangles, tous centrés sur la Horde : le menu sous ses pas, le paysage autour, les grands blocs jusqu'à l'horizon.
    this.cx = x; this.cs = s;
    for (const G of GRILLES) {
      const { cote, R } = G, n = Math.ceil(R / cote), i0 = Math.floor(x / cote), j0 = Math.floor(s / cote);
      this.R = R;
      for (let j = j0 - n; j <= j0 + n; j++) for (let i = i0 - n; i <= i0 + n; i++) semerCase(this.monde, i, j, G, this.poser, x, s, R);
    }
    for (const q of Object.values(this.m)) {
      const im = q.im;
      im.count = q.n; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, q.n * 16); im.instanceMatrix.needsUpdate = true;
      q.col.clearUpdateRanges(); q.col.addUpdateRange(0, q.n * 3); q.col.needsUpdate = true;
      q.ir.clearUpdateRanges(); q.ir.addUpdateRange(0, q.n); q.ir.needsUpdate = true;
    }
  }
}
