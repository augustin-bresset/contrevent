// Les corps : capuche, cape, sac, bâton, deux jambes. Chacun sa teinte.
// La marche vient du chemin parcouru (jeu/horde.js) : rien ne sautille.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const dyn = (n, t) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * t), t); a.setUsage(THREE.DynamicDrawUsage); return a; };

// L'avant est -Z, comme ailleurs dans three.
function corps() {
  const part = (g, i) => {
    const q = g.index ? g.toNonIndexed() : g;
    q.deleteAttribute('uv');
    q.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(q.getAttribute('position').count).fill(i), 1));
    return q;
  };
  const robe = new THREE.LatheGeometry([[0.03, 1.74], [0.17, 1.72], [0.235, 1.6], [0.26, 1.34], [0.3, 1.06], [0.37, 0.8], [0.445, 0.56], [0.46, 0.5]].reverse().map(([a, b]) => new THREE.Vector2(a, b)), 26, 0, 6.2832);
  const pr = robe.getAttribute('position');
  // Les plis : la robe se creuse en descendant, surtout à l'ourlet.
  for (let i = 0; i < pr.count; i++) {
    const x = pr.getX(i), y = pr.getY(i), z = pr.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 9) * (1.5 - y) + 0.03 * Math.sin(a * 17 + 1);
    pr.setXYZ(i, x * k, y, z * k);
  }
  robe.computeVertexNormals();
  // Un capuchon de marcheur : bas, souple, tombant sur les épaules, la pointe molle rabattue sur la nuque.
  const capuche = new THREE.LatheGeometry([[0.004, 2.1], [0.09, 2.09], [0.17, 2.04], [0.225, 1.95], [0.25, 1.84], [0.25, 1.74], [0.29, 1.66], [0.37, 1.58], [0.4, 1.5]].reverse().map(([a, b]) => new THREE.Vector2(a, b)), 26);
  const pc = capuche.getAttribute('position');
  for (let i = 0; i < pc.count; i++) {
    const x = pc.getX(i), y = pc.getY(i), z = pc.getZ(i), u = Math.max(0, y - 1.78);
    const dos = Math.max(0, z / 0.25);
    pc.setXYZ(i, x * (1 + 0.05 * Math.sin(y * 16)), y - dos * u * 0.34, z * 1.1 + dos * u * 0.72 - 0.03 * (1 - dos));
  }
  capuche.computeVertexNormals();
  const sac = new THREE.SphereGeometry(0.22, 16, 12).scale(0.8, 1.15, 0.4).translate(0, 1.22, 0.2);
  return mergeGeometries([
    part(robe, 0),
    part(capuche, 0),
    part(new THREE.SphereGeometry(0.12, 12, 10).scale(1, 1.2, 0.4).translate(0, 1.84, -0.235), 1),       // le creux d'ombre, où l'on ne voit personne
    part(new THREE.CapsuleGeometry(0.1, 0.56, 4, 12).translate(-0.15, 0.4, 0), 2),
    part(new THREE.CapsuleGeometry(0.1, 0.56, 4, 12).translate(0.15, 0.4, 0), 3),
    part(sac, 4),
    part(new THREE.CylinderGeometry(0.03, 0.035, 2.5, 8).translate(0.44, 1.25, -0.16), 5),             // le bâton
  ]);
}

