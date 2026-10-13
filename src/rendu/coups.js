// Les coups d'Erg : un trait qui traverse l'image et s'éteint.
import * as THREE from 'three';

const N = 8;
export class Coups {
  constructor() {
    this.liste = [];
    this.pos = new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    this.a = new THREE.BufferAttribute(new Float32Array(N * 4), 1); this.a.setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let i = 0; i < N; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', this.pos); g.setAttribute('aA', this.a); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(1.6, 1.4, 1.1, vA); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  ajouter(x0, y0, s0, x1, y1, s1) { this.liste.push({ x0, y0, s0, x1, y1, s1, v: 1 }); if (this.liste.length > N) this.liste.shift(); }
  maj(dt) {
    this.liste = this.liste.filter((c) => (c.v -= dt * 4.5) > 0);
    const p = this.pos.array, a = this.a.array;
    a.fill(0);
    this.liste.forEach((c, i) => {
      const dx = c.x1 - c.x0, ds = c.s1 - c.s0, l = Math.hypot(dx, ds) || 1, nx = -ds / l * 0.5 * c.v, ns = dx / l * 0.5 * c.v, b = i * 12;
      p.set([c.x0 + nx, c.y0 + 1, -(c.s0 + ns), c.x0 - nx, c.y0 + 1, -(c.s0 - ns), c.x1 + nx, c.y1 + 1, -(c.s1 + ns), c.x1 - nx, c.y1 + 1, -(c.s1 - ns)], b);
      a.fill(c.v, i * 4, i * 4 + 4);
    });
    this.pos.needsUpdate = this.a.needsUpdate = true;
  }
}
