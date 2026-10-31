// Vérifie qu'un monde se traverse à pied : parcours en largeur avec la règle de pente de la Horde.
// Le relief se lit tranche par tranche, on n'en garde que quelques-unes à la fois.
// node outils/passage.mjs [nb de graines]
import { creerFabrique } from '../src/monde/fabrique.js';
import { MONDE, SDEPART } from '../src/monde/contrees.js';

const n = +(process.argv[2] || 4), PAS = 1.6, MAXI = 1.7 * PAS, { W, L, pas, tranche: T } = MONDE;
const nx = W / pas, nt = T / pas;
let echecs = 0;
for (let g = 0; g < n; g++) {
  const graine = g === 0 ? 34 : g === 1 ? 2026 : g * 7919;
  const F = creerFabrique(graine), route = F.esquisse.route, pleins = F.esquisse.emprises;
  const H = (k) => F.relief(k);
  const h = (x, s) => {
    const fx = Math.max(0, Math.min(nx - 1.001, x / pas - 0.5)), fs = s / pas - 0.5, i = fx | 0, j = Math.floor(fs), a = fx - i, b = fs - j;
    const lire = (r, c) => { const k = Math.floor(r / nt); return H(k)[(r - k * nt) * nx + c]; };
    return Math.max(0, (lire(j, i) * (1 - a) + lire(j, i + 1) * a) * (1 - b) + (lire(j + 1, i) * (1 - a) + lire(j + 1, i + 1) * a) * b);
  };
  const c = 2, cx = Math.floor(W / c), cs = Math.floor(L / c), vu = new Uint8Array(cx * cs), f = new Int32Array(cx * cs);
  const sDep = SDEPART, iDep = Math.round(route[Math.round(sDep / pas)] / c), jDep = Math.round(sDep / c);
  let a = 0, b = 0, plusLoin = 0;
  f[b++] = jDep * cx + iDep; vu[f[0]] = 1;
  while (a < b) {
    const k = f[a++], j = Math.floor(k / cx), i = k - j * cx, h0 = h(i * c, j * c);
    if (j * c > plusLoin) plusLoin = j * c;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = i + di, v = j + dj;
      if (u < 4 || u >= cx - 4 || v < 16 || v >= cs) continue;
      const q = v * cx + u;
      if (vu[q]) continue;
      // Pente tâtée au pas de la Horde, dans le sens de la marche.
      if (h((i + di * PAS / c) * c, (j + dj * PAS / c) * c) - h0 > MAXI) continue;
      if (pleins.some((e) => Math.abs(e.s - v * c) < e.r + 3 && Math.hypot(u * c - e.x, v * c - e.s) < e.r + 3)) continue;
      vu[q] = 1; f[b++] = q;
    }
  }
  const ok = plusLoin >= L - 120;
  if (!ok) echecs++;
  console.log(`graine ${String(graine).padStart(6)} : ${ok ? 'traversée' : `BLOQUÉE à f=${(plusLoin / L).toFixed(3)}`}`);
}
console.log(echecs ? `${echecs} monde(s) bloqué(s)` : 'Tous les mondes se traversent.');
process.exitCode = echecs ? 1 : 0;