const VERT_CORPS = /* glsl */`
attribute vec4 iPos, iVent; attribute vec3 iCol, iMarche; attribute float aPart;
uniform float uEch, uTemps; varying vec3 vN, vC; varying float vPart, vA;
void main() {
  vec3 p = position; vec3 n = normal;
  float ph = iMarche.y, am = iMarche.z;
  if (aPart > 1.5 && aPart < 3.5) {               // les jambes pivotent à la hanche
    float a = sin(ph) * (aPart < 2.5 ? 1.0 : -1.0) * am * 0.6, d = 0.82 - p.y;
    p.z += sin(a) * d; p.y = 0.82 - cos(a) * d * mix(1.0, 0.94, abs(sin(ph)));
  } else {                                         // le haut balance à peine
    p.y += sin(ph * 2.0) * 0.022 * am;
    p.x += sin(ph) * 0.03 * am * p.y;
    if (aPart > 4.5) p.z += sin(ph) * 0.2 * am * (1.0 - p.y / 2.5);
  }
  float c = cos(iMarche.x), s = sin(iMarche.x);
  p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
  n = vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);
  p.xz -= vec2(iVent.x, iVent.y) * p.y * clamp(iVent.z * 0.2, 0.0, 0.42);
  p *= uEch;
  vN = n; vC = iCol; vPart = aPart; vA = iPos.w;
  vec4 pos = vec4(p * iPos.w + iPos.xyz, 1.0);
  #ifdef MIROIR
    pos.y = iPos.y - (pos.y - iPos.y);
    vec4 clip = projectionMatrix * modelViewMatrix * pos;
    vec4 sol = projectionMatrix * modelViewMatrix * vec4(pos.x, 0.03, pos.z, 1.0);
    clip.z = sol.z / sol.w * clip.w;             // à la profondeur de l'eau : devant le fond, derrière les corps
    gl_Position = clip;
  #else
    gl_Position = projectionMatrix * modelViewMatrix * pos;
  #endif
}`;
const FRAG_CORPS = /* glsl */`
uniform float uCharge, uNuit; varying vec3 vN, vC; varying float vPart, vA;
void main() {
  float l = clamp(dot(normalize(vN), normalize(vec3(-0.55, 0.62, 0.42))), 0.0, 1.0);
  vec3 c = vC;
  if (vPart > 0.5 && vPart < 1.5) c = vec3(0.03, 0.03, 0.04);
  else if (vPart > 1.5 && vPart < 3.5) c = vC * 0.42 + vec3(0.04);
  else if (vPart > 3.5 && vPart < 4.5) c = mix(vec3(0.3, 0.25, 0.21), vC * 0.6, 0.55);
  else if (vPart > 4.5) c = vec3(0.26, 0.21, 0.16);
  c = mix(c, vec3(dot(c, vec3(0.33))), 0.16);    // des teintes de laine : jamais franches
  float dessus = 0.5 + 0.5 * normalize(vN).y;
  c *= mix(vec3(0.5, 0.54, 0.62), vec3(0.78), dessus) + vec3(0.52, 0.49, 0.43) * l;
  c = mix(c, c * 1.5 + vec3(0.2, 0.08, 0.02), uCharge * 0.8);
  c = mix(c, mix(c * 0.5, vec3(0.2, 0.26, 0.4), 0.4), uNuit * (1.0 - uCharge * 0.8));
  #ifdef MIROIR
    gl_FragColor = vec4(c, 0.42 * step(0.5, vA));
  #else
    gl_FragColor = vec4(c, 1.0);
  #endif
}`;
const VERT_CAPE = /* glsl */`
attribute vec4 iPos, iVent; attribute vec3 iCol; attribute vec3 iMarche; attribute vec2 iStyle;
uniform float uEch, uTemps; varying float vT, vW2; varying vec3 vC, vP;
void main() {
  float t = 0.5 - position.y, w = position.x;
  vec3 dir = normalize(vec3(iVent.x, 0.0, iVent.y)), up = vec3(0.0, 1.0, 0.0), cote = cross(dir, up);
  float f = clamp(iVent.z, 0.0, 2.5), lon = (0.75 + f * 0.75) * iStyle.y;
  float vag = sin(t * 5.0 - uTemps * (3.0 + f * 3.0) + iMarche.y * 0.3) * t * (0.07 + f * 0.13);
  float tomb = (1.0 - clamp(f * 0.8, 0.0, 1.0)) * 0.9;
  // Attachée aux épaules, elle s'arrondit sur le dos, puis s'ouvre dans le vent.
  float plis = sin(w * 18.0 + t * 3.0 + iMarche.y * 0.2) * 0.05 * t;
  vec3 p = vec3(0.0, 1.66, 0.0) + dir * (t * lon + (0.2 - w * w * 0.7) + plis) + cote * (w * 0.74 * (1.0 + 0.3 * t * f) + vag) + up * (vag * 0.4 - tomb * t - t * 0.34);
  p *= uEch; vT = t; vC = iCol; vW2 = w; vP = p;
  vec4 pos = vec4(p * iPos.w + iPos.xyz, 1.0);
  #ifdef MIROIR
    pos.y = iPos.y - (pos.y - iPos.y);
    vec4 clip = projectionMatrix * modelViewMatrix * pos;
    vec4 sol = projectionMatrix * modelViewMatrix * vec4(pos.x, 0.03, pos.z, 1.0);
    clip.z = sol.z / sol.w * clip.w;
    gl_Position = clip;
  #else
    gl_Position = projectionMatrix * modelViewMatrix * pos;
  #endif
}`;
const FRAG_CAPE = /* glsl */`
uniform float uCharge, uNuit; varying float vT, vW2; varying vec3 vC, vP;
void main() {
  vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
  if (n.y < 0.0) n = -n;
  float l = clamp(dot(n, normalize(vec3(-0.62, 0.47, 0.5))), 0.0, 1.0);
  vec3 c = mix(vC, vec3(dot(vC, vec3(0.33))), 0.16) * (0.66 + 0.62 * l) * (1.0 - 0.18 * vT);
  c = mix(c, c * 1.5 + vec3(0.22, 0.09, 0.02), uCharge * 0.8);
  c = mix(c, mix(c * 0.5, vec3(0.2, 0.26, 0.4), 0.4), uNuit * (1.0 - uCharge * 0.8));
  #ifdef MIROIR
    gl_FragColor = vec4(c, 0.4);
  #else
    gl_FragColor = vec4(c, 1.0);
  #endif
}`;

