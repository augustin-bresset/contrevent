// L'atelier du bâti. Chaque pièce est sculptée en fonctions de distance : des volumes purs, fondus les uns dans les autres,
// creusés de grandes baies. On en tire un maillage, on y cuit l'ombre des creux et l'usure des arêtes, puis on le réduit.
// C'est la lumière et la masse qui font la beauté de ces pièces, pas le détail.
// node outils/bati.mjs [noms…]   (meshoptimizer doit être installé)
import { MeshoptSimplifier as M } from 'meshoptimizer';
import fs from 'node:fs';

const abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, PI = Math.PI;
const clamp = (a, b, x) => max(a, min(b, x));
const smin = (a, b, k) => { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const fract = (x) => x - Math.floor(x);
const h3 = (x, y, z) => fract(sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
const lisse = (t) => t * t * (3 - 2 * t);
function vn(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), a = lisse(x - i), b = lisse(y - j), c = lisse(z - k);
  const q = (p, r, s) => h3(i + p, j + r, k + s);
  const l = (u, v, t) => u + (v - u) * t;
  return l(l(l(q(0, 0, 0), q(1, 0, 0), a), l(q(0, 1, 0), q(1, 1, 0), a), b), l(l(q(0, 0, 1), q(1, 0, 1), a), l(q(0, 1, 1), q(1, 1, 1), a), b), c) * 2 - 1;
}
const fbm = (x, y, z, o = 3) => { let v = 0, a = 0.5; for (let i = 0; i < o; i++) { v += a * vn(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return v; };
const boite = (x, y, z, bx, by, bz, r = 0) => { const qx = abs(x) - bx + r, qy = abs(y) - by + r, qz = abs(z) - bz + r; return Math.hypot(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - r; };
const ell = (x, y, z, a, b, c) => { const k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c)); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -min(a, b, c); };
// Une baie : une ouverture droite, fermée par un arc plein cintre. Ouverte selon z, centrée en x, le seuil à y = 0.
const baie = (x, y, z, l, h, p) => { const a = boite(x, y - (h - l) / 2, z, l, (h - l) / 2 + 0.01, p, 0), b = max(Math.hypot(x, y - (h - l)) - l, abs(z) - p); return min(a, b); };
function plier(x, z, n) { const r = Math.hypot(x, z), a = atan2(z, x), s = 2 * PI / n, q = ((a % s) + s + s / 2) % s - s / 2; return [r * cos(q), r * sin(q)]; }
// Un profil tourné autour de l'axe : la distance signée à un polygone (r, y).
function profil(pts) {
  const P = [[0, pts[0][1]], ...pts, [0, pts[pts.length - 1][1]]], n = P.length;
  return (px, py) => {
    let d = (px - P[0][0]) ** 2 + (py - P[0][1]) ** 2, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], wx = px - P[i][0], wy = py - P[i][1], t = clamp(0, 1, (wx * ex + wy * ey) / (ex * ex + ey * ey)), bx = wx - ex * t, by = wy - ey * t;
      d = min(d, bx * bx + by * by);
      const c1 = py >= P[i][1], c2 = py < P[j][1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * sqrt(d);
  };
}
// La pierre n'est jamais tout à fait droite.
const use = (x, y, z, k) => k * fbm(x / 7, y / 11, z / 7, 2);

const PIECES = {};

{
  const c = profil([[27, 0], [21, 3], [14, 15], [10.6, 44], [9, 104], [8.8, 116], [12.4, 123], [13, 131], [8, 137], [10.4, 142], [7.4, 151], [3, 160], [0.4, 172]]);
  const creux = (x, y, z) => { const [u, v] = plier(x, z, 6); return min(baie(v, y - 121, u - 12, 2.4, 11, 7), baie(v, y - 24, u - 14, 3.4, 18, 8)); };
  const plein = (x, y, z) => { const r = Math.hypot(x, z), a = atan2(z, x), b = lisse(clamp(0, 1, (y - 18) / 10)) * lisse(clamp(0, 1, (112 - y) / 8)); return c(r - 0.42 * b * cos(a * 14), y) * 0.86 + use(x, y, z, 0.35); };
  PIECES.fleche = { pas: 0.62, bbox: [-29, 29, -2, 175, -29, 29], tris: [7000, 1400], sdf: (x, y, z) => smax(plein(x, y, z), -creux(x, y, z), 1), mat: (x, y, z) => (creux(x, y, z) < 0.5 ? 2 : y > 136 ? 1 : 0) };
}
{
  const c = profil([[32, 0], [24, 4], [19, 18], [16, 90], [15, 160], [18, 168], [18, 174], [10, 182], [1, 190]]);
  const ramp = (x, y, z) => { const r = Math.hypot(x, z), a = atan2(z, x), t = 30, q = y - (a / (2 * PI)) * t, f = ((q % t) + t) % t - t / 2; return boite(r - 20, f, 0, 7.6, 1.1, 99, 0.6); };
  PIECES.helice = { pas: 0.7, bbox: [-34, 34, -2, 193, -34, 34], tris: [9000, 1800], sdf: (x, y, z) => { const d = c(Math.hypot(x, z), y) * 0.9 + use(x, y, z, 0.3), m = max(ramp(x, y, z), 14 - y, y - 166); return smin(d, m * 0.6, 1.2); }, mat: (x, y) => (y > 170 ? 1 : 0) };
}
{
  const c = profil([[17, 0], [13, 3], [10.6, 12], [9, 70], [9.8, 76], [10, 80], [6.5, 84], [3, 90], [0.4, 96]]);
  const creux = (x, y, z) => { const [u, v] = plier(x, z, 4); return min(baie(v, y - 70, u - 8, 1.8, 7.5, 5), baie(v, y - 3, u - 10, 3.2, 12, 6)); };
  PIECES.tourelle = { pas: 0.45, bbox: [-19, 19, -2, 98, -19, 19], tris: [3600, 800], sdf: (x, y, z) => smax(c(Math.hypot(x, z), y) * 0.9 + use(x, y, z, 0.2), -creux(x, y, z), 0.7), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : y > 80 ? 1 : 0) };
}
{
  const c = profil([[10, 0], [7.4, 3], [5.4, 14], [4.6, 66], [7, 69], [7, 72], [4.4, 74], [4.6, 80], [3, 86], [0.3, 92]]);
  const creux = (x, y, z) => { const [u, v] = plier(x, z, 4); return baie(v, y - 75, u - 4, 1.1, 4.4, 3); };
  PIECES.minaret = { pas: 0.34, bbox: [-11, 11, -2, 94, -11, 11], tris: [2400, 500], sdf: (x, y, z) => smax(c(Math.hypot(x, z), y) * 0.9, -creux(x, y, z), 0.4), mat: (x, y, z) => (creux(x, y, z) < 0.3 ? 2 : y > 79 ? 1 : 0) };
}
{
  const creux = (x, y, z) => min(baie(x + 9, y, z - 14, 3, 9.5, 5), baie(x - 9, y - 7, z - 14, 2, 5.6, 5), baie(x - 21, y - 7, z, 5, 5.6, 2.2) - 0 + 99);
  const d0 = (x, y, z) => { const a = boite(x, y - 7, z, 21, 8, 13, 2.4), v = max(Math.hypot(y - 10, z) - 13.4, abs(x) - 19.5), b = boite(x, y - 1, z, 23, 2.4, 15, 1.2); return smin(smin(a, v, 2.4), b, 3.5) + use(x, y, z, 0.3); };
  PIECES.maison = { pas: 0.42, bbox: [-25, 25, -2, 26, -17, 17], tris: [2200, 500], sdf: (x, y, z) => smax(d0(x, y, z), -creux(x, y, z), 0.7), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : 0) };
}
{
  const creux = (x, y, z) => { const [u, v] = plier(x, z, 4); return min(baie(v, y, u - 12, 3.2, 9.5, 6), baie(v, y - 18, u - 9, 2.2, 6.4, 5)); };
  const d0 = (x, y, z) => smin(smin(boite(x, y - 8, z, 14, 9, 14, 3), boite(x, y - 24, z, 10.4, 9, 10.4, 2.6), 1.6), ell(x, y - 33, z, 9.4, 6.8, 9.4), 1.4) + use(x, y, z, 0.3);
  PIECES.maison2 = { pas: 0.42, bbox: [-17, 17, -2, 42, -17, 17], tris: [2400, 500], sdf: (x, y, z) => smax(d0(x, y, z), -creux(x, y, z), 0.7), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : 0) };
}
{
  const c = profil([[21, 0], [18, 2], [17.4, 13], [18.6, 15], [15.8, 17], [17, 22], [16, 30], [11.6, 37], [6, 41], [0.4, 46]]);
  const creux = (x, y, z) => { const [u, v] = plier(x, z, 8); return baie(v, y, u - 17, 3, 11, 5); };
  PIECES.dome = { pas: 0.4, bbox: [-23, 23, -2, 48, -23, 23], tris: [3000, 640], sdf: (x, y, z) => smax(c(Math.hypot(x, z), y) * 0.9 + use(x, y, z, 0.18), -creux(x, y, z), 0.7), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : y > 16.2 ? 1 : 0) };
}
{
  const c = profil([[13, 0], [10, 2], [7.6, 44], [9, 46], [9, 50], [6, 55], [0.4, 62]]);
  const creux = (x, y, z) => baie(x, y, z - 9, 2.4, 8, 3);
  PIECES.moulin = { pas: 0.34, bbox: [-14, 14, -2, 64, -14, 14], tris: [1800, 420], sdf: (x, y, z) => smax(c(Math.hypot(x, z), y) * 0.9 + use(x, y, z, 0.2), -creux(x, y, z), 0.5), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : y > 46 ? 1 : 0) };
}
{
  // Les ailes du moulin : cinq toiles sur leur moyeu, autour de z.
  PIECES.ailes = { base: 5, pas: 0.26, bbox: [-30, 30, -30, 30, -3, 3], tris: [1400, 360], sdf: (x, y, z) => { const [u, v] = plier(x, y, 5), t = boite(u - 16, v - 2, z - v * 0.12, 13, 3.8, 0.26, 0.2), a = boite(u - 15, v, z, 15, 0.36, 0.36, 0.2); return min(min(t, a), ell(x, y, z, 2.4, 2.4, 2.2)); }, mat: (x, y, z) => { const [u, v] = plier(x, y, 5); return boite(u - 15, v, z, 15.3, 0.6, 0.6) < 0.2 ? 1 : 0; } };
}
{
  const creux = (x, y, z) => { const q = ((x + 70) % 14 + 14) % 14 - 7; return abs(x) > 28 ? 9 : baie(q, y, z, 4.4, 12, 7); };
  PIECES.mur = { pas: 0.4, bbox: [-37, 37, -2, 20, -8, 8], tris: [2200, 500], sdf: (x, y, z) => smax(smin(boite(x, y - 8, z, 35, 9, 3.6, 1.4), boite(x, y - 0.5, z, 36, 2.4, 6, 1.4), 3) + use(x, y, z, 0.3), -creux(x, y, z), 0.8), mat: (x, y, z) => (creux(x, y, z) < 0.4 ? 2 : 0) };
}
{
  // La porte d'Urle : deux pylônes, un linteau, et pas un ornement. Ouverte selon z.
  const pyl = (x, y, z) => { const k = 1 - y / 300; return boite(x / k, y - 55, z / k, 19, 56, 25, 5) * k; };
  const d0 = (x, y, z) => { const a = min(pyl(x - 52, y, z), pyl(x + 52, y, z)); const l = boite(x, y - 92, z, 74, 15, 21, 4), c = boite(x, y - 113, z, 44, 7, 14, 3); return smin(smin(a, l, 7), c, 3) + use(x, y, z, 0.8); };
  const creux = (x, y, z) => { const r = baie(x, y + 2, z, 33, 84, 40), g = ((y + 8) % 16 + 16) % 16 - 8; return min(r, max(abs(g) - 0.8, 0.5 - boite(x, y - 60, z, 96, 70, 30))); };
  PIECES.portique = { pas: 0.72, bbox: [-82, 82, -2, 122, -30, 30], tris: [6000, 1200], sdf: (x, y, z) => smax(d0(x, y, z), -baie(x, y + 2, z, 33, 84, 40), 2.5), mat: () => 0 };
}
{
  const c = profil([[25, 0], [24, 8], [21, 30], [19, 52], [17, 68], [13, 77], [9.4, 82], [8.6, 88], [11, 94], [11.2, 100], [8.6, 106], [3, 110], [0.4, 112]]);
  const visage = (x, y, z) => ell(x, y - 97, z + 9.5, 6, 8.6, 6.6);
  const d0 = (x, y, z) => {
    const a = atan2(z, x), r = Math.hypot(x, z * 1.3), plis = 0.9 * clamp(0, 1, (76 - y) / 70) * cos(a * 7 + y * 0.022);
    const corps = c(r - plis, y) * 0.74, baton = max(Math.hypot(x - 25 - y * 0.004, z + 12) - 1.5, y - 124);
    return smin(corps + use(x, y, z, 0.5), baton, 1.2);
  };
  PIECES.colosse = { pas: 0.6, bbox: [-30, 30, -2, 126, -26, 26], tris: [6000, 1200], sdf: (x, y, z) => smax(d0(x, y, z), -visage(x, y, z), 1.6), mat: (x, y, z) => (visage(x, y, z) < 0.8 ? 2 : 0) };
}
{
  const c = profil([[4.4, 0], [3.8, 3], [3.2, 10], [2.5, 13], [2.8, 16], [1.8, 19], [0.3, 20]]);
  const visage = (x, y, z) => ell(x, y - 16.2, z + 2.5, 1.4, 2, 1.6);
  PIECES.stele = { pas: 0.13, bbox: [-5, 5, -1, 21, -5, 5], tris: [1100, 240], sdf: (x, y, z) => smax(c(Math.hypot(x, z * 1.3), y) * 0.8 + 0.34 * fbm(x / 1.8, y / 3, z / 1.8, 3), -visage(x, y, z), 0.3), mat: (x, y, z) => (visage(x, y, z) < 0.2 ? 2 : 0) };
}
{
  const c = profil([[12, 0], [11.6, 2], [9, 8], [4, 15], [0.8, 19], [0.4, 21]]);
  const creux = (x, y, z) => baie(x, y, z - 10, 2.4, 6, 3);
  PIECES.tente = { base: 5, pas: 0.22, bbox: [-13, 13, -1, 22, -13, 13], tris: [1300, 300], sdf: (x, y, z) => { const a = atan2(z, x), r = Math.hypot(x, z); return smax(c(r - 0.3 * cos(a * 10) * clamp(0, 1, (15 - y) / 10), y) * 0.8, -creux(x, y, z), 0.4); }, mat: (x, y, z) => (creux(x, y, z) < 0.25 ? 2 : 0) };
}
{
  // Les orgues de glace : des prismes à six pans, serrés, coupés de biais. Rien que des plans, et la lumière qui les traverse.
  const prisme = (c) => (x, y, z) => {
    const px = x - c[0] - c[4] * y, pz = z - c[1] - c[5] * y, q = max(abs(px) * 0.866 + abs(pz) * 0.5, abs(pz)) - c[2];
    const haut = y - c[3] + px * c[6] + pz * c[7];
    return max(q, haut) * 0.8;
  };
  const faire = (L) => { const P = L.map(prisme); return (x, y, z) => { let d = 1e9; for (const f of P) d = min(d, f(x, y, z)); return max(d, -3 - y); }; };
  const A = [[0, 0, 11, 120, 0.02, -0.01, 0.5, 0.3], [17, 6, 8.5, 86, -0.03, 0, -0.4, 0.5], [-15, 9, 9.5, 98, 0.04, 0.02, 0.6, -0.2], [7, -17, 8, 74, 0, 0.05, 0.3, 0.7], [-11, -15, 7, 58, 0.03, 0.04, -0.6, 0.3], [27, -9, 6.5, 48, -0.05, 0.02, 0.7, 0.2], [-27, -5, 6, 40, 0.06, 0.01, -0.5, -0.5], [9, 20, 6, 44, 0, -0.05, 0.3, -0.6]];
  const B = [[0, 0, 7.5, 70, 0.1, 0, 0.8, 0.2], [9, 7, 5, 40, 0.06, -0.03, -0.5, 0.5], [-7, 8, 4, 26, 0.12, -0.05, 0.6, -0.4]];
  const C = [[0, 0, 8, 34, 0.03, 0, 0.6, 0.4], [12, 4, 6, 24, -0.08, 0, -0.5, 0.4], [-10, 6, 5.5, 20, 0.1, 0.03, 0.5, -0.5], [2, -12, 5, 16, 0, 0.1, 0.2, 0.6]];
  PIECES.glaceA = { base: 3, pas: 0.5, bbox: [-40, 40, -4, 124, -36, 34], tris: [2600, 700], sdf: faire(A), mat: () => 0 };
  PIECES.glaceB = { base: 3, pas: 0.34, bbox: [-16, 26, -4, 74, -13, 16], tris: [900, 260], sdf: faire(B), mat: () => 0 };
  PIECES.glaceC = { base: 3, pas: 0.26, bbox: [-22, 22, -4, 37, -20, 16], tris: [1000, 280], sdf: faire(C), mat: () => 0 };
}
{
  // Le volcan suspendu de Krafla : une goutte de roche renversée, sa couronne et sa bouche de feu.
  const c = profil([[0.5, -210], [14, -176], [42, -120], [88, -44], [122, 16], [128, 44], [118, 58], [96, 64], [80, 40], [0.5, 34]]);
  const fente = (x, y, z) => abs(fbm(x / 40, y / 90, z / 40, 3)) - 0.03 - 0.012 * clamp(0, 1, (30 - y) / 200);
  PIECES.volcan = { base: 4, pas: 2, bbox: [-146, 146, -216, 70, -146, 146], tris: [14000, 2600], sdf: (x, y, z) => { const a = atan2(z, x), r = Math.hypot(x, z), rid = 5 * cos(a * 13 + y * 0.03) + 3 * cos(a * 29 - y * 0.05); return c(r - rid * clamp(0, 1, (40 - y) / 50), y) * 0.72 + 7 * fbm(x / 28, y / 34, z / 28, 3) + max(0, -fente(x, y, z)) * 0 + 3 * clamp(0, 1, 1 + fente(x, y, z) * 18) * 0 ; }, mat: (x, y, z) => (y < 62 && Math.hypot(x, z) < 92 && y > 20 ? 4 : fente(x, y, z) < 0 && y < 40 ? 4 : 0) };
  PIECES.ecueil = { pas: 0.5, bbox: [-20, 20, -18, 18, -20, 20], tris: [900, 220], sdf: (x, y, z) => ell(x, y, z, 15, 11, 13) * 0.7 + 3.4 * fbm(x / 5, y / 5, z / 5, 3), mat: () => 0 };
}

