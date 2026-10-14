// Ce qui traîne et pousse sur le sol, tiré d'une grille à graine autour de la Horde.
// Vu de haut, c'est du grain sur la carte ; à hauteur de Horde, c'est le paysage.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SEMIS } from '../monde/contrees.js';
import { GLSL_COMMUN } from './communs.js';

const MAX = 2600;
const pale = (l, h, a) => new THREE.PlaneGeometry(l, h, 1, 2).translate(0, h / 2, 0).rotateY(a);
const lames = (n, lg, h) => {
  const g = [];
  for (let i = 0; i < n; i++) {
    const q = pale(lg, h * (0.6 + 0.4 * ((i * 7) % 5) / 4), i * 2.4).rotateZ((i - n / 2) * 0.14).rotateX((i % 3 - 1) * 0.14).translate((i % 3 - 1) * 0.14, 0, ((i * 2) % 3 - 1) * 0.14);
    g.push(q.toNonIndexed());
  }
  return mergeGeometries(g.map((q) => { q.deleteAttribute('uv'); q.deleteAttribute('normal'); return q; }));
};
const brut = (g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); q.deleteAttribute('normal'); return q; };
// Une bosse de pierre : une sphère fine, déformée, aux normales lisses.
const galet = (r, d, k, f) => {
  const g = mergeVertices(brut(new THREE.IcosahedronGeometry(r, d)), 1e-4), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const q = 1 + k * (Math.sin(x * f + 1.3) * Math.cos(y * f * 1.3) + 0.6 * Math.sin(z * f * 2.1 + y * f) + 0.3 * Math.sin(x * f * 3.7 + z * f * 3.1));
    p.setXYZ(i, x * q, y * q, z * q);
  }
  return g;
};
const FORMES = {
  rocher: () => galet(1, 3, 0.2, 2.3).scale(1, 0.62, 0.85),
  eclat: () => brut(new THREE.ConeGeometry(0.42, 2, 4, 1).translate(0, 1, 0).rotateZ(0.12)),
  touffe: () => lames(7, 0.11, 1),
  roseau: () => lames(5, 0.07, 1.6),
  arbuste: () => mergeGeometries([
    brut(galet(0.7, 2, 0.14, 4.5).translate(0, 0.72, 0)), brut(galet(0.5, 2, 0.14, 6).translate(0.5, 0.46, 0.1)),
    brut(galet(0.46, 2, 0.14, 6).translate(-0.42, 0.44, -0.2)), brut(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6).translate(0, 0.2, 0)),
  ]),
  // Les côtes d'une bête ou d'une épave, à demi enterrées.
  cote: () => {
    const g = [];
    for (let i = 0; i < 6; i++) {
      const q = brut(new THREE.TorusGeometry(0.9 - Math.abs(i - 2.5) * 0.08, 0.05, 3, 8, Math.PI).rotateY(Math.PI / 2).translate(0, -0.08, -1.2 + i * 0.48));
      g.push(q);
    }
    return mergeGeometries(g);
  },
};
const SOUPLES = new Set(['touffe', 'roseau']);

