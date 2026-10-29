// Le Physalis, vaisseau-amiral de l'Escadre Frêle : une nef qui vole bas, cinq mâts, des voiles à lattes grandes
// comme des falaises. Quand elle propose de hisser la Horde à bord, ses cordes descendent jusqu'au sol.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_COMMUN, GLSL_OMBRE } from './communs.js';

const nu = (g) => { const q = g.index ? g.toNonIndexed() : g, a = new THREE.BufferGeometry(); a.setAttribute('position', q.getAttribute('position')); a.setAttribute('normal', q.getAttribute('normal')); return a; };

export class Navire {
  constructor(commun) {
    this.groupe = new THREE.Group(); this.groupe.visible = false;
    this.u = { ...commun, uCorde: { value: 0 } };
    const LON = 230;
    this.echelle = 0.72;

    // La coque, sculptée en sections : un ventre, une étrave qui monte, un pont.
    const secs = 72, tours = 28, pos = [], idx = [];
    for (let i = 0; i <= secs; i++) {
      const t = i / secs, z = (t - 0.5) * LON, l = Math.pow(Math.sin(Math.min(1, t * 1.02) * Math.PI), 0.55) * 21;
      const haut = 13 + 15 * Math.pow(Math.abs(t - 0.5) * 2, 3) + 7 * Math.pow(Math.max(0, 0.5 - t) * 2, 2);
      for (let k = 0; k <= tours; k++) {
        const a = k / tours * Math.PI, cx = -Math.cos(a), cy = Math.sin(a);
        // Un ventre profond au milieu, une quille qui remonte vers l'étrave et la poupe.
        const fond = 26 * Math.pow(Math.sin(t * Math.PI), 0.8) - 10 * Math.abs(t - 0.5);
        const x = l * Math.sign(cx) * Math.pow(Math.abs(cx), 0.72), y = haut - (haut + fond) * Math.pow(cy, 0.8);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < secs; i++) for (let k = 0; k < tours; k++) {
      const a = i * (tours + 1) + k, b = a + tours + 1; idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const coque = new THREE.BufferGeometry();
    coque.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); coque.setIndex(idx); coque.computeVertexNormals();
    const pieces = [nu(coque)];
    pieces.push(nu(new THREE.BoxGeometry(34, 1, 150).translate(0, 13, -4)));
    pieces.push(nu(new THREE.BoxGeometry(26, 15, 40).translate(0, 20, -86)), nu(new THREE.BoxGeometry(20, 9, 24).translate(0, 32, -90)), nu(new THREE.BoxGeometry(22, 8, 22).translate(0, 17, 74)));
    for (let i = 0; i < 26; i++) pieces.push(nu(new THREE.CylinderGeometry(0.34, 0.34, 3, 6).translate(i % 2 ? 16.5 : -16.5, 15, -66 + Math.floor(i / 2) * 11)));
    const mCoque = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: 'varying vec3 vN, vP, vM; void main() { vN = normalize(mat3(modelMatrix) * normal); vP = position; vM = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vN, vP, vM;
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        void main() {
          vec3 n = normalize(vN);
          float b = fract(vP.y * 0.62 + sin(vP.z * 0.02) * 0.5), bord = smoothstep(0.0, 0.06, b) * smoothstep(1.0, 0.94, b);
          float jt = step(0.965, fract(vP.z * 0.07 + floor(vP.y * 0.62) * 0.37));
          vec3 bois = mix(vec3(0.27, 0.19, 0.15), vec3(0.47, 0.34, 0.25), 0.5 + 0.5 * sin(vP.y * 0.62 * 6.283 * 0.5 + 1.0) * cos(vP.z * 0.031));
          bois *= (0.74 + 0.26 * bord) * (1.0 - jt * 0.3);
          bois = mix(bois, vec3(0.2, 0.3, 0.28), smoothstep(-1.0, -5.0, vP.y));          // le cuivre sous la flottaison
          gl_FragColor = vec4(eclairer(bois * bois, n, vM, 0.55, soleilVu(vM, gl_FragCoord.xy), 0.8), 1.0);
        }`,
    });
    const h = new THREE.Mesh(mergeGeometries(pieces), mCoque);
    h.layers.enable(1); h.frustumCulled = false; this.groupe.add(h);

    // Mâts, vergues : le bois qui tient tout ça.
    const bois = [], MATS = [[-72, 96, 58], [-30, 136, 76], [14, 150, 84], [56, 122, 70], [92, 74, 44]];
    for (const [z, H, l] of MATS) {
      bois.push(nu(new THREE.CylinderGeometry(0.8, 1.9, H + 14, 14).translate(0, (H + 14) / 2 + 12, z)));
      for (let k = 0; k < 6; k++) { const y = 26 + (H - 10) * k / 5, q = l * (1 - k * 0.11); bois.push(nu(new THREE.CylinderGeometry(0.34, 0.5, q * 2, 8).rotateZ(Math.PI / 2).translate(0, y, z - 1.6))); }
      bois.push(nu(new THREE.CylinderGeometry(4, 3.2, 2, 14).translate(0, H * 0.72 + 16, z)));
    }
    this.groupe.add(Object.assign(new THREE.Mesh(mergeGeometries(bois), mCoque), { frustumCulled: false }));

    // Les voiles : d'une seule toile, écrue, gonflées, côtelées par leurs lattes. Le jour les traverse.
    const mVoile = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        uniform float uTemps; varying vec2 vUv; varying vec3 vN; varying vec3 vP, vM;
        void main() {
          vUv = uv; vec3 p = position;
          float gon = sin(uv.x * 3.1416) * (0.42 + 0.58 * sin(uv.y * 3.1416));
          float souffle = 11.0 + 1.6 * sin(uTemps * 0.7 + position.x * 0.03 + uv.y * 2.0);
          float pan = sin(uv.y * 31.416) * 0.5 * gon;                     // la toile se creuse entre deux lattes
          p.z -= gon * souffle + pan;
          vec3 d = vec3(cos(uv.x * 3.1416) * 0.72, cos(uv.y * 3.1416) * 0.34 + cos(uv.y * 31.416) * 0.2, 1.0);
          vN = normalize(mat3(modelMatrix) * d); vP = p; vM = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec2 vUv; varying vec3 vN, vP, vM;
        ${GLSL_COMMUN}
        ${GLSL_OMBRE}
        void main() {
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          vec3 toile = mix(vec3(0.86, 0.78, 0.64), vec3(0.72, 0.6, 0.46), smoothstep(0.3, 1.0, vUv.y) * 0.5);
          float couture = smoothstep(0.03, 0.0, abs(fract(vUv.x * 13.0) - 0.5));
          float latte = smoothstep(0.016, 0.0, abs(fract(vUv.y * 5.0) - 0.5));
          vec3 c = toile * toile;
          c *= 1.0 - couture * 0.1;
          c = mix(c, vec3(0.09, 0.05, 0.026), latte * 0.85);
          c *= 0.92 + 0.08 * sin(vUv.y * 90.0);
          vec3 fin = eclairer(c, n, vM, 0.9, soleilVu(vM, gl_FragCoord.xy), 0.9);
          fin += c * uSoleilCol * max(dot(-n, uSoleil), 0.0) * 0.46 * (1.0 - tempeteA(-vM.z));      // la toile laisse passer le jour
          gl_FragColor = vec4(fin, 1.0);
        }`,
    });
    const voiles = [];
    for (const [z, H, l] of MATS) {
      const g = new THREE.PlaneGeometry(l * 2, H - 10, 40, 40), p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) + (H - 10) / 2) / (H - 10);
        p.setX(i, p.getX(i) * (1 - 0.48 * t));     // plus étroites en haut, comme une aile
        p.setY(i, p.getY(i) + (H - 10) / 2 + 26 + 8 * Math.abs(p.getX(i) / l) * Math.abs(p.getX(i) / l));
      }
      const q = nu(g.translate(0, 0, z - 2.4));
      const u = g.index ? g.toNonIndexed().getAttribute('uv') : g.getAttribute('uv');
      q.setAttribute('uv', u);
      voiles.push(q);
    }
    const v = new THREE.Mesh(mergeGeometries(voiles), mVoile);
    v.frustumCulled = false; v.layers.enable(1); this.groupe.add(v);

    // Les haubans.
    const fil = [];
    for (const [z, H] of MATS) for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
      fil.push(0.4 * s, H + 20 - k * 3, z, s * 19, 14, z - 22 + k * 7, 0.4 * s, H + 20 - k * 3, z, s * 19, 14, z + 22 - k * 7);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(fil, 3));
    const lignes = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x241c18 }));
    lignes.frustumCulled = false; this.groupe.add(lignes);

    // Les cordes : roulées sous la coque, elles se déroulent à la demande.
    const c = new THREE.CylinderGeometry(1, 1, 1, 6, 40, true).translate(0, -0.5, 0), g = new THREE.InstancedBufferGeometry();
    g.index = c.index; g.setAttribute('position', c.attributes.position); g.setAttribute('normal', c.attributes.normal);
    const n = 22, b = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1; b.set([s * 17, -66 + Math.floor(i / 2) * 13, i * 2.17], i * 3); }
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 3)); g.instanceCount = n;
    this.cordes = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`
        uniform float uTemps, uCorde; attribute vec3 iB; varying float vT; varying vec3 vN;
        void main() {
          float t = -position.y;                                    // 0 à la coque, 1 au bout
          float ray = 0.42 * (1.0 + 2.2 * smoothstep(0.965, 1.0, t)) * step(0.001, uCorde);
          vec3 p = vec3(position.x * ray, 0.0, position.z * ray);
          float y = -3.0 - t * uCorde;
          // Le vent les couche un peu, et le bas balance.
          float bal = t * t * (2.0 + uCorde * 0.04);
          p.x += iB.x + sin(uTemps * 0.9 + iB.z + t * 3.0) * bal * 0.6;
          p.z += iB.y + t * uCorde * 0.14 + cos(uTemps * 0.7 + iB.z * 1.7 + t * 2.0) * bal * 0.5;
          p.y = y;
          vT = t * uCorde; vN = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float; varying float vT; varying vec3 vN;
        ${GLSL_COMMUN}
        void main() {
          float tresse = 0.8 + 0.2 * sin(vT * 7.0 + atan(vN.z, vN.x) * 2.0), noeud = step(0.92, fract(vT / 6.0));
          vec3 n = normalize(vN), c = vec3(0.25, 0.16, 0.08) * tresse * (1.0 + noeud * 0.3);
          gl_FragColor = vec4(c * (uSoleilCol * max(dot(n, uSoleil), 0.0) + cielDiffus(n)), 1.0);
        }`,
    }));
    this.cordes.frustumCulled = false; this.groupe.add(this.cordes);
    this.groupe.scale.setScalar(this.echelle);
    this.groupe.renderOrder = 8;
  }
  // longueur en unités du monde, de la coque au sol.
  corde(l) { this.u.uCorde.value = l / this.echelle; }
  poser(x, y, s, cap, temps) {
    this.groupe.position.set(x, y, -s);
    this.groupe.rotation.set(0.012 * Math.sin(temps * 0.4), cap, 0.012 * Math.sin(temps * 0.31));
  }
}
