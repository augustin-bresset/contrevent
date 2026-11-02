import * as THREE from 'three';
import '@fontsource/spectral/200.css';
import '@fontsource/spectral/300.css';
import '@fontsource/spectral/300-italic.css';
import '@fontsource/spectral/400.css';
import './style.css';
import { Monde } from './monde/monde.js';
import { MONDE, SDEPART, FORMES, AIRS, CLIMATS } from './monde/contrees.js';
import { Lignes } from './rendu/lignes.js';
import { Terrain } from './rendu/terrain.js';
import { Post } from './rendu/post.js';
import { Figures } from './rendu/figures.js';
import { Fil } from './rendu/fil.js';
import { Coups } from './rendu/coups.js';
import { Monuments } from './rendu/monuments.js';
import { Navire } from './rendu/navire.js';
import { Poussiere } from './rendu/poussiere.js';
import { Titre } from './rendu/titre.js';
import { Atmo } from './rendu/atmo.js';
import { chargerMatieres } from './rendu/matieres.js';
import { Souffle } from './rendu/souffle.js';
import { Semis } from './rendu/semis.js';
import { Oiseaux } from './rendu/oiseaux.js';
import { Jalons } from './rendu/jalons.js';
import { textureBruit } from './rendu/bruit.js';
import { Herbe } from './rendu/herbe.js';
import { Rafales } from './rendu/rafales.js';
import { Tornades } from './rendu/tornades.js';
import { Eclats, POUSSIERE, GOUTTE, BRAISE, FUMEE, FLAMME } from './rendu/eclats.js';
import { Filets } from './rendu/filets.js';
import { Marques } from './rendu/marques.js';
import { Ombres } from './rendu/ombres.js';
import { Foudre } from './rendu/foudre.js';
import { NB_LENTILLES } from './rendu/post.js';
import { Vent } from './jeu/vent.js';
import { Horde, formeDuVent } from './jeu/horde.js';
import { Evenements } from './jeu/evenements.js';
import { Camp } from './jeu/camp.js';
import { Detour } from './jeu/detour.js';
import { R } from './jeu/reglages.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Carte } from './carte.js';
import FabriqueWorker from './monde/fabrique.worker.js?worker&inline';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const CLE = 'contrevent-marche';
const sauvegarde = (() => { try { return params.has('graine') || params.has('s') || params.has('admin') ? null : JSON.parse(localStorage.getItem(CLE)); } catch { return null; } })();
const graine = +(params.get('graine') || sauvegarde?.graine || Math.floor(Math.random() * 1e6));
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGES = 521;
const mix = (a, b, t) => a + (b - a) * t;
const vers = (a, b, dt, k) => a + (b - a) * (1 - Math.exp(-dt * k));

const canvas = $('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  $('charge').textContent = 'Ce jeu a besoin de WebGL 2. Activez l’accélération graphique du navigateur, puis rechargez la page.';
  throw e;
}
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// Le monde vient de l'atelier, par tranches. On commence dès que le sol autour de la Horde existe ;
// le reste arrive derrière la brume, qui recule à mesure.
const sDepart = sauvegarde?.s ?? (+params.get('s') > 0 ? +params.get('s') * MONDE.L : SDEPART);
const atelier = new FabriqueWorker(), arrivees = [];
let reveil = null;
const monde = await new Promise((ok, ko) => {
  atelier.onerror = ko;
  atelier.onmessage = (e) => {
    if (e.data.esquisse) ok(new Monde(e.data.esquisse));
    else { arrivees.push(e.data); reveil?.(); }
  };
  atelier.postMessage({ graine });
});
const reclamer = (s) => atelier.postMessage({ file: monde.manquantes(s) });
function deballer() {
  const t = arrivees.shift();
  if (t && Math.abs(t.k - monde.k) <= (MONDE.nbTranches - 1) / 2) monde.poser(t);
}
reclamer(sDepart);
await new Promise((ok) => {
  reveil = () => { while (arrivees.length) deballer(); if (monde.vu(sDepart) >= 650) { reveil = null; ok(); } };
});
const tex = monde.creerTextures(renderer);
monde.toutMonter();
const uAnneau = new THREE.Vector2(monde.W, monde.anneau);

const tBruit = textureBruit();
const atmo = new Atmo(renderer);
const matieres = await chargerMatieres(renderer);
const titre = new Titre(renderer, tBruit);
const lignes = new Lignes(renderer, tex.tV, uAnneau, { cote: 165, res: 1536 });
const terrain = new Terrain(monde, tex, matieres, lignes.texture, tBruit, atmo.u);
// La scène se rend en deux temps : ce qui est solide, puis ce qui vole, posé sur l'image lissée.
const scene = new THREE.Scene(), sceneAir = new THREE.Scene(), sceneOmbre = new THREE.Scene();
const ombres = new Ombres(renderer, scene, terrain.u.uSoleil.value, terrain.u, sceneOmbre);
const post = new Post(renderer, terrain.u, tBruit);
// ?brut : la lumière telle que la calcule la physique, sans la manière peinte. Pour comparer.
if (params.has('brut')) terrain.u.uPeint.value = 0;
scene.add(terrain.mesh);
Object.assign(terrain.u, { tNC: post.uN.tNC, uVentN: post.uN.uVentN, uCouv: post.uN.uCouv });   // le sol lit la carte des nuages pour porter leur ombre
const semis = new Semis(monde, terrain.u, matieres); scene.add(semis.groupe);
const souffle = new Souffle(renderer, lignes, tex.tH); sceneAir.add(souffle.mesh);
const oiseaux = new Oiseaux(); sceneAir.add(oiseaux.mesh);
const jalons = new Jalons(monde); sceneAir.add(jalons.groupe);
const filets = new Filets(renderer, lignes, tex.tH, tex.tPal, uAnneau, monde.L); sceneAir.add(filets.mesh);
const herbe = new Herbe(terrain.u); scene.add(herbe.mesh);
const tornades = new Tornades(tex.tH, tex.tPal, uAnneau, monde.L); sceneAir.add(tornades.mesh);
const eclats = new Eclats(); sceneAir.add(eclats.mesh);
const fil = new Fil(monde); sceneAir.add(fil.mesh);
const figures = new Figures(23, { echelle: 0.68, reflets: true, commun: terrain.u }); scene.add(figures.groupe); sceneOmbre.add(figures.ombre);
const assaillants = new Figures(14, { echelle: 0.7, commun: terrain.u }); scene.add(assaillants.groupe); sceneOmbre.add(assaillants.ombre);
const monuments = new Monuments(monde, terrain.u, matieres); scene.add(monuments.groupe);
const navire = new Navire(terrain.u); scene.add(navire.groupe);
const poussiere = new Poussiere(lignes, tex.tH, uAnneau); sceneAir.add(poussiere.mesh);
const fx = new Coups(); sceneAir.add(fx.mesh);
const marques = new Marques(24); sceneAir.add(marques.mesh);
const foudre = new Foudre(); sceneAir.add(foudre.mesh);

// Le point visé pendant qu'on mène, et la balise d'Arval.
const anneau = (c) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.82, 36).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(c).convertLinearToSRGB() }, a: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float a; void main() { gl_FragColor = vec4(c, a); }',
  }));
  m.renderOrder = 5; m.visible = false; sceneAir.add(m); return m;
};
const repere = anneau('#a5432f'), baliseM = anneau('#ffffff');

const camera = new THREE.PerspectiveCamera(36, 1, 1, 9000);
camera.layers.enable(1);
const vent = new Vent(monde);
const rafales = new Rafales(monde, vent); sceneAir.add(rafales.mesh);
const fDep = +(params.get('s') || 0);
const horde = new Horde(monde, vent, sauvegarde?.x ?? monde.xRoute(sDepart), sDepart);
for (const m of horde.membres) m.col = new THREE.Color(m.ton).convertLinearToSRGB();
const detour = new Detour(monde);
const hud = new Hud(), audio = new Audio();
const carte = new Carte(monde);

