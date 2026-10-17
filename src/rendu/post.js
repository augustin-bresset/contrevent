// La chaîne finale : la scène, une pyramide de flous (pas de blocs, à aucune échelle), puis le développement de l'image.
// Le flou va et vient par moitiés successives (filtre double de Kawase) : six petites passes, et un dégradé parfait.
import * as THREE from 'three';
import { GLSL_ECRAN_VERT } from './communs.js';

const NIV = 4;
export const NB_LENTILLES = 4;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const base = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    // 32 bits au lieu de 64 : la lumière au-dessus de 1 reste possible, l'alpha ne sert à rien ici.
    const compact = { ...base, format: THREE.RGBFormat, internalFormat: 'R11F_G11F_B10F' };
    this.scene = new THREE.WebGLRenderTarget(4, 4, { ...compact, samples: 4, depthBuffer: true });
    this.bas = Array.from({ length: NIV }, () => new THREE.WebGLRenderTarget(4, 4, compact));
    this.haut = Array.from({ length: NIV }, () => new THREE.WebGLRenderTarget(4, 4, compact));
    this.ray = new THREE.WebGLRenderTarget(4, 4, compact);
    this.cam = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.sc = new THREE.Scene(); this.sc.add(this.quad);

    const opt = { depthTest: false, depthWrite: false, vertexShader: GLSL_ECRAN_VERT };
    this.mBas = new THREE.ShaderMaterial({
      ...opt, uniforms: { t: { value: null }, uP: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D t; uniform vec2 uP; varying vec2 vUv;
        void main() { vec3 c = texture2D(t, vUv).rgb * 4.0;
          c += texture2D(t, vUv + uP * vec2(-1, -1)).rgb + texture2D(t, vUv + uP * vec2(1, -1)).rgb + texture2D(t, vUv + uP * vec2(-1, 1)).rgb + texture2D(t, vUv + uP * vec2(1, 1)).rgb;
          gl_FragColor = vec4(c / 8.0, 1.0); }`,
    });
    this.mHaut = new THREE.ShaderMaterial({
      ...opt, uniforms: { t: { value: null }, uP: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D t; uniform vec2 uP; varying vec2 vUv;
        void main() { vec3 c = texture2D(t, vUv + uP * vec2(-2, 0)).rgb + texture2D(t, vUv + uP * vec2(2, 0)).rgb + texture2D(t, vUv + uP * vec2(0, -2)).rgb + texture2D(t, vUv + uP * vec2(0, 2)).rgb;
          c += (texture2D(t, vUv + uP * vec2(-1, 1)).rgb + texture2D(t, vUv + uP * vec2(1, 1)).rgb + texture2D(t, vUv + uP * vec2(-1, -1)).rgb + texture2D(t, vUv + uP * vec2(1, -1)).rgb) * 2.0;
          gl_FragColor = vec4(c / 12.0, 1.0); }`,
    });
    this.mRayons = new THREE.ShaderMaterial({
      ...opt, uniforms: { t: { value: null }, uC: { value: new THREE.Vector2(0.5, 0.8) } },
      fragmentShader: `uniform sampler2D t; uniform vec2 uC; varying vec2 vUv;
        void main() {
          vec3 c = vec3(0.0); vec2 d = (uC - vUv) / 22.0, p = vUv; float w = 1.0;
          for (int i = 0; i < 22; i++) { c += max(texture2D(t, p).rgb - 0.86, 0.0) * w; p += d; w *= 0.94; }
          gl_FragColor = vec4(c / 11.0, 1.0); }`,
    });
    this.flou = true; this.rayons = true;
    this.u = {
      tS: { value: null }, tF1: { value: null }, tF2: { value: null }, tR: { value: null },
      uMaquette: { value: 0 }, uMaqY: { value: 0.36 }, uRayons: { value: 0 }, uEclair: { value: 0 }, uVig: { value: 0.2 }, uVigC: { value: new THREE.Color('#141822') },
      uLueur: { value: 0.5 }, uFlou: { value: 0 }, uBlanc: { value: 0 }, uAb: { value: 0.004 }, uGrain: { value: 0.012 }, uPx: { value: new THREE.Vector2() },
      uLent: { value: Array.from({ length: NB_LENTILLES }, () => new THREE.Vector4()) }, uAsp: { value: 1 }, uTemps: { value: 0 },
    };
    this.mFin = new THREE.ShaderMaterial({
      ...opt, uniforms: this.u,
      fragmentShader: /* glsl */`
        uniform sampler2D tS, tF1, tF2, tR; uniform float uMaquette, uMaqY, uRayons, uEclair, uVig, uLueur, uFlou, uBlanc, uAb, uGrain, uAsp, uTemps;
        uniform vec3 uVigC; uniform vec2 uPx; uniform vec4 uLent[${NB_LENTILLES}]; varying vec2 vUv;
        float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        // Une courbe de film : les tons moyens intacts, les hautes lumières qui glissent au lieu de brûler.
        vec3 film(vec3 c) { vec3 x = max(c - 0.72, 0.0); return min(c, vec3(0.72)) + 0.28 * (1.0 - exp(-x * 2.3)); }
        void main() {
          vec2 uv = vUv;
          // L'image elle-même se tord autour des chrones, et du Corroyeur qu'on ne voit pas.
          for (int i = 0; i < ${NB_LENTILLES}; i++) {
            vec4 l = uLent[i];
            if (l.z <= 0.0) continue;
            vec2 d = (uv - l.xy) * vec2(uAsp, 1.0); float q = dot(d, d) / (l.z * l.z), e = exp(-q);
            if (e < 0.01) continue;
            float a = l.w * e * (1.0 + 0.2 * sin(q * 7.0 - uTemps * 4.0)), c = cos(a), s = sin(a);
            d = mat2(c, -s, s, c) * d * (1.0 - 0.1 * abs(l.w) * e);
            uv = l.xy + d / vec2(uAsp, 1.0);
          }
          vec2 d = uv - 0.5; float r2 = dot(d, d);
          vec3 c;
          if (uFlou > 0.001) {
            c = vec3(0.0);
            for (int i = 0; i < 12; i++) { float k = 1.0 - float(i) / 12.0 * uFlou * 0.075; c += texture2D(tS, 0.5 + d * k).rgb; }
            c /= 12.0;
          } else {
            c = texture2D(tS, uv).rgb;
            if (uAb > 0.0) { c.r = texture2D(tS, uv + d * r2 * uAb).r; c.b = texture2D(tS, uv - d * r2 * uAb).b; }
            // Un rien de netteté rendue, là où le plan reste au point.
            vec3 av = (texture2D(tS, uv + vec2(uPx.x, 0.0)).rgb + texture2D(tS, uv - vec2(uPx.x, 0.0)).rgb + texture2D(tS, uv + vec2(0.0, uPx.y)).rgb + texture2D(tS, uv - vec2(0.0, uPx.y)).rgb) * 0.25;
            c += (c - av) * 0.45;
          }
          vec3 f1 = texture2D(tF1, uv).rgb, f2 = texture2D(tF2, uv).rgb;
          // L'effet maquette : deux rayons de flou, et la bande où marche la Horde au point.
          if (uMaquette > 0.001) {
            float co = smoothstep(0.1, 0.56, abs(uv.y - uMaqY) + max(0.0, uv.y - uMaqY) * 0.3) * uMaquette;
            c = mix(c, f1, clamp(co * 2.2, 0.0, 1.0));
            c = mix(c, f2, clamp(co * 2.2 - 1.0, 0.0, 1.0));
          }
          c += max(f2 - 0.82, 0.0) * uLueur + max(f1 - 1.0, 0.0) * uLueur * 0.6;
          if (uRayons > 0.001) c += texture2D(tR, uv).rgb * uRayons;
          c += vec3(0.74, 0.78, 0.96) * uEclair * 0.16;
          c = film(c);
          float l = dot(c, vec3(0.3, 0.59, 0.11));
          c = mix(vec3(l), c, 1.07);                                  // un peu plus de vie
          c = mix(c, c * c * (3.0 - 2.0 * c), 0.14);                  // un peu plus de tenue
          c = mix(c, uVigC, smoothstep(0.3, 1.0, r2 * 2.0) * uVig);
          c += (rnd(vUv * 917.0) - 0.5) * uGrain;                     // juste de quoi casser les dégradés
          c = mix(c, vec3(0.984, 0.98, 0.973), uBlanc);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
  }
  echantillons(n) { if (this.scene.samples !== n) { this.scene.samples = n; this.scene.dispose(); } }
  taille(w, h, pr) {
    const W = Math.round(w * pr), H = Math.round(h * pr);
    this.scene.setSize(W, H);
    this.tailles = [];
    for (let i = 0; i < NIV; i++) {
      const a = Math.max(2, W >> (i + 1)), b = Math.max(2, H >> (i + 1));
      this.bas[i].setSize(a, b); this.haut[i].setSize(a, b); this.tailles.push([a, b]);
    }
    this.ray.setSize(this.tailles[1][0], this.tailles[1][1]);
    this.u.uPx.value.set(1 / W, 1 / H); this.u.uAsp.value = w / h;
  }
  passe(mat, cible) { this.quad.material = mat; this.r.setRenderTarget(cible); this.r.render(this.sc, this.cam); }
  rendre(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.scene); r.render(scene, camera);
    let src = this.scene.texture;
    for (let i = 0; i < NIV; i++) {
      const [a, b] = this.tailles[i];
      this.mBas.uniforms.t.value = src; this.mBas.uniforms.uP.value.set(0.5 / a, 0.5 / b);
      this.passe(this.mBas, this.bas[i]); src = this.bas[i].texture;
    }
    for (let i = NIV - 2; i >= 0; i--) {
      const [a, b] = this.tailles[i];
      this.mHaut.uniforms.t.value = src; this.mHaut.uniforms.uP.value.set(0.5 / a, 0.5 / b);
      this.passe(this.mHaut, this.haut[i]); src = this.haut[i].texture;
    }
    this.u.tF1.value = this.haut[1].texture; this.u.tF2.value = this.haut[0].texture;
    if (!this.flou) this.u.uMaquette.value = 0;
    if (this.rayons && this.u.uRayons.value > 0.001) {
      this.mRayons.uniforms.t.value = this.bas[0].texture; this.passe(this.mRayons, this.ray);
      this.u.tR.value = this.ray.texture;
    } else this.u.uRayons.value = 0;
    this.u.tS.value = this.scene.texture;
    this.passe(this.mFin, null);
  }
}
