// Joue des parties entières sans rendu, avec les vraies règles et un joueur automatique. Sert à régler la difficulté.
// node outils/simulation.mjs [graine] [adresse du joueur, 0 à 1]    →  une ligne de bilan, et le détail par contrée
import { creerFabrique } from '../src/monde/fabrique.js';
import { MONDE, SDEPART } from '../src/monde/contrees.js';
import { Monde } from '../src/monde/monde.js';
import { Vent } from '../src/jeu/vent.js';
import { Horde } from '../src/jeu/horde.js';
import { Evenements } from '../src/jeu/evenements.js';
import { Camp } from '../src/jeu/camp.js';
import { R } from '../src/jeu/reglages.js';
import { alea } from '../src/monde/bruit.js';

const graine = +(process.argv[2] || 34), adresse = +(process.argv[3] ?? 0.8), detail = process.argv.includes('--detail');
Math.random = alea(graine ^ 0xa11ce);

// Les minuteries suivent le temps du jeu, pas celui de la machine.
let temps = 0;
const minuteries = [];
globalThis.setTimeout = (fn, ms = 0) => { minuteries.push([temps + ms / 1000, fn]); return minuteries.length; };

const rien = new Proxy({}, { get: () => () => {} });
const fab = creerFabrique(graine), monde = new Monde(fab.esquisse);
function suivre(s) {
  for (const k of monde.manquantes(s)) monde.poser(fab.tranche(k));
  monde.envois.length = 0;
}
suivre(SDEPART);
const vent = new Vent(monde), horde = new Horde(monde, vent, monde.xRoute(SDEPART), SDEPART);
const j = {
  monde, vent, horde, hud: rien, audio: rien, fx: rien, eclats: rien, navire: { groupe: {}, poser() {}, corde() {} },
  vivres: R.vivresDepart, repas: false, ajouterVivres(n) { j.vivres += n; }, eclair() {}, temps: 0, camp: false, intensite: 0, combat: 0,
  ralentiCible: 1, pesanteur: 0, balise: null, regard: false, regarder() { return true; }, changerAir() {}, viser() {}, secousse() {}, sauver() {},
};
const camps = { n: 0, jeunes: 0 };
const ev = new Evenements(j), camp = new Camp(j, () => {});

const cmd = { dx: 0, ds: 1, actif: false, serre: false, vitesseMax: 0 };
const rIA = alea(graine ^ 0xb07);
let repos = false, but = null, tBut = 0, pause = 0;
const parContree = {};
const repere = { t: 0, s: 0, fin: 0, bloque: false };

const lu = { x: 0, s: 0, abri: 0 };
// Le joueur voit le vent : il cherche devant lui un creux où les lignes s'écartent vraiment.
function versAbri(rayon) {
  let best = null, d0 = rayon;
  for (let ds = -48; ds <= rayon; ds += 16) for (let dx = -rayon * 0.7; dx <= rayon * 0.7; dx += 16) {
    const x = horde.x + dx, s = horde.s + ds, d = Math.hypot(dx, ds);
    if (d < d0 && monde.v(x, s, lu).abri > 0.47 && Math.abs(monde.h(x, s) - monde.h(horde.x, horde.s)) < 30) { d0 = d; best = { x, s: s + 12 }; }
  }
  return best;
}

function joueur() {
  const m = vent.masque(horde.s, horde.x) * vent.front.presence;
  cmd.serre = m > 0.25 || horde.force > 1.3 || (!!ev.tempete && horde.abri < 0.42);
  cmd.actif = false; cmd.vitesseMax = j.pesanteur;
  if (horde.souffle > 0.92 || (j.vivres === 0 && !j.repas && horde.souffle >= R.plafondSansRepas - 0.01)) repos = false;
  const seuil = Math.min(j.vivres > 0 ? 0.48 : 0.3, (0.22 + 0.14 * adresse) * (horde.force > 1.25 ? 1.15 : 1));
  if (!repos && temps > pause && !ev.actifs() && horde.souffle < seuil) {
    if (horde.abri > 0.42) { repos = true; but = null; tBut = temps; }
    else { const a = versAbri(260); if (a) { repos = true; but = { x: a.x, s: a.s - 13 }; tBut = temps; } }
  }
  if (repos && !j.camp && temps - tBut > 45) { repos = false; pause = temps + 12; }

  const aller = (x, s) => { cmd.dx = x - horde.x; cmd.ds = s - horde.s; cmd.actif = true; };
  if (ev.tempete) {
    const b = j.balise || (horde.abri < 0.45 ? (() => { const a = versAbri(320); return a && { x: a.x, s: a.s - 12 }; })() : null);
    if (horde.abri >= 0.45 && !ev.ennemis.length) { /* on attend qu'il passe */ }
    else if (b) aller(b.x, b.s);
    else aller(monde.xRoute(horde.s + 60), horde.s + 60);
  } else if (repos && !ev.actifs()) {
    if (horde.abri > 0.42) { /* on se pose */ }
    else if (but) aller(but.x, but.s);
  } else if (!j.camp || horde.souffle > 0.95 || (!j.repas && horde.souffle >= R.plafondSansRepas - 0.01)) {
    const ahead = horde.s + 60;
    let x = monde.xRoute(ahead);
    for (const c of ev.chrones) if (Math.hypot(c.x - x, c.s - ahead) < c.r * 1.2) x = c.x + Math.sign(x - c.x || 1) * (c.r * 1.3 + 8);
    aller(x, ahead);
  }
  // Coincé dans un repli du relief : on redescend vers la route, comme le ferait quelqu'un qui regarde la carte.
  if (temps > repere.t + 40) { repere.bloque = !j.camp && !ev.tempete && horde.s - repere.s < 12; repere.t = temps; repere.s = horde.s; if (repere.bloque) repere.fin = temps + 14; }
  if (temps < repere.fin) { repos = false; aller(monde.xRoute(horde.s - 30), horde.s - 30); return; }
  // Un chrone qui approche, on le fuit de biais, en continuant de remonter : la Horde va plus vite que lui.
  for (const c of ev.chrones) {
    const d = Math.hypot(c.x - horde.x, c.s - horde.s);
    if (c.k !== 'vera' && d < c.r * 1.7) {
      const ux = (horde.x - c.x) / d, us = (horde.s - c.s) / d;
      repos = false; aller(horde.x + (ux || 1) * 80, horde.s + Math.max(us, 0.3) * 80);
      break;
    }
  }
  // Un joueur rate, et ne voit pas tout : l'adresse règle la part des clics qui portent.
  for (const e of ev.ennemis) if (Math.hypot(e.x - horde.x, e.s - horde.s) < 60 && rIA() < adresse) { ev.clic(e.x, e.s); break; }
  const c = ev.corroyeur;
  if (c && Math.hypot(c.x - horde.x, c.s - horde.s) < 40 && rIA() < adresse * 0.25) ev.clic(c.x, c.s);
}

