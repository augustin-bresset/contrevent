// Des nuages entre le ciel et nous : ils passent sous la caméra, à la verticale exacte de leur ombre sur le sol.
import * as THREE from 'three';
import { GLSL_COMMUN } from './communs.js';

export class Nuages {
  constructor(u) {
    this.u = { ...u, uHordeN: { value: new THREE.Vector2() }, uForce: { value: 1 } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`
        precision highp float; uniform vec2 uHordeN; uniform float uForce; uniform vec3 uVentMoyen; varying vec3 vW;
        ${GLSL_COMMUN}
        void main() {
          vec2 p = vec2(vW.x, -vW.z);
          vec2 pn = p * 0.0042 + uVentMoyen.xy * uTemps * 0.012;
          float m = fbm3(pn), n = smoothstep(0.5, 0.72, m), e = fbm3(pn * 5.1 + uTemps * 0.01);
          n = smoothstep(0.0, 1.0, n * (0.62 + 0.76 * e));
          float trou = smoothstep(40.0, 150.0, length(p - uHordeN));     // la Horde reste à découvert
          float t = tempeteA(uSv * uBande);
          vec3 c = mix(vec3(1.0), palette(1, uSv), 0.26);
          c = mix(c, vec3(0.1, 0.13, 0.22), uNuit); c = mix(c, vec3(0.13, 0.09, 0.07), t);
          gl_FragColor = vec4(mix(c, BLANC_FIN, uReve), n * n * trou * 0.46 * uForce);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
}
