// Le chemin prévu : des anneaux numérotés par l'ordre, reliés par un pointillé posé sur le sol.
import * as THREE from 'three';

const MAX_TIRETS = 900, MAX_ANNEAUX = 24;

export class Jalons {
  constructor(monde) {
    this.monde = monde; this.groupe = new THREE.Group();
    this.pos = new THREE.BufferAttribute(new Float32Array(MAX_TIRETS * 4 * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    const idx = new Uint32Array(MAX_TIRETS * 6);
    for (let i = 0, k = 0; i < MAX_TIRETS; i++) { const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], k); k += 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', this.pos); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color('#a5432f').convertLinearToSRGB() } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide, transparent: true,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 c; void main() { gl_FragColor = vec4(c, 0.8); }',
    });
    this.tirets = new THREE.Mesh(g, mat); this.tirets.frustumCulled = false; this.tirets.renderOrder = 2.5;
    this.groupe.add(this.tirets);
    this.anneaux = Array.from({ length: MAX_ANNEAUX }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.5, 32).rotateX(-Math.PI / 2), mat);
      m.renderOrder = 2.5; m.visible = false; m.frustumCulled = false; this.groupe.add(m); return m;
    });
  }
  maj(hx, hs, points, temps) {
    const { monde: M } = this, P = this.pos.array;
    let n = 0, ax = hx, as = hs;
    const dash = 2.2, vide = 2.4;
    for (const q of points) {
      const lon = Math.hypot(q.x - ax, q.s - as) || 1, ux = (q.x - ax) / lon, us = (q.s - as) / lon, e = 0.14;
      for (let d = 1.5; d < lon - 1.5 && n < MAX_TIRETS; d += dash + vide) {
        const f = Math.min(d + dash, lon - 1.2);
        const x0 = ax + ux * d, s0 = as + us * d, x1 = ax + ux * f, s1 = as + us * f;
        const y0 = Math.max(0, M.h(x0, s0)) + 0.14, y1 = Math.max(0, M.h(x1, s1)) + 0.14, b = n * 12;
        P.set([x0 - us * e, y0, -(s0 + ux * e), x0 + us * e, y0, -(s0 - ux * e), x1 - us * e, y1, -(s1 + ux * e), x1 + us * e, y1, -(s1 - ux * e)], b);
        n++;
      }
      ax = q.x; as = q.s;
    }
    this.pos.needsUpdate = true;
    this.tirets.geometry.setDrawRange(0, n * 6);
    this.anneaux.forEach((a, i) => {
      const q = points[i];
      a.visible = !!q;
      if (q) { a.position.set(q.x, Math.max(0, M.h(q.x, q.s)) + 0.16, -q.s); a.scale.setScalar(i === 0 ? 1 + 0.06 * Math.sin(temps * 4) : 1); }
    });
  }
}