const TACTILE = matchMedia('(pointer: coarse)').matches;
const j = {
  tactile: TACTILE,
  monde, vent, horde, hud, audio, fx, navire, eclats, vivres: sauvegarde?.vivres ?? R.vivresDepart, repas: false,
  ajouterVivres(n) { j.vivres += n; hud.vivres(j.vivres); },
  eclair() {
    if (!calme) { eclair = 1; foudre.frapper(horde.x + (Math.random() - 0.5) * 300, Math.max(0, monde.h(horde.x, horde.s)), horde.s + 40 + Math.random() * 200, camera); }
    audio.tonnerre();
  }, temps: 0, camp: false, intensite: 0, combat: 0, ralentiCible: 1, pesanteur: 0, balise: null,
  get regard() { return regardCible > 0; },
  regarder, changerAir,
  viser(x, s, y) { if (regardCible && !regardLibre && visee.recul === 118) { visee.x = x; visee.s = s; visee.y = y; } },
  secousse: (v) => { if (!calme) secousse = Math.max(secousse, v); },
  sauver() {
    if (etat !== 'marche') return;
    try {
      localStorage.setItem(CLE, JSON.stringify({
        graine, x: horde.x, s: horde.s, souffle: horde.souffle, vivres: j.vivres, morts: horde.membres.filter((m) => !m.vivant).map((m) => m.id),
        vus: [...ev.lieuxVus], fil: fil.points.map((v) => Math.round(v)),
      }));
    } catch { /* le stockage peut être plein ou fermé */ }
  },
};
let secousse = 0, eclair = 0;
// Chaque pas soulève ce qu'il y a sous lui.
const TON_POUSSIERE = new THREE.Color();
horde.onPas = (m) => {
  const c = monde.contreeA(m.s);
  if (accel < 4) audio.pas(c.relief);
  if (m.y <= 0.02 && monde.h(m.x, m.s) < 0.02) {
    for (let i = 0; i < 3; i++) eclats.emettre(GOUTTE, m.x, 0.08, m.s, (Math.random() - 0.5) * 3.4, 3 + Math.random() * 4, (Math.random() - 0.5) * 3.4, 0.6, 0.09, 1, 1, 1, 0.9);
  } else if (c.rides > 0.05 || c.grain > 0.25) {
    TON_POUSSIERE.set(c.lumiere).convertLinearToSRGB();
    eclats.emettre(POUSSIERE, m.x, m.y + 0.1, m.s, (Math.random() - 0.5) * 1.6, 0.8 + Math.random(), (Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 0.5, 0.26, TON_POUSSIERE.r, TON_POUSSIERE.g, TON_POUSSIERE.b, 0.6);
  }
};
const ev = new Evenements(j);
const camp = new Camp(j, () => { if (!etapes.vivres) { etapes.vivres = true; hud.aide('Chaque camp consomme une ration. Sans repas, on ne récupère qu’à moitié.', 9); } });
if (sauvegarde) {
  for (const id of sauvegarde.morts) { const m = horde.membres.find((q) => q.id === id); if (m) m.vivant = false; }
  horde.souffle = sauvegarde.souffle ?? 1;
  for (const l of sauvegarde.vus || []) ev.lieuxVus.add(l);
  ev.restaurer();
  for (let i = 0; i < (sauvegarde.fil?.length || 0); i += 2) fil.ajouter(sauvegarde.fil[i], sauvegarde.fil[i + 1]);
  hud.signes(horde);
}
if (fDep) ev.restaurer();
changerAir(monde.contreeA(horde.s));

// La vue à hauteur de Horde : la caméra descend derrière les marcheurs, le temps de regarder.
let scene_ = false, regard = 0, regardCible = 0, regardReste = 0, regardLibre = false, regardMontee = 2.4, visee = { x: 0, s: 0, y: 0 };
// Une scène : le jeu s'arrête. Le chemin est oublié, personne ne se fatigue, rien n'attaque, jusqu'à la fin de la scène.
function regarder({ x, s, y, duree = 12, recul, lat }) {
  if (etat !== 'marche' || j.camp || ev.actifs()) return false;
  visee = { x, s, y, recul, lat }; regardCible = 1; regardReste = duree; regardLibre = false;
  scene_ = true; chemin = []; cible = null; mene = false; pression = null;
  setTimeout(() => { if (scene_) hud.aide(TACTILE ? 'Touchez Reprendre pour repartir' : 'V : reprendre la marche', 6); }, 2600);
  return true;
}
function quitterRegard() { regardCible = 0; regardLibre = false; scene_ = false; }
function basculerRegard() {
  if (regardCible) { quitterRegard(); return; }
  if (etat !== 'marche') return;
  regardCible = 1; regardLibre = true; regardReste = Infinity;
}
// Les boutons du doigt disent l'état du jeu : ce qu'ils feraient là, maintenant.
// Sous un vent léger, les rafales franchissent le seuil de l'abri : le doré attend que l'abri tienne, sans quoi il clignote.
let cleGestes = '', tExpose = 0;
function majGestes(abrite) {
  if (!abrite) tExpose = temps;
  const c = j.camp ? 'camp' : temps - tExpose > 1.5 && !ev.actifs() ? 'abri' : '';
  const cle = `${regardCible ? 1 : 0}${chemin.length ? 1 : 0}${lireRelief ? 1 : 0}${c}`;
  if (cle === cleGestes) return;
  cleGestes = cle;
  $('regarder').textContent = regardCible ? 'Reprendre' : 'Regarder';
  $('effacer').hidden = !chemin.length;
  $('relief').setAttribute('aria-pressed', lireRelief);
  $('camper').className = c;
}
function changerAir(c) {
  const a = AIRS[c.id] || AIRS.amont;
  souffle.regler(a, new THREE.Color(a.c));
  figures.reflets.visible = c.relief === 'flaque';
}

let etat = 'titre';   // titre, marche, pause, choix, fin
let accel = 1, vitesseJeu = 1, ralenti = 1, nuit = 0, feu = 0, reve = 0, blanc = 0;
let zoom = 0.62, zoomV = 0.62;
let camX = horde.x, camS = horde.s + 30, camH = Math.max(0, monde.h(horde.x, horde.s)), camAv = 0;
const cmd = { dx: 0, ds: 1, actif: false, serre: false, vitesseMax: 0 };
let chemin = [], cible = null, mene = false, souris = null, pression = null, bloc = false, chargeFinal = false;
const touches = new Set();
const etapes = { marche: false, lire: false, souffle: false, jalons: false, regard: false, vivres: false };
let cptOmbre = 0, parcouru = 0, piétine = 0, prochaineAideBloc = 0, fumee = 0;
const meilleur = { d: 1e9, q: null, t: 0 };
// Le spectateur de l'admin, quand il vole : le relief fin, les ombres et le climat suivent ce qu'il regarde, plus la Horde.
let spect = null, foyer = horde;

// --- Entrées ---
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// Le point du sol sous le curseur : on suit le rayon jusqu'à ce qu'il passe sous le relief, puis on affine.
// `pied` : un rayon qui heurte un mur s'arrête au pied de ce mur, côté joueur, au lieu de passer à travers jusqu'au sol derrière.
function versMonde(cx, cy, pied = false) {
  ndc.set(cx / innerWidth * 2 - 1, -cy / innerHeight * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  const sol = (t) => o.y + d.y * t - Math.max(0, monde.h(o.x + d.x * t, -(o.z + d.z * t)));
  let t0 = camera.near, t1 = t0;
  const pas = 2.5, loin = 2600, semes = pied ? monde.semesAutour(horde.x, horde.s, 420, true) : null;
  while (t1 < loin && sol(t1) > 0) {
    if (pied && monde.heurte(o.x + d.x * t1, -(o.z + d.z * t1), o.y + d.y * t1, semes)) return { x: o.x + d.x * t0, s: -(o.z + d.z * t0) };
    t0 = t1; t1 += pas * Math.max(1, t1 / 200);
  }
  if (t1 >= loin) return null;
  for (let i = 0; i < 9; i++) { const m = (t0 + t1) / 2; if (sol(m) > 0) t0 = m; else t1 = m; }
  return { x: o.x + d.x * t1, s: -(o.z + d.z * t1) };
}
function changerTemps() { accel = accel >= 16 ? 1 : accel * 2; }
// R : on pose le sac, si le vent le permet. Sinon on montre où aller.
function camper() {
  if (j.camp || scene_ || etat !== 'marche') return;
  if (ev.actifs()) { hud.aide('Pas avec ce qui nous tombe dessus.', 4); return; }
  if (camp.abrite()) { chemin = []; cible = null; mene = false; pression = null; camp.demande = true; return; }
  hud.aide('Pas d’abri ici, le vent porte. Rejoignez une zone dorée au sol : le cercle blanc marque la plus proche.', 8);
  montrerAbris = 9; chercherAbri();
}
// L'abri le plus proche, tâté en étoile autour de la Horde.
const lueAbri = { x: 0, s: 0, abri: 0 };
function chercherAbri() {
  let best = null, dBest = 1e9;
  for (let r = 24; r <= 288 && !best; r += 24) for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283, x = horde.x + Math.sin(a) * r, s = horde.s + Math.cos(a) * r;
    if (x < 12 || x > monde.W - 12) continue;
    monde.v(x, s, lueAbri);
    if ((lueAbri.abri > 0.46 || Math.hypot(lueAbri.x, lueAbri.s) < 0.44) && !monde.bloque(x, s, 5) && monde.h(x, s) > 0 && r < dBest) { dBest = r; best = { x, s }; }
  }
  if (best) j.balise = { x: best.x, s: best.s, vie: 4 };
}
function basculerBloc(v = !bloc) {
  bloc = v; hud.bloc(bloc); $('bloc').setAttribute('aria-pressed', bloc);
}
const LONG_APPUI = 220, MAX_JALONS = 24;
// Deux doigts : on pince pour zoomer, et ni l'un ni l'autre ne compte plus comme un ordre de marche.
const doigts = new Map();
let pince = null;
const ecart = () => { const [a, b] = doigts.values(); return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
const zoomer = (z) => { zoomV = Math.max(0.3, Math.min(1.05, z)); };
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    doigts.set(e.pointerId, [e.clientX, e.clientY]);
    if (doigts.size === 2) { pince = { d: ecart(), z: zoomV }; pression = null; mene = false; return; }
  }
  if (etat !== 'marche') return;
  if (e.button === 2) { basculerBloc(); return; }
  if (scene_) return;     // une scène se regarde : on ne commande rien tant qu'elle dure
  canvas.setPointerCapture?.(e.pointerId);
  const p = versMonde(e.clientX, e.clientY);
  if (!p) return;
  if (ev.clic(p.x, p.s)) return;
  pression = { t: performance.now(), x: e.clientX, y: e.clientY, p: versMonde(e.clientX, e.clientY, true) || p };
  souris = [e.clientX, e.clientY];
});
canvas.addEventListener('pointermove', (e) => {
  if (doigts.has(e.pointerId)) doigts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pince && doigts.size === 2) { zoomer(pince.z * pince.d / ecart()); return; }
  souris = [e.clientX, e.clientY];
  // Maintenir ou glisser, c'est mener : on oublie le chemin prévu.
  if (pression && !mene && Math.hypot(e.clientX - pression.x, e.clientY - pression.y) > 9) commencerAMener();
});
function commencerAMener() { mene = true; chemin = []; pression = null; }
const leverDoigt = (e) => { doigts.delete(e.pointerId); if (doigts.size < 2) pince = null; };
addEventListener('pointerup', (e) => {
  leverDoigt(e);
  if (pression) poserJalon(pression.p);
  pression = null; mene = false;
});
addEventListener('pointercancel', (e) => { leverDoigt(e); pression = null; mene = false; });
// Un clic bref pose un point au bout du chemin ; sur un point déjà posé, il le retire.
function poserJalon(p) {
  if (scene_) return;
  if (ev.defense()) { if (!etapes.defense) { etapes.defense = true; hud.aide('Pendant un combat, on ne trace plus : le clic sert à frapper.', 5); } return; }
  const i = chemin.findIndex((q) => Math.hypot(q.x - p.x, q.s - p.s) < (TACTILE ? 9 : 5));
  if (i >= 0) { chemin.splice(i, 1); return; }
  if (chemin.length >= MAX_JALONS) return;
  // Jamais dans un mur : le point glisse à son pied.
  const q = monde.degager(Math.max(10, Math.min(monde.W - 10, p.x)), Math.max(32, Math.min(monde.L - 6, p.s)), 5);
  if (!q) return;
  chemin.push(q);
  if (chemin.length === 2 && !etapes.jalons) { etapes.jalons = true; hud.aide(TACTILE ? 'Le chemin s’allonge à chaque toucher. Effacer retire le dernier point ; un appui long, tout le chemin.' : 'Le chemin s’allonge à chaque clic. Retour efface le dernier point.', 7); }
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { zoomer(zoomV * Math.exp(e.deltaY * 0.0009)); e.preventDefault(); }, { passive: false });
$('page').addEventListener('click', () => { if (etat === 'marche') basculerMenu(); });
$('bloc').addEventListener('click', () => basculerBloc());
$('regarder').addEventListener('click', () => basculerRegard());
$('temps').addEventListener('click', () => changerTemps());
$('repos').addEventListener('click', () => camper());
$('camper').addEventListener('click', () => camper());
$('relief').addEventListener('click', () => { lireRelief = !lireRelief; });
$('menu-doigt').addEventListener('click', () => { if (etat === 'marche') basculerMenu(); });
// Effacer : un toucher retire le dernier point, un appui long tout le chemin.
let tEffacer = 0;
const finEffacer = () => { clearTimeout(tEffacer); tEffacer = 0; };
$('effacer').addEventListener('pointerdown', () => { tEffacer = setTimeout(() => { tEffacer = 0; chemin = []; }, 500); });
$('effacer').addEventListener('pointerup', () => { if (tEffacer) { finEffacer(); chemin.pop(); } });
$('effacer').addEventListener('pointerleave', finEffacer);
$('effacer').addEventListener('pointercancel', finEffacer);
$('gestes').addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  touches.add(e.code);
  if (e.code === 'Space' && etat === 'marche') { e.preventDefault(); basculerBloc(); }
  if (e.code === 'KeyV' || e.code === 'KeyE') basculerRegard();
  if (e.code === 'KeyT') changerTemps();
  if (e.code === 'KeyC') lireRelief = true;
  if (e.code === 'KeyR' && etat === 'marche') camper();
  if (e.code === 'Backspace' && etat === 'marche') chemin.pop();
  if (e.code === 'Delete' && etat === 'marche') chemin = [];
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target === document.body) e.preventDefault();
  if ((e.code === 'KeyM' || e.code === 'Tab') && (etat === 'marche' || etat === 'pause')) { e.preventDefault(); basculerMenu(); }
  if (e.code === 'Escape' && (etat === 'marche' || etat === 'pause')) basculerMenu();
});
addEventListener('keyup', (e) => { touches.delete(e.code); if (e.code === 'KeyC') lireRelief = false; });
addEventListener('blur', () => { touches.clear(); mene = false; });

