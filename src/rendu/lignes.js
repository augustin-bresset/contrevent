// Les lignes de courant. Les particules suivent le vent réel du jeu, dans une fenêtre autour de la Horde ;
// leurs traits s'accumulent dans une cible de persistance posée sur le monde, que le terrain lit ensuite.
// D'après la brique 5 (Symphony of Vines, chapitre 2 ; Flow Field Gallery pour les particules).
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { GLSL_VENT, GLSL_ECRAN_VERT, NB_REMOUS } from './communs.js';

export const FENETRE = 620;   // côté de la fenêtre, en unités du monde
const NB_PAS = 23;

export class Lignes {
  constructor(renderer, tVent, uAnneau, { cote = 180, res = 2048 } = {}) {
    this.renderer = renderer; this.cote = cote; this.res = res;
    this.commun = {
      tVent: { value: tVent }, uAnneau: { value: uAnneau },
      uRemous: { value: Array.from({ length: NB_REMOUS }, () => new THREE.Vector4()) },
      uFront: { value: new THREE.Vector3(-1e6, -1e6, 1) },
      uNavire: { value: new THREE.Vector4() },
      uRespir: { value: 1 },
    };
    this.centre = new THREE.Vector2();
    this.prec = new THREE.Vector2();

    const gpu = new GPUComputationRenderer(cote, cote, renderer);
    const depart = gpu.createTexture();
    for (let i = 0; i < depart.image.data.length; i += 4) depart.image.data.set([0, 0, 0, 0], i);
    const v = gpu.addVariable('tPos', /* glsl */`
      uniform float uTemps, uDt, uVitesse, uFenetre;
      uniform vec2 uCentre, uHorde;
      uniform float uHordeR, uEtale, uNbFilets;
      ${GLSL_VENT}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 e = texture2D(tPos, uv);
        float id = hash(uv), duree = mix(2.2, 6.5, hash(uv + 0.37));
        float ph0 = (uTemps - uDt) / duree + id, ph1 = uTemps / duree + id;
        vec2 w = ventIci(e.xy);
        // La Horde est un obstacle : le vent s'ouvre devant elle, file serré sur ses flancs, et tourbillonne dans son dos.
        vec2 wh = ventIci(uHorde); float vh = length(wh);
        vec2 U = vh > 1e-3 ? wh / vh : vec2(0.0, -1.0), N = vec2(-U.y, U.x);
        vec2 dh = e.xy - uHorde; float r2 = max(dot(dh, dh), 1e-4), a2 = uHordeR * uHordeR;
        vec2 rh = dh * inversesqrt(r2);
        // L'écoulement autour d'un cylindre, qui s'efface au loin ; dedans, on est poussé dehors.
        float k = a2 / max(r2, a2 * 0.8) * exp(-r2 / (a2 * 16.0));
        w += (w - 2.0 * dot(w, rh) * rh) * k;
        if (r2 < a2) w += rh * vh * (1.0 - r2 / a2) * 1.5;
        // Le sillage : le vent y tombe, et se met à battre d'un flanc à l'autre.
        float lon = dot(dh, U), lat = dot(dh, N);
        if (lon > 0.0) {
          float sil = exp(-lat * lat / (a2 * 1.6)) * exp(-lon / (uHordeR * 7.0)) * smoothstep(0.0, uHordeR, lon);
          w = w * (1.0 - 0.55 * sil) + N * vh * 0.75 * sil * sin(lon / uHordeR * 1.4 - uTemps * 2.6);
        }
        vec2 p = e.xy + w * uVitesse * uDt;
        // Le furvent déborde la fenêtre : les filets s'y sèment jusqu'à perte de vue, serrés près de la Horde, là où l'œil les voit de près.
        float F = uFenetre * (1.0 + uEtale * 3.2);
        vec2 rel = (p - uCentre) / F;
        bool sortie = abs(rel.x) > 0.5 || abs(rel.y) > 0.5;
        if (floor(ph1) != floor(ph0) || sortie || e.x == 0.0) {
          float c = floor(ph1);
          vec2 q = vec2(hash(uv + c * 0.071), hash(uv.yx + c * 0.113)) * 2.0 - 1.0;
          p = uCentre + sign(q) * pow(abs(q), vec2(1.0 + uEtale * 1.1)) * 0.5 * F;
          // Une part des filets visibles naît en amont de la Horde, dans une large bande : ils arrivent sur elle de loin,
          // et la densité monte doucement à son approche, sans que rien ne surgisse devant elle.
          float idx = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
          if (idx < uNbFilets && hash(uv + c * 0.029) < 0.18)
            p = uHorde - U * (uHordeR * 2.0 + 20.0 + 150.0 * abs(q.x)) + N * q.y * (uHordeR * 3.0 + 25.0 + 40.0 * abs(q.x));
          gl_FragColor = vec4(p, p);
        } else gl_FragColor = vec4(p, e.xy);
      }`, depart);
    gpu.setVariableDependencies(v, [v]);
    Object.assign(v.material.uniforms, this.commun, {
      uTemps: { value: 0 }, uDt: { value: 1 / 60 }, uVitesse: { value: 26 }, uFenetre: { value: FENETRE },
      uCentre: { value: this.centre }, uHorde: { value: new THREE.Vector2() }, uHordeR: { value: 8 }, uEtale: { value: 0 }, uNbFilets: { value: 3600 },
    });
    const err = gpu.init();
    if (err) throw new Error(err);
    this.gpu = gpu; this.varPos = v; this.uSim = v.material.uniforms;

    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.cibles = [new THREE.WebGLRenderTarget(res, res, opts), new THREE.WebGLRenderTarget(res, res, opts)];
    this.courante = 0;

    this.sceneT = new THREE.Scene(); this.camT = new THREE.Camera();
    this.uFondu = { tPrec: { value: null }, uGarde: { value: 0.98 }, uGardeP: { value: 0.999 }, uDecal: { value: new THREE.Vector2() } };
    const fondu = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uFondu, depthTest: false, depthWrite: false, vertexShader: GLSL_ECRAN_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tPrec; uniform float uGarde, uGardeP; uniform vec2 uDecal; varying vec2 vUv;
        void main() {
          vec2 uv = vUv + uDecal;
          vec2 b = step(vec2(0.0), uv) * step(uv, vec2(1.0));
          vec4 c = texture2D(tPrec, uv);
          gl_FragColor = vec4(c.rgb * uGarde, c.a * uGardeP) * b.x * b.y;
        }`,
    }));
    fondu.frustumCulled = false; fondu.renderOrder = 0;

    const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position);
    const refs = new Float32Array(cote * cote * 2);
    for (let j = 0, k = 0; j < cote; j++) for (let i = 0; i < cote; i++) { refs[k++] = (i + 0.5) / cote; refs[k++] = (j + 0.5) / cote; }
    geo.setAttribute('aRef', new THREE.InstancedBufferAttribute(refs, 2));
    geo.instanceCount = cote * cote;
    this.uTraits = {
      tPos: { value: null }, uCentre: { value: this.centre }, uFenetre: { value: FENETRE }, uPx: { value: 1 / res },
      uIntensite: { value: 0.1 }, uLarg: { value: 1.5 },
    };
    const traits = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uTraits, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      vertexShader: /* glsl */`
        uniform sampler2D tPos; uniform vec2 uCentre; uniform float uFenetre, uPx, uLarg;
        attribute vec2 aRef; varying float vVit, vTravers, vRare;
        void main() {
          vec4 e = texture2D(tPos, aRef);
          // De jour, seul un filet sur douze se voit ; le furvent les allume tous.
          vRare = step(fract(sin(dot(aRef, vec2(12.9898, 78.233))) * 43758.5453), 0.085);
          vec2 p = (e.xy - uCentre) / uFenetre, q = (e.zw - uCentre) / uFenetre, dir = p - q;
          float v = length(dir);
          vec2 t = v > 1e-7 ? dir / v : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
          float larg = uLarg * uPx * (0.75 + clamp(v * 800.0, 0.0, 1.0));
          vec2 pos = mix(q, p, position.x + 0.5) + t * position.x * larg + n * position.y * larg;
          vVit = v * 300.0; vTravers = position.y * 2.0;
          gl_Position = vec4((pos + 0.5) * 2.0 - 1.0, 0.0, v > 0.0 && v < 0.03 ? 1.0 : 0.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uIntensite; varying float vVit, vTravers, vRare;
        void main() {
          float a = uIntensite * (1.0 - vTravers * vTravers);
          gl_FragColor = vec4(a, 0.0, vVit * a, 0.0);
        }`,
    }));
    traits.frustumCulled = false; traits.renderOrder = 1;
    this.sceneT.add(fondu, traits);

    // Les pas : un point par corps, écrit dans le seul canal alpha de la même cible.
    const pg = new THREE.InstancedBufferGeometry();
    pg.index = base.index; pg.setAttribute('position', base.attributes.position);
    this.iPas = new THREE.InstancedBufferAttribute(new Float32Array(NB_PAS * 3), 3); this.iPas.setUsage(THREE.DynamicDrawUsage);
    pg.setAttribute('iPas', this.iPas); pg.instanceCount = NB_PAS;
    const pas = new THREE.Mesh(pg, new THREE.ShaderMaterial({
      uniforms: { uCentre: { value: this.centre }, uFenetre: { value: FENETRE } }, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      vertexShader: /* glsl */`
        uniform vec2 uCentre; uniform float uFenetre; attribute vec3 iPas; varying vec2 vQ; varying float vF;
        void main() {
          vQ = position.xy * 2.0; vF = iPas.z;
          vec2 p = (iPas.xy - uCentre) / uFenetre + position.xy * 0.34 / uFenetre;
          gl_Position = vec4((p + 0.5) * 2.0 - 1.0, 0.0, iPas.z > 0.0 ? 1.0 : 0.0);
        }`,
      fragmentShader: `varying vec2 vQ; varying float vF; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, vF * smoothstep(1.0, 0.1, length(vQ))); }`,
    }));
    pas.frustumCulled = false; pas.renderOrder = 2;
    this.sceneT.add(pas);
    this.vider();
  }

  // Un pas de chaque corps, pour cette image. force 0 : rien.
  poserPas(membres) {
    const a = this.iPas.array;
    for (let i = 0; i < NB_PAS; i++) {
      const m = membres[i], s = Math.sin(m.marche), f = m.vivant && m.amp > 0.2 && Math.abs(s) > 0.92 ? 0.3 : 0;
      const c = Math.cos(m.cap), d = s > 0 ? 0.14 : -0.14;
      a[i * 3] = m.x + c * d; a[i * 3 + 1] = m.s - Math.sin(m.cap) * d; a[i * 3 + 2] = f;
    }
    this.iPas.needsUpdate = true;
  }

  vider() {
    const r = this.renderer;
    for (const t of this.cibles) { r.setRenderTarget(t); r.setClearColor(0x000000, 1); r.clear(); }
    r.setRenderTarget(null);
  }

  get texture() { return this.cibles[this.courante].texture; }

  maj(dt, temps, x, s, hx = x, hs = s) {
    // La fenêtre avance par multiples de texel : les lignes déjà tracées ne bavent pas.
    const pasT = FENETRE / this.res;
    this.prec.copy(this.centre);
    this.centre.set(Math.round(x / pasT) * pasT, Math.round(s / pasT) * pasT);
    this.uFondu.uDecal.value.set((this.centre.x - this.prec.x) / FENETRE, (this.centre.y - this.prec.y) / FENETRE);

    const u = this.uSim;
    u.uTemps.value = temps; u.uDt.value = dt; u.uHorde.value.set(hx, hs);
    this.gpu.compute();
    this.uTraits.tPos.value = this.gpu.getCurrentRenderTarget(this.varPos).texture;

    const keep = Math.exp(-dt * 0.8);
    this.uFondu.uGarde.value = keep;
    this.uFondu.uGardeP.value = Math.exp(-dt * 0.055);
    this.uTraits.uIntensite.value = 0.05 * Math.min(1.6, dt * 60);
    const r = this.renderer, a = this.cibles[this.courante], b = this.cibles[1 - this.courante];
    this.uFondu.tPrec.value = a.texture;
    r.setRenderTarget(b); r.render(this.sceneT, this.camT); r.setRenderTarget(null);
    this.courante = 1 - this.courante;
  }
}
