// Les prairies : des dizaines de milliers de brins, tous calculés dans le vertex shader à partir de la case du monde
// qu'ils occupent. Le vent réel les couche, ses rafales passent en vagues de lumière, et la Horde s'y ouvre un chemin.
import * as THREE from 'three';
import { GLSL_COMMUN } from './communs.js';

const COTE = 290, PAS = 1.15;

export class Herbe {
  constructor(u) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.34, 0.5, 0, 0.34, 0.5, 0, 0, 1, 0]), 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    // Rangés du centre vers le bord : réduire le nombre, c'est réduire le rayon.
    const cases = [];
    for (let j = 0; j < COTE; j++) for (let i = 0; i < COTE; i++) cases.push([i - COTE / 2, j - COTE / 2]);
    cases.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
    const a = new Float32Array(cases.length * 2);
    cases.forEach((c, i) => { a[i * 2] = c[0]; a[i * 2 + 1] = c[1]; });
    g.setAttribute('iG', new THREE.InstancedBufferAttribute(a, 2));
    g.instanceCount = cases.length;
    this.total = cases.length;
    this.u = {
      ...u, uCentre: { value: new THREE.Vector2() }, uHordeH: { value: new THREE.Vector2() }, uRayon: { value: COTE * PAS * 0.5 }, uPas: { value: PAS },
      uRespirH: { value: 1 }, uPres: { value: 0 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        uniform sampler2D tH, tPal, tBruit, tVent; uniform vec2 uMonde, uCentre, uHordeH; uniform float uTemps, uRayon, uPas, uRespirH, uPres;
        attribute vec2 iG; varying vec3 vC, vP; varying float vT, vL, vProf;
        void main() {
          vec2 cel = iG + floor(uCentre / uPas);
          vec4 r = texture2D(tBruit, (mod(cel, 256.0) + 0.5) / 256.0);
          vec2 pos = (cel + 0.5 + (r.xy - 0.5)) * uPas, uv = pos / uMonde;
          vec2 d = pos - uCentre; float dc = length(d) / uRayon;
          float hs = texture2D(tH, uv).r;
          vec4 reg = texture2D(tPal, vec2(5.5 / 7.0, uv.y));
          float patch_ = texture2D(tBruit, pos * 0.0042).g;
          float dens = reg.a * (0.46 + 1.4 * smoothstep(0.36, 0.6, patch_));
          if (r.b > dens || hs < 0.08 || dc > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float H = (0.8 + 1.5 * r.a) * (0.7 + 0.9 * patch_) * (1.0 - smoothstep(0.8, 1.0, dc)) * mix(1.0, 0.3, uPres);
          vec2 w = texture2D(tVent, uv).xy * uRespirH; float f = length(w);
          vec2 dir = f > 1e-3 ? w / f : vec2(0.0, -1.0);
          // La rafale : une onde qui descend le vent, avec deux longueurs pour qu'elle ne se répète pas.
          float ph = dot(pos, dir) * 0.11 - uTemps * (1.5 + f * 2.2);
          float vague = 0.5 + 0.5 * sin(ph + sin(dot(pos, vec2(dir.y, -dir.x)) * 0.05) * 1.6);
          vague = vague * vague * (0.6 + 0.4 * sin(ph * 2.3 + r.r * 3.0));
          float pli = (0.16 + f * 0.52) * (0.32 + 0.9 * vague);
          vec2 cour = dir * pli;
          vec2 dh = pos - uHordeH; float qh = exp(-dot(dh, dh) / 22.0);
          cour += normalize(dh + 1e-4) * qh * 1.25;

          float y = position.y, a = r.r * 6.283, l = mix(0.5, 0.1, uPres) * (0.7 + r.g);
          vec2 cote = vec2(cos(a), sin(a)) * position.x * l * (1.0 + 0.4 * length(cour));
          vec2 sol = pos + cote + cour * H * y * y;
          vec3 w3 = vec3(sol.x, hs + y * H * (1.0 - 0.34 * min(1.0, length(cour)) * y), -sol.y);
          vec3 ton = texture2D(tPal, vec2(6.5 / 7.0, uv.y)).rgb, lum = texture2D(tPal, vec2(1.5 / 7.0, uv.y)).rgb;
          float var = 0.82 + 0.3 * r.g;
          vC = mix(ton * 0.92, mix(ton, lum, 0.22 + 0.68 * vague), y) * var;
          vP = vec3(w3.x, w3.y, -w3.z); vT = y; vL = 0.45 + 0.5 * y;
          vec4 mv = viewMatrix * vec4(w3, 1.0); vProf = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vC, vP; varying float vT, vL, vProf;
        ${GLSL_COMMUN}
        void main() { gl_FragColor = vec4(atmosphere(vC, vL, vP, vProf), 1.0); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
  }
  niveau(k) { this.mesh.geometry.instanceCount = Math.floor(this.total * k); this.u.uRayon.value = COTE * PAS * 0.5 * Math.sqrt(k); this.k = k; }
  maj(x, s, hx, hs, respir, actif, pres) {
    this.u.uPres.value = pres;
    this.mesh.visible = actif && this.k > 0;
    this.u.uCentre.value.set(x, s); this.u.uHordeH.value.set(hx, hs); this.u.uRespirH.value = respir;
  }
}