// --- Écrans ---
function bouton(txt, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = fn; return b; }
function basculerMenu() {
  const m = $('menu');
  if (etat === 'pause') { etat = 'marche'; m.classList.remove('vu'); audio.suspendre(false); return; }
  etat = 'pause'; audio.suspendre(true);
  $('menu-titre').textContent = 'La bande du monde';
  const n = horde.vivants().length;
  $('menu-note').textContent = `${n} ${n > 1 ? 'marchent encore' : 'marche encore'}. Il reste ${hud.pageAff} pages.`;
  const c = $('menu-choix'); c.replaceChildren(
    bouton('Reprendre la marche', basculerMenu),
    bouton(audio.muet ? 'Rétablir le son' : 'Couper le son', (e) => { audio.couper(!audio.muet); e.target.textContent = audio.muet ? 'Rétablir le son' : 'Couper le son'; }),
    bouton('Nouvelle Horde', (e) => {
      if (e.target.dataset.sure) nouvelleHorde();
      else { e.target.dataset.sure = 1; e.target.textContent = 'Abandonner cette Horde ?'; }
    }),
  );
  carte.dessiner(fil, horde.x, horde.s, chemin);
  m.classList.add('vu');
  c.firstChild.focus();
}
// Sur la bande aussi, un clic pose un point : on voit tout, on peut tout prévoir.
$('bande').addEventListener('click', (e) => {
  if (etat !== 'pause') return;
  const b = e.currentTarget.getBoundingClientRect();
  poserJalon({ s: (e.clientX - b.left) / b.width * monde.L, x: (e.clientY - b.top) / b.height * monde.W });
  carte.dessiner(fil, horde.x, horde.s, chemin);
});
function nouvelleHorde() {
  try { localStorage.removeItem(CLE); } catch { /* rien à effacer */ }
  if (location.search) location.href = location.pathname; else location.reload();
}
function demarrer(reprise) {
  audio.demarrer();
  $('pied').classList.add('part');
  etat = 'marche';
  titre.envol = true;
  regardMontee = 5.2; quitterRegard(); setTimeout(() => { regardMontee = 2.4; }, 6000);
  setTimeout(() => { $('hud').classList.add('vu'); }, 1800);
  hud.signes(horde); hud.page(pageIci()); hud.vivres(j.vivres);
  if (!reprise) setTimeout(() => hud.aide(TACTILE ? 'Gardez le doigt posé : Golgoth marche vers le point visé.' : 'Maintenez le clic : Golgoth marche vers le point visé.'), 3600);
  else { etapes.marche = etapes.lire = true; setTimeout(() => hud.dire('sov', 'Nous repartons du dernier camp.'), 3000); }
  setTimeout(() => { $('accueil').style.display = 'none'; }, 3200);
}
function pageIci() { return Math.max(0, Math.round(PAGES * (1 - horde.s / (monde.L - 112)))); }

