// Le monde en mémoire : lectures côté jeu, textures côté GPU.
import * as THREE from 'three';
import { MONDE } from './contrees.js';

export class Monde {
  constructor(d) {
    Object.assign(this, d);
    this.W = MONDE.W; this.L = MONDE.L;
  }

  // Hauteur du sol, lissée (bilinéaire).
  h(x, s) {
    const { nx, ns, hauteur: H } = this, p = MONDE.pas;
    const fx = Math.max(0, Math.min(nx - 1.001, x / p)), fs = Math.max(0, Math.min(ns - 1.001, s / p));
    const i = fx | 0, j = fs | 0, a = fx - i, b = fs - j, k = j * nx + i;
    return (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + nx] * (1 - a) + H[k + nx + 1] * a) * b;
  }

  // Vent permanent en (x, s). `o` reçoit x, s (composantes) et abri.
  v(x, s, o) {
    const { gx, gs, vent: V } = this, p = MONDE.pasVent;
    const fx = Math.max(0, Math.min(gx - 1.001, x / p)), fs = Math.max(0, Math.min(gs - 1.001, s / p));
    const i = fx | 0, j = fs | 0, a = fx - i, b = fs - j;
    const k0 = (j * gx + i) * 4, k1 = k0 + 4, k2 = k0 + gx * 4, k3 = k2 + 4;
    const w0 = (1 - a) * (1 - b), w1 = a * (1 - b), w2 = (1 - a) * b, w3 = a * b;
    o.x = V[k0] * w0 + V[k1] * w1 + V[k2] * w2 + V[k3] * w3;
    o.s = V[k0 + 1] * w0 + V[k1 + 1] * w1 + V[k2 + 1] * w2 + V[k3 + 1] * w3;
    o.abri = V[k0 + 2] * w0 + V[k1 + 2] * w1 + V[k2 + 2] * w2 + V[k3 + 2] * w3;
    return o;
  }

  xRoute(s) {
    const j = Math.max(0, Math.min(this.ns - 1, Math.round(s / MONDE.pas)));
    return this.route[j];
  }

  contreeA(s) {
    let c = this.contrees[0];
    for (const q of this.contrees) if (q.s <= s) c = q;
    return c;
  }

  // Le relief en demi-flottants, filtrables partout en WebGL2.
  textures() {
    const conv = THREE.DataUtils.toHalfFloat, H = this.hauteur, d = new Uint16Array(H.length);
    for (let i = 0; i < H.length; i++) d[i] = conv(H[i]);
    const tH = new THREE.DataTexture(d, this.nx, this.ns, THREE.RedFormat, THREE.HalfFloatType);
    tH.minFilter = tH.magFilter = THREE.LinearFilter; tH.wrapS = tH.wrapT = THREE.ClampToEdgeWrapping; tH.needsUpdate = true;

    const V = this.vent, dv = new Uint16Array(V.length);
    for (let i = 0; i < V.length; i++) dv[i] = conv(V[i]);
    const tV = new THREE.DataTexture(dv, this.gx, this.gs, THREE.RGBAFormat, THREE.HalfFloatType);
    tV.minFilter = tV.magFilter = THREE.LinearFilter; tV.wrapS = tV.wrapT = THREE.ClampToEdgeWrapping; tV.needsUpdate = true;

    const tL = new THREE.DataTexture(this.lum, this.lx, this.ls, THREE.RGFormat, THREE.UnsignedByteType);
    tL.minFilter = tL.magFilter = THREE.LinearFilter; tL.wrapS = tL.wrapT = THREE.ClampToEdgeWrapping; tL.needsUpdate = true;

    return { tH, tV, tL, tPal: this.palette() };
  }

  // Les couleurs des contrées, le long de la bande.
  // Colonnes : ombre, lumière, encre, trait, ciel, réglages (ligne, rides, grain, densité d'herbe), herbe.
  palette() {
    const R = 512, C = 7, d = new Uint8Array(R * C * 4), cs = this.contrees;
    const q = new THREE.Color(), lin = (hex) => { q.set(hex); q.convertLinearToSRGB(); return [q.r, q.g, q.b]; };
    const lignes = cs.map((c) => [lin(c.ombre), lin(c.lumiere), lin(c.encre), lin(c.trait), lin(c.ciel), [c.pasLigne / 10, c.rides, c.grain], lin(c.herbeTon || c.ombre)]);
    for (let r = 0; r < R; r++) {
      const s = (r + 0.5) / R * this.L;
      let i = 0; while (i < cs.length - 1 && s >= cs[i + 1].s) i++;
      const j = Math.min(cs.length - 1, i + 1), f = i === j ? 0 : Math.max(0, (s - (cs[j].s - 110)) / 220);
      const t = Math.min(1, f), u = t * t * (3 - 2 * t);
      for (let c = 0; c < C; c++) {
        const a = lignes[i][c], b = lignes[j][c];
        for (let k = 0; k < 3; k++) d[(r * C + c) * 4 + k] = Math.round((a[k] + (b[k] - a[k]) * u) * 255);
        d[(r * C + c) * 4 + 3] = c === 5 ? Math.round(((cs[i].herbe || 0) * (1 - u) + (cs[j].herbe || 0) * u) * 255) : 255;
      }
    }
    const t = new THREE.DataTexture(d, C, R, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  }
}