export class Figures {
  constructor(max, { echelle = 1, reflets = false } = {}) {
    this.max = max;
    this.groupe = new THREE.Group();
    this.iPos = dyn(max, 4);     // x, y, z, présence
    this.iVent = dyn(max, 4);    // dx, dz, force, libre
    this.iCol = dyn(max, 3);
    this.iMarche = dyn(max, 3);  // cap, phase, ampleur
    this.iStyle = dyn(max, 2);
    this.u = {
      uTemps: { value: 0 }, uNuit: { value: 0 }, uEch: { value: echelle }, uCharge: { value: 0 },
      uSoleilO: { value: new THREE.Vector2(0.55, 0.42) },
    };
    const attr = (g) => { for (const n of ['iPos', 'iVent', 'iCol', 'iMarche', 'iStyle']) g.setAttribute(n, this[n]); g.instanceCount = max; return g; };

    // L'ombre, longue, toujours du même côté.
    const gOmbre = attr(new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)));
    const mOmbre = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec4 iPos; uniform float uEch; uniform vec2 uSoleilO; varying vec2 vP; varying float vA;
        void main() {
          vP = position.xz * 2.0; vA = iPos.w;
          vec2 d = uSoleilO, n = vec2(-d.y, d.x);
          vec2 q = (d * (position.z + 0.5) * 3.0 + n * position.x * 1.0) * uEch;
          vec3 p = iPos.xyz + vec3(q.x, 0.16, q.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uNuit; varying vec2 vP; varying float vA;
        void main() { float a = smoothstep(1.0, 0.25, length(vP)) * 0.34 * vA * (1.0 - uNuit * 0.6); gl_FragColor = vec4(0.05, 0.05, 0.1, a); }`,
    });
    this.ombres = new THREE.Mesh(gOmbre, mOmbre); this.ombres.frustumCulled = false; this.ombres.renderOrder = 2;

    const gCorps = attr(new THREE.InstancedBufferGeometry().copy(corps()));
    this.corps = new THREE.Mesh(gCorps, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT_CORPS, fragmentShader: FRAG_CORPS }));
    this.corps.frustumCulled = false; this.corps.renderOrder = 0;

    const gCape = attr(new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 8, 12)));
    this.capes = new THREE.Mesh(gCape, new THREE.ShaderMaterial({ uniforms: this.u, side: THREE.DoubleSide, vertexShader: VERT_CAPE, fragmentShader: FRAG_CAPE }));
    this.capes.frustumCulled = false; this.capes.renderOrder = 0;
    this.groupe.add(this.ombres, this.capes, this.corps);

    // Sur la Flaque, chacun marche sur son double.
    if (reflets) {
      const opt = { uniforms: this.u, transparent: true, depthWrite: false, defines: { MIROIR: 1 } };
      this.reflets = new THREE.Group();
      const a = new THREE.Mesh(gCorps, new THREE.ShaderMaterial({ ...opt, vertexShader: VERT_CORPS, fragmentShader: FRAG_CORPS }));
      const b = new THREE.Mesh(gCape, new THREE.ShaderMaterial({ ...opt, side: THREE.DoubleSide, vertexShader: VERT_CAPE, fragmentShader: FRAG_CAPE }));
      for (const m of [a, b]) { m.frustumCulled = false; m.renderOrder = 2; this.reflets.add(m); }
      this.reflets.visible = false;
      this.groupe.add(this.reflets);
    }
  }

  // `liste` : objets { x, y, s, presence, vx, vs, force, cap, phase, amp, col, long }
  poser(liste) {
    const P = this.iPos.array, V = this.iVent.array, C = this.iCol.array, M = this.iMarche.array, S = this.iStyle.array;
    for (let i = 0; i < this.max; i++) {
      const m = liste[i];
      if (!m) { P[i * 4 + 3] = 0; continue; }
      P[i * 4] = m.x; P[i * 4 + 1] = m.y; P[i * 4 + 2] = -m.s; P[i * 4 + 3] = m.presence;
      V[i * 4] = m.vx; V[i * 4 + 1] = -m.vs; V[i * 4 + 2] = m.force;
      C[i * 3] = m.col.r; C[i * 3 + 1] = m.col.g; C[i * 3 + 2] = m.col.b;
      M[i * 3] = m.cap; M[i * 3 + 1] = m.phase; M[i * 3 + 2] = m.amp;
      S[i * 2] = m.accent; S[i * 2 + 1] = m.long;
    }
    this.iPos.needsUpdate = this.iVent.needsUpdate = this.iCol.needsUpdate = this.iMarche.needsUpdate = this.iStyle.needsUpdate = true;
  }
}
