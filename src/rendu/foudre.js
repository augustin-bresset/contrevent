// La foudre sèche du furvent : un tracé brisé, très lumineux, qui ne dure qu'un instant.
import * as THREE from 'three';

const PTS = 70;
export class Foudre {
  constructor() {
    this.pos = new THREE.BufferAttribute(new Float32Array(PTS * 2 * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let i = 0; i < PTS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', this.pos); g.setIndex(idx);
    this.u = { uV: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uV; void main() { gl_FragColor = vec4(vec3(3.2, 3.1, 3.8), uV); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 12; this.v = 0;
  }
  frapper(x, sol, s, camera) {
    const P = this.pos.array, cx = camera.position.x - x, cz = camera.position.z + s, l = Math.hypot(cx, cz) || 1, nx = cz / l, nz = -cx / l;
    let px = x + (Math.random() - 0.5) * 60, ps = s + (Math.random() - 0.5) * 60, y = sol + 300;
    const pas = (y - sol) / (PTS - 1);
    for (let i = 0; i < PTS; i++) {
      const e = 0.2 + 1.5 * (1 - i / PTS), b = i * 6;
      P[b] = px + nx * e; P[b + 1] = y; P[b + 2] = -(ps - nz * e); P[b + 3] = px - nx * e; P[b + 4] = y; P[b + 5] = -(ps + nz * e);
      y -= pas; px += (Math.random() - 0.5) * 19 + (x - px) * 0.05; ps += (Math.random() - 0.5) * 19 + (s - ps) * 0.05;
    }
    this.pos.needsUpdate = true; this.v = 1; this.mesh.visible = true;
  }
  maj(dt) {
    if (this.v <= 0) { this.mesh.visible = false; return; }
    this.v -= dt * 5; this.u.uV.value = Math.max(0, this.v) * (0.6 + 0.4 * Math.random());
  }
}
