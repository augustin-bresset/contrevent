// Ce qui est semé sur le sol. Une même réponse pour le rendu, pour le vent et pour les pas : ce qu'on voit, on ne le traverse pas.
import { SEMIS } from './contrees.js';
import { PIECES } from './villes.js';

// Trois grilles : les grands blocs jusqu'à l'horizon, le paysage autour, le menu sous les pieds.
export const GRILLES = [
  { cote: 120, R: 3000, ech: 3.4, regle: 2, grands: true },
  { cote: 24, R: 640, ech: 1.4, regle: 0, grands: false },
  { cote: 8, R: 190, ech: 0.5, regle: 1, grands: false },
];

const DURS = new Set(['rocher', 'eclat', 'glacon']);
const SEUIL = 0.7;      // en dessous, on l'enjambe
const VOIE = 9;         // la route reste libre, de quoi passer à vingt-trois

export function tirage(graine, a, b, k) {
  let h = Math.imul(a * 73856093 ^ b * 19349663 ^ k * 83492791 ^ graine, 1540483477);
  h ^= h >>> 15; h = Math.imul(h, 739982445);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const rayon = (forme, taille, q0) => (forme === 'glacon' ? taille * (q0 < 0.5 ? 2 : 1.7) : forme === 'eclat' ? taille * 0.57 : forme === 'rocher' ? taille * 1.05 : 0);

// `poser(forme, x, s, taille, sol, k, q0, ton, i, j)` pour chaque chose de la case.
export function semerCase(M, i, j, { cote, ech, regle, grands }, poser, cx = 0, cs = 0, R = Infinity) {
  const x0 = i * cote, s0 = j * cote, table = SEMIS[M.contreeA(s0).relief];
  if (!table) return;
  const g = M.graine;
  for (let k = 0; k < table.length; k++) {
    const [forme, chance, [t0, t1], ton, opt] = table[k];
    if (grands && forme !== 'rocher' && forme !== 'eclat' && forme !== 'glacon') continue;
    if (tirage(g, i, j, k + regle * 31) > chance * (grands ? 0.5 : 1)) continue;
    const x = x0 + tirage(g, i, j, k + 11) * cote, s = s0 + tirage(g, i, j, k + 23) * cote;
    if (x < 0 || x > M.W || s < 0 || s > M.L) continue;
    if (Math.hypot(x - cx, s - cs) > R) continue;
    if (M.plein(x, s, 3)) continue;
    const hb = M.h(x, s);
    if (opt?.eau ? (hb > 0.25 || hb < -1.5) : hb < 0.12) continue;
    if (Math.abs(M.h(x + 1.5, s) - M.h(x - 1.5, s)) + Math.abs(M.h(x, s + 1.5) - M.h(x, s - 1.5)) > 3.6) continue;
    const taille = (t0 + (t1 - t0) * tirage(g, i, j, k + 37) ** 2) * ech, q0 = tirage(g, i, j, k + 61), r = rayon(forme, taille, q0);
    const ecart = Math.abs(x - M.xRoute(s));
    if (taille > 2 && ecart < 6) continue;
    if (r >= SEUIL && ecart < r + VOIE) continue;
    poser(forme, x, s, taille, hb, k, q0, ton, i, j);
  }
}

// Ce qu'une chose semée occupe au sol. Les colonnes de glace reprennent les cercles de leur pièce, tournés comme elle.
export function emprisesSemees(graine, forme, x, s, taille, k, q0, i, j) {
  if (!DURS.has(forme)) return [];
  const r = rayon(forme, taille, q0);
  if (r < SEUIL) return [];
  if (forme !== 'glacon') return [{ x, s, r, h: taille * (forme === 'eclat' ? 2 : 1.3) }];
  const P = PIECES[q0 < 0.5 ? 'glaceC' : 'glaceB'], e = taille * 0.1, ry = tirage(graine, i, j, k + 43) * 6.28, c = Math.cos(ry), n = Math.sin(ry);
  return P.e.map(([a, b, q]) => ({ x: x + (a * c + b * n) * e, s: s - (-a * n + b * c) * e, r: q * e, h: P.h * e }));
}
