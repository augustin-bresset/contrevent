// Le plan des villes : quelles pièces, où, à quelle échelle. Il sert au rendu, mais aussi au vent et aux pas :
// un mur arrête le vent, abrite ce qui est derrière lui, et ne se traverse pas. Rien ici ne dépend du navigateur.
import { HORDIERS } from '../jeu/hordiers.js';

// h : hauteur ; e : ce qui occupe le sol, en cercles [x, z, rayon], à l'échelle 1.
export const PIECES = {
  fleche: { h: 172, e: [[0, 0, 15]] },
  helice: { h: 190, e: [[0, 0, 24]] },
  tourelle: { h: 96, e: [[0, 0, 12]] },
  minaret: { h: 92, e: [[0, 0, 7]] },
  maison: { h: 24, e: [[-9, 0, 11], [9, 0, 11]] },
  maison2: { h: 40, e: [[0, 0, 15]] },
  dome: { h: 44, e: [[0, 0, 18]] },
  moulin: { h: 62, e: [[0, 0, 9]] },
  mur: { h: 18, e: [[-28, 0, 5], [-14, 0, 5], [0, 0, 5], [14, 0, 5], [28, 0, 5]] },
  portique: { h: 118, e: [[-52, 0, 19], [52, 0, 19]] },
  colosse: { h: 112, e: [[0, 0, 19]] },
  stele: { h: 20, e: [[0, 0, 3.2]] },
  tente: { h: 20, e: [[0, 0, 10]] },
  glaceA: { h: 120, e: [[0, 0, 26]] },
  glaceB: { h: 70, e: [[0, 0, 12]] },
  glaceC: { h: 34, e: [[0, 0, 15]] },
  volcan: { h: 0, e: [] },
};

const ROUTE_LIBRE = 20;

export function composer(l, r, xRoute) {
  const o = [];
  const poser = (p, dx, ds, { ry = r() * 6.283, e = 1, y = 0, pench = 0, ton = 0, force = false } = {}) => {
    const x = l.x + dx, s = l.s + ds;
    if (!force && PIECES[p].e.length) {
      const R = Math.max(...PIECES[p].e.map((c) => Math.hypot(c[0], c[1]) + c[2])) * e;
      if (Math.abs(x - xRoute(s)) < R + ROUTE_LIBRE) return;
    }
    o.push({ p, x, s, ry, e, y, pench, ton });
  };
  const gauche = (i) => (i % 2 ? 1 : -1);
  const pl = PLANS[l.id];
  if (pl) pl({ poser, r, gauche, l });
  return o;
}

