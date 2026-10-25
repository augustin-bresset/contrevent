// Fabrique le monde à partir d'une graine, à la demande.
// L'esquisse (bornes, route, lieux, abris, grand vent) se calcule une fois pour toutes. Le reste se fabrique par tranches :
// une tranche ne dépend que de la graine et de son numéro, donc on la retrouve identique, dans n'importe quel ordre.
// Le vent n'est pas du bruit : c'est un écoulement résolu sur le relief (fonction de courant), d'abord à grande maille
// sur tout le monde, puis affiné dans chaque tranche. Il contourne les massifs, s'accélère dans les défilés.
import { MONDE, CONTREES, LIEUX, SOLEIL, ECHELLE } from './contrees.js';
import { creerBruit, alea } from './bruit.js';
import { composer, emprises } from './villes.js';

const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

const OMEGA = 1.86, PAS_APERCU = 24, MARGE_APERCU = 1200;
const ITER_APERCU = 160, ITER_TRANCHE = 60;
const PAS_T = [3, 6, 10, 15, 22, 32, 45, 62, 85, 115, 155, 210, 290, 390];

// Une demi-fois de SOR sur div(r grad ψ) = 0 : les colonnes de bord sont tenues, comme les lignes `fixe`.
function relaxer(psi, res, nx, nj, iter, fixe) {
  for (let it = 0; it < iter; it++) {
    const j0 = fixe ? 1 : 0, j1 = fixe ? nj - 1 : nj;
    for (let j = j0; j < j1; j++) {
      const jm = j > 0 ? -nx : nx, jp = j < nj - 1 ? nx : -nx;   // bords amont et aval : flux libre
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i, r0 = res[k];
        const cw = r0 + res[k - 1], ce = r0 + res[k + 1], cs = r0 + res[k + jm], cn = r0 + res[k + jp];
        const v = (cw * psi[k - 1] + ce * psi[k + 1] + cs * psi[k + jm] + cn * psi[k + jp]) / (cw + ce + cs + cn);
        psi[k] += OMEGA * (v - psi[k]);
      }
    }
  }
}

// Une moyenne locale, en deux passes de boîte : ce qui dépasse d'elle fait obstacle.
function moyenner(haut, nx, nj, R) {
  const tmp = new Float32Array(nx * nj), moy = new Float32Array(nx * nj);
  for (let j = 0; j < nj; j++) {
    let somme = 0;
    for (let i = -R; i <= R; i++) somme += haut[j * nx + Math.max(0, Math.min(nx - 1, i))];
    for (let i = 0; i < nx; i++) {
      tmp[j * nx + i] = somme / (2 * R + 1);
      somme += haut[j * nx + Math.min(nx - 1, i + R + 1)] - haut[j * nx + Math.max(0, i - R)];
    }
  }
  for (let i = 0; i < nx; i++) {
    let somme = 0;
    for (let j = -R; j <= R; j++) somme += tmp[Math.max(0, Math.min(nj - 1, j)) * nx + i];
    for (let j = 0; j < nj; j++) {
      moy[j * nx + i] = somme / (2 * R + 1);
      somme += tmp[Math.min(nj - 1, j + R + 1) * nx + i] - tmp[Math.max(0, j - R) * nx + i];
    }
  }
  return moy;
}

// Résistance à l'écoulement. Là où r est fort, ψ varie peu et le vent passe mal.
function resistance(haut, moy) {
  const res = new Float32Array(haut.length);
  for (let k = 0; k < haut.length; k++) {
    const e = lisse(7, 28, haut[k] - moy[k]);
    res[k] = 1 + e * e * 24;
  }
  return res;
}

// L'abri : ce qui est sous le vent d'un obstacle (le vent vient de l'amont, s décroissant).
function abriter(haut, moy, nx, nj, abri, perte, a1 = 3.5, a2 = 18) {
  for (let j = nj - 2; j >= 0; j--) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, h = lisse(a1, a2, haut[k] - moy[k]);
    const a = abri[k + nx], l = abri[k + nx - (i > 0 ? 1 : 0)], d = abri[k + nx + (i < nx - 1 ? 1 : 0)];
    abri[k] = Math.max(h, (a * 0.6 + l * 0.2 + d * 0.2) * perte);
  }
}

