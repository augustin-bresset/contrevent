// Les chrones vus de l'air : une colonne de poussière qui tourne. Chaque grain est une hélice calculée en entier
// dans le vertex shader : aucune simulation, et des milliers de points.
import * as THREE from 'three';

const NB = 4, PAR = 5200;

export class Tornades {
  constructor(tH, tPal, uAnneau, uBande) {
    const n = NB * PAR, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = Math.random(); a[i * 3 + 1] = Math.random(); a[i * 3 + 2] = Math.floor(i / PAR); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    this.u = {
      tH: { value: tH }, tPal: { value: tPal }, uAnneau: { value: uAnneau }, uBande: { value: uBande }, uTemps: { value: 0 }, uPx: { value: 1 },
      uT: { value: Array.from({ length: NB }, () => new THREE.Vector4()) },
    };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        uniform sampler2D tH, tPal; uniform vec2 uAnneau; uniform float uTemps, uPx, uBande; uniform vec4 uT[${NB}];
        varying float vA; varying vec3 vC;
        void main() {
          vec4 t = uT[int(position.z)];
          if (t.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float id = position.x, id2 = position.y;
          float h = fract(id2 + uTemps * (0.09 + 0.16 * id));                 // on monte, on repart du sol
          float haut = t.z * (1.2 + 0.7 * id) * pow(h, 1.2);
          float rayon = t.z * (0.1 + 0.95 * pow(h, 1.5)) * (0.72 + 0.34 * id2) * (1.0 + 0.1 * sin(h * 18.0 + uTemps * 2.0));
          float ang = id * 62.83 + uTemps * (2.4 + 3.4 / (0.25 + h * 1.6)) * sign(t.w);
          vec2 p = t.xy + vec2(cos(ang), sin(ang)) * rayon + vec2(sin(h * 7.0 + uTemps), cos(h * 6.0 - uTemps * 0.8)) * h * t.z * 0.14;
          float sol = max(texture2D(tH, p / uAnneau).r, 0.0);
          vec4 mv = modelViewMatrix * vec4(p.x, sol + haut, -p.y, 1.0);
          float sv = p.y / uBande;
          vec3 om = texture2D(tPal, vec2(0.5 / 7.0, sv)).rgb, lu = texture2D(tPal, vec2(1.5 / 7.0, sv)).rgb, en = texture2D(tPal, vec2(2.5 / 7.0, sv)).rgb;
          vC = mix(en, mix(om, lu, id2), smoothstep(0.0, 0.6, h));
          vA = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.62, 1.0, h)) * (0.3 + 0.6 * id);
          gl_PointSize = uPx * (1.4 + id * 3.2) * (230.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA; varying vec3 vC;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC, smoothstep(1.0, 0.25, d) * vA); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
  }
  maj(t, liste) {
    const u = this.u; u.uTemps.value = t;
    for (let i = 0; i < NB; i++) {
      const c = liste[i];
      if (c) u.uT.value[i].set(c.x, c.s, c.r, c.f); else u.uT.value[i].z = 0;
    }
    this.mesh.visible = liste.length > 0;
  }
}