// Le maillage : filets de surface sur une grille, qu'on n'évalue que près de la surface.
function mailler(P) {
  const [x0, x1, y0, y1, z0, z1] = P.bbox, h = P.pas, nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1, N = nx * ny * nz;
  const f = new Float32Array(N), B = 6, marge = B * h * 1.8;
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const c = P.sdf(x0 + (bi + B / 2) * h, y0 + (bj + B / 2) * h, z0 + (bk + B / 2) * h), loin = abs(c) > marge;
    for (let k = bk; k < min(bk + B, nz); k++) for (let j = bj; j < min(bj + B, ny); j++) for (let i = bi; i < min(bi + B, nx); i++) f[k * ny * nx + j * nx + i] = loin ? c : P.sdf(x0 + i * h, y0 + j * h, z0 + k * h);
  }
  const id = new Int32Array(N).fill(-1), pos = [], idx = [], I = (i, j, k) => k * ny * nx + j * nx + i;
  const coin = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], ar = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let s = 0, vx = 0, vy = 0, vz = 0, n = 0;
    const v = coin.map((c) => f[I(i + c[0], j + c[1], k + c[2])]);
    for (let q = 0; q < 8; q++) if (v[q] < 0) s |= 1 << q;
    if (s === 0 || s === 255) continue;
    for (const [a, b] of ar) if ((v[a] < 0) !== (v[b] < 0)) { const t = v[a] / (v[a] - v[b]); vx += coin[a][0] + (coin[b][0] - coin[a][0]) * t; vy += coin[a][1] + (coin[b][1] - coin[a][1]) * t; vz += coin[a][2] + (coin[b][2] - coin[a][2]) * t; n++; }
    id[I(i, j, k)] = pos.length / 3; pos.push(x0 + (i + vx / n) * h, y0 + (j + vy / n) * h, z0 + (k + vz / n) * h);
  }
  const quad = (a, b, c, d, inv) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (inv) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = f[I(i, j, k)] < 0;
    if (a !== (f[I(i + 1, j, k)] < 0)) quad(id[I(i, j - 1, k - 1)], id[I(i, j, k - 1)], id[I(i, j, k)], id[I(i, j - 1, k)], a);
    if (a !== (f[I(i, j + 1, k)] < 0)) quad(id[I(i - 1, j, k - 1)], id[I(i - 1, j, k)], id[I(i, j, k)], id[I(i, j, k - 1)], a);
    if (a !== (f[I(i, j, k + 1)] < 0)) quad(id[I(i - 1, j - 1, k)], id[I(i, j - 1, k)], id[I(i, j, k)], id[I(i - 1, j, k)], a);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

