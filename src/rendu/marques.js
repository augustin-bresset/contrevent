// Les assaillants se voient de loin : un cercle de braise au sol sous chacun, qui bat, et par-dessus tout le reste.
import * as THREE from 'three';

export class Marques {
  constructor(max) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    this.iP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.iP.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', this.iP); g.instanceCount = max;
    this.u = { uTemps: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec4 iP; varying vec2 vQ; varying float vA;
        void main() {
          vQ = position.xz * 2.0; vA = iP.w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(iP.xyz + position * vec3(9.0, 1.0, 9.0) * step(0.001, iP.w), 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTemps; varying vec2 vQ; varying float vA;
        void main() {
          float r = length(vQ), bat = 0.72 + 0.28 * sin(uTemps * 6.0);
          float a = smoothstep(0.1, 0.0, abs(r - 0.62)) + 0.32 * smoothstep(0.62, 0.0, r);
          gl_FragColor = vec4(vec3(5.0, 1.15, 0.35), clamp(a, 0.0, 1.0) * bat * vA);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  poser(liste, temps) {
    const a = this.iP.array; this.u.uTemps.value = temps;
    for (let i = 0; i < this.max; i++) {
      const e = liste[i];
      a[i * 4 + 3] = e ? 1 : 0;
      if (e) { a[i * 4] = e.x; a[i * 4 + 1] = e.y + 0.3; a[i * 4 + 2] = -e.s; }
    }
    this.iP.needsUpdate = true;
  }
}