const dt = 1 / 30;
const pertes = [];
horde.onPerteOrig = horde.onPerte;
const onPerte = horde.onPerte;
horde.onPerte = (m, cause) => { onPerte(m, cause); pertes.push({ f: horde.s / monde.L, cause, c: monde.contreeA(horde.s).id }); };
let tick = 0, kk = 0, fini = '';
let vivresMin = 99;
const LIMITE = +(process.env.LIMITE || 6) * 3600;
while (temps < LIMITE) {
  temps += dt; tick++;
  for (let i = minuteries.length - 1; i >= 0; i--) if (minuteries[i][0] <= temps) { const [, fn] = minuteries.splice(i, 1)[0]; fn(); }
  if (Math.floor(horde.s / MONDE.tranche) !== kk) { kk = Math.floor(horde.s / MONDE.tranche); suivre(horde.s); }
  if (tick % 4 === 0) joueur();
  j.ralentiCible = 1; j.pesanteur = 0; j.temps = temps;
  vent.maj(dt);
  ev.maj(dt);
  const avant = j.camp;
  horde.maj(dt * j.ralentiCible, cmd);
  camp.maj(dt, cmd.actif, ev);
  if (!avant && j.camp) { camps.n++; if (!j.repas) camps.jeunes++; }
  horde.veillee += ((j.camp ? 1 : 0) - horde.veillee) * (1 - Math.exp(-dt * 1.4));
  const id = monde.contreeA(horde.s).id, q = parContree[id] ??= { t: 0, v0: horde.nb, camps: 0, f: 0, nf: 0 };
  q.t += dt; q.f += horde.force; q.nf++; q.v1 = horde.nb; q.vivres = j.vivres;
  vivresMin = Math.min(vivresMin, j.vivres);
  if (process.env.TRACE && horde.s / monde.L > +process.env.TRACE && tick % 150 === 0) console.log(`${(temps / 60).toFixed(1)} f=${(horde.s / monde.L).toFixed(3)} n=${horde.nb} sf=${horde.souffle.toFixed(2)} F=${horde.force.toFixed(2)} ab=${horde.abri.toFixed(2)} v=${horde.vitesse.toFixed(1)} serre=${horde.serre.toFixed(1)} camp=${j.camp} rep=${repos} tp=${ev.tempete?.phase || ''} en=${ev.ennemis.length} chr=${ev.chrones.length} dx=${(horde.x - monde.xRoute(horde.s)).toFixed(0)} h=${monde.h(horde.x, horde.s).toFixed(0)}`);
  if (horde.nb <= 0) { fini = 'mort'; break; }
  if (monde.L - horde.s < 112) { fini = 'arrivée'; break; }
}
if (process.argv.includes('--etat')) console.log({ x: horde.x, xr: monde.xRoute(horde.s), s: horde.s, sf: horde.souffle, force: horde.force, abri: horde.abri, v: horde.vitesse, camp: j.camp, vivres: j.vivres, repos, but, tp: !!ev.tempete, en: ev.ennemis.length, cor: !!ev.corroyeur, chr: ev.chrones.length, nav: !!ev.nav, cmd });
const causes = {};
for (const p of pertes) causes[p.cause] = (causes[p.cause] || 0) + 1;
console.log(`graine ${String(graine).padStart(6)} ${(fini || 'temps').padEnd(8)} f=${(horde.s / monde.L).toFixed(3)} vivants ${String(horde.nb).padStart(2)}  ${(temps / 60).toFixed(0).padStart(3)} min  camps ${camps.n} (${camps.jeunes} à jeun)  ${JSON.stringify(causes)}`);
const bandes = Array.from({ length: 10 }, () => ({}));
for (const p of pertes) { const b = bandes[Math.min(9, Math.floor(p.f * 10))]; b[p.cause] = (b[p.cause] || 0) + 1; }
if (detail) bandes.forEach((b, i) => { if (Object.keys(b).length) console.log(`  f ${i / 10}  ${JSON.stringify(b)}`); });
if (detail) for (const [id, q] of Object.entries(parContree)) console.log(`  ${id.padEnd(11)} ${(q.t / 60).toFixed(1).padStart(5)} min  vent ${(q.f / q.nf).toFixed(2)}  hordiers ${q.v0} → ${q.v1}  vivres ${q.vivres}`);