function finir(nom, P) {
  const t0 = Date.now(), { pos, idx } = mailler(P), n = pos.length / 3, S = P.sdf, e = P.pas * 0.5;
  const nor = new Float32Array(n * 3), inf = new Float32Array(n * 4), H = Math.max(P.bbox[1] - P.bbox[0], P.bbox[3] - P.bbox[2]);
  const A = clamp(1, 26, H * 0.05);
  for (let i = 0; i < n; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], gx, gy, gz;
    for (let q = 0; q < 2; q++) {
      const d = S(x, y, z);
      gx = S(x + e, y, z) - S(x - e, y, z); gy = S(x, y + e, z) - S(x, y - e, z); gz = S(x, y, z + e) - S(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
      x -= gx * d; y -= gy * d; z -= gz * d;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; nor[i * 3] = gx; nor[i * 3 + 1] = gy; nor[i * 3 + 2] = gz;
    // L'ombre des creux : ce que le volume cache, le long de la normale, puis vers le ciel.
    let o = 0, w = 1;
    for (let q = 1; q <= 5; q++) { const t = q * q * 0.05 * A, d = S(x + gx * t, y + gy * t, z + gz * t); o += w * max(0, t - d) / t; w *= 0.72; }
    const ux = gx * 0.5, uy = gy * 0.5 + 0.86, uz = gz * 0.5; let c = 0;
    for (let q = 1; q <= 3; q++) { const t = q * 0.5 * A, d = S(x + ux * t, y + uy * t, z + uz * t); c += max(0, t * 0.7 - d) / t; }
    const r = P.pas * 2.2, ar = (S(x + gx * r, y + gy * r, z + gz * r) + S(x - gx * r, y - gy * r, z - gz * r)) / r;
    const ao = clamp(0, 1, 1 - o * 0.3 - c * 0.26);
    // Les poids des matières, moyennés autour du point : leurs bords restent doux, même sur un maillage réduit.
    let wc = 0, wa = 0; const q0 = P.pas * 1.4;
    for (const [a, b, d] of [[0, 0, 0], [q0, 0, 0], [-q0, 0, 0], [0, q0, 0], [0, -q0, 0], [0, 0, q0], [0, 0, -q0]]) { const m = P.mat(x + a, y + b, z + d); if (m === 2 || m === 4) wc++; if (m === 1) wa++; }
    wc /= 7; wa /= 7;
    if (P.base !== 4) wc *= clamp(0, 1, (0.86 - ao) / 0.34);       // un creux est ce qui reste dans l'ombre : pas la façade autour de lui
    inf[i * 4] = ao; inf[i * 4 + 1] = clamp(0, 1, 0.5 + ar * 1.6); inf[i * 4 + 2] = wc; inf[i * 4 + 3] = wa;
  }
  const attrs = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) { attrs[i * 5] = nor[i * 3]; attrs[i * 5 + 1] = nor[i * 3 + 1]; attrs[i * 5 + 2] = nor[i * 3 + 2]; attrs[i * 5 + 3] = inf[i * 4] * 1.4; attrs[i * 5 + 4] = (inf[i * 4 + 2] + inf[i * 4 + 3]) * 2; }
  let k = 0; for (const v of pos) k = max(k, abs(v));
  const lods = P.tris.map((cible) => {
    const [J] = M.simplifyWithAttributes(idx, pos, 3, attrs, 5, [0.8, 0.8, 0.8, 0.8, 2], null, cible * 3, 0.06, []);
    const nn = new Int32Array(n).fill(-1), V = [], J2 = new Uint16Array(J.length);
    J.forEach((q, i) => { if (nn[q] < 0) { nn[q] = V.length; V.push(q); } J2[i] = nn[q]; });
    const p = new Int16Array(V.length * 3), m = new Int8Array(V.length * 3), a = new Uint8Array(V.length * 4);
    V.forEach((q, i) => { for (let c = 0; c < 3; c++) { p[i * 3 + c] = Math.round(pos[q * 3 + c] / k * 32767); m[i * 3 + c] = Math.round(nor[q * 3 + c] * 127); } for (let c = 0; c < 4; c++) a[i * 4 + c] = Math.round(inf[q * 4 + c] * 255); });
    const b64 = (x) => Buffer.from(x.buffer, x.byteOffset, x.byteLength).toString('base64');
    return { p: b64(p), n: b64(m), a: b64(a), i: b64(J2), v: V.length, t: J.length / 3 };
  });
  console.log(nom.padEnd(10), n, 'sommets →', lods.map((l) => l.t).join(' / '), 'triangles,', ((Date.now() - t0) / 1000).toFixed(1), 's');
  return { k, base: P.base || 0, lods: lods.map(({ p, n: q, a, i }) => ({ p, n: q, a, i })) };
}

await M.ready;
const dest = new URL('../src/rendu/bati-maillage.js', import.meta.url), demandes = process.argv.slice(2);
let tout = {};
if (demandes.length && fs.existsSync(dest)) tout = JSON.parse(fs.readFileSync(dest, 'utf8').replace(/^[^]*?export const BATI = /, '').replace(/;\s*$/, ''));
for (const [nom, P] of Object.entries(PIECES)) if (!demandes.length || demandes.includes(nom)) tout[nom] = finir(nom, P);
const js = `// Les pièces du bâti, sculptées par outils/bati.mjs : positions, normales, ombre / arête / matière, indices, en base64.\nexport const BATI = ${JSON.stringify(tout)};\n`;
fs.writeFileSync(dest, js);
console.log('js', Math.round(js.length / 1024), 'Ko');
