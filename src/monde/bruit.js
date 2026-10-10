// Bruit simplex 2D à graine. Tout le monde en dérive : même graine, même monde.
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];

export function alea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function creerBruit(graine) {
  const r = alea(graine), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function s2(x, y) {
    const t0 = (x + y) * F2, i = Math.floor(x + t0), j = Math.floor(y + t0), t = (i + j) * G2;
    const x0 = x - i + t, y0 = y - j + t, i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, a = 0.5 - x0 * x0 - y0 * y0;
    if (a > 0) { const g = perm[ii + perm[jj]] & 7; a *= a; n += a * a * (GX[g] * x0 + GY[g] * y0); }
    a = 0.5 - x1 * x1 - y1 * y1;
    if (a > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; a *= a; n += a * a * (GX[g] * x1 + GY[g] * y1); }
    a = 0.5 - x2 * x2 - y2 * y2;
    if (a > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; a *= a; n += a * a * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }
  function fbm(x, y, oct = 4) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += a * s2(x * f, y * f); f *= 2.03; a *= 0.5; }
    return v;
  }
  function crete(x, y, oct = 4) {
    let v = 0, a = 0.5, f = 1, w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(s2(x * f, y * f)); n *= n; n *= w;
      w = Math.min(1, n * 2); v += a * n; f *= 2.1; a *= 0.5;
    }
    return v;
  }
  return { s2, fbm, crete };
}
