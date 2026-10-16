// Tout ce qui jaillit : poussière des pas, gerbes d'eau, flammes et braises du camp, étincelles des coups,
// et le corps de ceux que le vent prend. Un seul tampon tournant : le plus ancien cède sa place.
import * as THREE from 'three';

const MAX = 3600;
export const POUSSIERE = 0, BRAISE = 1, FUMEE = 2, ETINCELLE = 3, DISPERSION = 4, GOUTTE = 5, FLAMME = 6;

export class Eclats {
  constructor() {
    this.pos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(MAX * 4), 4); this.col.setUsage(THREE.DynamicDrawUsage);
    this.tai = new THREE.BufferAttribute(new Float32Array(MAX), 1); this.tai.setUsage(THREE.DynamicDrawUsage);
    this.v = new Float32Array(MAX * 3); this.vie = new Float32Array(MAX); this.tot = new Float32Array(MAX);
    this.gen = new Uint8Array(MAX); this.t0 = new Float32Array(MAX); this.a0 = new Float32Array(MAX); this.ph = new Float32Array(MAX);
    this.i = 0; this.haut = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.pos); g.setAttribute('aCol', this.col); g.setAttribute('aT', this.tai);
    this.u = { uPx: { value: 1 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec4 aCol; attribute float aT; uniform float uPx; varying vec4 vC;
        void main() {
          vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aT * uPx * (620.0 / -mv.z);
          gl_Position = aT > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec4 vC;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(1.0, 0.2, d)); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }
  emettre(gen, x, y, s, vx, vy, vs, vie, taille, r, g, b, a) {
    const i = this.i; this.i = (i + 1) % MAX; this.haut = Math.max(this.haut, i + 1);
    this.pos.array.set([x, y, -s], i * 3);
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = -vs;
    this.vie[i] = this.tot[i] = vie; this.gen[i] = gen; this.t0[i] = taille; this.a0[i] = a; this.ph[i] = Math.random() * 6.28;
    this.col.array.set([r, g, b, a], i * 4); this.tai.array[i] = taille;
  }
  maj(dt, wx, ws, temps) {
    const P = this.pos.array, C = this.col.array, T = this.tai.array, V = this.v, wz = -ws;
    for (let i = 0; i < this.haut; i++) {
      let vie = this.vie[i];
      if (vie <= 0) continue;
      vie -= dt; this.vie[i] = vie;
      if (vie <= 0) { T[i] = 0; continue; }
      const q = vie / this.tot[i], g = this.gen[i], k = i * 3;
      let vx = V[k], vy = V[k + 1], vz = V[k + 2];
      if (g === POUSSIERE) { vx += (wx * 14 - vx) * dt * 2; vz += (wz * 14 - vz) * dt * 2; vy *= 1 - dt * 2; T[i] = this.t0[i] * (1.6 - 0.6 * q); C[i * 4 + 3] = this.a0[i] * q * q; }
      else if (g === GOUTTE) { vy -= 22 * dt; if (P[k + 1] < 0.05 && vy < 0) { this.vie[i] = 0; T[i] = 0; continue; } }
      else if (g === ETINCELLE) { vy -= 34 * dt; C[i * 4 + 3] = this.a0[i] * q; }
      else if (g === BRAISE) {
        vx += (wx * 7 - vx) * dt * 1.2 + Math.sin(temps * 5 + this.ph[i]) * dt * 7; vz += (wz * 7 - vz) * dt * 1.2 + Math.cos(temps * 4 + this.ph[i]) * dt * 7;
        C[i * 4 + 3] = this.a0[i] * Math.min(1, q * 2) * (0.6 + 0.4 * Math.sin(temps * 14 + this.ph[i]));
      } else if (g === FLAMME) { vy *= 1 + dt * 0.7; T[i] = this.t0[i] * q; C[i * 4 + 1] = 0.35 + 0.5 * q; C[i * 4 + 2] = 0.1 + 0.2 * q * q; C[i * 4 + 3] = this.a0[i] * Math.min(1, q * 2.4); }
      else if (g === FUMEE) { vx += (wx * 9 - vx) * dt * 0.7; vz += (wz * 9 - vz) * dt * 0.7; T[i] = this.t0[i] * (2.6 - 1.6 * q); C[i * 4 + 3] = this.a0[i] * q * Math.min(1, (1 - q) * 6); }
      else if (g === DISPERSION) {
        // Le corps se défait : d'abord lent, puis pris par le vent, en tournoyant.
        const f = Math.min(1, (1 - q) * 3.5), n = this.ph[i];
        vx += (wx * 30 * f + Math.sin(P[k + 2] * 0.3 + temps * 2 + n) * 9 - vx) * dt * 1.6;
        vz += (wz * 30 * f + Math.cos(P[k] * 0.3 - temps * 2 + n) * 9 - vz) * dt * 1.6;
        vy += (Math.sin(n + temps) * 2 + 1.2 - vy) * dt * 1.4;
        C[i * 4 + 3] = this.a0[i] * Math.min(1, q * 1.8);
      }
      V[k] = vx; V[k + 1] = vy; V[k + 2] = vz;
      P[k] += vx * dt; P[k + 1] += vy * dt; P[k + 2] += vz * dt;
    }
    this.pos.needsUpdate = this.col.needsUpdate = this.tai.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.haut);
  }
  // Un hordier qui tombe.
  disperser(x, y, s, col) {
    for (let i = 0; i < 300; i++) {
      const t = i < 210, h = Math.random() * 1.8;
      this.emettre(DISPERSION, x + (Math.random() - 0.5) * 0.8, y + h, s + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3,
        3.2 + Math.random() * 3.4, 0.11 + Math.random() * 0.15, t ? col.r * 1.3 : 0.95, t ? col.g * 1.3 : 0.9, t ? col.b * 1.3 : 0.84, 0.92);
    }
  }
  gerbe(x, y, s) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, v = 8 + Math.random() * 16;
      this.emettre(ETINCELLE, x, y + 1.2, s, Math.cos(a) * v, 5 + Math.random() * 13, Math.sin(a) * v, 0.3 + Math.random() * 0.4, 0.13, 1.5, 1.2, 0.8, 1);
    }
  }
}
