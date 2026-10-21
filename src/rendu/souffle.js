// Le souffle à hauteur de Horde : des dizaines de milliers de grains dans une boîte autour de la caméra.
// Ils suivent le vent réel du jeu, mêlé d'un écoulement (Flow Field Gallery), et se dessinent en traits
// le long de leur vitesse. De près, ils sont gros et flous : c'est ce qui fait l'air.
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { GLSL_VENT } from './communs.js';

const BOITE = new THREE.Vector3(170, 46, 240);

export class Souffle {
  constructor(renderer, lignes, tH, { cote = 230 } = {}) {
    this.cote = cote;
    const gpu = new GPUComputationRenderer(cote, cote, renderer);
    const dep = gpu.createTexture(), d = dep.image.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = Math.random();
      d.set([Math.random() * BOITE.x, 0.25 + r * r * BOITE.y, Math.random() * BOITE.z, Math.random()], i);
    }
    const v = gpu.addVariable('tGrain', /* glsl */`
      uniform float uTemps, uDt, uChute;
      uniform vec2 uCentre; uniform vec3 uBoite;
      ${GLSL_VENT}
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 e = texture2D(tGrain, uv);                       // x, altitude, s, graine
        vec2 p = e.xz;
        vec2 w = ventIci(p);
        // L'écoulement : trois sinus emboîtés, assez pour que les grains tournent entre eux.
        vec2 q = p * 0.05 + vec2(sin(p.y * 0.07 + uTemps * 0.3), cos(p.x * 0.06 - uTemps * 0.23)) * 1.3;
        vec2 fl = vec2(sin(q.y * 1.7 + uTemps * 0.5 + e.w * 6.0), cos(q.x * 1.9 - uTemps * 0.4));
        p += (w * (20.0 + 12.0 * e.w) + fl * 2.2) * uDt;
        float y = e.y + (sin(p.x * 0.11 + p.y * 0.09 + uTemps * 0.7 + e.w * 9.0) * 1.1 - uChute * (1.0 + e.w * 2.0)) * uDt;
        if (y < 0.2) y += uBoite.y * (0.3 + 0.7 * e.w);
        if (y > uBoite.y) y = 0.3;
        // La boîte suit la caméra : ce qui sort d'un côté rentre de l'autre.
        vec2 b = uBoite.xz, o = uCentre - b * 0.5;
        p = mod(p - o, b) + o;
        gl_FragColor = vec4(p.x, y, p.y, e.w);
      }`, dep);
    gpu.setVariableDependencies(v, [v]);
    Object.assign(v.material.uniforms, lignes.commun, {
      uTemps: { value: 0 }, uDt: { value: 1 / 60 }, uChute: { value: 0 },
      uCentre: { value: new THREE.Vector2() }, uBoite: { value: BOITE },
    });
    const err = gpu.init();
    if (err) throw new Error(err);
    this.gpu = gpu; this.v = v; this.uS = v.material.uniforms;

    const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    const refs = new Float32Array(cote * cote * 2);
    for (let j = 0, k = 0; j < cote; j++) for (let i = 0; i < cote; i++) { refs[k++] = (i + 0.5) / cote; refs[k++] = (j + 0.5) / cote; }
    g.setAttribute('aRef', new THREE.InstancedBufferAttribute(refs, 2));
    g.instanceCount = cote * cote;
    this.u = {
      ...lignes.commun, tGrain: { value: null }, tH: { value: tH },
      uRegard: { value: 0 }, uTaille: { value: 1 }, uLong: { value: 0.6 }, uCouleur: { value: new THREE.Color(1, 1, 1) }, uAsp: { value: 1 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, depthTest: true,
      vertexShader: /* glsl */`
        uniform sampler2D tGrain, tH; uniform float uRegard, uTaille, uLong, uAsp;
        attribute vec2 aRef; varying vec2 vQ; varying float vA;
        ${GLSL_VENT}
        void main() {
          vec4 e = texture2D(tGrain, aRef);
          vec2 p = e.xz; float id = e.w;
          float h = max(texture2D(tH, p / uAnneau).r, 0.0);
          vec3 w0 = vec3(p.x, h + e.y, -p.y);
          vec2 w = ventIci(p);
          // Un grain sur sept est un long filet de soie ; les autres, des points d'air presque ronds.
          float filet = step(0.857, fract(id * 17.3));
          float lon = mix(0.012 + uLong * 0.03, 0.8 + uLong * 3.2, filet);
          vec4 a = modelViewMatrix * vec4(w0, 1.0);
          vec4 b = modelViewMatrix * vec4(w0 + vec3(w.x, 0.0, -w.y) * lon * 2.0, 1.0);
          vec4 ca = projectionMatrix * a, cb = projectionMatrix * b;
          vec2 sa = ca.xy / max(ca.w, 0.01), sb = cb.xy / max(cb.w, 0.01);
          float prof = -a.z;
          // La taille à l'écran : gros et flou tout près, fin au loin.
          float t = uTaille * mix(0.0011, 0.0034, id * id) * (1.0 + 14.0 / max(prof, 2.0)) * mix(1.0, 0.34, filet);
          vec2 d = (sb - sa) * vec2(uAsp, 1.0), n = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
          vec2 cote = vec2(-n.y, n.x);
          vec2 q = position.xy * 2.0;
          vec2 off = (cote * q.y * t + n * q.x * t) / vec2(uAsp, 1.0);
          vec2 s = mix(sa, sb, position.x + 0.5) + off;
          vQ = q;
          vA = (0.2 + 0.5 * id) * smoothstep(2.0, 12.0, prof) * (1.0 - smoothstep(110.0, 210.0, prof)) * uRegard * mix(0.8, 0.5, filet);
          gl_Position = vec4(s * ca.w, ca.z, ca.w);
          if (ca.w < 0.5 || cb.w < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCouleur; varying vec2 vQ; varying float vA;
        void main() { float d = abs(vQ.y); gl_FragColor = vec4(uCouleur, vA * smoothstep(1.0, 0.1, d) * smoothstep(1.0, 0.72, abs(vQ.x))); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; this.mesh.visible = false;
  }
  regler(air, couleur) {
    this.u.uTaille.value = air.taille; this.u.uLong.value = air.long; this.uS.uChute.value = air.chute * 3;
    this.u.uCouleur.value.copy(couleur);
    this.mesh.material.blending = air.vif ? THREE.AdditiveBlending : THREE.NormalBlending;
  }
  maj(dt, temps, x, s, regard, asp) {
    this.mesh.visible = regard > 0.02;
    if (!this.mesh.visible) return;
    const u = this.uS; u.uTemps.value = temps; u.uDt.value = dt; u.uCentre.value.set(x, s);
    this.gpu.compute();
    this.u.tGrain.value = this.gpu.getCurrentRenderTarget(this.v).texture;
    this.u.uRegard.value = regard; this.u.uAsp.value = asp;
  }
}