const PLANS = {
  // La ville adossée à la Falaise : de grands orgues de glace, et les tours claires à leur pied.
  aberlaas({ poser, r }) {
    for (let i = 0; i < 18; i++) poser('glaceA', -360 + i * 42 + r() * 16, -96 - r() * 30, { e: 1 + r() * 1.1 });
    for (let i = 0; i < 9; i++) poser('tourelle', -200 + i * 50 + r() * 12, -40 + r() * 14, { e: 0.9 + r() * 0.6, ton: i % 2 });
    for (let i = 0; i < 10; i++) { const c = i % 2 ? 1 : -1; poser('glaceB', c * (230 + r() * 180), -30 + r() * 50, { e: 0.8 + r() * 0.7 }); }
    for (let i = 0; i < 6; i++) poser('glaceC', (i % 2 ? 1 : -1) * (170 + r() * 200), 20 + r() * 34, {});
  },
  // Le dernier port : des maisons basses, serrées contre le vent, et les moulins au-dessus.
  portchoon({ poser, r, gauche }) {
    for (let i = 0; i < 26; i++) poser(i % 3 ? 'maison' : 'maison2', gauche(i) * (34 + r() * 130), -80 + (i / 26) * 170 + r() * 12, { ry: (Math.round(r() * 3)) * 1.5708 + (r() - 0.5) * 0.2, e: 0.9 + r() * 0.3 });
    for (let i = 0; i < 5; i++) poser('moulin', gauche(i) * (70 + r() * 100), -100 + i * 44, { e: 1 + r() * 0.3 });
    for (let i = 0; i < 6; i++) poser('mur', gauche(i) * (46 + i * 12), 96, { ry: 0, e: 1 });
  },
  chawondasee({ poser, r, gauche }) {
    for (let i = 0; i < 12; i++) poser('dome', gauche(i) * (44 + r() * 140), -90 + i * 16 + r() * 8, { e: 0.8 + r() * 0.6 });
    for (let i = 0; i < 16; i++) poser('maison', gauche(i) * (30 + r() * 170), -96 + r() * 200, { ry: (Math.round(r() * 3)) * 1.5708, e: 0.8 + r() * 0.3 });
    for (let i = 0; i < 5; i++) poser('minaret', gauche(i) * (60 + r() * 90), -70 + i * 36, { e: 0.9 + r() * 0.3 });
  },
  // La cité verticale : deux rangs de flèches de part et d'autre du canyon, et la Tour d'Ær.
  alticcio({ poser, r, gauche }) {
    for (let i = 0; i < 22; i++) poser('fleche', gauche(i) * (62 + r() * 96), -250 + i * 23 + r() * 10, { e: 0.8 + r() * 0.62 });
    for (let i = 0; i < 14; i++) poser('maison2', gauche(i) * (44 + r() * 120), -240 + i * 36, { e: 1 + r() * 0.3, ry: r() * 1.5 });
    poser('helice', 132, -60, { e: 1.2 });
  },
  // Le seul passage du massif.
  urle({ poser }) {
    poser('portique', 0, 0, { ry: 0, e: 1, force: true });
    poser('colosse', -112, 16, { ry: 0, e: 1, force: true });
    poser('colosse', 112, 16, { ry: 0, e: 1, force: true });
  },
  // La 27e Horde : des stèles dans la formation qu'elle tenait, tournées vers l'amont. Deux sont tombées.
  egine({ poser, r }) {
    HORDIERS.forEach((h, i) => poser('stele', h.slot[0] * 8, h.slot[1] * 8 - 30, { ry: Math.PI + (r() - 0.5) * 0.25, e: 0.9 + (i * 7 % 5) * 0.12, pench: i % 11 === 7 ? 1.42 : (r() - 0.5) * 0.07, force: true }));
  },
  boban({ poser, r }) {
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; poser('tente', Math.cos(a) * (46 + r() * 22), Math.sin(a) * (46 + r() * 22), { ry: a + 1.57, e: 0.9 + r() * 0.5, ton: i % 3 }); }
  },
  brakauer({ poser, r, l }) {
    for (let i = 0; i < 26; i++) { const a = 0.34 + i / 25 * 5.6; poser('glaceA', Math.sin(a) * 300, Math.cos(a) * 300, { e: 0.9 + r() * 0.9 }); }
    for (let i = 0; i < 16; i++) { const a = r() * 6.283; poser('glaceB', Math.sin(a) * (120 + r() * 120), Math.cos(a) * (120 + r() * 120), { e: 0.8 + r() * 0.8 }); }
  },
  krafla({ poser }) { poser('volcan', 0, 0, { ry: 0.6, e: 1, y: 150, force: true }); },
};

// Ce que chaque pièce occupe au sol, dans le monde.
export function emprises(pieces) {
  const o = [];
  for (const q of pieces) {
    if (Math.abs(q.pench) > 1) continue;
    const c = Math.cos(q.ry), n = Math.sin(q.ry);
    for (const [a, b, r] of PIECES[q.p].e) o.push({ x: q.x + (a * c + b * n) * q.e, s: q.s - (-a * n + b * c) * q.e, r: r * q.e, h: PIECES[q.p].h * q.e });
  }
  return o;
}