export class Semis {
  constructor(monde, u) {
    this.monde = monde; this.u = u; this.groupe = new THREE.Group(); this.cle = '';
    this.m = {};
    const mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec3 iCol; attribute float iSouple;
        uniform float uTemps; varying vec3 vP, vC, vN; varying float vProf;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          float h = iSouple * max(position.y, 0.0);
          w.z += h * (0.2 + 0.1 * sin(uTemps * 2.1 + w.x * 0.21 + w.z * 0.17));
          w.x += h * 0.06 * sin(uTemps * 1.7 + w.z * 0.3);
          vP = w.xyz; vC = iCol; vN = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
          vec4 mv = viewMatrix * w; vProf = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vP, vC, vN; varying float vProf;
        ${GLSL_COMMUN}
        void main() {
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          float l = clamp(dot(n, uSoleil), 0.0, 1.0);
          float grain = fbm3(vP.xz * 2.4 + vP.y * 3.0);
          float haut = 0.5 + 0.5 * n.y;
          vec3 c = vC * (0.74 + 0.5 * grain) * (mix(vec3(0.5, 0.53, 0.62), vec3(0.74), haut) + vec3(0.72, 0.68, 0.6) * l);
          gl_FragColor = vec4(atmosphere(c, l, vec3(vP.x, vP.y, -vP.z), vProf), 1.0);
        }`,
    });
    for (const [nom, f] of Object.entries(FORMES)) {
      const g = f(); g.computeVertexNormals();
      const col = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
      const so = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(SOUPLES.has(nom) ? 1 : 0), 1);
      g.setAttribute('iCol', col); g.setAttribute('iSouple', so);
      const im = new THREE.InstancedMesh(g, mat, MAX);
      im.frustumCulled = false; im.count = 0; im.renderOrder = 0;
      if (nom === 'rocher' || nom === 'eclat' || nom === 'arbuste') im.layers.enable(1);
      this.groupe.add(im);
      this.m[nom] = { im, col, n: 0 };
    }
    this.o = new THREE.Object3D();
    this.c = new THREE.Color();
    this.tons = {};
  }
  ton(hex) { return this.tons[hex] || (this.tons[hex] = new THREE.Color(hex).convertLinearToSRGB()); }
  graine(a, b, k) { let h = Math.imul(a * 73856093 ^ b * 19349663 ^ k * 83492791 ^ this.monde.graine, 1540483477); h ^= h >>> 15; h = Math.imul(h, 739982445); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }

  case(i, j, cote, echT, regle) {
    const { monde: M } = this, x0 = i * cote, s0 = j * cote, c = M.contreeA(s0);
    const table = SEMIS[c.relief] || [];
    for (let k = 0; k < table.length; k++) {
      const [forme, chance, [t0, t1], ton, opt] = table[k];
      if (this.graine(i, j, k + regle * 31) > chance) continue;
      const q = this.m[forme];
      if (q.n >= MAX) continue;
      const x = x0 + this.graine(i, j, k + 11) * cote, s = s0 + this.graine(i, j, k + 23) * cote;
      if (x < 0 || x > M.W || s < 0 || s > M.L) continue;
      const hb = M.h(x, s);
      if (opt?.eau ? (hb > 0.25 || hb < -1.5) : hb < 0.12) continue;
      if (Math.abs(M.h(x + 1.5, s) - M.h(x - 1.5, s)) + Math.abs(M.h(x, s + 1.5) - M.h(x, s - 1.5)) > 3.6) continue;
      const taille = (t0 + (t1 - t0) * this.graine(i, j, k + 37) ** 2) * echT;
      if (taille > 2 && Math.abs(x - M.xRoute(s)) < 6) continue;
      const o = this.o;
      o.position.set(x, Math.max(hb, 0) - taille * 0.06, -s);
      o.rotation.set((this.graine(i, j, k + 41) - 0.5) * 0.3, this.graine(i, j, k + 43) * 6.28, (this.graine(i, j, k + 47) - 0.5) * 0.3);
      o.scale.setScalar(taille); o.updateMatrix();
      q.im.setMatrixAt(q.n, o.matrix);
      const t = this.ton(ton), v = 0.86 + this.graine(i, j, k + 53) * 0.28;
      q.col.setXYZ(q.n, t.r * v, t.g * v, t.b * v);
      q.n++;
    }
  }
  maj(x, s) {
    const C = 24, F = 6, ci = Math.floor(x / 12), cj = Math.floor(s / 12), cle = ci + ':' + cj;
    if (cle === this.cle) return;
    this.cle = cle;
    for (const q of Object.values(this.m)) q.n = 0;
    // Une grille large pour le paysage, une fine et plus menue pour ce qui est tout près.
    const ii = Math.floor(x / C), jj = Math.floor(s / C);
    for (let j = jj - 14; j <= jj + 28; j++) for (let i = ii - 19; i <= ii + 19; i++) this.case(i, j, C, 1.4, 0);
    const fi = Math.floor(x / F), fj = Math.floor(s / F);
    for (let j = fj - 12; j <= fj + 24; j++) for (let i = fi - 14; i <= fi + 14; i++) this.case(i, j, F, 0.5, 1);
    for (const q of Object.values(this.m)) {
      q.im.count = q.n; q.im.instanceMatrix.needsUpdate = true; q.col.needsUpdate = true;
    }
  }
}
