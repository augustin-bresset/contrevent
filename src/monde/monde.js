// Le monde en mémoire : une esquisse de toute la bande, et un anneau de tranches autour de la Horde.
// L'anneau tourne : s modulo sa longueur donne la rangée, côté jeu comme côté GPU. Les textures se répètent en s,
// donc les shaders lisent le monde en coordonnées absolues sans savoir ce qui est chargé.
import * as THREE from 'three';
import { MONDE, CLIMATS, COUCHE } from './contrees.js';

const { W, L, pas, pasVent, pasLum, tranche: T, nbTranches: NT } = MONDE;
const mod = (a, n) => ((a % n) + n) % n;

export class Monde {
  constructor(d) {
    Object.assign(this, d);
    this.W = W; this.L = L; this.anneau = T * NT;
    this.nx = W / pas; this.nt = T / pas; this.ns = this.nt * NT;
    this.gx = W / pasVent; this.vt = T / pasVent; this.gs = this.vt * NT;
    this.lx = W / pasLum; this.lt = T / pasLum;
    this.hauteur = new Float32Array(this.nx * this.ns);
    this.vent = new Float32Array(this.gx * this.gs * 4);
    this.casiers = new Array(NT).fill(null);   // quelle tranche occupe chaque casier de l'anneau
    this.k = 0; this.sA = 0; this.sB = 0;      // la tranche centrale, et ce qui est chargé d'un seul tenant autour d'elle
    this.envois = [];                          // ce qui reste à monter sur le GPU
    // Les murs : on ne les traverse pas. Rangés par cases, pour n'en tester que quelques-uns.
    this.casesBati = new Map();
    for (const e of d.emprises || []) {
      for (let j = Math.floor((e.s - e.r) / 64); j <= Math.floor((e.s + e.r) / 64); j++) for (let i = Math.floor((e.x - e.r) / 64); i <= Math.floor((e.x + e.r) / 64); i++) {
        const c = i * 4096 + j;
        if (!this.casesBati.has(c)) this.casesBati.set(c, []);
        this.casesBati.get(c).push(e);
      }
    }
  }

  // Hauteur du sol, lissée (bilinéaire). Hors de l'anneau, l'aperçu : grossier, mais il existe partout.
  h(x, s) {
    if (s < this.sA + pas || s > this.sB - pas) return this.hLoin(x, s);
    const { nx, ns, hauteur: H } = this;
    const fx = Math.max(0, Math.min(nx - 1.001, x / pas - 0.5)), fs = s / pas - 0.5;
    const i = fx | 0, j = Math.floor(fs), a = fx - i, b = fs - j;
    const r0 = mod(j, ns), r1 = r0 + 1 === ns ? 0 : r0 + 1, k0 = r0 * nx + i, k1 = r1 * nx + i;
    return (H[k0] * (1 - a) + H[k0 + 1] * a) * (1 - b) + (H[k1] * (1 - a) + H[k1 + 1] * a) * b;
  }

