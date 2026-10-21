// Les filets du vent, en vrais tracés : chaque ligne est un ruban posé dans la scène, à la résolution de l'écran.
// Les têtes sont les particules de la simulation ; un tableau circulaire garde leurs dernières positions,
// et le vertex shader relit ce tableau pour dérouler le ruban. Rien n'est plus jamais agrandi.
import * as THREE from 'three';

const LARG = 1800, LONG = 40;

export class Filets {
  constructor(renderer, lignes, tH, tPal, uAnneau, uBande) {
    this.r = renderer; this.lignes = lignes; this.tete = 0; this.acc = 0;
    this.hist = new THREE.WebGLRenderTarget(LARG, LONG, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
    this.uE = { tPos: { value: null }, uCote: { value: lignes.cote }, uLigne: { value: 0 } };
    this.sc = new THREE.Scene(); this.cam = new THREE.Camera();
    const q = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 3, 0, 0, -1, 1, 0]), 3)), new THREE.ShaderMaterial({
      uniforms: this.uE, depthTest: false, depthWrite: false, glslVersion: THREE.GLSL3,
      vertexShader: `uniform float uLigne; void main() { float y = (uLigne + 0.5 + position.y * 0.0) / ${LONG}.0 * 2.0 - 1.0; gl_Position = vec4(position.x, y + position.y * 4.0 / ${LONG}.0 - 2.0 / ${LONG}.0, 0.0, 1.0); }`,
      fragmentShader: `precision highp float; uniform sampler2D tPos; uniform float uCote; out vec4 o;
        void main() { int i = int(gl_FragCoord.x), c = int(uCote); o = texelFetch(tPos, ivec2(i % c, i / c), 0); }`,
    }));
    q.frustumCulled = false; this.sc.add(q);

    const n = (LONG - 1) * 2, aT = new Float32Array(n), aC = new Float32Array(n), idx = [];
    for (let i = 0; i < LONG - 1; i++) {
      aT[i * 2] = aT[i * 2 + 1] = i / (LONG - 2); aC[i * 2] = -1; aC[i * 2 + 1] = 1;
      if (i < LONG - 2) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); g.setAttribute('aC', new THREE.BufferAttribute(aC, 1)); g.setIndex(idx);
    const id = new Float32Array(LARG); for (let i = 0; i < LARG; i++) id[i] = i;
    g.setAttribute('iId', new THREE.InstancedBufferAttribute(id, 1)); g.instanceCount = LARG;
    this.u = {
      tHist: { value: this.hist.texture }, tH: { value: tH }, tPal: { value: tPal }, uAnneau: { value: uAnneau }, uBande: { value: uBande }, uTete: { value: 0 }, uFrac: { value: 0 },
      uEcran: { value: new THREE.Vector2(1, 1) }, uLarg: { value: 1.4 }, uChaud: { value: 0 }, uNuit: { value: 0 }, uForceF: { value: 1 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide, glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */`
        precision highp float; precision highp int;
        uniform sampler2D tHist, tH, tPal; uniform vec2 uAnneau, uEcran; uniform int uTete; uniform float uLarg, uFrac, uBande;
        in float aT, aC, iId; out float vA; out vec3 vC; out float vC2;
        vec4 lit(int i) { return texelFetch(tHist, ivec2(int(iId), (uTete - i + ${LONG * 4}) % ${LONG}), 0); }
        vec3 monte(vec2 p) { return vec3(p.x, max(texture(tH, p / uAnneau).r, 0.0) + 0.3, -p.y); }
        void main() {
          int i = int(aT * ${(LONG - 3).toFixed(1)} + 0.5);
          vec4 z = lit(max(i - 1, 0)), a = lit(i), b = lit(i + 1), c = lit(i + 2);
          vec2 pa = a.xy, pb = b.xy;
          float saut = step(11.0, distance(z.xy, pa)) + step(11.0, distance(pa, pb)) + step(11.0, distance(pb, c.xy)) + step(a.x * b.x, 0.0);
          vec4 ca = projectionMatrix * modelViewMatrix * vec4(monte(pa), 1.0), cb = projectionMatrix * modelViewMatrix * vec4(monte(pb), 1.0);
          vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w, d = (sb - sa) * uEcran;
          vec2 n = length(d) > 1e-4 ? normalize(vec2(-d.y, d.x)) : vec2(0.0, 1.0);
          float q = sin(aT * 3.14159);
          float l = uLarg * (0.35 + 0.65 * q);
          gl_Position = ca;
          if (saut > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vC2 = 0.0; vC = vec3(0.0); return; }
          gl_Position.xy += n * aC * l / uEcran * 2.0 * ca.w;
          gl_Position.z -= 0.00035 * ca.w;
          vC2 = aC;
          vA = saut > 0.5 ? 0.0 : pow(q, 0.7) * smoothstep(0.0, 0.5, length(a.xy - a.zw) * 6.0);
          vC = texture(tPal, vec2(3.5 / 7.0, pa.y / uBande)).rgb;
        }`,
      fragmentShader: /* glsl */`
        precision highp float; uniform float uChaud, uNuit, uForceF; in float vA, vC2; in vec3 vC; out vec4 o;
        void main() {
          float e = 1.0 - abs(vC2);
          vec3 c = mix(vC, vec3(1.0, 0.76, 0.5) * 1.5, uChaud);
          c = mix(c, vec3(0.5, 0.62, 0.86), uNuit * 0.7);
          o = vec4(c, vA * smoothstep(0.0, 0.42, e) * 0.86 * uForceF);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
  }
  niveau(k) { this.mesh.geometry.instanceCount = Math.floor(LARG * k); }
  // Une ligne de plus dans le tableau, toutes les deux images environ.
  maj(dt, l, h, pr) {
    this.acc += dt;
    this.u.uEcran.value.set(l * pr, h * pr); this.u.uLarg.value = 1.15 * Math.max(1, pr);
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    this.tete = (this.tete + 1) % LONG;
    this.uE.tPos.value = this.lignes.gpu.getCurrentRenderTarget(this.lignes.varPos).texture;
    this.uE.uLigne.value = this.tete;
    const r = this.r, ac = r.autoClear; r.autoClear = false;
    r.setRenderTarget(this.hist); r.render(this.sc, this.cam); r.setRenderTarget(null);
    r.autoClear = ac;
    this.u.uTete.value = this.tete;
  }
}
