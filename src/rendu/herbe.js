// Les prairies : des dizaines de milliers de brins, tous calculés dans le vertex shader à partir de la case du monde
// qu'ils occupent. Le vent réel les couche, ses rafales passent en vagues de lumière, et la Horde s'y ouvre un chemin.
import * as THREE from 'three';
import { GLSL_COMMUN } from './communs.js';

const COTE = 360, PAS = 0.78;

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
        uniform sampler2D tH, tPal, tBruit, tVent; uniform vec2 uAnneau, uCentre, uHordeH; uniform float uTemps, uRayon, uPas, uRespirH, uPres, uBande, uPeint;
        attribute vec2 iG; varying vec3 vC, vP, vNs; varying float vT, vL, vProf;
        void main() {
          vec2 cel = iG + floor(uCentre / uPas);
          vec4 r = texture2D(tBruit, (mod(cel, 256.0) + 0.5) / 256.0);
          vec2 pos = (cel + 0.5 + (r.xy - 0.5)) * uPas, uv = pos / uAnneau; float sv = pos.y / uBande;
          vec2 d = pos - uCentre; float dc = length(d) / uRayon;
          float hs = texture2D(tH, uv).r;
          vec4 reg = texture2D(tPal, vec2(5.5 / 7.0, sv));
          float patch_ = texture2D(tBruit, pos * 0.0042).g;
          float dens = reg.a * (0.46 + 1.4 * smoothstep(0.36, 0.6, patch_));
          if (r.b > dens || hs < 0.08 || dc > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float H = (0.6 + 1.1 * r.a) * (0.7 + 0.9 * patch_) * (1.0 - smoothstep(0.8, 1.0, dc)) * mix(1.0, 0.5, uPres);
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

          float y = position.y, a = r.r * 6.283, l = mix(0.2, 0.09, uPres) * (0.7 + r.g);
          vec2 cote = vec2(cos(a), sin(a)) * position.x * l * (1.0 + 0.4 * length(cour));
          vec2 sol = pos + cote + cour * H * y * y;
          vec3 w3 = vec3(sol.x, hs + y * H * (1.0 - 0.34 * min(1.0, length(cour)) * y), -sol.y);
          vec3 ton = texture2D(tPal, vec2(6.5 / 7.0, sv)).rgb, lum = texture2D(tPal, vec2(1.5 / 7.0, sv)).rgb;
          // Peinte, l'herbe reste dans le ton du sol : une nappe qui ondule, pas des brins qui scintillent.
          float var = 0.82 + 0.3 * r.g * (1.0 - 0.6 * uPeint);
          vC = mix(ton * mix(0.5, 0.7, uPeint), mix(ton, lum, (0.14 + 0.5 * vague) * (1.0 - 0.65 * uPeint)), y) * var;
          vP = vec3(w3.x, w3.y, -w3.z); vT = y; vL = 0.45 + 0.5 * y;
          // La pente du sol sous le brin : l'herbe d'un versant à l'ombre est à l'ombre.
          float hx = texture2D(tH, (pos + vec2(2.0, 0.0)) / uAnneau).r - texture2D(tH, (pos - vec2(2.0, 0.0)) / uAnneau).r;
          float hz = texture2D(tH, (pos + vec2(0.0, 2.0)) / uAnneau).r - texture2D(tH, (pos - vec2(0.0, 2.0)) / uAnneau).r;
          vNs = normalize(vec3(-hx, 4.0, hz));
          vec4 mv = viewMatrix * vec4(w3, 1.0); vProf = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vC, vP, vNs; varying float vT, vL, vProf;
        ${GLSL_COMMUN}
        void main() {
          vec3 Q = vec3(vP.x, vP.y, -vP.z), n = normalize(mix(vec3(uSoleil.x * 0.3, 1.0, uSoleil.z * 0.3), normalize(vNs) * 1.3, uPeint * 0.8));
          vec3 c = eclairer(vC * vC, n, Q, 0.6, soleilRelief(Q, 0.0), mix(0.4, 1.0, vL));
          // La lumière qui traverse le brin, vue à contre-jour.
          vec3 v = normalize(cameraPosition - Q);
          c += vC * vC * uSoleilCol * pow(max(dot(-v, uSoleil), 0.0), 3.0) * 0.5 * vL;
          gl_FragColor = vec4(c, 1.0);
        }`,
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