function fin(mode) {
  etat = 'fin';
  try { localStorage.removeItem(CLE); } catch { /* rien à effacer */ }
  const n = horde.vivants().length;
  const finir = (titreT, note) => {
    $('voile').classList.remove('vu');
    $('menu-titre').textContent = titreT; $('menu-note').textContent = note;
    $('menu-choix').replaceChildren(bouton('Une autre Horde', nouvelleHorde));
    carte.derouler(fil, horde.x, horde.s);
    $('menu').classList.add('vu');
  };
  if (mode === 'chute') {
    const p = hud.pageAff;
    setTimeout(() => finir(`La 34e Horde s’arrête à la page ${p}.`, 'Personne pour écrire la suite. Le fil rouge reste sur la carte, jusqu’à la prochaine.'), 3800);
  } else if (mode === 'ici') {
    hud.aide('');
    setTimeout(() => finir('Sov écrit : c’est ici.', `Page 0. ${n} ${n > 1 ? 'ont posé' : 'a posé'} le sac. Le vent n’a pas de source ; il a seulement ceux qui lui résistent.`), 6000);
  } else {
    setTimeout(() => finir('Golgoth ne s’est pas retourné.', `Page 0. Plus de sol, plus de vent. ${n > 1 ? `${n} sont entrés dans le blanc.` : 'Il est entré dans le blanc.'} Sov est redescendu pour le dire.`), 7000);
  }
}

function choixFinal() {
  etat = 'choix'; chargeFinal = true;
  const v = $('voile');
  const titreH = document.createElement('h2'); titreH.textContent = 'Il n’y a plus de vent.';
  const p = document.createElement('p'); p.textContent = 'Rien devant : ni source, ni bout du monde. Seulement le blanc. Oroshi pose son sac. Golgoth regarde devant lui.';
  const c = document.createElement('div'); c.className = 'choix';
  c.append(
    bouton('S’arrêter ici', () => { v.classList.remove('vu'); fin('ici'); nuitCible = 0.0; feuFinal = true; hud.dire('oroshi', 'Écris-le, Sov. L’Extrême-Amont, c’est ici.'); }),
    bouton('Continuer', () => { v.classList.remove('vu'); fin('plus'); hud.dire('golgoth', 'Avancez.'); marcheFinale = true; }),
  );
  v.replaceChildren(titreH, p, c); v.classList.add('vu');
  c.firstChild.focus();
}
let nuitCible = 0, feuFinal = false, marcheFinale = false;

// Quatre niveaux, comptés en pixels : c'est eux qui coûtent. Le lissage temporel rattrape bien mieux une image un peu moins
// grande qu'une image privée de ses ombres ; on ne renonce aux effets qu'en dernier. Le jeu descend seul s'il n'arrive plus à tenir.
const NIVEAUX = [
  { px: 3.2e6, herbe: 1, filets: 1, vol: true, ao: true, ombreP: true },
  { px: 2.2e6, herbe: 0.85, filets: 1, vol: true, ao: true, ombreP: true },
  { px: 1.5e6, herbe: 0.6, filets: 0.75, vol: true, ao: true, ombreP: true },
  { px: 1e6, herbe: 0.4, filets: 0.6, vol: false, ao: false, ombreP: false },
];
let niveau = 0, prActuel = 1;
function appliquerNiveau(n) {
  niveau = n; const q = NIVEAUX[n];
  herbe.niveau(q.herbe); filets.niveau(q.filets); post.volActif = q.vol; post.aoActif = q.ao; post.uF.uPas.value = n > 1 ? 24 : 40;
  taille();
}
function taille() {
  const pr = Math.max(0.6, Math.min(Math.max(devicePixelRatio, 1), Math.sqrt(NIVEAUX[niveau].px / (innerWidth * innerHeight)))); prActuel = pr;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.taille(innerWidth, innerHeight, pr);
  titre.u.uAsp.value = innerWidth / innerHeight; titre.u.uPx.value = pr;
  poussiere.u.uPx.value = pr; eclats.u.uPx.value = pr; tornades.u.uPx.value = pr;
}
let qualiteFigee = false, lireRelief = false, carteV = 0, montrerAbris = 0, abriV = 0, alerteV = 0, tAbri = 0;
addEventListener('resize', taille);
// Sur un très grand nombre de pixels, on part un cran plus bas plutôt que de saccader d'abord.
appliquerNiveau(1);

// --- La boucle ---
const lueTemp = { x: 0, s: 0, abri: 0 };
const visu = horde.membres.map(() => ({}));
const visuE = Array.from({ length: 14 }, () => ({}));
const COUL_ENNEMI = { r: 0.62, g: 0.12, b: 0.09 };
const vF = new THREE.Vector3(), vP = new THREE.Vector3();
let avant = performance.now(), temps = 0, cumul = 0, images = 0;

// Ce que le vent donne à voir : presque rien quand il dort.
const ventVu = () => 0.26 + 0.74 * Math.min(1, Math.max(0, (horde.force - 0.15) / 0.75));

