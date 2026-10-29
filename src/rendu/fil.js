// Le fil rouge : le tracé réel de la Horde. Il ne s'efface pas.
import * as THREE from 'three';

const MAX = 9000;

export class Fil {
  constructor(monde) {
    this.monde = monde; this.n = 0; this.points = []; this.dx = 0; this.ds = 0;
    this.pos = new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    const idx = new Uint32Array((MAX - 1) * 6);
    for (let i = 0, k = 0; i < MAX - 1; i++) {
      const a = i * 2;
      idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2; idx[k++] = a + 1; idx[k++] = a + 3; idx[k++] = a + 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.pos); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    this.u = { uCouleur: { value: new THREE.Color('#a5432f').convertLinearToSRGB() } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, depthWrite: false, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCouleur; void main() { gl_FragColor = vec4(uCouleur, 1.0); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
  }
  ajouter(x, s) {
    if (this.n && Math.hypot(x - this.dx, s - this.ds) < 1.8) return;
    if (this.n >= MAX) return;
    const px = this.dx, ps = this.ds, l = Math.hypot(x - px, s - ps) || 1;
    const nx = this.n ? -(s - ps) / l : 1, ns = this.n ? (x - px) / l : 0, e = 0.13;
    const y = Math.max(0, this.monde.h(x, s)) + 0.5, i = this.n * 2 * 3, a = this.pos.array;
    a[i] = x + nx * e; a[i + 1] = y; a[i + 2] = -(s + ns * e);
    a[i + 3] = x - nx * e; a[i + 4] = y; a[i + 5] = -(s - ns * e);
    this.pos.needsUpdate = true;
    // Sans jamais vider la liste : à ×16, plusieurs points s'ajoutent par image, et chacun doit partir vers le GPU.
    this.pos.addUpdateRange(i, 6);
    this.n++; this.dx = x; this.ds = s; this.points.push(x, s);
    this.mesh.geometry.setDrawRange(0, Math.max(0, (this.n - 1) * 6));
  }
}
