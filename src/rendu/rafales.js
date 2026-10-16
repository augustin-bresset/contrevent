// Les rafales : des rubans blancs qui filent dans le vent et font une boucle avant de s'éteindre,
// la manière dont Zelda a toujours dessiné le vent.
import * as THREE from 'three';

const N = 12, PTS = 44, PAS = 2.1;

export class Rafales {
  constructor(monde, vent) {
    this.monde = monde; this.vent = vent; this.t0 = 0;
    this.r = Array.from({ length: N }, () => ({ vie: 0, pts: new Float32Array(PTS * 3), n: 0, x: 0, y: 0, s: 0, dx: 0, ds: -1, acc: 0, boucle: 0, sens: 1, avantBoucle: 0, age: 0 }));
    this.pos = new THREE.BufferAttribute(new Float32Array(N * PTS * 2 * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    this.al = new THREE.BufferAttribute(new Float32Array(N * PTS * 2), 1); this.al.setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let k = 0; k < N; k++) for (let i = 0; i < PTS - 1; i++) {
      const a = (k * PTS + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', this.pos); g.setAttribute('aA', this.al); g.setIndex(idx);
    this.u = { uCouleur: { value: new THREE.Color(1, 1, 1) } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCouleur; varying float vA; void main() { gl_FragColor = vec4(uCouleur, vA); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
    this.w = { x: 0, s: 0, abri: 0 };
  }
  lancer(cx, cs, sol) {
    const r = this.r.find((q) => q.vie <= 0);
    if (!r) return;
    r.x = cx + (Math.random() - 0.5) * 240; r.s = cs + 30 + Math.random() * 150; r.y = sol + 8 + Math.random() * 16;
    r.n = 0; r.vie = 1; r.age = 0; r.acc = PAS; r.boucle = 0; r.sens = Math.random() < 0.5 ? -1 : 1; r.avantBoucle = 0.35 + Math.random() * 0.8;
    this.vent.ici(r.x, r.s, this.w); const f = Math.hypot(this.w.x, this.w.s) || 1; r.dx = this.w.x / f; r.ds = this.w.s / f;
  }
  maj(dt, cx, cs, sol, force, frequence) {
    this.t0 -= dt;
    if (this.t0 <= 0) { this.lancer(cx, cs, sol); this.t0 = (0.5 + Math.random() * 0.9) / frequence; }
    const P = this.pos.array, A = this.al.array, w = this.w;
    for (let k = 0; k < N; k++) {
      const r = this.r[k], bv = k * PTS * 6, ba = k * PTS * 2;
      if (r.vie <= 0) { A.fill(0, ba, ba + PTS * 2); continue; }
      r.age += dt;
      this.vent.ici(r.x, r.s, w);
      const f = Math.hypot(w.x, w.s) || 1, v = 46 + f * 36;
      if (r.boucle > 0) {
        // La boucle : le cap tourne d'un tour complet, puis reprend le vent.
        const a = r.sens * 6.283 / 0.62 * (0.7 + 0.8 * (1 - r.boucle / 0.62)) * dt, c = Math.cos(a), sn = Math.sin(a), dx = r.dx * c - r.ds * sn;
        r.ds = r.dx * sn + r.ds * c; r.dx = dx; r.boucle -= dt;
      } else {
        r.dx += (w.x / f - r.dx) * (1 - Math.exp(-dt * 5)); r.ds += (w.s / f - r.ds) * (1 - Math.exp(-dt * 5));
        if (r.age > r.avantBoucle) { r.boucle = 0.62; r.avantBoucle = 1e9; }
      }
      const d = v * dt;
      r.x += r.dx * d; r.s += r.ds * d; r.acc += d;
      if (r.acc >= PAS) {
        r.acc = 0; r.pts.copyWithin(3, 0, (PTS - 1) * 3);
        r.pts[0] = r.x; r.pts[1] = r.y; r.pts[2] = r.s;
        r.n = Math.min(PTS, r.n + 1);
      }
      if (r.age > 2.4) r.vie -= dt * 1.4;
      const o = Math.min(1, r.age * 3) * Math.max(0, r.vie);
      for (let i = 0; i < PTS; i++) {
        const j = i < r.n - 1 ? i : Math.max(0, r.n - 2), q = j * 3;
        const x = r.pts[i < r.n ? i * 3 : q], y = r.pts[(i < r.n ? i * 3 : q) + 1], s = r.pts[(i < r.n ? i * 3 : q) + 2];
        const ex = r.pts[q + 3] - r.pts[q] || 0, es = r.pts[q + 5] - r.pts[q + 2] || 0, l = Math.hypot(ex, es) || 1;
        const t = i / Math.max(1, r.n - 1), e = 0.34 * Math.sin(Math.min(1, t) * Math.PI) + 0.02;
        const nx = -es / l * e, ns = ex / l * e, b = bv + i * 6;
        P[b] = x + nx; P[b + 1] = y; P[b + 2] = -(s + ns); P[b + 3] = x - nx; P[b + 4] = y; P[b + 5] = -(s - ns);
        const al = i < r.n ? (1 - t) * o * 0.8 : 0;
        A[ba + i * 2] = A[ba + i * 2 + 1] = al;
      }
    }
    this.pos.needsUpdate = this.al.needsUpdate = true;
  }
}