  hLoin(x, s) {
    const { ax, as, pasApercu: p, margeApercu: m, apercu: A } = this;
    const fx = Math.max(0, Math.min(ax - 1.001, x / p - 0.5)), fs = Math.max(0, Math.min(as - 1.001, (s + m) / p - 0.5));
    const i = fx | 0, j = fs | 0, a = fx - i, b = fs - j, k = j * ax + i;
    return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + ax] * (1 - a) + A[k + ax + 1] * a) * b;
  }

  autour(x, s) { return this.casesBati.get(Math.floor(x / 64) * 4096 + Math.floor(s / 64)); }
  plein(x, s, marge = 0) {
    const l = this.autour(x, s);
    if (l) for (const e of l) { const r = e.r + marge; if ((x - e.x) ** 2 + (s - e.s) ** 2 < r * r) return true; }
    return false;
  }
  // Un corps qui mord sur un mur en ressort par le plus court.
  ecarter(m) {
    const l = this.autour(m.x, m.s);
    if (l) for (const e of l) {
      const dx = m.x - e.x, ds = m.s - e.s, d = Math.hypot(dx, ds) || 1, r = e.r + 0.5;
      if (d < r) { m.x = e.x + dx / d * r; m.s = e.s + ds / d * r; }
    }
  }

  // Vent permanent en (x, s). `o` reçoit x, s (composantes) et abri.
  v(x, s, o) {
    if (s < this.sA + pasVent || s > this.sB - pasVent) { o.x = 0; o.s = -0.6; o.abri = 0; return o; }
    const { gx, gs, vent: V } = this;
    const fx = Math.max(0, Math.min(gx - 1.001, x / pasVent - 0.5)), fs = s / pasVent - 0.5;
    const i = fx | 0, j = Math.floor(fs), a = fx - i, b = fs - j;
    const r0 = mod(j, gs), r1 = r0 + 1 === gs ? 0 : r0 + 1;
    const k0 = (r0 * gx + i) * 4, k1 = k0 + 4, k2 = (r1 * gx + i) * 4, k3 = k2 + 4;
    const w0 = (1 - a) * (1 - b), w1 = a * (1 - b), w2 = (1 - a) * b, w3 = a * b;
    o.x = V[k0] * w0 + V[k1] * w1 + V[k2] * w2 + V[k3] * w3;
    o.s = V[k0 + 1] * w0 + V[k1 + 1] * w1 + V[k2 + 1] * w2 + V[k3 + 1] * w3;
    o.abri = V[k0 + 2] * w0 + V[k1 + 2] * w1 + V[k2 + 2] * w2 + V[k3 + 2] * w3;
    return o;
  }

  xRoute(s) {
    const j = Math.max(0, Math.min(this.route.length - 1, Math.round(s / pas)));
    return this.route[j];
  }

  contreeA(s) {
    let c = this.contrees[0];
    for (const q of this.contrees) if (q.s <= s) c = q;
    return c;
  }

  // Ce qu'il faut autour de s, du plus proche au plus loin. La marche avant passe avant le retour.
  manquantes(s) {
    this.k = Math.floor(s / T);
    const m = [], demi = (NT - 1) / 2;
    for (let d = 0; d <= demi; d++) for (const k of d ? [this.k + d, this.k - d] : [this.k]) if (this.casiers[mod(k, NT)] !== k) m.push(k);
    this.chaine();
    return m;
  }

  // La partie de l'anneau d'un seul tenant autour de la tranche centrale.
  chaine() {
    const C = this.casiers, demi = (NT - 1) / 2;
    if (C[mod(this.k, NT)] !== this.k) { this.sA = this.sB = this.k * T; return; }
    let a = this.k, b = this.k;
    while (this.k - a < demi && C[mod(a - 1, NT)] === a - 1) a--;
    while (b - this.k < demi && C[mod(b + 1, NT)] === b + 1) b++;
    this.sA = a * T; this.sB = (b + 1) * T;
  }

  // La distance sûre autour de s : la brume ne doit jamais s'ouvrir plus loin.
  vu(s) { return Math.min(this.sB - s, s - this.sA); }

  // Une tranche arrive de l'atelier : elle prend son casier dans l'anneau.
  poser({ k, h, v, l, hd, vd }) {
    const c = mod(k, NT), { nx, nt, gx, vt } = this;
    this.casiers[c] = k;
    this.hauteur.set(h, c * nt * nx);
    this.vent.set(v, c * vt * gx * 4);
    this.chaine();
    this.envois.push({ c, hd, vd, l });
  }

  // Le relief en pleine précision : en demi-flottants, le sol se ferait en escaliers de quelques centimètres, visibles à la lumière rasante.
  creerTextures(renderer) {
    const faire = (donnees, w, h, format, type) => {
      const t = new THREE.DataTexture(donnees, w, h, format, type);
      t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true; renderer.initTexture(t);
      return t;
    };
    const { nx, ns, gx, gs, lx, lt } = this;
    const tH = faire(new Float32Array(nx * ns), nx, ns, THREE.RedFormat, THREE.FloatType);
    const tV = faire(new Uint16Array(gx * gs * 4), gx, gs, THREE.RGBAFormat, THREE.HalfFloatType);
    const tL = faire(new Uint8Array(lx * lt * NT * 2), lx, lt * NT, THREE.RGFormat, THREE.UnsignedByteType);
    this.textures = { tH, tV, tL, tPal: this.palette(), tMat: this.sols() };
    this.gabarits = {
      h: new THREE.DataTexture(null, nx, this.nt, THREE.RedFormat, THREE.FloatType),
      v: new THREE.DataTexture(null, gx, this.vt, THREE.RGBAFormat, THREE.HalfFloatType),
      l: new THREE.DataTexture(null, lx, lt, THREE.RGFormat, THREE.UnsignedByteType),
    };
    this.renderer = renderer;
    return this.textures;
  }

  // Une tranche par image, pas plus : la marche ne doit jamais sentir qu'on construit devant elle.
  monter() {
    const e = this.envois.shift();
    if (!e) return;
    const { renderer: r, gabarits: G, textures: X, nt, vt, lt } = this, posH = new THREE.Vector2(0, e.c * nt), posV = new THREE.Vector2(0, e.c * vt), posL = new THREE.Vector2(0, e.c * lt);
    G.h.image.data = e.hd; G.v.image.data = e.vd; G.l.image.data = e.l;
    r.copyTextureToTexture(G.h, X.tH, null, posH);
    r.copyTextureToTexture(G.v, X.tV, null, posV);
    r.copyTextureToTexture(G.l, X.tL, null, posL);
  }

  toutMonter() { while (this.envois.length) this.monter(); }

  // De quoi est fait le sol, le long de la bande. Deux colonnes, lues au plus proche : ce sont des numéros de couches.
  sols() {
    const R = 1024, d = new Uint8Array(R * 2 * 4), cs = this.contrees;
    for (let r = 0; r < R; r++) {
      const s = (r + 0.5) / R * this.L, c = this.contreeA(s), q = CLIMATS[c.id];
      d.set([COUCHE[q.sols[0]], COUCHE[q.sols[1]], COUCHE[q.roche], Math.round(q.neige * 255)], r * 8);
      d.set([Math.round(q.raide * 255), Math.round(q.pris * 127), Math.round((c.herbe || 0) * 255), 255], r * 8 + 4);
    }
    const t = new THREE.DataTexture(d, 2, R, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }

  // Les couleurs des contrées, le long de la bande.
  // Colonnes : ombre, lumière, encre, trait, ciel, réglages (ligne, rides, grain, densité d'herbe), herbe.
  palette() {
    const R = 1024, C = 7, d = new Uint8Array(R * C * 4), cs = this.contrees;
    const q = new THREE.Color(), lin = (hex) => { q.set(hex); q.convertLinearToSRGB(); return [q.r, q.g, q.b]; };
    const lignes = cs.map((c) => [lin(c.ombre), lin(c.lumiere), lin(c.encre), lin(c.trait), lin(c.ciel), [c.pasLigne / 10, c.rides, c.grain], lin(c.herbeTon || c.ombre)]);
    for (let r = 0; r < R; r++) {
      const s = (r + 0.5) / R * this.L;
      let i = 0; while (i < cs.length - 1 && s >= cs[i + 1].s) i++;
      const j = Math.min(cs.length - 1, i + 1), f = i === j ? 0 : Math.max(0, (s - (cs[j].s - 200)) / 400);
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
