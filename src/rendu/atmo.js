// Le ciel : une vraie atmosphère, calculée dans une petite table (Hillaire, 2020), puis lue partout.
// Tout ce qui reçoit du ciel lit cette table : le sol, les pierres, les corps, la brume. C'est ce qui rend l'image cohérente.
// La lumière du soleil au sol vient du même calcul : basse, elle traverse plus d'air et rougit toute seule.
import * as THREE from 'three';
import { SOLEIL } from '../monde/contrees.js';

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec3 uSol, uTeinte, uNuitC;
uniform float uTrouble, uGain, uVoile, uNuit;
const float Rg = 6360.0, Rt = 6460.0;
const vec3 BR = vec3(5.802, 13.558, 33.1) * 1e-3, OZ = vec3(0.65, 1.881, 0.085) * 1e-3;
vec2 sphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d), c = dot(o, o) - r * r, q = b * b - c;
  if (q < 0.0) return vec2(-1.0);
  q = sqrt(q); return vec2(-b - q, -b + q);
}
void milieu(float h, out vec3 sR, out vec3 sM, out vec3 ext) {
  float dR = exp(-h / 8.0), dM = exp(-h / 1.4), dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  float bM = 3.996e-3 * uTrouble;
  sR = BR * dR; sM = bM * uTeinte * dM; ext = BR * dR + bM * 1.1 * dM + OZ * dO;
}
vec3 versSoleil(vec3 p) {
  vec2 sol = sphere(p, uSol, Rg);
  if (sol.x > 0.0) return vec3(0.0);
  float t = sphere(p, uSol, Rt).y, dt = t / 6.0;
  vec3 od = vec3(0.0), sR, sM, ext;
  for (int i = 0; i < 6; i++) {
    vec3 q = p + uSol * (float(i) + 0.5) * dt;
    milieu(length(q) - Rg, sR, sM, ext); od += ext;
  }
  return exp(-od * dt);
}
void main() {
  float l = vUv.y * 2.0 - 1.0; l = sign(l) * l * l * 1.5708;
  float az = (vUv.x - 0.5) * 6.28318;
  vec3 d = vec3(cos(l) * cos(az), sin(l), cos(l) * sin(az));
  vec3 o = vec3(0.0, Rg + 0.2, 0.0);
  vec2 sol = sphere(o, d, Rg);
  float tMax = sol.x > 0.0 ? sol.x : sphere(o, d, Rt).y;
  float mu = dot(d, uSol), pR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  const float g = 0.78; float pM = (1.0 - g * g) / (4.0 * 3.14159 * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  // Ce que la diffusion multiple renvoie, en une approximation : un ciel qui ne s'éteint pas au ras de l'horizon.
  float jour = smoothstep(-0.1, 0.25, uSol.y);
  vec3 L = vec3(0.0), T = vec3(1.0), sR, sM, ext;
  const int N = 22;
  float t0 = 0.0;
  for (int i = 0; i < N; i++) {
    float a = (float(i) + 1.0) / float(N), t1 = a * a * tMax, dt = t1 - t0, t = 0.5 * (t0 + t1);
    vec3 p = o + d * t; float h = length(p) - Rg;
    milieu(h, sR, sM, ext);
    vec3 S = (sR * pR + sM * pM) * versSoleil(p) + (sR + sM) * (0.085 + 0.1 * jour) * vec3(0.8, 0.9, 1.0);
    L += T * S * dt; T *= exp(-ext * dt); t0 = t1;
  }
  if (sol.x > 0.0) L += T * vec3(0.3, 0.27, 0.23) * max(uSol.y, 0.0) * 0.32;
  L *= uGain;
  L = mix(L, vec3(dot(L, vec3(0.3, 0.5, 0.2))) * uTeinte, uVoile);   // sous un ciel couvert, plus de bleu
  L = mix(L, L * 0.03 + uNuitC, uNuit);
  gl_FragColor = vec4(L, 1.0);
}`;

// La transmission vers le soleil, pour la lumière au sol : le même calcul que dans la table, ici en JS.
function transmission(sol, trouble, o) {
  const Rg = 6360, Rt = 6460, y0 = Rg + 0.2, t = -y0 * sol.y + Math.sqrt(y0 * y0 * sol.y * sol.y - y0 * y0 + Rt * Rt), dt = t / 24;
  const BR = [5.802e-3, 13.558e-3, 33.1e-3], OZ = [0.65e-3, 1.881e-3, 0.085e-3], bM = 3.996e-3 * trouble * 1.1;
  const od = [0, 0, 0];
  for (let i = 0; i < 24; i++) {
    const q = (i + 0.5) * dt, x = sol.x * q, y = y0 + sol.y * q, z = sol.z * q, h = Math.hypot(x, y, z) - Rg;
    const dR = Math.exp(-h / 8), dM = Math.exp(-h / 1.4), dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
    for (let k = 0; k < 3; k++) od[k] += BR[k] * dR + bM * dM + OZ[k] * dO;
  }
  o.setRGB(Math.exp(-od[0] * dt), Math.exp(-od[1] * dt), Math.exp(-od[2] * dt));
  return o;
}

export class Atmo {
  constructor(renderer) {
    this.r = renderer;
    this.rt = new THREE.WebGLRenderTarget(256, 128, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, wrapS: THREE.RepeatWrapping,
    });
    this.sol = new THREE.Vector3(...SOLEIL).normalize();
    this.m = {
      uSol: { value: this.sol }, uTeinte: { value: new THREE.Color(1, 1, 1) }, uNuitC: { value: new THREE.Color(0.012, 0.02, 0.05) },
      uTrouble: { value: 1 }, uGain: { value: 8 }, uVoile: { value: 0 }, uNuit: { value: 0 },
    };
    this.sc = new THREE.Scene(); this.cam = new THREE.Camera();
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.m, depthTest: false, depthWrite: false, fragmentShader: FRAG,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    }));
    q.frustumCulled = false; this.sc.add(q);
    // Ce que tous les matériaux partagent.
    this.u = {
      tCiel: { value: this.rt.texture }, uSoleil: { value: this.sol }, uSoleilCol: { value: new THREE.Color() }, uBrume: { value: 0.0006 }, uBrumeH: { value: 90 },
    };
    this.cle = ''; this.tr = new THREE.Color();
  }
  // a : { trouble, teinte, voile, soleil, brume } ; nuit, orage : 0 à 1.
  maj({ trouble, teinte, voile, soleil, brume }, nuit, orage) {
    const m = this.m, cou = Math.max(voile, orage * 0.9);
    const cle = [trouble.toFixed(2), teinte.r.toFixed(2), teinte.g.toFixed(2), teinte.b.toFixed(2), cou.toFixed(2), nuit.toFixed(2)].join();
    transmission(this.sol, trouble, this.tr);
    const k = soleil * 9.5 * (1 - 0.92 * Math.max(cou, 0)) * (1 - 0.985 * nuit);
    this.u.uSoleilCol.value.setRGB(this.tr.r * k, this.tr.g * k, this.tr.b * k);
    if (nuit > 0.01) this.u.uSoleilCol.value.lerp(new THREE.Color(0.09, 0.13, 0.26), nuit);
    this.u.uBrume.value = brume;
    if (cle === this.cle) return;
    this.cle = cle;
    m.uTrouble.value = trouble; m.uTeinte.value.copy(teinte); m.uVoile.value = cou; m.uNuit.value = nuit;
    m.uGain.value = 8 * (1 - 0.8 * orage);
    const r = this.r, cible = r.getRenderTarget();
    r.setRenderTarget(this.rt); r.render(this.sc, this.cam); r.setRenderTarget(cible);
  }
}
