// Ce qu'il faut voir de loin, tracé au sol par-dessus tout le reste : les assaillants, le Corroyeur qu'on frappe, les chrones qu'on évite.
import * as THREE from 'three';

export class Marques {
  constructor(max) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    this.iP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.iP.setUsage(THREE.DynamicDrawUsage);
    this.iK = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); this.iK.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', this.iP); g.setAttribute('iK', this.iK); g.instanceCount = max;
    this.u = { uTemps: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec4 iP; attribute vec2 iK; varying vec2 vQ; varying float vA, vK, vR;
        void main() {
          vQ = position.xz * 2.0; vA = iP.w; vK = iK.y; vR = iK.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(iP.xyz + position * vec3(iK.x, 1.0, iK.x) * step(0.001, iP.w), 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTemps; varying vec2 vQ; varying float vA, vK, vR;
        void main() {
          float r = length(vQ), an = atan(vQ.y, vQ.x), l = 1.6 / vR;
          vec3 c; float a;
          if (vK < 0.5) {           // l'assaillant : de la braise
            a = (smoothstep(0.1, 0.0, abs(r - 0.62)) + 0.32 * smoothstep(0.62, 0.0, r)) * (0.72 + 0.28 * sin(uTemps * 6.0));
            c = vec3(5.0, 1.15, 0.35);
          } else if (vK < 1.5) {    // le Corroyeur : une cible froide qui se resserre sur son cœur
            float anneau = smoothstep(l, 0.0, abs(r - 0.92)), ondes = smoothstep(0.1, 0.0, abs(fract(r * 1.5 + uTemps * 0.9) - 0.5)) * smoothstep(0.9, 0.2, r) * 0.45;
            float crans = smoothstep(0.06, 0.0, abs(sin(an * 2.0 + uTemps * 0.7))) * smoothstep(0.1, 0.0, abs(r - 0.8)), coeur = smoothstep(0.1, 0.02, r);
            a = anneau + ondes + crans + coeur; c = vec3(2.6, 3.1, 3.6);
          } else {                  // le chrone : un bord à ne pas franchir, et son œil
            float bord = smoothstep(l, 0.0, abs(r - 0.92)) * step(0.42, fract(an * 3.8197 + uTemps * 0.22));
            float oeil = smoothstep(l, 0.0, abs(r - 0.383));
            a = bord * 0.9 + oeil * 0.9 + 0.1 * smoothstep(0.92, 0.84, r); c = mix(vec3(4.2, 2.5, 0.8), vec3(5.0, 1.0, 0.4), step(r, 0.5));
          }
          gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * vA);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  // Chaque marque : x, y, s, et facultatifs r (rayon au sol) et k (0 assaillant, 1 Corroyeur, 2 chrone).
  poser(liste, temps) {
    const a = this.iP.array, b = this.iK.array; this.u.uTemps.value = temps;
    for (let i = 0; i < this.max; i++) {
      const e = liste[i];
      a[i * 4 + 3] = e ? 1 : 0;
      if (e) { a[i * 4] = e.x; a[i * 4 + 1] = e.y + 0.3; a[i * 4 + 2] = -e.s; b[i * 2] = e.r ? e.r / 0.46 : 9; b[i * 2 + 1] = e.k || 0; }
    }
    this.iP.needsUpdate = true; this.iK.needsUpdate = true;
  }
}
