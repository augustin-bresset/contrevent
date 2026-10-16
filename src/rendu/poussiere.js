// La poussière en l'air : les mêmes particules, relevées du sol. Elle donne la profondeur du survol.
import * as THREE from 'three';

export class Poussiere {
  constructor(lignes, tH, uMonde, n = 7000) {
    const c = lignes.cote, refs = new Float32Array(n * 2), vert = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { refs[i * 2] = ((i % c) + 0.5) / c; refs[i * 2 + 1] = (Math.floor(i / c) % c + 0.5) / c; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vert, 3));
    g.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    this.u = {
      tPos: { value: null }, tH: { value: tH }, uMonde: { value: uMonde }, uPx: { value: 1 },
      uCouleur: { value: new THREE.Vector3(1, 1, 1) }, uForce: { value: 0.5 }, uChaud: { value: 0 },
    };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        uniform sampler2D tPos, tH; uniform vec2 uMonde; uniform float uPx;
        attribute vec2 aRef; varying float vA;
        void main() {
          vec4 e = texture2D(tPos, aRef);
          float id = fract(sin(dot(aRef, vec2(41.3, 289.1))) * 43758.5453);
          float h = max(texture2D(tH, e.xy / uMonde).r, 0.0);
          vec4 mv = modelViewMatrix * vec4(e.x, h + 1.0 + id * id * 42.0, -e.y, 1.0);
          float v = length(e.xy - e.zw);
          vA = (0.25 + 0.75 * id) * clamp(v * 5.0, 0.0, 1.0);
          gl_PointSize = uPx * (1.0 + id * 2.4) * (260.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCouleur; uniform float uForce; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(uCouleur, smoothstep(1.0, 0.2, d) * vA * uForce);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }
}