function commande(dt) {
  const k = (c) => touches.has(c);
  const dx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('KeyQ') || k('ArrowLeft') ? 1 : 0);
  const ds = (k('KeyW') || k('KeyZ') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  cmd.serre = bloc;
  cmd.actif = false; cmd.vitesseMax = j.pesanteur;
  if (pression && performance.now() - pression.t > LONG_APPUI) commencerAMener();
  if (mene && souris) { const p = versMonde(souris[0], souris[1]); if (p) cible = p; }
  else if (!mene) cible = chemin[0] || null;

  if (dx || ds) { mene = false; chemin = []; cible = null; cmd.dx = dx; cmd.ds = ds; cmd.actif = true; }
  else if (cible) {
    const loin = Math.hypot(cible.x - horde.x, cible.s - horde.s);
    if (loin < (mene ? 1.5 : 3.5)) { if (!mene) chemin.shift(); }
    else {
      // Ce qui ne se franchit pas, on le contourne : la Horde vise le prochain coude du détour.
      const p = detour.vers(horde.x, horde.s, cible, temps);
      cmd.dx = p.x - horde.x; cmd.ds = p.s - horde.s; cmd.actif = true;
      if (!mene) {
        // Un point qu'aucun chemin ne rejoint : on va au plus près, puis on passe au suivant.
        if (p.auBout) {
          chemin.shift(); meilleur.q = null;
          if (!etapes.injoignable) { etapes.injoignable = true; hud.aide('Aucun passage ne mène à ce point : la Horde s’en est approchée au plus près.', 6); }
        }
        // Passé quelques secondes sans gagner de terrain sur le détour, on le saute aussi.
        else if (p.reste < meilleur.d - 0.5 || meilleur.q !== chemin[0]) { meilleur.d = p.reste; meilleur.q = chemin[0]; meilleur.t = temps; }
        else if (temps - meilleur.t > 8) { chemin.shift(); meilleur.q = null; }
      }
    }
  }
  if (marcheFinale) { cmd.dx = 0; cmd.ds = 1; cmd.actif = true; }
}

function aides() {
  if (!etapes.marche && parcouru > 42) { etapes.marche = true; hud.aide(TACTILE ? 'Toucher bref : un point de passage. La poussière montre le vent, les creux calmes se cachent derrière les roches. Le bouton Relief dessine le relief et le vent. À deux doigts, on zoome.' : 'Clic bref : un point de passage. La poussière montre le vent, les creux calmes se cachent derrière les roches. Tenir C dessine le relief et le vent.', 11); }
  if (etapes.marche && !etapes.souffle && horde.souffle < 0.62) { etapes.souffle = true; hud.aide(`Le souffle s’épuise. Les zones dorées au sol sont à l’abri du vent : allez-y, puis ${TACTILE ? 'touchez Camper' : 'R pour camper'}. Chaque camp mange une ration.`, 11); }
  // On piétine face au vent sans faire bloc : le jeu le dit une fois, puis à chaque rechute.
  piétine = cmd.actif && !cmd.serre && !regardCible && horde.force > 1.2 && horde.vitesse < 2.2 ? piétine + 1 / 60 : Math.max(0, piétine - 1 / 30);
  if (piétine > 4 && temps > prochaineAideBloc) { prochaineAideBloc = temps + 45; hud.aide(TACTILE ? 'Le vent gagne. Touchez Faire bloc pour passer.' : 'Le vent gagne. Espace ou clic droit : faites bloc pour passer.', 7); }
  if (etapes.marche && !etapes.lire && parcouru > 240) { etapes.lire = true; hud.aide(TACTILE ? 'La route est longue. « temps normal », en haut à droite, accélère le temps ; le moindre danger le ramène à la normale.' : 'La route est longue. T accélère le temps ; le moindre danger le ramène à la normale.', 9); }
}

function majJeu(dt) {
  j.ralentiCible = 1; j.pesanteur = 0;
  commande(dt);
  j.temps = temps;
  vent.maj(dt);
  ev.maj(dt);
  ralenti = vers(ralenti, j.ralentiCible, dt, 6);

  const avS = horde.s, avX = horde.x;
  horde.maj(dt * ralenti, cmd);
  parcouru += Math.hypot(horde.x - avX, horde.s - avS);
  fil.ajouter(horde.x, horde.s);
  aides();

  camp.maj(dt, cmd.actif, ev);
  horde.veillee = vers(horde.veillee, j.camp ? 1 : 0, dt, 1.4);
  lignes.poserPas(horde.membres);

  // La fin du monde : le vent tombe, tout se fond dans le blanc.
  const reste = monde.L - horde.s;
  reve = Math.max(0, Math.min(1, (260 - reste) / 150));
  if (reste < 112 && !chargeFinal) choixFinal();
  if (!horde.vivants().length && etat === 'marche') { fin('chute'); }
  if (horde.vivants().length === 1 && !j.seul) { j.seul = true; hud.dire(horde.vivants()[0].id, 'Je suis seul. Je continue.'); }
}

function poserUniformes(dt) {
  vent.uniformes(lignes.commun, horde.x, horde.s);
  const u = terrain.u;
  u.uTemps.value = temps; u.tTrace.value = lignes.texture; u.uCentreTrace.value.copy(lignes.centre);
  const fr = vent.front;
  u.uFrontT.value.set(fr.a, fr.b, fr.presence);
  u.uReve.value = reve * (1 - feu * 0.2);
  // Tenir C, ou le bouton Relief : le relief se dessine, et le vent se voit mieux.
  carteV = vers(carteV, lireRelief && !regardCible ? 1 : 0, dt, 9); u.uCarte.value = carteV;
  // Les zones de repos se montrent dès qu'on en a besoin, ou qu'on les demande.
  montrerAbris = Math.max(0, montrerAbris - dt);
  abriV = vers(abriV, etat === 'marche' && !j.camp && !scene_ && (lireRelief || horde.souffle < 0.62 || montrerAbris > 0) ? 1 : 0, dt, 3); u.uAbriV.value = abriV;
  if (etat === 'marche') {
    const ab = camp.abrite();
    if (j.camp) hud.repos(j.repas ? `Le camp : le souffle revient. ${TACTILE ? 'Touchez le sol' : 'Cliquez'} pour repartir.` : 'Le camp, le ventre vide : on ne récupère qu’à moitié.', 'camp');
    else if (scene_ || ev.actifs()) hud.repos('', '');
    else if (ab && horde.souffle < 0.98) hud.repos(TACTILE ? 'À l’abri du vent : touchez Camper' : 'À l’abri du vent. R pour camper', 'abri');
    else if (!ab && horde.souffle < 0.8) hud.repos('Exposés au vent : pas de repos ici', 'expose');
    else hud.repos('', '');
    // À bout de souffle, Arval montre le chemin.
    if ((tAbri -= dt) < 0 && horde.souffle < 0.4 && !ab && !ev.actifs() && !j.balise) { tAbri = 2; chercherAbri(); }
    if (TACTILE) majGestes(ab);
  } else hud.repos('', '');
  u.uFeu.value.set(horde.x, horde.s, feu);
  const n = vent.navire;
  u.uNavireO.value.set(n.x + 12, n.s - 40, 118, n.p > 0 ? Math.min(1, n.p * 1.5) : 0);
  const eR = lisseR();
  // La brume ne s'ouvre jamais au-delà de ce qui existe : le joueur ne voit pas le monde se construire.
  u.uBrouillard.value = Math.min(2400, monde.vu(foyer.s) / 1.25);
  u.uSv.value = horde.s / monde.L;
  u.uRemousT.value = lignes.commun.uRemous.value;

  const m = vent.masque(horde.s, horde.x) * fr.presence;
  hud.sombre(m > 0.5 || nuit > 0.62);
  figures.u.uCharge.value = Math.max(m, nuit * 0.5);
  assaillants.u.uCharge.value = 0.5;
  u.uNuit.value = nuit;

  // Le temps qu'il fait : on glisse d'une contrée à l'autre, au fil de la marche.
  climat(dt, m);

  const cf = horde.force || 1, w = horde.w, fv = Math.min(2.5, horde.force);
  horde.membres.forEach((q, i) => {
    const v = visu[i];
    v.x = q.x; v.y = q.y; v.s = q.s; v.presence = q.vivant ? 1 : Math.max(0, q.chute); v.vx = w.x / cf; v.vs = w.s / cf; v.force = fv;
    v.cap = q.cap; v.phase = q.marche; v.amp = q.amp; v.col = q.col; v.accent = 0; v.long = q.id === 'golgoth' ? 1.25 : 1;
  });
  figures.poser(visu);
  ev.ennemis.forEach((e, i) => { if (i < 14) Object.assign(visuE[i], e, { accent: 0, long: 0.9, col: COUL_ENNEMI }); });
  assaillants.poser(visuE.slice(0, ev.ennemis.length));
  assaillants.groupe.visible = ev.ennemis.length > 0;
  marques.poser(aMarquer(), temps);
  fleches();

  poussiere.u.tPos.value = lignes.gpu.getCurrentRenderTarget(lignes.varPos).texture;
  poussiere.u.uForce.value = (0.3 * ventVu() + m * 0.5) * (reve > 0.5 ? 0.35 : 1);
  poussiere.u.uCouleur.value.set(clair.r, clair.g * mix(1, 0.74, m), clair.b * mix(1, 0.5, m));

  repere.visible = mene && !!cible && etat === 'marche';
  if (repere.visible) { repere.position.set(cible.x, Math.max(0, monde.h(cible.x, cible.s)) + 0.2, -cible.s); repere.scale.setScalar(1 + 0.08 * Math.sin(temps * 5)); }
  jalons.maj(horde.x, horde.s, etat === 'marche' ? chemin : [], temps, etat === 'marche' && !mene && chemin.length ? detour.trace() : []);
  fil.mesh.visible = lisseR() < 0.5;
  if (j.balise) {
    j.balise.vie -= dt;
    baliseM.visible = j.balise.vie > 0;
    baliseM.position.set(j.balise.x, Math.max(0, monde.h(j.balise.x, j.balise.s)) + 0.2, -j.balise.s);
    baliseM.scale.setScalar(3 + 1.4 * ((temps * 0.8) % 1));
    baliseM.material.uniforms.a.value = 1 - ((temps * 0.8) % 1);
    if (j.balise.vie <= 0) j.balise = null;
  } else baliseM.visible = false;
}

