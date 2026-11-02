// La chaîne d'image. La scène se rend en lumière réelle, avec sa profondeur ; viennent ensuite, dans l'ordre :
// l'occlusion des creux, l'air (ciel, brume, poussière éclairée), le lissage temporel, ce qui vole, la lueur, et le film.
// Le lissage accumule les images d'une caméra légèrement décalée : plus d'escalier, plus de grouillement, à toute distance.
import * as THREE from 'three';
import { GLSL_ECRAN_VERT, GLSL_COMMUN, GLSL_OMBRE } from './communs.js';

const NIV = 5;
export const NB_LENTILLES = 4;
const HALTON = Array.from({ length: 16 }, (_, i) => {
  const h = (b, n) => { let f = 1, r = 0; while (n > 0) { f /= b; r += f * (n % b); n = Math.floor(n / b); } return r; };
  return [h(2, i + 1) - 0.5, h(3, i + 1) - 0.5];
});

const GLSL_POS = /* glsl */`
uniform mat4 uInvVP; uniform vec3 uCam;
// Le rayon de l'œil, relatif à la caméra : à 42 000 unités du départ, un flottant n'a plus la précision de la position absolue.
vec3 relatif(vec2 uv, float z) { vec4 w = uInvVP * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return w.xyz / w.w; }`;

// Le bruit des nuages, en volume : trois octaves de Worley répétables, fabriquées sur le GPU, tranche par tranche.
function bruit3D(renderer) {
  const N = 64, rt = new THREE.WebGL3DRenderTarget(N, N, N, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  rt.texture.wrapS = rt.texture.wrapT = rt.texture.wrapR = THREE.RepeatWrapping;
  const u = { uZ: { value: 0 } }, sc = new THREE.Scene(), cam = new THREE.Camera();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u, depthTest: false, depthWrite: false, vertexShader: GLSL_ECRAN_VERT,
    fragmentShader: /* glsl */`
      precision highp float; uniform float uZ; varying vec2 vUv;
      vec3 h3(vec3 p) { p = fract(p * vec3(0.1031, 0.103, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
      float w(vec3 p, float per) {
        vec3 i = floor(p), f = p - i; float d = 9.0;
        for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec3 g = vec3(float(x), float(y), float(z)), c = mod(i + g, per), r = g + h3(c + 17.0) - f;
          d = min(d, dot(r, r));
        }
        return 1.0 - sqrt(d);
      }
      float f(vec3 p, float per) { return w(p * per, per) * 0.625 + w(p * per * 2.0, per * 2.0) * 0.25 + w(p * per * 4.0, per * 4.0) * 0.125; }
      void main() { vec3 p = vec3(vUv, uZ); gl_FragColor = vec4(f(p, 3.0), f(p, 6.0), f(p, 12.0), f(p, 20.0)); }`,
  }));
  q.frustumCulled = false; sc.add(q);
  for (let k = 0; k < N; k++) { u.uZ.value = (k + 0.5) / N; renderer.setRenderTarget(rt, k); renderer.render(sc, cam); }
  renderer.setRenderTarget(null);
  return rt.texture;
}

// La carte des nuages : un bruit de Perlin répétable, en six octaves. Une fois pour toutes.
function carteNuages(renderer) {
  const rt = new THREE.WebGLRenderTarget(512, 512, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  const sc = new THREE.Scene(), cam = new THREE.Camera();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader: GLSL_ECRAN_VERT,
    fragmentShader: /* glsl */`
      precision highp float; varying vec2 vUv;
      vec2 g(vec2 p, float per) { p = mod(p, per); float a = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 6.28318; return vec2(cos(a), sin(a)); }
      float pn(vec2 p, float per) {
        vec2 i = floor(p), f = p - i, u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return mix(mix(dot(g(i, per), f), dot(g(i + vec2(1.0, 0.0), per), f - vec2(1.0, 0.0)), u.x), mix(dot(g(i + vec2(0.0, 1.0), per), f - vec2(0.0, 1.0)), dot(g(i + vec2(1.0, 1.0), per), f - vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        float v = 0.0, a = 0.5, per = 6.0;
        for (int i = 0; i < 6; i++) { v += a * pn(vUv * per, per); per *= 2.0; a *= 0.5; }
        gl_FragColor = vec4(vec3(0.5 + 0.8 * v), 1.0);
      }`,
  }));
  q.frustumCulled = false; sc.add(q);
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(null);
  return rt.texture;
}

