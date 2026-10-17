// Le titre : un vrai tracé, net à toute taille, que le vent ronge par un shader de dissolution ;
// la poussière ne se voit que sur le bord qui se défait (Flow Field Gallery).
import * as THREE from 'three';

export class Titre {
  constructor(renderer, tBruit) {
    this.r = renderer; this.scene = new THREE.Scene(); this.cam = new THREE.Camera(); this.actif = true;
    this.u = {
      tMot: { value: null }, tBruit: { value: tBruit }, uT: { value: 0 }, uSouffle: { value: 0 }, uTemps: { value: 0 }, uPx: { value: 1 }, uAsp: { value: 1 }, uEchX: { value: 0.74 },
    };
  }
  async composer() {
    await document.fonts.load('200 200px Spectral');
    const W = 2800, H = 840, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff';
    x.font = '200 440px Spectral'; x.textAlign = 'center'; x.textBaseline = 'middle';
    try { x.letterSpacing = '10px'; } catch { /* pas partout */ }
    x.fillText('Contrevent', W / 2, H / 2);
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
    this.u.tMot.value = t;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tMot, tBruit; uniform float uT, uSouffle, uTemps, uAsp, uEchX; varying vec2 vP;
        float fbm(vec2 p) { return 0.55 * texture2D(tBruit, p / 256.0).r + 0.3 * texture2D(tBruit, (p * 2.1 + 3.1) / 256.0).g + 0.15 * texture2D(tBruit, (p * 4.3 + 7.7) / 256.0).b; }
        void main() {
          vec2 p = vec2(vP.x / uEchX, (vP.y - 0.33) / uEchX / uAsp * ${(2800 / 840).toFixed(4)}) * 0.5 + 0.5;
          // L'air tremble sur le mot, à peine.
          p += vec2(sin(p.y * 22.0 + uTemps * 1.1), cos(p.x * 17.0 + uTemps * 0.8)) * 0.0011;
          float n = fbm(p * vec2(26.0, 9.0) + vec2(uTemps * 0.1, 0.0));
          // Il se forme de l'amont (la droite), et s'en va vers l'aval (la gauche et le bas).
          float vient = smoothstep(0.0, 0.1, uT * 0.42 - (1.0 - p.x) * 0.8 - n * 0.3);
          float part = (1.0 - p.x) * 0.6 + (1.0 - p.y) * 0.2 + n * 0.55;
          float seuil = uSouffle * 1.5 - 0.1;
          float garde = uSouffle > 0.0 ? 1.0 - smoothstep(part - 0.03, part + 0.03, seuil) : 1.0;
          float a = texture2D(tMot, p).r * step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
          float halo = texture2D(tMot, p, 3.6).r + 0.6 * texture2D(tMot, p, 5.2).r;
          // Le bord qui se défait brûle un instant.
          float bord = uSouffle > 0.0 ? smoothstep(0.1, 0.0, abs(part - seuil)) : 0.0;
          vec3 c = mix(vec3(0.99, 0.99, 1.0), vec3(1.5, 0.96, 0.62), bord);
          float balayage = smoothstep(0.1, 0.0, abs(p.x - fract(uTemps * 0.09) * 1.6 + 0.3));
          c += balayage * 0.12;
          float al = a * vient * garde;
          float ombre = clamp(halo * 0.42, 0.0, 0.5) * vient * garde;
          gl_FragColor = vec4(mix(vec3(0.05, 0.1, 0.17), c, step(0.001, al) * smoothstep(0.0, 1.0, al / max(al + ombre * (1.0 - al), 1e-3))), al + ombre * (1.0 - al));
        }`,
    }));
    quad.frustumCulled = false; this.scene.add(quad);

    // Les grains arrachés au bord : on ne les voit qu'en vol.
    const d = x.getImageData(0, 0, W, H).data, pts = [];
    for (let k = 0; k < 90000 && pts.length < 90000; k++) {
      const i = Math.floor(Math.random() * W), j = Math.floor(Math.random() * H);
      if (d[(j * W + i) * 4] > 120) pts.push((i / W - 0.5) * 2, (0.5 - j / H) * 2, Math.random());
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
        uniform float uSouffle, uTemps, uPx, uAsp, uEchX; varying float vA;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec2 q = position.xy; float id = position.z;
          vec2 p = vec2(q.x * uEchX, q.y * uEchX * uAsp / ${(2800 / 840).toFixed(4)} + 0.33);
          float ret = (1.0 - (q.x * 0.5 + 0.5)) * 0.6 + id * 0.3;
          float t = clamp(uSouffle * 1.5 - ret, 0.0, 1.0);
          float tt = t * t;
          p += tt * vec2(-0.5 - 1.1 * h(id * 7.1), -0.9 - 1.5 * h(id * 3.3));
          p.x += sin(t * 9.0 + id * 30.0) * tt * 0.2; p.y += cos(t * 7.0 + id * 21.0) * tt * 0.12;
          vA = t > 0.0 && t < 1.0 ? (1.0 - t) * min(1.0, t * 14.0) : 0.0;
          gl_Position = vec4(p, 0.0, 1.0);
          gl_PointSize = uPx * (1.1 + id * 1.9);
        }`,
      fragmentShader: 'varying float vA; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(1.0, 0.95, 0.86, vA * smoothstep(1.0, 0.2, d)); }',
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 2;
    this.scene.add(this.points);
  }
  rendre(temps, dt) {
    if (!this.actif || !this.points) return;
    const u = this.u; u.uTemps.value = temps; u.uT.value += dt;
    u.uEchX.value = u.uAsp.value < 1 ? 0.92 : 0.66;
    this.r.autoClear = false;
    this.r.setRenderTarget(null); this.r.render(this.scene, this.cam);
    this.r.autoClear = true;
    if (u.uSouffle.value >= 1) { this.actif = false; this.scene.clear(); }
  }
}