export function creerFabrique(graine) {
  const { W, L, pas, pasVent, pasLum, tranche: T } = MONDE;
  const K = ECHELLE.relief, HK = ECHELLE.hauteur, EM = ECHELLE.monument;
  const nx = W / pas, nt = T / pas, gx = W / pasVent, vt = T / pasVent, lx = W / pasLum, lt = T / pasLum;
  const b = creerBruit(graine), r = alea(graine ^ 0x5eed);

  // Les bornes des contrées, un peu déplacées par la graine, dans l'ordre du roman.
  const contrees = CONTREES.map((c, i) => ({ ...c, s: (i ? c.f + (r() - 0.5) * 0.004 : 0) * L, pasLigne: c.pasLigne * HK }));

  // La route : un méandre lent qui garantit qu'un passage existe.
  const ns = Math.round(L / pas) + 1, route = new Float32Array(ns);
  const p1 = r() * 6.28, p2 = r() * 6.28;
  for (let j = 0; j < ns; j++) {
    const s = j * pas;
    route[j] = W * 0.5 + W * 0.2 * Math.sin(s / 2300 + p1) + W * 0.1 * Math.sin(s / 860 + p2) + 60 * b.fbm(s / 700, 7.7, 2);
  }
  const xRoute = (s) => route[Math.max(0, Math.min(ns - 1, Math.round(s / pas)))];

  // Le détour des Malachites : long, le long de la glace, mais abrité. L'autre choix est la porte d'Urle.
  const coteDetour = xRoute(0.6 * L) > W / 2 ? 0.1 : 0.9;

  // Les lieux d'abord : ce sont eux qui commandent le relief, pas l'inverse.
  const lieux = LIEUX.map((l) => {
    const borne = l.borne && contrees.find((c) => c.id === l.borne);
    const s = l.fixe ?? (borne ? borne.s + l.ecart : (l.f + (r() - 0.5) * 0.002) * L);
    return { ...l, dx: l.dx * EM, rayon: l.rayon * EM, s, x: Math.max(30, Math.min(W - 30, xRoute(s) + l.dx * EM)) };
  });
  const ancres = lieux.filter((l) => l.ancre).map((l) => {
    const a = l.ancre;
    const portee = a.forme === 'plateau' ? (Math.max(a.rx, a.rs) * (1 + a.raccord / Math.min(a.rx, a.rs)))
      : a.forme === 'col' ? Math.max(a.rs + a.raccord, a.rx + 430) : a.rx + 270;
    return { ...a, x: l.x, s: l.s, portee, id: l.id };
  });

  // Un gradin : le relief se pose en replats, séparés par des ressauts raides. C'est ce qui fait une mesa.
  const gradins = (h, pas0, raide = 0.72) => { const q = h / pas0, f = q - Math.floor(q); return (Math.floor(q) + lisse(raide, 1, f)) * pas0; };

  const relief = {
    banquise: (x, s) => 6 + 3.5 * b.fbm(x / 110, s / 110, 3) + 7 * Math.pow(b.crete(x / 170, s / 90, 3), 2) + 0.7 * b.fbm(x / 9, s / 26, 2),
    coteaux: (x, s) => 9 + 17 * (0.5 + 0.8 * b.fbm(x / 150, s / 150, 4)) + 5 * Math.pow(b.crete(x / 70, s / 70, 3), 1.4),
    flaque: (x, s) => {
      const n = b.fbm(x / 130, s / 130, 4);
      return -1.1 + 0.35 * b.fbm(x / 40, s / 40, 2) + Math.max(0, n - 0.3) * 34;
    },
    // Une dune n'est pas une vague : un long dos face au vent, une crête nette, une face d'avalanche sous le vent.
    dunes: (x, s) => {
      const w = 90 * b.fbm(x / 260, s / 260, 3), q = (s + w + 0.25 * x) / 74, f = q - Math.floor(q);
      const onde = f < 0.17 ? lisse(0, 0.17, f) : Math.pow(1 - (f - 0.17) / 0.83, 1.5);
      const m = 0.55 + 0.75 * b.fbm(x / 340, s / 340, 2) + 0.3 * b.fbm(x / 60, s / 90, 2);
      const q2 = (s + 0.6 * w + 0.5 * x) / 13, f2 = q2 - Math.floor(q2);
      const petite = (f2 < 0.2 ? f2 / 0.2 : 1 - (f2 - 0.2) / 0.8) * Math.max(0, 0.5 + b.fbm(x / 34, s / 34, 2));
      return 5 + 16 * onde * Math.max(0.1, m) + 7 * (0.5 + b.fbm(x / 380, s / 380, 2)) + 0.9 * petite * (1 - onde * 0.6);
    },
    // Des mesas : les couches dures tiennent, les tendres s'en vont.
    canyon: (x, s) => {
      const m = b.crete(x / 130 + 3, s / 170, 4);
      return 24 + gradins(8 * b.fbm(x / 120, s / 120, 3) + 34 * Math.pow(m, 1.6) + 2.2 * b.fbm(x / 30, s / 30, 2), 5.2);
    },
    massif: (x, s) => {
      const h = 14 + 74 * Math.pow(b.crete(x / 180, s / 150, 5), 1.5);
      return h + 9 * lisse(24, 60, h) * b.crete(x / 26, s / 34, 3);
    },
    plateforme: (x, s) => 3.2 + 1.6 * b.fbm(x / 170, s / 170, 3),
    terrasses: (x, s) => gradins(24 + 20 * b.fbm(x / 200, s / 200, 4) + 1.4 * b.fbm(x / 40, s / 40, 2), 6, 0.75),
    cimes: (x, s) => {
      const h = 42 + 88 * Math.pow(b.crete(x / 150, s / 170, 5), 1.3);
      return h + 14 * lisse(60, 110, h) * b.crete(x / 24, s / 30, 3);
    },
    cendres: (x, s) => 40 + 10 * b.fbm(x / 90, s / 90, 3) + 18 * Math.pow(b.crete(x / 140, s / 140, 3), 2) + 3.5 * b.crete(x / 30, s / 42, 3),
    vide: (x, s) => 40 + 1.5 * b.fbm(x / 200, s / 200, 2),
  };

  function hauteurDans(c, x, s) {
    let h = relief[c.relief](x / K, s / K) * HK;
    if (c.couloir) {
      const d = Math.abs(x - xRoute(s));
      h = mix(c.solRoute * HK + 2.5 * b.fbm(x / 60, s / 60, 2), h, lisse(c.couloir * K * 0.75, c.couloir * K * (c.relief === 'canyon' ? 1.2 : 2.1), d + 16 * b.fbm(x / 70, s / 70, 2)));
    }
    if (c.passe) {
      const d = Math.abs(x - W * coteDetour);
      h = mix((c.solRoute + 3) * HK, h, lisse(50, 110, d));
    }
    return h;
  }

  // Une ancre impose le sol : exactement son altitude au centre, un retour en douceur au relief sur les bords.
  function ancrer(a, x, s, h) {
    const dx = x - a.x, ds = s - a.s, sol = a.y + 0.5 * b.fbm(x / 38, s / 38, 2);
    if (a.forme === 'plateau') {
      const marge = a.raccord / Math.min(a.rx, a.rs), d = Math.hypot(dx / a.rx, ds / a.rs);
      return d >= 1 + marge ? h : mix(sol, h, lisse(1, 1 + marge, d));
    }
    if (a.forme === 'col') {
      const lon = 1 - lisse(a.rs, a.rs + a.raccord, Math.abs(ds)), lar = 1 - lisse(a.rx + 200, a.rx + 430, Math.abs(dx));
      const m = lisse(a.rx, a.rx + 70, Math.abs(dx)), haut = Math.max(h, sol + a.mur);
      return mix(h, mix(sol, haut, m), lon * lar);
    }
    // Le cirque : un fond rond, et un mur que seule la route traverse.
    const d = Math.hypot(dx, ds), fond = 1 - lisse(a.rx, a.rx + 44, d);
    const mur = lisse(a.rx - 6, a.rx + 74, d) * (1 - lisse(a.rx + 100, a.rx + 270, d));
    const porte = lisse(a.ouverture, a.ouverture + 54, Math.abs(x - xRoute(s)));
    return mix(mix(h, Math.max(h, sol + a.mur), mur * porte), sol, fond);
  }

  // Une rangée du relief, sans les abris. `o` reçoit n valeurs à partir de k0, aux abscisses (i + 0,5) × px.
  const FONDU = 300;
  function rangee(s, n, px, o, k0) {
    let ic = 0;
    while (ic < contrees.length - 1 && s >= contrees[ic + 1].s) ic++;
    const c = contrees[ic], suiv = contrees[ic + 1], prec = contrees[ic - 1];
    const dSuiv = suiv ? suiv.s - s : Infinity, dPrec = s - c.s;
    const proches = ancres.filter((a) => Math.abs(s - a.s) < a.portee);
    const fin = lisse(L - 70, L, s);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * px;
      let h = hauteurDans(c, x, s);
      if (dSuiv < FONDU) h = mix(hauteurDans(suiv, x, s), h, 0.5 + 0.5 * lisse(0, 1, dSuiv / FONDU));
      else if (prec && dPrec < FONDU) h = mix(hauteurDans(prec, x, s), h, 0.5 + 0.5 * lisse(0, 1, dPrec / FONDU));
      // Les deux glaces qui bordent le monde.
      const e = Math.min(x, W - x), g = 1 - lisse(0, 96 + 56 * b.s2(s / 190, x > W / 2 ? 3 : 9), e);
      if (g > 0) h += g * g * (150 + 330 * (0.5 + b.fbm(s / 380, x > W / 2 ? 3 : 9, 3)) + 90 * b.crete(s / 120, x / 90, 3));
      // Le monde s'achève sur le vide : le sol tombe dans la lumière.
      if (fin > 0) h -= fin * fin * 120;
      for (const a of proches) h = ancrer(a, x, s, h);
      // La Falaise des Confins, derrière Aberlaas : un mur en gradins qui monte plus haut que les nuages. Personne n'en a vu le sommet.
      if (s < 160) {
        const pied = 112 + 30 * b.fbm(x / 210, 5, 3) + 9 * b.crete(x / 46, 9, 2);
        if (s < pied) { const q = (pied - s) / 92 + 0.16 * b.fbm(x / 120, s / 200, 2), r = Math.floor(q), e0 = q - r; h += (r + lisse(0, 0.34, e0)) * 900 + 60 * b.fbm(x / 34, s / 34, 2) * lisse(0, 0.3, q); }
      }
      o[k0 + i] = h;
    }
  }

  // Les villes se posent sur le sol qui les attendait. Leurs murs comptent : le vent les contourne, et on dort derrière.
  const solUn = new Float32Array(1);
  const solIci = (x, s) => { rangee(s, 1, 2 * x, solUn, 0); return Math.max(0, solUn[0]); };
  const pleins = [];
  for (const l of lieux) {
    let h0 = 0; for (const c of l.id) h0 = (h0 * 31 + c.charCodeAt(0)) | 0;
    l.bati = composer(l, alea(graine ^ h0), xRoute);
    for (const q of l.bati) q.y0 = solIci(q.x, q.s) - 0.6 + q.y;
    pleins.push(...emprises(l.bati));
  }

  // Les abris : des lames de roche en travers du vent, toujours à portée de la route.
  const abris = [];
  const dansUneAncre = (x, s) => ancres.some((a) => Math.hypot(x - a.x, s - a.s) < Math.max(a.rx, a.rs ?? 0) + 40);
  const poserAbri = (x, s, ax, as, h) => { if (!dansUneAncre(x, s)) abris.push({ x, s, ax, as, h }); };
  for (let s = 620; s < L - 340; ) {
    const c = contrees.findLast((q) => q.s <= s), pasA = c.relief === 'flaque' ? 150 + r() * 70 : 110 + r() * 80;
    const cote = r() < 0.5 ? -1 : 1, montagne = c.relief === 'massif' || c.relief === 'cimes';
    if (montagne) {
      // Dans les défilés, de petites lames collées au flanc : on peut toujours souffler.
      poserAbri(xRoute(s) + cote * (c.couloir * K * 0.6 + 8), s, 26, 8, 30);
    } else if (c.relief !== 'vide') {
      const x = xRoute(s) + cote * (22 + r() * 90), flaque = c.relief === 'flaque';
      poserAbri(x, s, 24 + r() * 24, 7 + r() * 3, flaque ? 14 + r() * 7 : 21 + r() * 13);
    }
    s += pasA;
  }

  // La force du vent le long de la bande : par marches, avec des replis qui montent eux aussi.
  const forceA = (s) => {
    let ic = 0;
    while (ic < contrees.length - 1 && s >= contrees[ic + 1].s) ic++;
    const c = contrees[ic], suiv = contrees[ic + 1], q = suiv ? lisse(suiv.s - 360, suiv.s, s) : 0;
    return mix(c.force, suiv ? suiv.force : c.force, q);
  };
  // Au-delà, plus aucun corps ne passe, même en bloc : il faut que la porte d'Urle reste une porte.
  // Il monte avec la remontée : c'est ce qui laisse à la fin du monde de quoi être pire que tout le reste.
  const plafondA = (s) => mix(1.4, 1.95, Math.pow(Math.min(1, s / L), 2.2));

  // --- L'aperçu : tout le monde à grande maille, pour la bande, et pour que chaque tranche sache d'où vient le vent ---
  const ax = Math.round(W / PAS_APERCU), as = Math.round((L + 2 * MARGE_APERCU) / PAS_APERCU), apercu = new Float32Array(ax * as);
  for (let j = 0; j < as; j++) rangee((j + 0.5) * PAS_APERCU - MARGE_APERCU, ax, PAS_APERCU, apercu, j * ax);
  const hautA = new Float32Array(ax * as);
  for (let k = 0; k < hautA.length; k++) hautA[k] = Math.max(0, apercu[k]);
  const moyA = moyenner(hautA, ax, as, 4), resA = resistance(hautA, moyA), psiA = new Float32Array(ax * as), abriA = new Float32Array(ax * as);
  for (let j = 0, k = 0; j < as; j++) for (let i = 0; i < ax; i++, k++) psiA[k] = (i + 0.5) * PAS_APERCU;
  relaxer(psiA, resA, ax, as, ITER_APERCU, false);
  abriter(hautA, moyenner(hautA, ax, as, 2), ax, as, abriA, 0.965 ** 3);
  const lireA = (t, x, s) => {
    const fx = Math.max(0, Math.min(ax - 1.001, x / PAS_APERCU - 0.5)), fs = Math.max(0, Math.min(as - 1.001, (s + MARGE_APERCU) / PAS_APERCU - 0.5));
    const i = fx | 0, j = fs | 0, a = fx - i, c = fs - j, k = j * ax + i;
    return (t[k] * (1 - a) + t[k + 1] * a) * (1 - c) + (t[k + ax] * (1 - a) + t[k + ax + 1] * a) * c;
  };

  // --- Les tranches ---
  const memoire = new Map();
  function reliefTranche(k) {
    let H = memoire.get(k);
    if (H) { memoire.delete(k); memoire.set(k, H); return H; }
    H = new Float32Array(nx * nt);
    const s0 = k * T;
    for (let j = 0; j < nt; j++) rangee(s0 + (j + 0.5) * pas, nx, pas, H, j * nx);
    for (const a of abris) {
      if (a.s + a.as * 2.4 < s0 || a.s - a.as * 2.4 > s0 + T) continue;
      const i0 = Math.max(0, Math.floor((a.x - a.ax * 2.4) / pas)), i1 = Math.min(nx - 1, Math.ceil((a.x + a.ax * 2.4) / pas));
      const j0 = Math.max(0, Math.floor((a.s - a.as * 2.4 - s0) / pas)), j1 = Math.min(nt - 1, Math.ceil((a.s + a.as * 2.4 - s0) / pas));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * pas, s = s0 + (j + 0.5) * pas;
        const dx = (x - a.x) / a.ax, ds = (s - a.s) / a.as, e = Math.exp(-(dx * dx + ds * ds)), q = j * nx + i;
        H[q] = Math.max(H[q], mix(H[q], H[q] + a.h, e) + (e > 0.5 ? 1.2 * b.s2(x * 0.065, s * 0.065) : 0));
      }
    }
    memoire.set(k, H);
    if (memoire.size > 24) memoire.delete(memoire.keys().next().value);
    return H;
  }

  // Le sol d'une tranche et de ses voisines, lu au plus proche.
  function lecteur(k) {
    const P = reliefTranche(k - 1), I = reliefTranche(k), S = reliefTranche(k + 1), s0 = (k - 1) * T;
    return (x, s) => {
      const i = Math.max(0, Math.min(nx - 1, Math.floor(x / pas))), j = Math.max(0, Math.min(3 * nt - 1, Math.floor((s - s0) / pas)));
      const t = j < nt ? P : j < 2 * nt ? I : S;
      return t[(j % nt) * nx + i];
    };
  }

  // La lumière du relief : l'ombre que le terrain se fait à lui-même, et les creux où le ciel entre mal.
  function lumiereTranche(k, sol) {
    const lum = new Uint8Array(lx * lt * 2), s0 = k * T, haut0 = (x, s) => Math.max(0, sol(x, s));
    const [sx, sy, sz] = SOLEIL, hl = Math.hypot(sx, sz), dxs = sx / hl, dss = -sz / hl, pente = sy / hl;
    for (let j = 0, q = 0; j < lt; j++) for (let i = 0; i < lx; i++, q += 2) {
      const x = (i + 0.5) * pasLum, s = s0 + (j + 0.5) * pasLum, h0 = haut0(x, s);
      let v = 1;
      for (const d of PAS_T) {
        const e = h0 + d * pente - haut0(x + dxs * d, s + dss * d);
        // Plus l'obstacle est loin, plus son ombre est douce et faible : elle s'éteint avant la limite du calcul, sans bord net.
        const u = 1 - (1 - Math.max(0, Math.min(1, (e + 1.6 + d * 0.02) / (3.2 + d * 0.04)))) * (1 - lisse(170, 380, d));
        if (u < v) v = u;
        if (v <= 0) break;
      }
      let a = 0;
      for (const r0 of [10, 28]) {
        a += Math.max(0, haut0(x + r0, s) - h0) + Math.max(0, haut0(x - r0, s) - h0) + Math.max(0, haut0(x, s + r0) - h0) + Math.max(0, haut0(x, s - r0) - h0);
      }
      lum[q] = Math.round(v * 255); lum[q + 1] = Math.round(255 * (1 - Math.min(0.72, a / 210)));
    }
    return lum;
  }

  // Le vent d'une tranche : résolu finement sur elle et ses voisines, tenu aux bords par le grand écoulement.
  function ventTranche(k, sol) {
    const nj = 3 * vt, n = gx * nj, s0 = (k - 1) * T;
    const haut = new Float32Array(n), psi = new Float32Array(n), abri = new Float32Array(n);
    for (let j = 0, q = 0; j < nj; j++) for (let i = 0; i < gx; i++, q++) {
      const x = (i + 0.5) * pasVent, s = s0 + (j + 0.5) * pasVent;
      haut[q] = Math.max(0, sol(x, s)); psi[q] = lireA(psiA, x, s);
    }
    // Les murs : ce qui est plein ne laisse pas passer le vent.
    const dedans = new Uint8Array(n);
    for (const e of pleins) {
      if (e.s + e.r < s0 || e.s - e.r > s0 + nj * pasVent) continue;
      const i0 = Math.max(0, Math.floor((e.x - e.r) / pasVent)), i1 = Math.min(gx - 1, Math.ceil((e.x + e.r) / pasVent));
      const j0 = Math.max(0, Math.floor((e.s - e.r - s0) / pasVent)), j1 = Math.min(nj - 1, Math.ceil((e.s + e.r - s0) / pasVent));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (Math.hypot((i + 0.5) * pasVent - e.x, s0 + (j + 0.5) * pasVent - e.s) > e.r + 3) continue;
        const q = j * gx + i; haut[q] += Math.min(60, e.h); dedans[q] = 1;
      }
    }
    for (let i = 0; i < gx; i++) abri[(nj - 1) * gx + i] = lireA(abriA, (i + 0.5) * pasVent, s0 + (nj - 0.5) * pasVent);
    const moy = moyenner(haut, gx, nj, 11);
    relaxer(psi, resistance(haut, moy), gx, nj, ITER_TRANCHE, true);
    // L'abri se juge de près : dans un défilé, une lame compte, même si les parois sont cent fois plus hautes qu'elle.
    abriter(haut, moyenner(haut, gx, nj, 5), gx, nj, abri, 0.965);

    // Le vent final : rotationnel de ψ plus une turbulence large, multiplié par la force de la contrée.
    for (let j = 0, q = 0; j < nj; j++) for (let i = 0; i < gx; i++, q++) {
      const x = (i + 0.5) * pasVent, s = s0 + (j + 0.5) * pasVent;
      psi[q] += 38 * b.fbm(x / 220, s / 220 + 40, 3) + 10 * b.fbm(x / 72, s / 72, 2);
    }
    const v = new Float32Array(gx * vt * 4);
    for (let j = 0, q = 0; j < vt; j++) {
      const J = j + vt, s = k * T + (j + 0.5) * pasVent, F = forceA(s), P = plafondA(s);
      for (let i = 0; i < gx; i++, q += 4) {
        const ie = Math.min(gx - 1, i + 1), io = Math.max(0, i - 1);
        const dx = (psi[J * gx + ie] - psi[J * gx + io]) / ((ie - io) * pasVent);
        const ds = (psi[(J + 1) * gx + i] - psi[(J - 1) * gx + i]) / (2 * pasVent);
        const ab = abri[J * gx + i], a = 1 - 0.9 * Math.min(1, ab);
        let vx = ds * F * a, vs = -dx * F * a;
        const m = Math.hypot(vx, vs);
        if (m > P) { vx *= P / m; vs *= P / m; }
        if (dedans[J * gx + i]) vx = vs = 0;
        v[q] = vx; v[q + 1] = vs; v[q + 2] = ab; v[q + 3] = 1;
      }
    }
    return v;
  }

  function fabriquerTranche(k) {
    const sol = lecteur(k);
    return { k, h: reliefTranche(k).slice(), v: ventTranche(k, sol), l: lumiereTranche(k, sol) };
  }

  const esquisse = {
    graine, route, coteDetour, abris, lieux, emprises: pleins, ax, as, margeApercu: MARGE_APERCU, pasApercu: PAS_APERCU, apercu,
    contrees: contrees.map(({ id, nom, s, relief: rl, force, ombre, lumiere, encre, trait, ciel, pasLigne, rides = 0, grain = 0, herbe = 0, herbeTon }) => ({ id, nom, s, relief: rl, force, ombre, lumiere, encre, trait, ciel, pasLigne, rides, grain, herbe, herbeTon })),
  };
  return { esquisse, tranche: fabriquerTranche, relief: reliefTranche };
}
