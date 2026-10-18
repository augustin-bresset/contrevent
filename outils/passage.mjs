// Vérifie qu'un monde se traverse à pied : parcours en largeur avec la règle de pente de la Horde.
// node outils/passage.mjs [nb de graines]
import { fabriquerMonde } from '../src/monde/fabrique.js';
import { MONDE } from '../src/monde/contrees.js';

const n = +(process.argv[2] || 12), PAS = 1.6, MAXI = 1.7 * PAS;
let echecs = 0;
for (let g = 0; g < n; g++) {
  const graine = g === 0 ? 34 : g === 1 ? 2026 : g * 7919;
  const m = fabriquerMonde(graine), { W, L, pas } = MONDE;
  const h = (x, s) => {
    const fx = Math.max(0, Math.min(m.nx - 1.001, x / pas)), fs = Math.max(0, Math.min(m.ns - 1.001, s / pas));
    const i = fx | 0, j = fs | 0, a = fx - i, b = fs - j, k = j * m.nx + i, H = m.hauteur;
    return Math.max(0, (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + m.nx] * (1 - a) + H[k + m.nx + 1] * a) * b);
  };
  const c = 2, nx = Math.floor(W / c), ns = Math.floor(L / c), vu = new Uint8Array(nx * ns), f = new Int32Array(nx * ns);
  const sDep = 132, iDep = Math.round(m.route[Math.round(sDep / pas)] / c), jDep = Math.round(sDep / c);
  let a = 0, b = 0, plusLoin = 0;
  f[b++] = jDep * nx + iDep; vu[f[0]] = 1;
  while (a < b) {
    const k = f[a++], j = Math.floor(k / nx), i = k - j * nx, h0 = h(i * c, j * c);
    if (j * c > plusLoin) plusLoin = j * c;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = i + di, v = j + dj;
      if (u < 4 || u >= nx - 4 || v < 16 || v >= ns) continue;
      const q = v * nx + u;
      if (vu[q]) continue;
      // Pente tâtée au pas de la Horde, dans le sens de la marche.
      if (h((i + di * PAS / c) * c, (j + dj * PAS / c) * c) - h0 > MAXI) continue;
      vu[q] = 1; f[b++] = q;
    }
  }
  const ok = plusLoin >= L - 120;
  if (!ok) echecs++;
  console.log(`graine ${String(graine).padStart(6)} : ${ok ? 'traversée' : `BLOQUÉE à f=${(plusLoin / L).toFixed(3)}`}`);
}
console.log(echecs ? `${echecs} monde(s) bloqué(s)` : 'Tous les mondes se traversent.');
process.exitCode = echecs ? 1 : 0;
