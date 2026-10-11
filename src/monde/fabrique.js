// Fabrique le monde à partir d'une graine : relief, abris, vent.
// Le vent n'est pas du bruit : c'est un écoulement résolu sur le relief (fonction de courant).
// Il contourne les massifs, s'accélère dans les défilés et laisse du calme sous le vent.
import { MONDE, CONTREES, LIEUX, SOLEIL, ECHELLE } from './contrees.js';
import { creerBruit, alea } from './bruit.js';

// Au-delà, plus aucun corps ne passe, même en bloc : il faut que la porte d'Urle reste une porte.
const PLAFOND = 1.7;
const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

export function fabriquerMonde(graine) {
  const { W, L, pas, pasVent } = MONDE;
  const K = ECHELLE.relief, HK = ECHELLE.hauteur, EM = ECHELLE.monument;
  const nx = Math.round(W / pas) + 1, ns = Math.round(L / pas) + 1;
  const b = creerBruit(graine), r = alea(graine ^ 0x5eed);

  // Les bornes des contrées, un peu déplacées par la graine, dans l'ordre du roman.
  const contrees = CONTREES.map((c, i) => ({ ...c, s: (i ? c.f + (r() - 0.5) * 0.012 : 0) * L, pasLigne: c.pasLigne * HK }));
  const lieux = LIEUX.map((l) => ({ ...l, dx: l.dx * EM, rayon: l.rayon * EM, s: (l.f + (r() - 0.5) * 0.006) * L }));

  // La route : un méandre lent qui garantit qu'un passage existe.
  const route = new Float32Array(ns);
  const p1 = r() * 6.28, p2 = r() * 6.28;
  for (let j = 0; j < ns; j++) {
    const s = j * pas;
    route[j] = W * 0.5 + W * 0.2 * Math.sin(s / 1520 + p1) + W * 0.1 * Math.sin(s / 570 + p2) + 60 * b.fbm(s / 700, 7.7, 2);
  }
  const xRoute = (s) => route[Math.max(0, Math.min(ns - 1, Math.round(s / pas)))];

  // Le détour des Malachites : long, le long de la glace, mais abrité. L'autre choix est la porte d'Urle.
  const coteDetour = xRoute(0.6 * L) > W / 2 ? 0.1 : 0.9;

  const relief = {
    banquise: (x, s) => 6 + 3.5 * b.fbm(x / 110, s / 110, 3) + 7 * Math.pow(b.crete(x / 170, s / 90, 3), 2),
    coteaux: (x, s) => 9 + 17 * (0.5 + 0.8 * b.fbm(x / 150, s / 150, 4)),
    flaque: (x, s) => {
      const n = b.fbm(x / 130, s / 130, 4);
      return -1.1 + 0.35 * b.fbm(x / 40, s / 40, 2) + Math.max(0, n - 0.3) * 34;
    },
    dunes: (x, s) => {
      const w = 90 * b.fbm(x / 260, s / 260, 3), q = (s + w + 0.25 * x) / 74 * 6.283;
      const onde = Math.pow(0.5 + 0.5 * Math.sin(q + 0.8 * Math.sin(q)), 1.6);
      const m = 0.6 + 0.6 * b.fbm(x / 340, s / 340, 2);
      return 5 + 13 * onde * m + 7 * (0.5 + b.fbm(x / 380, s / 380, 2));
    },
    canyon: (x, s) => 30 + 8 * b.fbm(x / 120, s / 120, 3),
    massif: (x, s) => 14 + 74 * Math.pow(b.crete(x / 180, s / 150, 5), 1.5),
    plateforme: (x, s) => 3.2 + 1.6 * b.fbm(x / 170, s / 170, 3),
    terrasses: (x, s) => {
      const h = 24 + 20 * b.fbm(x / 200, s / 200, 4);
      const k = 6, t = h / k, f = t - Math.floor(t);
      return (Math.floor(t) + lisse(0.75, 1, f)) * k;
    },
    cimes: (x, s) => 42 + 88 * Math.pow(b.crete(x / 150, s / 170, 5), 1.3),
    cendres: (x, s) => 40 + 10 * b.fbm(x / 90, s / 90, 3) + 18 * Math.pow(b.crete(x / 140, s / 140, 3), 2),
    vide: (x, s) => 40 + 1.5 * b.fbm(x / 200, s / 200, 2),
  };

  function hauteurDans(c, x, s) {
    let h = relief[c.relief](x / K, s / K) * HK;
    if (c.couloir) {
      const d = Math.abs(x - xRoute(s));
      h = mix(c.solRoute * HK + 2.5 * b.fbm(x / 60, s / 60, 2), h, lisse(c.couloir * K * 0.75, c.couloir * K * 2.1, d));
    }
    if (c.passe) {
      const d = Math.abs(x - W * coteDetour);
      h = mix((c.solRoute + 3) * HK, h, lisse(50, 110, d));
    }
    return h;
  }

  // --- Le relief ---
  const H = new Float32Array(nx * ns);
  const FONDU = 150;
  for (let j = 0, k = 0, ic = 0; j < ns; j++) {
    const s = j * pas;
    while (ic < contrees.length - 1 && s >= contrees[ic + 1].s) ic++;
    const c = contrees[ic], suiv = contrees[ic + 1], prec = contrees[ic - 1];
    const dSuiv = suiv ? suiv.s - s : Infinity, dPrec = s - c.s;
    for (let i = 0; i < nx; i++, k++) {
      const x = i * pas;
      let h = hauteurDans(c, x, s);
      if (dSuiv < FONDU) h = mix(hauteurDans(suiv, x, s), h, 0.5 + 0.5 * lisse(0, 1, dSuiv / FONDU));
      else if (prec && dPrec < FONDU) h = mix(hauteurDans(prec, x, s), h, 0.5 + 0.5 * lisse(0, 1, dPrec / FONDU));
      // Les deux glaces qui bordent le monde.
      const e = Math.min(x, W - x), g = 1 - lisse(0, 96 + 56 * b.s2(s / 190, x > W / 2 ? 3 : 9), e);
      h += 260 * g * g;
      // La Falaise des Confins, derrière Aberlaas.
      if (s < 240) { const f = 1 - lisse(30, 240, s); h += 320 * f * f; }
      H[k] = h;
    }
  }

  // Le monde s'achève sur le vide : le sol tombe dans la lumière.
  for (let j = 0, k = 0; j < ns; j++) {
    const s = j * pas, f = lisse(L - 70, L, s);
    for (let i = 0; i < nx; i++, k++) if (f > 0) H[k] -= f * f * 120;
  }

  // Les abris : des lames de roche en travers du vent, toujours à portée de la route.
  const abris = [];
  const poserAbri = (x, s, ax, as, h) => {
    abris.push({ x, s, ax, h });
    const i0 = Math.max(0, Math.floor((x - ax * 2.4) / pas)), i1 = Math.min(nx - 1, Math.ceil((x + ax * 2.4) / pas));
    const j0 = Math.max(0, Math.floor((s - as * 2.4) / pas)), j1 = Math.min(ns - 1, Math.ceil((s + as * 2.4) / pas));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = (i * pas - x) / ax, ds = (j * pas - s) / as;
      const e = Math.exp(-(dx * dx + ds * ds));
      const k = j * nx + i;
      H[k] = Math.max(H[k], mix(H[k], H[k] + h, e) + (e > 0.5 ? 1.2 * b.s2(i * 0.13, j * 0.13) : 0));
    }
  };
  for (let s = 620; s < L - 340; ) {
    const c = contrees.findLast((q) => q.s <= s), pasA = c.relief === 'flaque' ? 150 + r() * 70 : 110 + r() * 80;
    const cote = r() < 0.5 ? -1 : 1, montagne = c.relief === 'massif' || c.relief === 'cimes';
    if (montagne) {
      // Dans les défilés, de petites lames collées au flanc : on peut toujours souffler.
      poserAbri(xRoute(s) + cote * (c.couloir * K * 0.7 + 4), s, 13, 5, 18);
    } else if (c.relief !== 'vide') {
      const x = xRoute(s) + cote * (22 + r() * 90), flaque = c.relief === 'flaque';
      poserAbri(x, s, 24 + r() * 24, 7 + r() * 3, flaque ? 10 + r() * 4 : 21 + r() * 13);
    }
    s += pasA;
  }

  // --- La lumière du relief : l'ombre que le terrain se fait à lui-même, et les creux où le ciel entre mal ---
  const pasL = 5, lx = Math.round(W / pasL) + 1, ls = Math.round(L / pasL) + 1, lum = new Uint8Array(lx * ls * 2);
  const haut0 = (x, s) => {
    const i = Math.max(0, Math.min(nx - 1, Math.round(x / pas))), j = Math.max(0, Math.min(ns - 1, Math.round(s / pas)));
    return Math.max(0, H[j * nx + i]);
  };
  const [sx, sy, sz] = SOLEIL, hl = Math.hypot(sx, sz), dxs = sx / hl, dss = -sz / hl, pente = sy / hl;
  const PAS_T = [3, 6, 10, 15, 22, 32, 45, 62, 85, 115, 155, 210];
  for (let j = 0, k = 0; j < ls; j++) for (let i = 0; i < lx; i++, k += 2) {
    const x = i * pasL, s = j * pasL, h0 = haut0(x, s);
    let v = 1;
    for (const d of PAS_T) {
      const e = h0 + d * pente - haut0(x + dxs * d, s + dss * d);
      const q = Math.max(0, Math.min(1, (e + 1.6) / 3.2));
      if (q < v) v = q;
      if (v <= 0) break;
    }
    let a = 0;
    for (const r0 of [10, 28]) {
      a += Math.max(0, haut0(x + r0, s) - h0) + Math.max(0, haut0(x - r0, s) - h0) + Math.max(0, haut0(x, s + r0) - h0) + Math.max(0, haut0(x, s - r0) - h0);
    }
    lum[k] = Math.round(v * 255); lum[k + 1] = Math.round(255 * (1 - Math.min(0.72, a / 210)));
  }

  // --- Le vent ---
  const gx = Math.round(W / pasVent) + 1, gs = Math.round(L / pasVent) + 1, n = gx * gs;
  const moy = new Float32Array(n), haut = new Float32Array(n);
  const hAt = (x, s) => {
    const i = Math.max(0, Math.min(nx - 1, Math.round(x / pas))), j = Math.max(0, Math.min(ns - 1, Math.round(s / pas)));
    return H[j * nx + i];
  };
  for (let j = 0, k = 0; j < gs; j++) for (let i = 0; i < gx; i++, k++) haut[k] = Math.max(0, hAt(i * pasVent, j * pasVent));
  // Une moyenne locale, en deux passes de boîte : ce qui dépasse d'elle fait obstacle.
  const R = 11, tmp = new Float32Array(n);
  for (let j = 0; j < gs; j++) {
    let somme = 0;
    for (let i = -R; i <= R; i++) somme += haut[j * gx + Math.max(0, Math.min(gx - 1, i))];
    for (let i = 0; i < gx; i++) {
      tmp[j * gx + i] = somme / (2 * R + 1);
      somme += haut[j * gx + Math.min(gx - 1, i + R + 1)] - haut[j * gx + Math.max(0, i - R)];
    }
  }
  for (let i = 0; i < gx; i++) {
    let somme = 0;
    for (let j = -R; j <= R; j++) somme += tmp[Math.max(0, Math.min(gs - 1, j)) * gx + i];
    for (let j = 0; j < gs; j++) {
      moy[j * gx + i] = somme / (2 * R + 1);
      somme += tmp[Math.min(gs - 1, j + R + 1) * gx + i] - tmp[Math.max(0, j - R) * gx + i];
    }
  }
  // Résistance à l'écoulement, dans div(r grad ψ) = 0. Là où r est fort, ψ varie peu et le vent passe mal.
  const res = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const e = lisse(7, 28, haut[k] - moy[k]);
    res[k] = 1 + e * e * 24;
  }
  const psi = new Float32Array(n);
  for (let j = 0, k = 0; j < gs; j++) for (let i = 0; i < gx; i++, k++) psi[k] = i * pasVent;
  const omega = 1.86;
  for (let it = 0; it < 260; it++) {
    for (let j = 0; j < gs; j++) {
      const jm = j > 0 ? -gx : gx, jp = j < gs - 1 ? gx : -gx;   // bords amont et aval : flux libre
      for (let i = 1; i < gx - 1; i++) {
        const k = j * gx + i, r0 = res[k];
        const cw = r0 + res[k - 1], ce = r0 + res[k + 1], cs = r0 + res[k + jm], cn = r0 + res[k + jp];
        const v = (cw * psi[k - 1] + ce * psi[k + 1] + cs * psi[k + jm] + cn * psi[k + jp]) / (cw + ce + cs + cn);
        psi[k] += omega * (v - psi[k]);
      }
    }
  }

  // L'abri : ce qui est sous le vent d'un obstacle (le vent vient de l'amont, s décroissant).
  const abri = new Float32Array(n);
  for (let j = gs - 2; j >= 0; j--) for (let i = 0; i < gx; i++) {
    const k = j * gx + i, h = lisse(3.5, 18, haut[k] - moy[k]);
    const a = abri[k + gx], l = abri[k + gx - (i > 0 ? 1 : 0)], d = abri[k + gx + (i < gx - 1 ? 1 : 0)];
    abri[k] = Math.max(h, (a * 0.6 + l * 0.2 + d * 0.2) * 0.965);
  }

  // Le vent final : rotationnel de ψ plus une turbulence large, multiplié par la force de la contrée.
  for (let j = 0, k = 0; j < gs; j++) for (let i = 0; i < gx; i++, k++) {
    const s = j * pasVent, x = i * pasVent;
    psi[k] += 38 * b.fbm(x / 220, s / 220 + 40, 3) + 10 * b.fbm(x / 72, s / 72, 2);
  }
  const forceS = new Float32Array(gs);
  for (let j = 0, ic = 0; j < gs; j++) {
    const s = j * pasVent;
    while (ic < contrees.length - 1 && s >= contrees[ic + 1].s) ic++;
    const c = contrees[ic], suiv = contrees[ic + 1], q = suiv ? lisse(suiv.s - 120, suiv.s, s) : 0;
    forceS[j] = mix(c.force, suiv ? suiv.force : c.force, q);
  }
  const vent = new Float32Array(n * 4);
  for (let j = 0, k = 0; j < gs; j++) for (let i = 0; i < gx; i++, k++) {
    const ie = Math.min(gx - 1, i + 1), io = Math.max(0, i - 1), jn = Math.min(gs - 1, j + 1), js = Math.max(0, j - 1);
    const dx = (psi[j * gx + ie] - psi[j * gx + io]) / ((ie - io) * pasVent);
    const ds = (psi[jn * gx + i] - psi[js * gx + i]) / ((jn - js) * pasVent);
    const a = 1 - 0.9 * Math.min(1, abri[k]);
    let vx = ds * forceS[j] * a, vs = -dx * forceS[j] * a;
    const m = Math.hypot(vx, vs);
    if (m > PLAFOND) { vx *= PLAFOND / m; vs *= PLAFOND / m; }
    vent[k * 4] = vx; vent[k * 4 + 1] = vs; vent[k * 4 + 2] = abri[k]; vent[k * 4 + 3] = 1;
  }

  const trace = lieux.map((l) => ({ ...l, x: Math.max(30, Math.min(W - 30, xRoute(l.s) + l.dx)) }));
  return {
    graine, nx, ns, gx, gs, hauteur: H, vent, route, abris, coteDetour, lum, lx, ls,
    contrees: contrees.map(({ id, nom, s, relief: rl, force, ombre, lumiere, encre, trait, ciel, pasLigne, rides = 0, grain = 0, herbe = 0, herbeTon }) => ({ id, nom, s, relief: rl, force, ombre, lumiere, encre, trait, ciel, pasLigne, rides, grain, herbe, herbeTon })),
    lieux: trace,
  };
}
