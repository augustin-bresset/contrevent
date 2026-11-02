// Le détour : quand la ligne droite bute sur un mur ou une pente trop raide, on cherche le chemin autour.
// Une recherche A* sur une grille de 2 m autour de la Horde, avec sa règle de pente : on descend tout, on ne monte pas les falaises.
const C = 2, RAYON = 190, PENTE = 1.7 * 0.85, MAX_NOEUDS = 60000;
const VOISINS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Detour {
  constructor(monde) {
    this.monde = monde;
    this.but = null; this.pts = []; this.joignable = true; this.tPlan = -1e9; this.tVise = -1e9;
    this.direct = true; this.revoir = false;
  }

  // Ce qu'on retient du sol à un endroit : sa hauteur, et s'il est libre (avec un peu d'air autour des murs).
  sol(x, s) { return Math.max(0, this.monde.h(x, s)); }
  libre(x, s) { return !this.monde.bloque(x, s, 0.8); }

  // La ligne droite tient-elle, d'un bout à l'autre, au pas de la Horde ?
  droit(x0, s0, x1, s1) {
    const d = Math.hypot(x1 - x0, s1 - s0), n = Math.max(1, Math.ceil(d / 1.2)), m = d / n;
    let hp = this.sol(x0, s0);
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, s = s0 + (s1 - s0) * t, h = this.sol(x, s);
      if (h - hp > PENTE * m || !this.libre(x, s)) return false;
      hp = h;
    }
    return true;
  }

  // Où marcher maintenant pour rejoindre `but`. Rend le point à viser, ce qui reste à parcourir, et si le but se rejoint.
  vers(x, s, but, temps) {
    const neuf = !this.but || Math.hypot(but.x - this.but.x, but.s - this.but.s) > (this.pts.length ? 6 : 1);
    if (neuf) { this.but = { x: but.x, s: but.s }; this.tVise = -1e9; this.revoir = true; }
    if (temps - this.tVise > 0.2) {
      this.tVise = temps;
      this.direct = this.droit(x, s, but.x, but.s);
      if (this.direct) { this.pts = []; this.joignable = true; }
      else {
        // On replanifie si le but a bougé, si le vent nous a sortis du tracé, ou de temps en temps : le relief chargé s'affine.
        const perdu = this.pts.length && temps - this.tPlan > 1 && !this.droit(x, s, this.pts[0].x, this.pts[0].s);
        // Un but qu'on traîne au doigt ne relance pas la recherche à chaque image.
        if (!this.pts.length || (this.revoir || perdu) && temps - this.tPlan > 0.3 || this.joignable && temps - this.tPlan > 4) { this.planifier(x, s, but.x, but.s); this.tPlan = temps; this.revoir = false; }
        // On coupe au plus loin qu'on voit d'ici : pas d'escalier de grille.
        while (this.pts.length > 1 && Math.hypot(this.pts[0].x - x, this.pts[0].s - s) < 3) this.pts.shift();
        let k = 0;
        for (let i = Math.min(this.pts.length - 1, 14); i > 0; i--) if (this.droit(x, s, this.pts[i].x, this.pts[i].s)) { k = i; break; }
        if (k) this.pts.splice(0, k);
      }
    }
    if (this.direct || !this.pts.length) return { x: but.x, s: but.s, reste: Math.hypot(but.x - x, but.s - s), joignable: this.joignable, auBout: !this.joignable };
    let reste = Math.hypot(this.pts[0].x - x, this.pts[0].s - s);
    for (let i = 1; i < this.pts.length; i++) reste += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].s - this.pts[i - 1].s);
    const fin = this.pts[this.pts.length - 1];
    if (this.joignable) reste += Math.hypot(but.x - fin.x, but.s - fin.s);
    return { x: this.pts[0].x, s: this.pts[0].s, reste, joignable: this.joignable, auBout: !this.joignable && reste < 3.5 };
  }

  // Le tracé du détour, pour le dessiner au sol.
  trace() { return this.direct ? [] : this.pts; }

  planifier(x, s, bx, bs) {
    // La fenêtre couvre la Horde et le but, sans s'éloigner de plus de RAYON : au-delà, les solides ne sont pas chargés.
    // Si rien ne passe, on l'élargit : le chemin fait parfois le tour de toute une ville.
    const d = Math.hypot(bx - x, bs - s);
    for (const marge of d > RAYON ? [60] : [30, 80, 140]) if (this.chercher(x, s, bx, bs, d, marge)) return;
  }

  chercher(x, s, bx, bs, d, MARGE) {
    const r = Math.min(1, RAYON / Math.max(d, 1));
    const tx = x + (bx - x) * r, ts = s + (bs - s) * r;
    const x0 = Math.max(4, Math.min(x, tx) - MARGE), x1 = Math.min(this.monde.W - 4, Math.max(x, tx) + MARGE);
    const s0 = Math.min(s, ts) - MARGE, s1 = Math.max(s, ts) + MARGE;
    const nx = Math.ceil((x1 - x0) / C) + 1, ns = Math.ceil((s1 - s0) / C) + 1, N = nx * ns;
    const H = new Float32Array(N).fill(NaN), etat = new Uint8Array(N), g = new Float32Array(N).fill(Infinity), de = new Int32Array(N).fill(-1);
    const px = (k) => x0 + (k % nx) * C, ps = (k) => s0 + Math.floor(k / nx) * C;
    // etat : 0 inconnu, 1 libre, 2 plein, |4 fermé, |8 près d'un mur.
    const lire = (k) => {
      if (!etat[k]) {
        const X = px(k), S = ps(k);
        etat[k] = this.libre(X, S) ? (this.monde.bloque(X, S, 5) ? 9 : 1) : 2;
        H[k] = this.sol(X, S);
      }
      return etat[k];
    };
    const cle = (X, S) => Math.max(0, Math.min(ns - 1, Math.round((S - s0) / C))) * nx + Math.max(0, Math.min(nx - 1, Math.round((X - x0) / C)));
    const dep = cle(x, s), arr = cle(bx, bs), ai = arr % nx, aj = Math.floor(arr / nx);
    const est = (k) => { const i = k % nx, j = Math.floor(k / nx), a = Math.abs(i - ai), b = Math.abs(j - aj); return C * (Math.max(a, b) + 0.414 * Math.min(a, b)); };

    // Un tas binaire, sur les numéros de case.
    const tas = [], f = new Float32Array(N);
    const pousser = (k) => { tas.push(k); let i = tas.length - 1; while (i) { const p = (i - 1) >> 1; if (f[tas[p]] <= f[k]) break; tas[i] = tas[p]; i = p; } tas[i] = k; };
    const tirer = () => {
      const h = tas[0], z = tas.pop();
      if (tas.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= tas.length) break; if (c + 1 < tas.length && f[tas[c + 1]] < f[tas[c]]) c++; if (f[tas[c]] >= f[z]) break; tas[i] = tas[c]; i = c; } tas[i] = z; }
      return h;
    };

    lire(dep); etat[dep] = (etat[dep] & ~2) | 1;   // on part d'où l'on est, même collé à un mur
    g[dep] = 0; f[dep] = est(dep); pousser(dep);
    let mieux = dep, mieuxE = est(dep), vus = 0, trouve = false;
    while (tas.length && vus++ < MAX_NOEUDS) {
      const k = tirer();
      if (etat[k] & 4) continue;
      etat[k] |= 4;
      if (k === arr) { trouve = true; mieux = k; break; }
      const e = est(k);
      if (e < mieuxE) { mieuxE = e; mieux = k; }
      const i = k % nx, j = Math.floor(k / nx);
      for (const [di, dj] of VOISINS) {
        const u = i + di, v = j + dj;
        if (u < 0 || v < 0 || u >= nx || v >= ns) continue;
        const q = v * nx + u;
        if (lire(q) & 6) continue;
        // En diagonale, on ne rase pas un coin.
        if (di && dj && ((lire(j * nx + u) & 2) || (lire(v * nx + i) & 2))) continue;
        const pas = di && dj ? C * 1.414 : C;
        if (H[q] - H[k] > PENTE * pas) continue;
        const cout = g[k] + pas * ((etat[q] & 8) ? 1.6 : 1) * (1 + Math.max(0, H[q] - H[k]) / pas * 0.6);
        if (cout < g[q]) { g[q] = cout; de[q] = k; f[q] = cout + est(q) * 1.05; pousser(q); }
      }
    }
    // Un but hors de portée : on va au plus près qu'on puisse atteindre.
    this.joignable = trouve || (d > RAYON && mieux !== dep);
    const pts = [];
    for (let k = mieux; k !== dep && k >= 0; k = de[k]) pts.push({ x: px(k), s: ps(k) });
    pts.reverse();
    if (trouve && pts.length) pts[pts.length - 1] = { x: bx, s: bs };
    this.pts = pts;
    return trouve;
  }
}
