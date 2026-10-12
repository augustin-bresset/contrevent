// Le ciel : on ne le voit qu'une fois descendu à hauteur de Horde.
import * as THREE from 'three';
import { GLSL_COMMUN } from './communs.js';

export class Ciel {
  constructor(u) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 20), new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = position; vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = c.xyww; gl_Position.z *= 0.99999; }',
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vD;
        ${GLSL_COMMUN}
        void main() { gl_FragColor = vec4(couleurCiel(normalize(vD)), 1.0); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.visible = false;
  }
}
