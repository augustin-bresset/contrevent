// Les autours de Tourse et de Darbon, qui tournent au-dessus de la Horde, et de loin en loin un vol sauvage.
import * as THREE from 'three';

const N = 18;
export class Oiseaux {
  constructor() {
    const p = new Float32Array([-1, 0, 0.1, 0, 0, -0.32, 0, 0, 0.32, 0, 0, -0.32, 1, 0, 0.1, 0, 0, 0.32]);
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.iP = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); this.iP.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', this.iP); g.instanceCount = N;
    this.u = { uTemps: { value: 0 }, uNuit: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec4 iP; uniform float uTemps;
        void main() {
          vec3 q = position * 0.72;
          q.y = abs(q.x) * sin(uTemps * 8.0 + iP.y * 3.0) * 0.5;
          float c = cos(iP.w), s = sin(iP.w);
          vec3 r = vec3(q.x * c - q.z * s, q.y, q.x * s + q.z * c);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(iP.xyz + r, 1.0);
        }`,
      fragmentShader: 'uniform float uNuit; void main() { gl_FragColor = vec4(vec3(0.2, 0.18, 0.2) * (1.0 - uNuit * 0.6), 1.0); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    this.vol = { x: 0, s: 0, cap: 0, vie: 0 };
  }
  maj(dt, t, hx, hs, sol, nbAutours) {
    const a = this.iP.array;
    a.fill(-1e6);
    for (let i = 0; i < nbAutours; i++) {
      const q = t * (0.28 + i * 0.07) + i * 2.4, r = 16 + i * 7, x = hx + Math.cos(q) * r, s = hs + 14 + Math.sin(q) * r;
      a.set([x, sol + 24 + i * 4, -s, -q], i * 4);
    }
    const v = this.vol;
    v.vie -= dt;
    if (v.vie <= 0) { v.vie = 34; const c = Math.random() < 0.5 ? -1 : 1; v.x = hx + c * 170; v.s = hs + 60 + Math.random() * 180; v.cap = c > 0 ? Math.PI : 0; }
    v.x += Math.cos(v.cap) * 13 * dt; v.s += Math.sin(v.cap) * 3 * dt;
    for (let i = 0; i < N - 4; i++) {
      const l = Math.ceil(i / 2), c = i % 2 ? 1 : -1;
      a.set([v.x - Math.cos(v.cap) * l * 2.2, sol + 24 + l * 0.2, -(v.s + c * l * 1.9), v.cap === 0 ? 0 : 3.14], (i + 4) * 4);
    }
    this.iP.needsUpdate = true;
    this.u.uTemps.value = t;
  }
}