export class Post {
  constructor(renderer, u, tBruit) {
    this.r = renderer; this.uC = u;
    const base = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false };
    const hdr = { ...base, type: THREE.HalfFloatType, format: THREE.RGBAFormat };
    this.prof = new THREE.DepthTexture(4, 4, THREE.FloatType);
    this.prof.minFilter = this.prof.magFilter = THREE.NearestFilter;
    this.scene = new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: true, depthTexture: this.prof });
    this.fini = new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: true, depthTexture: this.prof });
    this.air = new THREE.WebGLRenderTarget(4, 4, hdr);
    this.hist = [new THREE.WebGLRenderTarget(4, 4, hdr), new THREE.WebGLRenderTarget(4, 4, hdr)];
    this.ao = new THREE.WebGLRenderTarget(4, 4, { ...base, type: THREE.UnsignedByteType });
    this.vol = new THREE.WebGLRenderTarget(4, 4, hdr);
    this.fr = new THREE.WebGLRenderTarget(4, 4, hdr);
    this.nu = [new THREE.WebGLRenderTarget(4, 4, hdr), new THREE.WebGLRenderTarget(4, 4, hdr)]; this.pairN = 0;
    this.bas = Array.from({ length: NIV }, () => new THREE.WebGLRenderTarget(4, 4, hdr));
    this.haut = Array.from({ length: NIV }, () => new THREE.WebGLRenderTarget(4, 4, hdr));
    this.cam = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.sc = new THREE.Scene(); this.sc.add(this.quad);
    this.image = 0; this.pair = 0; this.neuf = true;
    this.camAvant = new THREE.Vector3(); this.vpAvant = new THREE.Matrix4(); this.v = new THREE.Matrix4(); this.vp = new THREE.Matrix4(); this.iv = new THREE.Matrix4();
    this.taa = true; this.aoActif = true; this.volActif = true;

    const opt = { depthTest: false, depthWrite: false, vertexShader: GLSL_ECRAN_VERT };
    const pos = { uInvVP: { value: this.iv }, uCam: { value: new THREE.Vector3() } };
    this.pos = pos;

    this.mCopie = new THREE.ShaderMaterial({ ...opt, uniforms: { t: { value: null } }, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { gl_FragColor = texture2D(t, vUv); }' });
    this.mBas = new THREE.ShaderMaterial({
      ...opt, uniforms: { t: { value: null }, uP: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D t; uniform vec2 uP; varying vec2 vUv;
        void main() { vec3 c = texture2D(t, vUv).rgb * 4.0;
          c += texture2D(t, vUv + uP * vec2(-1, -1)).rgb + texture2D(t, vUv + uP * vec2(1, -1)).rgb + texture2D(t, vUv + uP * vec2(-1, 1)).rgb + texture2D(t, vUv + uP * vec2(1, 1)).rgb;
          gl_FragColor = vec4(min(c / 8.0, vec3(24.0)), 1.0); }`,
    });
    this.mHaut = new THREE.ShaderMaterial({
      ...opt, uniforms: { t: { value: null }, tB: { value: null }, uP: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D t, tB; uniform vec2 uP; varying vec2 vUv;
        void main() { vec3 c = texture2D(t, vUv + uP * vec2(-2, 0)).rgb + texture2D(t, vUv + uP * vec2(2, 0)).rgb + texture2D(t, vUv + uP * vec2(0, -2)).rgb + texture2D(t, vUv + uP * vec2(0, 2)).rgb;
          c += (texture2D(t, vUv + uP * vec2(-1, 1)).rgb + texture2D(t, vUv + uP * vec2(1, 1)).rgb + texture2D(t, vUv + uP * vec2(-1, -1)).rgb + texture2D(t, vUv + uP * vec2(1, -1)).rgb) * 2.0;
          gl_FragColor = vec4(c / 12.0 * 0.82 + texture2D(tB, vUv).rgb * 0.5, 1.0); }`,
    });

    // L'occlusion : les creux et les pieds de ce qui touche le sol reçoivent moins de ciel (Scalable Ambient Obscurance).
    this.uAO = { tD: { value: this.prof }, uProj: { value: new THREE.Vector4() }, uAsp: { value: 1 }, uI: { value: 0 }, uPx: { value: new THREE.Vector2() } };
    this.mAO = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uAO,
      fragmentShader: /* glsl */`
        precision highp float; uniform sampler2D tD; uniform vec4 uProj; uniform vec2 uPx; uniform float uAsp, uI; varying vec2 vUv;
        vec3 vue(vec2 uv) {
          float z = texture2D(tD, uv).r * 2.0 - 1.0, w = uProj.w / (z + uProj.z);
          return vec3((uv * 2.0 - 1.0) / uProj.xy * w, -w);
        }
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        void main() {
          vec3 C = vue(vUv);
          if (-C.z > 900.0) { gl_FragColor = vec4(1.0); return; }
          // La normale, prise du côté où le relief est le plus continu : jamais à travers une arête.
          vec3 a1 = vue(vUv + vec2(uPx.x, 0.0)) - C, a2 = C - vue(vUv - vec2(uPx.x, 0.0)), b1 = vue(vUv + vec2(0.0, uPx.y)) - C, b2 = C - vue(vUv - vec2(0.0, uPx.y));
          vec3 N = normalize(cross(abs(a1.z) < abs(a2.z) ? a1 : a2, abs(b1.z) < abs(b2.z) ? b1 : b2));
          float r = clamp(-C.z * 0.03, 1.1, 7.0), rp = r * uProj.y * 0.5 / -C.z, ph = ign(gl_FragCoord.xy + uI * 5.588) * 6.283, ao = 0.0;
          for (int i = 0; i < 9; i++) {
            float a = (float(i) + 0.5) / 9.0, h = rp * a, t = a * 19.0 + ph;
            vec2 q = vUv + vec2(cos(t) / uAsp, sin(t)) * h;
            if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
            vec3 v = vue(q) - C;
            float vv = dot(v, v), f = max(r * r - vv, 0.0);
            ao += f * f * f * max((dot(v, N) - 0.06 * r) / (0.01 + vv), 0.0);
          }
          float o = max(0.0, 1.0 - ao * 6.5 / (pow(r, 6.0) * 9.0));
          gl_FragColor = vec4(mix(o, 1.0, smoothstep(300.0, 900.0, -C.z)));
        }`,
    });

    // La poussière éclairée : quelques pas le long du rayon, à demi-résolution ; le lissage temporel fait le reste.
    this.uV = {
      ...u, tD: { value: this.prof }, ...pos, uI: { value: 0 }, uVol: { value: 1 }, uSolY: { value: 0 }, uVentV: { value: new THREE.Vector2(0, -1) }, uTon: { value: new THREE.Color(1, 1, 1) },
    };
    this.mVol = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uV,
      fragmentShader: /* glsl */`
        precision highp float; uniform sampler2D tD; uniform float uI, uVol, uSolY; uniform vec2 uVentV; uniform vec3 uTon; varying vec2 vUv;
        ${GLSL_POS}
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        float sable(vec3 p) {
          vec2 q = p.xz + uVentV * uTemps * 30.0;
          return smoothstep(0.4, 0.72, fbm3(q * 0.016 + p.y * 0.03));
        }
        void main() {
          float z = texture2D(tD, vUv).r;
          vec3 R = relatif(vUv, z); float d = length(R); R /= d;
          float mx = min(d, 620.0), dt = mx / 9.0, j = ign(gl_FragCoord.xy + uI * 5.588);
          vec3 L = vec3(0.0); float T = 1.0;
          float mu = dot(R, uSoleil), ph = 0.09 + 0.55 * pow(max(mu, 0.0), 6.0) + 1.6 * pow(max(mu, 0.0), 40.0);
          vec3 amb = cielDiffus(vec3(0.0, 1.0, 0.0)) * 0.34;
          for (int i = 0; i < 9; i++) {
            float t = (float(i) + j) * dt;
            vec3 P = uCam + R * t;
            float s = -P.z, y = P.y - uSolY, f = tempeteA(P.x, s);
            float dens = (exp(-max(y, 0.0) / 22.0) * (0.06 + 1.5 * sable(P) * sable(P)) * 0.0006 * uVol) + f * 0.009;
            float sol = texture2D(tL, vec2(P.x, s) / uAnneau).r;
            float vis = mix(sol, 1.0, smoothstep(6.0, 60.0, y));
            vec4 q = uOmbreM * vec4(P, 1.0); vec3 p = q.xyz * 0.5 + 0.5;
            if (all(greaterThan(p.xy, vec2(0.01))) && all(lessThan(p.xy, vec2(0.99))) && p.z < 1.0) vis *= texture(tOmbre, vec3(p.xy, p.z - 0.0006));
            vec3 S = uSoleilCol * vis * ph * (1.0 - 0.8 * f) + amb;
            S = mix(S, vec3(0.5, 0.26, 0.12) * (0.16 + uEclair * 4.0), f * 0.86);
            L += T * S * uTon * dens * dt;
            T *= exp(-dens * dt);
          }
          gl_FragColor = vec4(L, T);
        }`,
    });

    // Les nuages : un vrai volume traversé pas à pas, au quart de la résolution, et accumulé d'une image à l'autre.
    this.uN = {
      ...u, tN3: { value: bruit3D(renderer) }, tNC: { value: carteNuages(renderer) }, tNH: { value: null }, ...pos, uPrec: { value: new THREE.Matrix4() }, uI: { value: 0 }, uVentN: { value: new THREE.Vector2() }, uCouv: { value: 0.5 },
    };
    this.mNuage = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uN,
      fragmentShader: /* glsl */`
        precision highp float; precision highp sampler3D;
        uniform sampler3D tN3; uniform sampler2D tNH, tNC; uniform float uI, uCouv; uniform vec2 uVentN; uniform mat4 uPrec; varying vec2 vUv;
        ${GLSL_POS}
        ${GLSL_COMMUN}
        const float H0 = 1500.0, H1 = 3300.0;
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        float reb(float x, float a, float b, float c, float d) { return c + (x - a) / (b - a) * (d - c); }
        float densite(vec3 p, bool fin) {
          float y = (p.y - H0) / (H1 - H0);
          // Où sont les nuages : une carte sans mipmaps, pour qu'un rayon bruité ne la fasse pas clignoter.
          float c = texture2D(tNC, (p.xz + uVentN) * 0.000024).r;
          c = smoothstep(0.62 - uCouv * 0.24, 0.72 - uCouv * 0.24, c);
          float g = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.3, y) * (0.4 + 0.6 * c);
          vec4 n = texture(tN3, (vec3(p.x + uVentN.x, p.y * 1.3, p.z + uVentN.y)) * 0.000235);
          float b = n.r * 0.5 + n.g * 0.33 + n.b * 0.17;
          float d = clamp(reb(b, 1.0 - c * g * 0.86, 1.0, 0.0, 1.0), 0.0, 1.0) * 2.2;
          if (fin && d > 0.0) {
            vec4 e = texture(tN3, (p + vec3(uVentN.x, uTemps * 3.0, uVentN.y)) * 0.0019);
            float f = e.r * 0.6 + e.g * 0.3 + e.b * 0.1;
            d = clamp(reb(d, f * 0.42 * mix(1.0, 0.6, y), 1.0, 0.0, 1.0), 0.0, 1.0);
          }
          return d;
        }
        void main() {
          vec3 R = relatif(vUv, 1.0); vec3 V = normalize(R);
          vec4 q0 = uPrec * vec4(V * 5000.0, 1.0); vec2 pv = q0.xy / q0.w * 0.5 + 0.5;
          vec4 avant = texture2D(tNH, pv);
          bool hors = q0.w <= 0.0 || pv.x < 0.0 || pv.x > 1.0 || pv.y < 0.0 || pv.y > 1.0;
          if (V.y < 0.01) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          float t0 = (H0 - uCam.y) / V.y, t1 = min((H1 - uCam.y) / V.y, t0 + 6500.0);
          const int N = 26;
          float dt = (t1 - t0) / float(N), j = fract(texture2D(tBruit, gl_FragCoord.xy / 256.0).r + uI * 0.618034), T = 1.0;
          vec3 L = vec3(0.0);
          float mu = dot(V, uSoleil);
          float g1 = 0.72, g2 = -0.2;
          float ph = mix((1.0 - g2 * g2) / pow(1.0 + g2 * g2 - 2.0 * g2 * mu, 1.5), (1.0 - g1 * g1) / pow(1.0 + g1 * g1 - 2.0 * g1 * mu, 1.5), 0.45) * 0.5;
          vec3 hautC = cielLu(vec3(0.0, 1.0, 0.0)), basC = cielLu(normalize(vec3(V.x, 0.05, V.z)));
          for (int i = 0; i < N; i++) {
            float t = t0 + (float(i) + j) * dt;
            vec3 P = uCam + V * t;
            float d = densite(P, true);
            if (d < 0.004) continue;
            // Vers le soleil : combien de nuage reste-t-il à traverser ?
            float tauL = 0.0;
            for (int k = 0; k < 4; k++) {
              float l = (float(k) + 0.5 + j) * 170.0 * (1.0 + float(k) * 0.7);
              tauL += densite(P + uSoleil * l, false) * 170.0 * (1.0 + float(k) * 0.7);
            }
            float y = (P.y - H0) / (H1 - H0);
            float e = exp(-tauL * 0.0038), pd = 1.0 - exp(-tauL * 0.009);
            vec3 S = uSoleilCol * 0.5 * ph * e * mix(0.55, 1.0, pd);
            S += mix(basC, hautC, y) * mix(0.42, 0.92, y) * (0.72 + 0.28 * e);
            float a = 1.0 - exp(-d * dt * 0.012);
            L += T * S * a; T *= 1.0 - a;
            if (T < 0.015) break;
          }
          // L'air entre eux et nous : au loin, les nuages deviennent de l'horizon.
          float loin = 1.0 - exp(-max(t0, 0.0) * 0.000052);
          vec3 air = cielLu(normalize(vec3(V.x, max(V.y * 0.5, 0.01), V.z)));
          L = mix(L, air * (1.0 - T), loin);
          vec4 c = vec4(L, T);
          gl_FragColor = hors || avant.a < 0.0 ? c : mix(avant, c, 0.14);
        }`,
    });

    // Le mur du furvent : un seul volume, sans bords, plus large que tout ce qu'on peut voir. La tête surplombe le pied,
    // la poussière roule en choux énormes, et le soleil frappe sa face. Il se dissout en arrivant sur l'œil : dedans, on voit.
    this.uF = { ...u, tD: { value: this.prof }, tN3: this.uN.tN3, ...pos, uI: { value: 0 }, uSolY: { value: 0 }, uTon: { value: new THREE.Color(1, 1, 1) }, uPas: { value: 40 } };
    this.mFront = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uF,
      fragmentShader: /* glsl */`
        precision highp float; precision highp sampler3D;
        uniform sampler2D tD; uniform sampler3D tN3; uniform float uI, uSolY; uniform vec3 uTon; uniform int uPas; varying vec2 vUv;
        ${GLSL_POS}
        ${GLSL_COMMUN}
        const float H = 640.0;
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        float reb(float x, float a, float b) { return clamp((x - a) / (b - a), 0.0, 1.0); }
        // Deux phases qui se relaient : chaque volute naît, monte et se fond pendant que l'autre prend le relais.
        // Sans elles, la poussière serait une image qui glisse d'un bloc.
        const float CYCLE = 7.0;
        float P0, P1, A0, A1, NORM;
        void phases() {
          P0 = fract(uTemps / CYCLE); P1 = fract(P0 + 0.5);
          A0 = 1.0 - abs(2.0 * P0 - 1.0); A1 = 1.0 - A0; NORM = inversesqrt(A0 * A0 + A1 * A1);
        }
        float relais(vec3 w, vec3 v, float k, vec3 dec, int c) {
          vec4 a = texture(tN3, (w - v * P0 * CYCLE) * k + dec), b = texture(tN3, (w - v * P1 * CYCLE) * k + dec + 0.41);
          float x = c == 0 ? a.r * A0 + b.r * A1 : a.g * A0 + b.g * A1;
          return (x - 0.5 * (A0 + A1)) * NORM + 0.5;
        }
        // La forme du mur, comme une surface : F > 0 à l'intérieur. De grands choux, et de plus petits sur les grands.
        float champ(vec3 p, bool fin, out float q) {
          float s = -p.z, y = p.y - uSolY, yn = max(y, 0.0) / H, nez = 110.0 * smoothstep(0.03, 0.3, yn) * smoothstep(1.2, 0.6, yn);
          q = s - (uFrontT.x + ondeFront(p.x, uFrontT.x) - nez);
          if (q < -430.0) return -430.0;
          // Au pied, le mur est une seule masse qui roule au ras du sol ; les choux se creusent en montant.
          float amp = mix(0.3, 1.0, smoothstep(0.0, 0.35, yn));
          vec3 w = vec3(p.x, y * 1.35, q * 0.84);
          // Dans le repère du mur, l'air monte le long de la face, puis repart en arrière au sommet : la tête roule sur elle-même.
          vec3 v = vec3(0.0, mix(18.0, 6.0, smoothstep(0.3, 0.9, yn)), mix(-7.0, 16.0, smoothstep(0.25, 0.85, yn)));
          vec4 n = texture(tN3, (w - vec3(0.0, uTemps * 7.0, -uTemps * 2.0)) * 0.00074);
          float F = q + ((n.r - 0.62) * 1150.0 + (relais(w.zxy, v.zxy, 0.0024, vec3(0.37), 1) - 0.62) * 340.0) * amp;
          // Le sommet : de grands dômes, qui se dressent à mesure que le mur sort du lointain.
          float haut = H * (1.05 + 0.34 * sin(p.x * 0.0023 + 0.7) + 0.22 * sin(p.x * 0.0061 + 2.1)) * (0.3 + 0.7 * uFrontT.z);
          F -= max(y - haut * 0.45, 0.0) * 2.6;
          if (fin && F > -130.0) F += ((relais(w, v * 1.6, 0.0086, vec3(0.0), 0) - 0.62) * 170.0 + (texture(tN3, (w.yzx - v.yzx * uTemps * 0.5) * 0.021).g - 0.62) * 46.0) * mix(0.6, 1.0, amp);
          return F;
        }
        // Combien de poussière en p.
        float densite(vec3 p, bool fin, out float q) {
          float F = champ(p, fin, q), y = p.y - uSolY;
          if (q < -430.0) return 0.0;
          float d = reb(F, 0.0, 46.0) * 1.6;
          // Devant le pied, les doigts de sable que le mur lance au ras du sol : ils filent devant lui, et s'éteignent.
          float ras = smoothstep(58.0, 2.0, y) * smoothstep(-320.0, -40.0, q);
          if (ras > 0.0) {
            vec4 r = texture(tN3, vec3(p.x * 0.0031, y * 0.007, (q + uTemps * 38.0) * 0.004));
            d = max(d, (0.04 + reb(r.r, 0.54, 0.84) * 0.42) * ras);
          }
          // Derrière la tête, le corps du furvent ne se voit plus : c'est l'air où l'on marche.
          // Loin, il sort peu à peu du lointain.
          return d * mix(0.03, 1.0, smoothstep(880.0, 520.0, q)) * smoothstep(0.0, 0.45, uFrontT.z);
        }
        void main() {
          float z = texture2D(tD, vUv).r;
          vec3 R = relatif(vUv, z); float dS = z < 1.0 ? length(R) : 1e6; vec3 V = normalize(R);
          // Une montagne que la brume a mangée ne cache plus le mur : les mêmes lois que l'air.
          float loin = 0.0;
          if (z < 1.0) {
            float a = (uCam.y - uSolY) / uBrumeH, b = V.y * dS / uBrumeH, fq = abs(b) < 1e-3 ? 1.0 : (1.0 - exp(-b)) / b;
            loin = 1.0 - smoothstep(0.05, 0.32, exp(-uBrume * exp(-max(a, 0.0)) * dS * fq) * (1.0 - smoothstep(uBrouillard * 0.5, uBrouillard * 1.22, dS)));
          }
          // Le rayon ne compte que dans la tranche où le mur se trouve.
          float sA = uFrontT.x - 640.0, sB = uFrontT.x + 880.0, sC = -uCam.z, vs = -V.z, t0 = 0.0, t1 = loin > 0.0 ? 5200.0 : min(dS, 5200.0);
          if (abs(vs) > 1e-4) { float a = (sA - sC) / vs, b = (sB - sC) / vs; t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b)); }
          else if (sC < sA || sC > sB) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          float yH = uSolY + H * 1.9;
          if (V.y > 1e-4) t1 = min(t1, (yH - uCam.y) / V.y);
          else if (V.y < -1e-4) { t1 = min(t1, (uSolY - 12.0 - uCam.y) / V.y); t0 = max(t0, (yH - uCam.y) / V.y); }
          if (t1 <= t0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          phases();
          float dt = max((t1 - t0) / float(uPas), 14.0), j = ign(gl_FragCoord.xy + uI * 5.588), T = 1.0;
          vec3 L = vec3(0.0), hautC = cielLu(vec3(0.0, 1.0, 0.0)), basC = cielLu(normalize(vec3(V.x, 0.05, V.z)));
          bool peau = false; float lamb = 1.0, ciel = 0.5;
          float mu = dot(V, uSoleil), ph = 0.5 + 0.55 * pow(max(-mu, 0.0), 2.0) + 1.1 * pow(max(mu, 0.0), 8.0), jour = 1.0 - uNuit * 0.9;
          for (int i = 0; i < uPas; i++) {
            float t = t0 + (float(i) + j) * dt;
            if (t >= t1) break;
            vec3 P = uCam + V * t;
            float q, d = densite(P, true, q);
            d *= smoothstep(30.0, 150.0, t) * (t < dS ? 1.0 : loin);
            if (d < 0.004) continue;
            // La peau du mur, une fois par rayon : c'est elle qui dessine les choux.
            if (!peau && d > 0.3) {
              peau = true;
              // Plus la peau est loin, plus on la juge large : pas de grain qu'un pixel ne saurait montrer.
              vec2 h = vec2(20.0 + t * 0.035, 0.0);
              bool fn = t < 900.0;
              float q3, F0 = champ(P, fn, q3);
              vec3 G = vec3(champ(P + h.xyy, fn, q3) - F0, champ(P + h.yxy, fn, q3) - F0, champ(P + h.yyx, fn, q3) - F0);
              vec3 n = -normalize(G);
              lamb = max(dot(n, uSoleil) * 0.74 + 0.26, 0.0);
              ciel = 0.5 + 0.5 * n.y;
            }
            // Le soleil vient de côté : ce qui est derrière un chou est dans son ombre.
            float tau = 0.0, q2;
            for (int k = 0; k < 4; k++) { float l = 26.0 * pow(2.3, float(k)); tau += densite(P + uSoleil * l, false, q2) * l; }
            float haut = densite(P + vec3(0.0, 120.0, 0.0), false, q2);
            float yn = clamp((P.y - uSolY) / H, 0.0, 1.0), e = exp(-tau * 0.0034), creux = 1.0 - 0.6 * haut / 1.6;
            vec3 alb = mix(vec3(0.5, 0.3, 0.18), vec3(0.92, 0.72, 0.52), smoothstep(0.02, 0.8, yn)) * uTon;
            vec3 S = uSoleilCol * alb * jour * (e * ph * lamb * 1.5 + 0.05);
            S += mix(basC * 0.3, hautC * 0.8, creux * ciel) * alb * creux;
            S *= mix(0.5, 1.0, smoothstep(0.0, 0.16, yn));
            S += vec3(0.62, 0.66, 0.86) * uEclair * 2.6 * (0.2 + 0.8 * (1.0 - e));
            float a = 1.0 - exp(-d * dt * 0.05);
            L += T * S * a; T *= 1.0 - a;
            if (T < 0.012) break;
          }
          gl_FragColor = vec4(L, T);
        }`,
    });

    // L'air : le ciel derrière tout, et la brume devant ce qui s'éloigne.
    this.uA = {
      ...u, tC: { value: null }, tD: { value: this.prof }, tAO: { value: this.ao.texture }, tVol: { value: this.vol.texture }, tNu: { value: null }, tFr: { value: this.fr.texture }, ...pos,
      uAOn: { value: 1 }, uVolOn: { value: 1 }, uFrOn: { value: 0 }, uSolY: { value: 0 }, uMonts: { value: 1 }, uPxA: { value: new THREE.Vector2() },
    };
    this.mAir = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uA,
      fragmentShader: /* glsl */`
        precision highp float; uniform sampler2D tC, tD, tAO, tVol, tNu, tFr; uniform float uAOn, uVolOn, uFrOn, uSolY, uMonts; uniform vec2 uPxA; varying vec2 vUv;
        ${GLSL_POS}
        ${GLSL_COMMUN}
        float crete(float a, float f, float s) { return fbm3(vec2(a * f + s, s * 3.1)); }
        vec3 fond(vec3 V, float vide) {
          vec3 d = vec3(V.x, max(V.y, 0.004), V.z); d = normalize(d);
          vec3 c = cielLu(d);
          // Le soleil.
          float s = max(dot(V, uSoleil), 0.0), jour = 1.0 - uNuit;
          c += uSoleilCol * 60.0 * smoothstep(0.99996, 0.99999, s) * step(0.0, V.y) * jour * vide;
          // Les étoiles.
          if (uNuit > 0.01 && V.y > 0.0) {
            vec2 g = floor(V.xz / (V.y + 0.3) * 190.0);
            c += vec3(0.9, 0.93, 1.0) * step(0.9972, hash(g)) * hash(g + 3.0) * uNuit * 0.5 * smoothstep(0.02, 0.2, V.y);
          }
          vec4 n = texture2D(tNu, vUv);
          // Le lointain se perd dans l'air, jamais dans les nuages : on ne voit rien au travers d'une montagne.
          if (V.y > 0.0 && vide > 0.5) c = c * n.a + n.rgb;
          // Au loin, des chaînes qui n'en finissent pas : deux plans, avalés par l'air.
          float az = atan(V.x, -V.z);
          float h1 = 0.012 + 0.05 * crete(az, 2.7, 3.0) * crete(az, 9.0, 1.2) * 2.0 + 0.006 * crete(az, 37.0, 5.0);
          float h2 = 0.006 + 0.03 * crete(az, 4.3, 7.0) * crete(az, 14.0, 2.2) * 2.0 + 0.005 * crete(az, 51.0, 9.0);
          vec3 air = cielLu(normalize(vec3(V.x, 0.012, V.z)));
          float m1 = smoothstep(0.0012, -0.0012, V.y - h1) * uMonts, m2 = smoothstep(0.0012, -0.0012, V.y - h2) * uMonts;
          c = mix(c, air * mix(vec3(0.9, 0.93, 1.0), vec3(1.0), 0.3) * 0.94, m1 * 0.7);
          c = mix(c, air * vec3(0.8, 0.84, 0.92) * 0.86, m2 * 0.82);
          return c;
        }
        // L'inverse de la distance : sur un plan, il varie en ligne droite à l'écran, si bien que seules les ruptures ressortent.
        float inv(vec2 uv) { float z = texture2D(tD, uv).r; return z >= 1.0 ? 0.0 : 1.0 / length(relatif(uv, z)); }
        void main() {
          float z = texture2D(tD, vUv).r;
          vec3 R = relatif(vUv, z); float d = length(R); vec3 V = R / d;
          vec3 c = texture2D(tC, vUv).rgb;
          vec3 f = fond(V, step(1.0, z));
          if (z >= 1.0) c = f;
          else {
            if (uAOn > 0.5) c *= mix(1.0, texture2D(tAO, vUv).r, 0.86);
            // Le trait : le bord de ce qui se détache sur plus lointain reçoit un contour d'encre, du côté de la chose.
            // Il s'efface avec la distance ; au-delà, la brume dessine seule.
            if (uPeint > 0.01 && d < 520.0) {
              float w = 1.0 / d;
              float e = 4.0 * w - inv(vUv + vec2(uPxA.x, 0.0)) - inv(vUv - vec2(uPxA.x, 0.0)) - inv(vUv + vec2(0.0, uPxA.y)) - inv(vUv - vec2(0.0, uPxA.y));
              float tr = smoothstep(0.06, 0.2, e / w) * smoothstep(520.0, 60.0, d) * uPeint;
              float dvA = clamp(-(uCam.z + R.z) / uBande, 0.0, 1.0);
              c = mix(c, lumi(c) * 0.22 * teinte(2, dvA), tr * 0.8);
            }
            // La brume : dense au ras du sol, elle se dilue en montant.
            float a = (uCam.y - uSolY) / uBrumeH, b = V.y * d / uBrumeH, fq = abs(b) < 1e-3 ? 1.0 : (1.0 - exp(-b)) / b;
            float tau = uBrume * exp(-max(a, 0.0)) * d * fq;
            float lim = smoothstep(uBrouillard * 0.5, uBrouillard * 1.22, d);
            float T = exp(-tau) * (1.0 - lim);
            c = mix(f, c, T);
          }
          // Au-dessus de 1 000 unités, on entre dans la mer de nuages : c'est là que la Falaise se perd.
          if (z < 1.0) {
            float y = uCam.y + R.y, q = fbm3((uCam.xz + R.xz) * 0.0021 + y * 0.0013) + 0.34 * fbm3(R.xy * 0.009);
            float mer = smoothstep(780.0, 1500.0, y + (q - 0.7) * 900.0);
            c = mix(c, cielLu(vec3(0.0, 1.0, 0.0)) * 0.82 + uSoleilCol * 0.17, mer);
          }
          if (uVolOn > 0.5) { vec4 v = texture2D(tVol, vUv); c = c * v.a + v.rgb; }
          if (uFrOn > 0.5) { vec4 v = texture2D(tFr, vUv); c = c * v.a + v.rgb; }
          c = mix(c, BLANC_FIN, uReve);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });

    this.uT = { tC: { value: null }, tH: { value: null }, tD: { value: this.prof }, ...pos, uPrec: { value: new THREE.Matrix4() }, uDelta: { value: new THREE.Vector3() }, uPx: { value: new THREE.Vector2() }, uNeuf: { value: 1 } };
    this.mTAA = new THREE.ShaderMaterial({
      ...opt, uniforms: this.uT,
      fragmentShader: /* glsl */`
        precision highp float; uniform sampler2D tC, tH, tD; uniform mat4 uPrec; uniform vec3 uDelta; uniform vec2 uPx; uniform float uNeuf; varying vec2 vUv;
        ${GLSL_POS}
        vec3 ycc(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
        vec3 rgb(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
        // Sur une courbe douce : un point très clair ne pèse pas plus lourd que ses voisins.
        vec3 lu(vec2 uv) { vec3 c = max(texture2D(tC, uv).rgb, vec3(0.0)); return ycc(c / (1.0 + max(c.r, max(c.g, c.b)))); }
        vec3 histoire(vec2 uv) {                                    // Catmull-Rom, cinq lectures : l'image reste nette
          vec2 sz = 1.0 / uPx, p = uv * sz, c = floor(p - 0.5) + 0.5, f = p - c, f2 = f * f, f3 = f2 * f;
          vec2 w0 = -0.5 * f3 + f2 - 0.5 * f, w1 = 1.5 * f3 - 2.5 * f2 + 1.0, w2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f, w3 = 0.5 * f3 - 0.5 * f2, w12 = w1 + w2;
          vec2 tc0 = (c - 1.0) * uPx, tc3 = (c + 2.0) * uPx, tc12 = (c + w2 / w12) * uPx;
          vec3 r = texture2D(tH, vec2(tc12.x, tc0.y)).rgb * w12.x * w0.y + texture2D(tH, vec2(tc0.x, tc12.y)).rgb * w0.x * w12.y + texture2D(tH, tc12).rgb * w12.x * w12.y
            + texture2D(tH, vec2(tc3.x, tc12.y)).rgb * w3.x * w12.y + texture2D(tH, vec2(tc12.x, tc3.y)).rgb * w12.x * w3.y;
          float t = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
          return max(r / t, vec3(0.0));
        }
        void main() {
          // La profondeur la plus proche du voisinage : le bord des objets se reprojette avec eux.
          float z = 1.0; vec3 m1 = vec3(0.0), m2 = vec3(0.0), cur = vec3(0.0);
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y)) * uPx;
            z = min(z, texture2D(tD, vUv + o).r);
            vec3 c = lu(vUv + o); m1 += c; m2 += c * c;
            if (x == 0 && y == 0) cur = c;
          }
          m1 /= 9.0; vec3 sig = sqrt(max(m2 / 9.0 - m1 * m1, vec3(0.0))) * 1.25;
          vec3 R = relatif(vUv, z) + uDelta;
          vec4 q = uPrec * vec4(R, 1.0); vec2 p = q.xy / q.w * 0.5 + 0.5;
          float hors = step(1.0, max(max(p.x, p.y), max(1.0 - p.x, 1.0 - p.y)) ) + uNeuf;
          vec3 h = ycc(histoire(p)); h = ycc(rgb(h) / (1.0 + max(rgb(h).r, max(rgb(h).g, rgb(h).b))));
          // Variance : ce qui s'écarte trop de l'image présente n'est plus la même chose, on le ramène.
          vec3 d = h - m1, u = abs(d / max(sig, vec3(1e-4))); float k = max(u.x, max(u.y, u.z));
          if (k > 1.0) h = m1 + d / k;
          float a = hors > 0.5 ? 1.0 : 0.1;
          vec3 c = rgb(mix(h, cur, a));
          c = c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-3);
          gl_FragColor = vec4(min(c, vec3(60.0)), 1.0);
        }`,
    });

    this.u = {
      tS: { value: null }, tF: { value: null }, tBruitF: { value: tBruit },
      uEclair: { value: 0 }, uVig: { value: 0.2 }, uExpo: { value: 1 }, uLueur: { value: 0.045 }, uFlou: { value: 0 }, uBlanc: { value: 0 }, uAb: { value: 0.001 }, uGrain: { value: 0.012 }, uPx: { value: new THREE.Vector2() },
      uLent: { value: Array.from({ length: NB_LENTILLES }, () => new THREE.Vector4()) }, uAsp: { value: 1 }, uTemps: { value: 0 }, uNet: { value: 0.32 },
      uLift: { value: new THREE.Color(0, 0, 0) }, uGainF: { value: new THREE.Color(1, 1, 1) }, uI: { value: 0 },
    };
    this.mFin = new THREE.ShaderMaterial({
      ...opt, uniforms: this.u,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D tS, tF, tBruitF; uniform float uEclair, uVig, uExpo, uLueur, uFlou, uBlanc, uAb, uGrain, uAsp, uTemps, uNet, uI;
        uniform vec3 uLift, uGainF; uniform vec2 uPx; uniform vec4 uLent[${NB_LENTILLES}]; varying vec2 vUv;
        // AgX : les fortes lumières vont vers le blanc sans virer ni se brûler, comme sur une pellicule.
        vec3 agxC(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
        vec3 agx(vec3 v) {
          const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
          const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
          const float a = -12.47393, b = 4.026069;
          v = clamp(log2(max(m * v, vec3(1e-10))), a, b);
          v = agxC((v - a) / (b - a));
          float l = dot(v, vec3(0.2126, 0.7152, 0.0722));         // l'allure : un peu plus de tenue et de couleur
          v = pow(max(v, vec3(0.0)), vec3(1.42));
          v = l * 0.86 + 1.36 * (v - l);
          return mi * v;
        }
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
            for (int i = 0; i < 12; i++) { float k = 1.0 - float(i) / 12.0 * uFlou * 0.022; c += texture2D(tS, 0.5 + d * k).rgb; }
            c /= 12.0;
          } else {
            c = texture2D(tS, uv).rgb;
            if (uAb > 0.0) { c.r = texture2D(tS, uv + d * r2 * uAb).r; c.b = texture2D(tS, uv - d * r2 * uAb).b; }
          }
          // La netteté rendue après le lissage, sur la luminance seule : rien ne s'auréole.
          vec3 av = (texture2D(tS, uv + vec2(uPx.x, 0.0)).rgb + texture2D(tS, uv - vec2(uPx.x, 0.0)).rgb + texture2D(tS, uv + vec2(0.0, uPx.y)).rgb + texture2D(tS, uv - vec2(0.0, uPx.y)).rgb) * 0.25;
          float lc = dot(c, vec3(0.3, 0.59, 0.11)), la = dot(av, vec3(0.3, 0.59, 0.11));
          c *= 1.0 + clamp((lc - la) / max(la, 0.02), -0.3, 0.3) * uNet;
          c = mix(c, texture2D(tF, uv).rgb, uLueur);
          c += vec3(0.74, 0.78, 0.96) * uEclair * 0.5;
          c *= uExpo;
          c *= 1.0 - smoothstep(0.12, 0.72, r2) * uVig;
          c = agx(c) * uGainF + uLift;
          // Un grain fin, qui casse aussi les dégradés du ciel.
          vec3 n = texture2D(tBruitF, gl_FragCoord.xy / 256.0 + vec2(0.37, 0.71) * uI).rgb - 0.5;
          c += n * uGrain;
          c = mix(c, vec3(0.984, 0.98, 0.973), uBlanc);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
  }
  taille(w, h, pr) {
    const W = Math.max(2, Math.round(w * pr)), H = Math.max(2, Math.round(h * pr));
    this.W = W; this.H = H;
    this.prof.image.width = W; this.prof.image.height = H; this.prof.needsUpdate = true;
    this.scene.setSize(W, H); this.fini.setSize(W, H); this.air.setSize(W, H);
    this.hist[0].setSize(W, H); this.hist[1].setSize(W, H);
    this.ao.setSize(W >> 1, H >> 1); this.vol.setSize(W >> 1, H >> 1); this.fr.setSize(W >> 1, H >> 1);
    this.nu[0].setSize(W >> 2, H >> 2); this.nu[1].setSize(W >> 2, H >> 2);
    this.tailles = [];
    for (let i = 0; i < NIV; i++) {
      const a = Math.max(2, W >> (i + 1)), b = Math.max(2, H >> (i + 1));
      this.bas[i].setSize(a, b); this.haut[i].setSize(a, b); this.tailles.push([a, b]);
    }
    this.u.uPx.value.set(1 / W, 1 / H); this.u.uAsp.value = w / h; this.uAO.uAsp.value = w / h;
    this.uT.uPx.value.set(1 / W, 1 / H); this.uA.uPxA.value.set(1 / W, 1 / H); this.neuf = true;
    this.uAO.uPx.value.set(2 / W, 2 / H);
  }
  passe(mat, cible) { this.quad.material = mat; this.r.setRenderTarget(cible); this.r.render(this.sc, this.cam); }
  rendre(scene, air, camera, { solY, ventX, ventS, couv, teinteAir, vol, front }) {
    const r = this.r, P = camera.projectionMatrix.elements, W = this.W, H = this.H;
    // Le décalage de l'image : un huitième à un demi-pixel, toujours différent.
    const J = this.taa ? HALTON[this.image++ % 16] : [0, 0];
    const p8 = P[8], p9 = P[9];
    P[8] = p8 + J[0] * 2 / W; P[9] = p9 + J[1] * 2 / H;
    r.setRenderTarget(this.scene); r.clear(); r.render(scene, camera);
    P[8] = p8; P[9] = p9;

    camera.updateMatrixWorld();
    this.v.copy(camera.matrixWorldInverse); this.v.setPosition(0, 0, 0);
    this.vp.multiplyMatrices(camera.projectionMatrix, this.v);
    this.iv.copy(this.vp).invert();
    this.pos.uCam.value.copy(camera.position);
    const I = this.image % 64;
    if (this.aoActif) {
      this.uAO.uProj.value.set(P[0], P[5], P[10], P[14]); this.uAO.uI.value = I;
      this.passe(this.mAO, this.ao);
    }
    if (this.volActif) {
      Object.assign(this.uV.uI, { value: I }); this.uV.uSolY.value = solY; this.uV.uVentV.value.set(ventX, ventS); this.uV.uTon.value.copy(teinteAir); this.uV.uVol.value = vol;
      this.passe(this.mVol, this.vol);
    }
    if (front) {
      const F = this.uF; F.uI.value = I; F.uSolY.value = solY; F.uTon.value.copy(teinteAir);
      this.passe(this.mFront, this.fr);
    }
    const Nu = this.uN, cN = this.nu[this.pairN];
    Nu.tNH.value = this.nu[1 - this.pairN].texture; Nu.uPrec.value.copy(this.vpAvant); Nu.uI.value = I; Nu.uCouv.value = couv;
    Nu.uVentN.value.x -= ventX * 0.9; Nu.uVentN.value.y += ventS * 0.9;
    this.passe(this.mNuage, cN);
    this.pairN = 1 - this.pairN;
    const A = this.uA;
    A.tC.value = this.scene.texture; A.uAOn.value = this.aoActif ? 1 : 0; A.uVolOn.value = this.volActif ? 1 : 0; A.uSolY.value = solY; A.tNu.value = cN.texture; A.uFrOn.value = front ? 1 : 0;
    this.passe(this.mAir, this.air);

    let src = this.air.texture;
    if (this.taa) {
      const T = this.uT, cible = this.hist[this.pair], avant = this.hist[1 - this.pair];
      T.tC.value = this.air.texture; T.tH.value = avant.texture; T.uPrec.value.copy(this.vpAvant); T.uNeuf.value = this.neuf ? 1 : 0;
      T.uDelta.value.subVectors(camera.position, this.camAvant);
      this.passe(this.mTAA, cible);
      src = cible.texture; this.pair = 1 - this.pair; this.neuf = false;
    }
    this.vpAvant.copy(this.vp); this.camAvant.copy(camera.position);

    // Ce qui vole se pose après le lissage : net, sans traînée, et il suit le sol grâce à la même profondeur.
    this.mCopie.uniforms.t.value = src;
    this.passe(this.mCopie, this.fini);
    const ac = r.autoClear; r.autoClear = false;
    r.setRenderTarget(this.fini); r.render(air, camera);
    r.autoClear = ac;

    src = this.fini.texture;
    for (let i = 0; i < NIV; i++) {
      const [a, b] = this.tailles[i];
      this.mBas.uniforms.t.value = src; this.mBas.uniforms.uP.value.set(0.5 / a, 0.5 / b);
      this.passe(this.mBas, this.bas[i]); src = this.bas[i].texture;
    }
    for (let i = NIV - 2; i >= 0; i--) {
      const [a, b] = this.tailles[i];
      this.mHaut.uniforms.t.value = src; this.mHaut.uniforms.tB.value = this.bas[i].texture; this.mHaut.uniforms.uP.value.set(0.5 / a, 0.5 / b);
      this.passe(this.mHaut, this.haut[i]); src = this.haut[i].texture;
    }
    this.u.tF.value = this.haut[0].texture;
    this.u.tS.value = this.fini.texture; this.u.uI.value = this.image % 97 * 0.618;
    this.passe(this.mFin, null);
  }
}