const clair = new THREE.Color();
const CL = { trouble: 1, teinte: new THREE.Color(1, 1, 1), voile: 0, soleil: 1, brume: 0.0005, expo: 1, vol: 1 };
const TEINTES = Object.fromEntries(Object.entries(CLIMATS).map(([k, c]) => [k, new THREE.Color(c.teinte).convertLinearToSRGB()]));
let climatPret = false;
function climat(dt, m) {
  const c = monde.contreeA(foyer.s + (foyer === horde ? 260 : 0)), q = CLIMATS[c.id] || CLIMATS.amont, k = climatPret ? 1 - Math.exp(-dt * 0.25) : 1;
  climatPret = true;
  for (const n of ['trouble', 'voile', 'soleil', 'brume', 'expo']) CL[n] += (q[n] - CL[n]) * k;
  CL.teinte.lerp(TEINTES[c.id] || TEINTES.amont, k);
  atmo.maj(CL, nuit, m);
  // Ce qui vole dans l'air reçoit la même lumière que lui.
  const sc = atmo.u.uSoleilCol.value;
  clair.setRGB(sc.r * 0.2 + 0.35 * (1 - nuit * 0.9), sc.g * 0.2 + 0.38 * (1 - nuit * 0.9), sc.b * 0.2 + 0.44 * (1 - nuit * 0.9));
  filets.u.uClair.value.copy(clair);
  souffle.u.uClair.value.copy(clair);
  post.u.uExpo.value = CL.expo * mix(1, 1.9, m) * mix(1, 1.5, nuit);
}

// Le Corroyeur et les chrones n'ont pas de corps à viser : c'est leur cercle au sol qui se lit.
function aMarquer() {
  const l = ev.ennemis.slice(0, 14), sol = (x, s) => Math.max(0, monde.h(x, s));
  if (ev.corroyeur) { const c = ev.corroyeur; l.push({ x: c.x, y: sol(c.x, c.s), s: c.s, r: R.porteeCorroyeur, k: 1 }); }
  for (const c of ev.chrones) if (l.length < 24 && c.k !== 'vera') l.push({ x: c.x, y: sol(c.x, c.s), s: c.s, r: c.r * 0.72, k: 2 });
  return l;
}

// Ce qui arrive hors de l'image est signalé au bord de l'écran.
const FLECHES = Array.from({ length: 15 }, () => { const e = document.createElement('i'); $('fleches').append(e); return e; });
const vE = new THREE.Vector3();
function fleches() {
  FLECHES.forEach((q, i) => {
    const e = i < 14 ? ev.ennemis[i] : ev.corroyeur;
    if (!e) { q.style.display = 'none'; return; }
    vE.set(e.x, (e.y ?? camH) + 1, -e.s).project(camera);
    let x = vE.x, y = vE.y; if (vE.z > 1) { x = -x; y = -y; }
    if (Math.abs(x) < 0.97 && Math.abs(y) < 0.95 && vE.z <= 1) { q.style.display = 'none'; return; }
    const k = 0.93 / Math.max(Math.abs(x), Math.abs(y), 1e-3);
    q.style.display = 'block';
    q.style.transform = `translate(${(x * k + 1) / 2 * innerWidth}px,${(1 - y * k) / 2 * innerHeight}px) rotate(${Math.atan2(-y, x)}rad)`;
  });
}

function lisseR() { return regard * regard * (3 - 2 * regard); }

function cadrer(dt) {
  if (spect?.actif) { spect.poser(camera); return spect.foyer; }
  zoom = vers(zoom, zoomV * (j.camp ? 0.74 : 1) * (1 + j.intensite * 0.1), dt, 1.1);
  // Assaillants en vue : la caméra monte et remet la Horde au milieu de l'image, pour qu'on voie ce qui vient de derrière.
  alerteV = vers(alerteV, ev.ennemis.length || ev.corroyeur ? 1 : 0, dt, 2.2);
  const av = mix(46, 8, nuit) * zoom * (1 - alerteV);
  camX = vers(camX, horde.x, dt, 2.2); camS = vers(camS, horde.s + av, dt, 2.2);
  camH = vers(camH, Math.max(0, monde.h(horde.x, horde.s)), dt, 1.4);
  // Le regard devance un peu la marche, et l'image respire avec le vent.
  camAv = vers(camAv, horde.vitesse > 1 ? 1 : 0, dt, 0.8);
  const lead = 18 * camAv * (1 - alerteV), respire = 1 + 0.014 * Math.sin(temps * 0.31) + Math.min(0.05, horde.force * 0.018);
  // Plus on recule, plus on prend de hauteur : près du sol on voit le pays, de haut on lit le chemin.
  const hautV = Math.max(0, Math.min(1, (zoom - 0.5) / 0.9));
  const assiette = mix(mix(0.22, 0.52, hautV * hautV * (3 - 2 * hautV)), 0.86, alerteV), dist = mix(268 * zoom, 360, alerteV) * respire;
  const hC = Math.sin(assiette) * dist, recul = Math.cos(assiette) * dist;
  const sx = secousse * Math.sin(temps * 57) * 1.6, sy = secousse * Math.cos(temps * 43) * 1.6;
  const cx = camX + Math.sin(horde.capF) * lead + 2.4 * Math.sin(temps * 0.13), cs = camS + Math.cos(horde.capF) * lead;
  // La caméra ne recule jamais dans la Falaise.
  let px = cx + sx, py = camH + hC, ps = Math.max(cs - recul, 170);
  // Le regard ne s'arrête pas à la Horde : il file vers l'horizon, et la Horde reste en bas de l'image.
  const vise = mix(0.16, 0.02, hautV) * (1 - alerteV);
  let lx = cx + sx * 0.6, ly = camH + vise * dist, ls = cs + vise * dist;
  // Jamais dans la colline.
  py = Math.max(py, Math.max(0, monde.h(px, ps)) + 16, Math.max(0, monde.h(px, ps + 60)) + 22);

  // On descend à hauteur d'homme, juste derrière eux, et on lève les yeux vers ce qu'ils voient.
  regard = Math.max(0, Math.min(1, regard + (regardCible ? dt / 3.2 : -dt / regardMontee)));
  const r = lisseR();
  let fx0 = horde.x, fs0 = horde.s;
  if (r > 0.001) {
    const libre = regardLibre, cap = horde.capF;
    const vx = libre ? horde.x + Math.sin(cap) * 900 : visee.x, vs = libre ? horde.s + Math.cos(cap) * 900 : visee.s;
    const vy = libre ? camH + 46 : visee.y;
    const n = Math.hypot(vx - horde.x, vs - horde.s) || 1, ux = (vx - horde.x) / n, us = (vs - horde.s) / n;
    const lat = visee.lat ?? 2.3, ar = (visee.recul ?? 7.5) - horde.veillee * 3;
    const ex = horde.x - ux * ar + us * lat, es = horde.s - us * ar - ux * lat;
    const sol = Math.max(0, monde.h(ex, es), monde.h(ex + ux * 5, es + us * 5));
    const ey = Math.max(sol, camH) + (visee.haut ?? 1.7);
    px = mix(px, ex, r); ps = mix(ps, es, r); py = mix(py, ey, r * r);
    lx = mix(lx, vx, r); ls = mix(ls, vs, r); ly = mix(ly, vy, r);
    fx0 = ex + ux * 200; fs0 = es + us * 200;
  }
  camera.position.set(px, py, -ps + sy);
  camera.lookAt(lx, ly, -ls + sy * 0.6);
  camera.rotation.z += Math.sin(temps * 0.27) * 0.008 * r;
  const fov = mix(camera.aspect < 0.8 ? 48 : 36, camera.aspect < 0.8 ? 62 : 48, r), near = r > 0.25 ? 0.3 : 1;
  if (fov !== camera.fov || near !== camera.near) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
  secousse = Math.max(0, secousse - dt * 1.6);
  return { x: mix(camX, fx0, r), s: mix(camS, fs0, r) };
}

