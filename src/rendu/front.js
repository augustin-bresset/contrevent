// Le mur du furvent : trois rideaux de poussière qui s'avancent, s'enroulent par le haut et mangent le paysage.
import * as THREE from 'three';
import { GLSL_COMMUN } from './communs.js';

export class Front {
  constructor(u, W) {
    this.groupe = new THREE.Group(); this.groupe.visible = false;
    this.u = { ...u, uA: { value: 0 }, uW: { value: W } };
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.PlaneGeometry(1, 1, 120, 10).translate(0.5, 0.5, 0);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { ...this.u, uK: { value: k } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: /* glsl */`
          uniform sampler2D tH, tBruit; uniform vec2 uAnneau; uniform float uA, uW, uK, uTemps;
          varying vec2 vQ; varying vec3 vP; varying float vProf, vH;
          void main() {
            float x = -160.0 + position.x * (uW + 320.0), y = position.y;
            // Le front ondule à grande échelle : un texel de bruit vaut ici deux cents unités.
            vec2 qn = vec2(x / 210.0 + uK * 19.0, uTemps * 0.05) / 256.0;
            float fes = texture2D(tBruit, qn).r + 0.5 * texture2D(tBruit, qn * 2.3).g - 0.75;
            float H = 74.0 + 64.0 * fes + 20.0 * uK;
            float s = uA + fes * 120.0 + uK * 36.0 - y * y * 46.0;
            float sol = max(texture2D(tH, vec2(x, s) / uAnneau).r, 0.0);
            vec3 w = vec3(x, sol + y * H, -s);
            vQ = vec2(x, y); vP = vec3(w.x, w.y, s); vH = H;
            vec4 mv = modelViewMatrix * vec4(w, 1.0); vProf = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          precision highp float; uniform float uK; varying vec2 vQ; varying vec3 vP; varying float vProf, vH;
          ${GLSL_COMMUN}
          void main() {
            // Des volutes : un bruit rond, tordu par lui-même, qui monte et s'enroule.
            vec2 q = vec2(vQ.x, vQ.y * vH) * 0.021 + vec2(uK * 3.7, -uTemps * 0.19);
            vec2 tw = vec2(fbm3(q * 0.6 + 2.0), fbm3(q * 0.6 + 7.0)) - 0.5;
            float n = fbm3(q + tw * 2.4) + 0.42 * (fbm3(q * 2.9 + tw * 3.0 + vec2(0.0, -uTemps * 0.12)) - 0.5);
            float a = smoothstep(0.36, 0.56, n + (1.0 - vQ.y) * 0.26 - vQ.y * 0.34) * smoothstep(1.0, 0.6, vQ.y) * smoothstep(0.0, 0.05, vQ.y);
            vec3 sombre = vec3(0.06, 0.042, 0.04), cuivre = vec3(0.56, 0.32, 0.17), clair = vec3(0.92, 0.72, 0.52);
            vec3 c = mix(sombre, cuivre, smoothstep(0.34, 0.74, n));
            c = mix(c, clair, smoothstep(0.55, 0.72, n) * (0.3 + 0.6 * vQ.y));
            c += vec3(0.6, 0.62, 0.74) * uEclair * (0.3 + n);
            gl_FragColor = vec4(c, a * (0.96 - uK * 0.1));
          }`,
      }));
      m.frustumCulled = false; m.renderOrder = 8 - k;
      this.groupe.add(m);
    }
  }
  maj(a, actif) { this.groupe.visible = actif; this.u.uA.value = a; }
}