function boucle(now) {
  requestAnimationFrame(boucle);
  const brut = Math.min(0.05, (now - avant) / 1000); avant = now;
  const dt = brut * vitesseJeu;
  const vol = !!spect?.actif;
  if (vol) spect.maj(brut);
  foyer = vol ? spect.foyer : horde;

  // La qualité se règle seule : mieux vaut un dessin un peu moins fin qu'un vent qui saccade.
  cumul += brut; images++;
  if (cumul > 3) {
    const ms = cumul / images * 1000; cumul = 0; images = 0;
    if (ms > 22 && niveau < NIVEAUX.length - 1 && !qualiteFigee) appliquerNiveau(niveau + 1);
  }
  if (etat === 'pause') return;

  temps += dt;
  // Le temps : plusieurs pas de jeu par image, jamais plus quand quelque chose menace.
  const pasJeu = etat === 'marche' && !ev.actifs() && !ev.presage && !regardCible && !ev.nav ? accel : 1;
  hud.temps(accel, pasJeu);
  if (etat === 'marche' && scene_) {
    // Le temps de la scène ne compte pas : le Physalis seul poursuit sa manœuvre.
    j.temps = temps; vent.maj(dt); ev.majNavire(dt);
    horde.repos = true; horde.maj(dt, { actif: false, dx: 0, ds: 1, serre: bloc }); horde.repos = false;
  } else if (etat === 'marche') for (let i = 0; i < pasJeu; i++) { majJeu(dt); if (etat !== 'marche' || (i && (ev.actifs() || regardCible))) break; }
  else {
    vent.maj(dt); j.temps = temps;
    commande(dt);
    horde.maj(dt, marcheFinale ? cmd : { actif: false, dx: 0, ds: 1, serre: false });
    if (etat === 'fin' && horde.vivants().length) fil.ajouter(horde.x, horde.s);
  }

  if (titre.envol) titre.u.uSouffle.value = Math.min(1, titre.u.uSouffle.value + dt / 2.6);

  const nuitC = j.camp ? 1 : feuFinal ? 0.62 : 0;
  nuit = vers(nuit, nuitC, dt, j.camp ? 0.5 : 0.8);
  feu = vers(feu, (j.camp && horde.vit('callirhoe')) || feuFinal ? 1 : 0, dt, 1.2);
  if (marcheFinale) blanc = Math.min(1, blanc + dt / 5.5);
  if (etat === 'fin' && !marcheFinale && !feuFinal) blanc = Math.min(1, blanc + dt / 3.4);
  post.u.uBlanc.value = blanc;

  const m = vent.masque(horde.s, horde.x) * vent.front.presence;
  const eclat = calme ? 0 : Math.max(0, m - 0.5) * 2 * Math.min(1, Math.max(0, horde.force - 1.6));
  post.u.uFlou.value = eclat;
  post.u.uGrain.value = mix(0.016, 0.034, m);
  post.u.uVig.value = mix(0.26, 0.6, m);
  post.u.uAb.value = mix(0.0015, 0.024, m);
  post.u.uTemps.value = temps;

  if (regardCible) {
    regardReste -= dt;
    if (regardReste <= 0 || (!regardLibre && ev.actifs()) || (reve > 0.6)) quitterRegard();
  }
  // Le monde suit la Horde : une tranche par image au plus, fabriquée dans l'atelier.
  if (Math.floor(horde.s / MONDE.tranche) !== monde.k) reclamer(horde.s);
  deballer(); monde.monter();

  monuments.maj(foyer.s, 3000, dt);
  semis.maj(foyer.x, foyer.s + 40);
  poserUniformes(dt);
  lignes.uSim.uVitesse.value = 26;
  // L'obstacle que la Horde fait au vent : aussi large qu'elle, plus serré quand elle fait bloc.
  let ecartH = 0;
  for (const q of horde.membres) if (q.vivant) ecartH = Math.max(ecartH, Math.hypot(q.x - horde.x, q.s - horde.s));
  lignes.uSim.uHordeR.value = vers(lignes.uSim.uHordeR.value, Math.min(16, Math.max(4, ecartH + 2.5)), dt, 2);
  lignes.uSim.uNbFilets.value = filets.mesh.geometry.instanceCount;
  lignes.uSim.uEtale.value = vers(lignes.uSim.uEtale.value, m > 0.02 ? 1 : 0, dt, 1.4);
  lignes.maj(dt, temps, foyer.x, foyer.s + 150, horde.x, horde.s);
  filets.maj(dt, innerWidth, innerHeight, prActuel);
  filets.u.uFrontF.value.set(vent.front.a, vent.front.presence > 0 ? Math.max(0, Math.min(1, (vent.front.a + camera.position.z + 60) / 200)) : 0);
  filets.u.uChaud.value = m; filets.u.uNuit.value = nuit; filets.u.uForceF.value = (1 - reve) * (1 - lisseR() * 0.72) * (1 + carteV * 1.8) * ventVu();
  fx.maj(dt); foudre.maj(dt);
  const centre = cadrer(dt);
  // Les pierres et les tours ne bougent pas : une image sur quatre suffit à la grande carte. La petite porte les corps.
  if ((cptOmbre = (cptOmbre + 1) % 4) === 0) {
    if (vol) ombres.majLarge(foyer.x, Math.max(0, monde.h(foyer.x, foyer.s)), foyer.s);
    else ombres.majLarge(mix(camX, centre.x - vF.x * 40, lisseR()), camH, mix(camS + 240, horde.s + 300, lisseR()));
  }
  if (NIVEAUX[niveau].ombreP) ombres.majProche(horde.x, Math.max(0, monde.h(horde.x, horde.s)), horde.s + 26);
  camera.getWorldDirection(vF);
  // La maille la plus fine va où est le regard : sous les pieds de la Horde, ou devant la caméra quand elle descend.
  const eC = vol ? 1 : lisseR();
  terrain.maj(mix(centre.x, camera.position.x + vF.x * 24, eC), mix(centre.s, -camera.position.z - vF.z * 24, eC));
  souffle.maj(dt, temps, camera.position.x + vF.x * 70, -camera.position.z - vF.z * 70, lisseR(), camera.aspect);
  oiseaux.maj(dt, temps, horde.x, horde.s, camH, (horde.vit('tourse') ? 1 : 0) + (horde.vit('darbon') ? 1 : 0));
  oiseaux.u.uNuit.value = nuit;

  const eR = vol ? 1 : lisseR(), mTemp = vent.masque(horde.s, horde.x) * vent.front.presence;
  herbe.maj(mix(camX, centre.x - vF.x * 40, eR), mix(camS + 40, -(camera.position.z + vF.z * 110), eR), horde.x, horde.s, vent.respir, monde.contreeA(foyer.s).herbe > 0 || monde.contreeA(foyer.s + 200).herbe > 0 || monde.contreeA(foyer.s - 120).herbe > 0, eR);
  rafales.u.uCouleur.value.setRGB(clair.r, clair.g * mix(1, 0.72, mTemp), clair.b * mix(1, 0.46, mTemp));
  rafales.maj(dt, vol ? foyer.x : camX, vol ? foyer.s : camS + 90, vol ? Math.max(0, monde.h(foyer.x, foyer.s)) : camH, horde.force, 0.7 + Math.min(1.6, horde.force) + mTemp * 2 + vent.rafale * 6);
  rafales.mesh.visible = nuit < 0.5 && reve < 0.5;
  tornades.maj(temps, ev.colonne ? [...ev.chrones.slice(0, 3), ev.colonne] : ev.chrones);
  eclair *= Math.exp(-dt * 8);
  if (eclair < 0.01) eclair = 0;
  terrain.u.uEclair.value = eclair; post.u.uEclair.value = eclair;

  // Le feu du camp : une flamme, des braises, un peu de fumée.
  if (feu > 0.15 && !calme) {
    fumee += dt * 60 * feu;
    while (fumee >= 1) {
      fumee -= 1;
      const y = Math.max(0, monde.h(horde.x, horde.s));
      eclats.emettre(FLAMME, horde.x + (Math.random() - 0.5) * 0.8, y + 0.2, horde.s + (Math.random() - 0.5) * 0.8, 0, 3 + Math.random() * 3, 0, 0.55 + Math.random() * 0.3, 0.75 + Math.random() * 0.4, 1.7, 0.8, 0.3, 0.8);
      const q = Math.random();
      if (q < 0.25) eclats.emettre(BRAISE, horde.x, y + 0.8, horde.s, (Math.random() - 0.5) * 3, 5 + Math.random() * 7, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, 0.1, 1.9, 0.86, 0.34, 1);
      else if (q < 0.34) eclats.emettre(FUMEE, horde.x, y + 2, horde.s, 0, 3.2, 0, 3.2, 0.9, 0.5, 0.5, 0.56, 0.16);
    }
  }
  eclats.maj(dt, horde.w.x, horde.w.s, temps);

  // Les lentilles : l'image se tord autour des chrones, et du Corroyeur.
  for (let i = 0; i < NB_LENTILLES; i++) {
    const c = i === 0 && ev.corroyeur ? ev.corroyeur : ev.chrones[i - (ev.corroyeur ? 1 : 0)];
    const L = post.u.uLent.value[i];
    if (!c || eR > 0.4) { L.z = 0; continue; }
    vP.set(c.x, camH + 4, -c.s).project(camera);
    L.set(vP.x * 0.5 + 0.5, vP.y * 0.5 + 0.5, c === ev.corroyeur ? 0.07 : 0.13, c === ev.corroyeur ? -0.9 : 0.5);
  }
  document.body.classList.toggle('regard', regard > 0.35);

  post.rendre(scene, sceneAir, camera, {
    solY: camH, ventX: horde.w.x, ventS: horde.w.s, couv: CL.voile * 0.8 + 0.42, teinteAir: CL.teinte, vol: 1 + m * 3, front: vent.front.presence > 0,
  });
  titre.rendre(temps, dt);

  // L'interface suit.
  if (etat === 'marche') {
    hud.page(pageIci());
    const i = formeDuVent(horde.force);
    hud.forme(horde.s > monde.L - 240 ? '' : m > 0.6 ? 'furvent' : monde.contreeA(horde.s).id === 'krafla' && i >= 3 ? 'septième forme' : FORMES[i].nom);
    vP.set(horde.x, camH + 2, -horde.s).project(camera);
    const px = (vP.x + 1) / 2 * innerWidth + 74, py = (1 - vP.y) / 2 * innerHeight - 26;
    hud.roue(horde.souffle, px, py, horde.souffle < 0.985);
  } else if (etat === 'fin') hud.roue(1, 0, 0, false);
  audio.maj(brut, { force: horde.force, rafale: vent.rafale, tempete: j.intensite, combat: j.combat, camp: feu, silence: reve, abri: horde.abri, relief: monde.contreeA(horde.s).relief, avance: horde.s / monde.L, approche: vent.front.presence > 0 ? Math.max(0, 1 - Math.max(0, vent.front.a - horde.s) / 1500) : ev.presage ? 0.03 + ev.presage.monte * 0.7 : 0 });
}

// --- Démarrage ---
await titre.composer();
$('charge').remove();
const choix = $('choix-accueil');
if (sauvegarde) choix.append(bouton('Reprendre la marche', () => demarrer(true)), bouton('Nouvelle Horde', nouvelleHorde));
else choix.append(bouton('Prendre la route', () => demarrer(false)));
$('pied').hidden = false;
// Le titre se lit à hauteur de Horde, face à la Falaise ; le départ emportera la caméra jusqu'au ciel.
if (!params.has('direct')) {
  const a = monde.lieux[0];
  visee = { x: a.x, s: a.s - 8, y: Math.max(0, monde.h(a.x, a.s)) + 96, recul: 90, lat: -60, haut: 9 };
  regard = 1; regardCible = 1; regardReste = Infinity; regardLibre = false;
}
addEventListener('keydown', function entree(e) {
  if (e.code === 'Enter' && etat === 'titre') { removeEventListener('keydown', entree); choix.firstChild.click(); }
});
if (params.has('direct')) { demarrer(fDep > 0); regard = 0; }
requestAnimationFrame(boucle);

// Le mode admin n'existe qu'en local : la construction du site le retire.
if (import.meta.env.DEV && params.has('admin')) {
  import('./admin.js').then(({ ouvrirAdmin }) => ouvrirAdmin({ peint: terrain.u.uPeint,
    j, horde, monde, ev, vent, canvas, versMonde, graine, camera,
    vite(v) { vitesseJeu = v; },
    voler(s) { spect = s; },
    aller(x, s) {
      const dx = x - horde.x, ds = s - horde.s;
      horde.x = x; horde.s = s;
      for (const m of horde.membres) { m.x += dx; m.s += ds; m.emporte = false; }
      camX = x; camS = s + 34; camH = Math.max(0, monde.h(x, s)); fil.dx = x; fil.ds = s;
      chemin = []; cible = null; mene = false; pression = null; quitterRegard();
      ev.plan = ev.plan.filter((p) => p.f > s / monde.L);
      reclamer(s);
    },
  }));
}
if (params.has('debug')) window.__j = {
  j, horde, vent, ev, monde, get etat() { return etat; }, renderer, post,
  vite(v) { vitesseJeu = v; }, camera, versMonde, herbe, rafales, tornades, poussiere, semis, lignes, terrain, souffle, eclats, scene, sceneAir, atmo, ombres, fil, reclamer, tp(f) { horde.s = f * monde.L; horde.x = monde.xRoute(horde.s); reclamer(horde.s); camX = horde.x; camS = horde.s + 34; fil.dx = horde.x; fil.ds = horde.s; ev.plan = ev.plan.filter((p) => p.f > f); },
  mener(x, s) { chemin = [{ x, s }]; }, arret() { chemin = []; }, serre(v) { if (v !== bloc) basculerBloc(v); }, get qualite() { return niveau; }, figerQualite() { qualiteFigee = true; }, appliquerNiveau, regarder, basculerRegard, get chemin() { return chemin; },
};
