// Ce qui arrive à la Horde, dans l'ordre du roman : furvents, Physalis, Poursuite, chrones.
// Le plan est fixe ; ses positions exactes, les chrones errants et les bavardages varient avec la graine.
import { alea } from '../monde/bruit.js';
import { A_LIEU, CHEMIN, CHUTE } from './textes.js';
import { R } from './reglages.js';

const REPLIQUES = [5, 13, 21, 28, 35];

// Où poser les yeux en arrivant : la hauteur du regard sur le monument. Sans monument, l'horizon.
const VISEES = { portchoon: 26, chawondasee: 20, alticcio: 76, urle: 58, egine: 14, boban: 14, brakauer: 40, krafla: 165 };

const mix = (a, b, t) => a + (b - a) * t;

// Les rendez-vous du roman sont fixes. Entre eux, la route se durcit toute seule : les furvents et la Poursuite
// se rapprochent à mesure qu'on remonte, jusqu'à ne plus laisser de répit au bout du monde.
const nouveauPlan = (r) => {
  const j = (f, e = 0.004) => f + (r() - 0.5) * e;
  const p = [
    { f: j(0.06), t: 'furvent', m: 2.2, premier: true },
    { f: j(0.124), t: 'silene' },
    { f: j(0.178), t: 'navire' },
    { f: j(0.248), t: 'corroyeur' },
    { f: j(0.342), t: 'chrone', k: 'eau' },
    { f: j(0.438), t: 'chrone', k: 'temps' },
    { f: j(0.518), t: 'poursuite', n: 10, chef: 'Maskhar Lek' },
    { f: j(0.722), t: 'chrone', k: 'vera' },
  ];
  for (let f = 0.1; f < 0.955;) {
    p.push({ f, t: 'furvent', m: mix(2.3, 3.7, f) });
    f += mix(R.furventTous, R.furventFin, f * f) * (0.8 + 0.4 * r());
  }
  for (let f = 0.15; f < 0.95;) {
    if (Math.abs(f - 0.518) > 0.02) p.push({ f, t: 'poursuite', n: Math.round(mix(5, 11, f)), pv: f > 0.85 ? 2 : 1 });
    f += mix(R.poursuiteTous, R.poursuiteFin, f * f) * (0.8 + 0.4 * r());
  }
  for (const [a, b, n] of [[0.17, 0.28, 3], [0.32, 0.44, 5], [0.665, 0.77, 6], [0.88, 0.93, 4]])
    for (let i = 0; i < n; i++) p.push({ f: a + r() * (b - a), t: 'chrone', k: 'errant' });
  return p.sort((a, b) => a.f - b.f);
};

export class Evenements {
  constructor(j) {
    this.j = j; this.r = alea(j.monde.graine ^ 0xc0de);
    this.plan = nouveauPlan(this.r);
    this.faits = new Set();
    this.lieuxVus = new Set();
    this.chrones = []; this.ennemis = []; this.corroyeur = null;
    this.tempete = null; this.nav = null;
    this.babil = 22; this.contree = '';
    this.ecartParade = 0;
    this.j.horde.onPerte = (m, cause) => {
      const l = CHUTE[cause] || CHUTE.souffle;
      j.hud.dire(m.id === 'sov' ? 'caracole' : 'sov', `${m.nom}. ${l[Math.floor(Math.random() * l.length)]}`);
      j.hud.signes(j.horde); j.audio.perte(); j.secousse(0.4);
      j.eclats.disperser(m.x, m.y, m.s, m.col);
    };
  }

  restaurer(faits) { for (const f of faits || []) this.faits.add(f); this.plan = this.plan.filter((p) => p.f > this.j.horde.s / this.j.monde.L); }

  actifs() { return !!this.tempete || this.ennemis.length > 0 || !!this.corroyeur; }

  dire(id, texte) { if (this.j.horde.vit(id)) { this.j.hud.dire(id, texte); return true; } return false; }

  maj(dt) {
    const { j } = this, { horde, monde } = j, f = horde.s / monde.L;

    while (!j.regard && this.plan.length && this.plan[0].f <= f) this.lancer(this.plan.shift());

    for (const l of monde.lieux) {
      if (this.lieuxVus.has(l.id) || Math.abs(horde.s - l.s) > l.rayon) continue;
      this.lieuxVus.add(l.id);
      if (l.id !== 'aberlaas') {
        const y = VISEES[l.id], sol = Math.max(0, monde.h(l.x, l.s));
        if (y) j.regarder({ x: l.x, s: l.s + 8, y: sol + y, duree: 13 });
        else j.regarder({ x: monde.xRoute(l.s + 900), s: l.s + 900, y: sol + 30, duree: 12 });
      }
      setTimeout(() => { j.hud.banniere(l.nom, l.sous); j.audio.decouverte(); }, l.id === 'aberlaas' ? 0 : 2400);
      (A_LIEU[l.id] || []).forEach(([id, t], i) => setTimeout(() => this.dire(id, t), 4400 + i * 6200));
      const rations = R.rations[l.id];
      if (rations) { j.ajouterVivres(rations); setTimeout(() => this.dire('steppe', `De quoi tenir : ${rations} rations de plus.`), 9000); }
      if (l.id === 'boban') { horde.souffle = 1; j.sauver(); }
      if (l.id === 'krafla') this.krafla(l);
    }
    const c = monde.contreeA(horde.s);
    if (c.id !== this.contree) { this.contree = c.id; j.audio.contree(monde.contrees.indexOf(c)); j.hud.teinte(c); j.changerAir(c); }

    this.majTempete(dt);
    this.majNavire(dt);
    this.majChrones(dt);
    this.majEnnemis(dt);
    this.majCorroyeur(dt);

    if (c.id === 'norska' || c.id === 'krafla') if (!j.camp) horde.souffle = Math.max(0, horde.souffle - R.froid * dt);

    // Aoi cueille, Larco chasse : tant qu'ils vivent, le sac se remplit un peu.
    if (horde.s > (this.cueillette ??= horde.s + R.cueilletteTous)) {
      this.cueillette = horde.s + R.cueilletteTous;
      // Plus rien ne pousse au-delà du Scóverr : ce qu'on a dans le sac doit tenir jusqu'au bout.
      if (f < 0.87 && (horde.vit('aoi') || horde.vit('larco'))) { j.ajouterVivres(1); this.dire(horde.vit('aoi') ? 'aoi' : 'larco', 'Trouvé de quoi manger. Une ration.'); }
    }

    this.babil -= dt;
    if (this.babil <= 0 && !this.actifs() && !j.camp) {
      this.babil = 34 + this.r() * 26;
      const ids = Object.keys(CHEMIN).filter((i) => horde.vit(i)), id = ids[Math.floor(this.r() * ids.length)];
      if (id) { const l = CHEMIN[id]; this.dire(id, l[Math.floor(this.r() * l.length)]); }
    }
  }

  lancer(e) {
    const { j } = this;
    if (e.t === 'furvent') this.furvent(e);
    else if (e.t === 'silene') this.silene();
    else if (e.t === 'navire') this.navire();
    else if (e.t === 'corroyeur') this.lancerCorroyeur();
    else if (e.t === 'chrone') this.chrone(e.k);
    else if (e.t === 'poursuite') this.poursuite(e.n, e.chef, e.pv);
    j.sauver();
  }

  // --- Furvent ---
  furvent({ m, premier }) {
    if (this.tempete) return;
    const { j } = this, oroshi = j.horde.vit('oroshi');
    this.tempete = { phase: 'annonce', t: oroshi ? R.alerte : 2, m, longueur: 900 + m * 120, premier };
    if (oroshi) j.hud.dire('oroshi', premier ? 'Ça vient de l’amont. Un furvent, le premier. Trouvez un creux, et faites bloc.' : 'Furvent. Il arrive. Un creux, vite.');
    else j.hud.dire('sov', 'Oroshi n’est plus là pour l’entendre venir. Il est déjà sur nous.');
    if (premier) j.hud.aide('Espace ou clic droit : faire bloc. La Horde ralentit, mais elle tient.', 16);
    j.audio.alerte();
    // Arval cherche l'abri le plus proche.
    if (j.horde.vit('arval')) {
      let best = null, d0 = 1e9;
      for (const a of j.monde.abris) {
        const d = Math.hypot(a.x - j.horde.x, a.s - 12 - j.horde.s);
        if (d < d0 && d < 240) { d0 = d; best = a; }
      }
      if (best) { j.balise = { x: best.x, s: best.s - 12, vie: 34 }; j.hud.dire('arval', 'Un creux, là-bas. Je le marque.'); }
    }
  }
  majTempete(dt) {
    const T = this.tempete, { j } = this;
    if (!T) { j.intensite = Math.max(0, j.intensite - dt * 0.4); return; }
    const fr = j.vent.front;
    if (T.phase === 'annonce') {
      T.t -= dt;
      if (T.t <= 0) {
        T.phase = 'front'; fr.a = j.horde.s + R.frontDepart; fr.b = fr.a + T.longueur; fr.m = T.m; fr.presence = 1;
        j.audio.tom(0.9, 70);
      }
      j.intensite = Math.min(0.35, j.intensite + dt * 0.04);
      return;
    }
    const v = R.frontVitesse;
    fr.a -= v * dt; fr.b -= v * dt;
    const ici = j.vent.masque(j.horde.s);
    j.intensite += (Math.max(ici, 0.3) - j.intensite) * (1 - Math.exp(-dt * 1.4));
    if (ici > 0.6 && !T.vu) { T.vu = true; j.secousse(0.8); }
    // À découvert, le furvent arrache : le bloc retarde, seul un vrai abri protège.
    T.rav = (T.rav ?? 1) - dt;
    if (ici > 0.6 && T.rav <= 0 && !T.premier) {
      const h = j.horde;
      T.rav = h.serre > 0.8 ? mix(R.ravageBloc, R.ravageBlocFin, (h.s / j.monde.L) ** 2) : R.ravageLibre;
      if (h.abri < 0.42) {
        const q = h.membres.filter((m) => m.vivant && !m.emporte && m.id !== 'golgoth');
        const m = q[Math.floor(this.r() * q.length)];
        if (m) m.emporte = true;
        else if (h.nb > 0) h.fauchee('emporte');
      }
    }
    T.foudre = (T.foudre ?? 2) - dt;
    if (ici > 0.4 && T.foudre <= 0) { T.foudre = 1.6 + this.r() * 4.5; j.eclair(); }
    if (fr.b < j.horde.s - 260) {
      fr.a = fr.b = -1e6; fr.m = 1; fr.presence = 0;
      this.tempete = null; j.balise = null;
      const m = j.horde.vivants().length;
      this.dire('sov', m === 23 ? 'Il est passé. Vingt-trois. Je recompte, pour le plaisir.' : `Il est passé. Nous sommes ${m}.`);
      j.sauver();
    }
  }

  // --- Le Physalis ---
  navire() {
    const { j } = this;
    this.nav = { phase: 0, x: j.horde.x - 150, s: j.horde.s - 900, t: 0, corde: 0, dit: 0 };
    j.navire.groupe.visible = true;
    this.dire('sov', 'Un grondement de toile, dans notre dos et au-dessus. Une montagne de voiles remonte la Flaque, sans toucher l’eau.');
  }
  // Le passage du Physalis, réglé sur son propre temps : il ne dépend pas de l'horloge du navigateur.
  majNavire(dt) {
    const N = this.nav, { j } = this;
    if (!N) return;
    const h = j.horde, n = j.vent.navire, ALT = 66;
    N.t += dt;
    const replique = (q, id, txt) => { if (N.dit === q && N.t > REPLIQUES[q]) { N.dit++; this.dire(id, txt); } };
    if (N.phase === 0) {
      N.s += 60 * dt; N.x += (h.x - 120 - N.x) * (1 - Math.exp(-dt * 0.4));
      if (N.s > h.s - 460 && !N.vu) { N.vu = true; j.regarder({ x: N.x, s: N.s, y: ALT + 56, duree: 56, recul: 118, lat: 0, haut: 2 }); this.dire('talweg', 'Le Physalis. Le vaisseau-amiral de l’Escadre Frêle.'); }
      if (N.s > h.s + 20) { N.phase = 1; N.t = 0; }
    } else if (N.phase === 1) {
      // Il règle son allure sur la nôtre : le temps de l'offre.
      N.s += (h.s + 24 - N.s) * (1 - Math.exp(-dt * 0.5)); N.x += (h.x - 120 - N.x) * (1 - Math.exp(-dt * 0.3));
      replique(0, 'pietro', 'Il ralentit. Il se met à notre pas.');
      replique(1, 'sov', 'Ils lâchent les cordes. Nouchka nous fait signe de monter.');
      replique(2, 'caracole', 'Un lit, de la soupe, et le vent sous les pieds pour une fois. J’en connais qui pleureraient.');
      replique(3, 'golgoth', 'Non. La Horde remonte à pied. On ne monte pas.');
      replique(4, 'sov', 'Les cordes remontent, sans un mot de là-haut.');
      const veut = N.t > REPLIQUES[1] - 1 && N.t < REPLIQUES[4] - 1;
      const cible = veut ? Math.max(0, ALT - 3 - Math.max(0, j.monde.h(N.x, N.s))) / 1 : 0;
      N.corde += (cible - N.corde) * (1 - Math.exp(-dt * (veut ? 0.5 : 0.9)));
      if (N.t > REPLIQUES[4] + 5) { N.phase = 2; N.t = 0; this.dire('sov', 'Le Physalis repart sans nous. Il monte, et il ne nous attend pas.'); }
    } else {
      N.s += (6 + N.t * 3.4) * dt; N.corde *= Math.exp(-dt);
      if (N.s > h.s + 2400) { this.nav = null; n.p = 0; j.navire.groupe.visible = false; return; }
    }
    n.x = N.x + 70; n.s = N.s - 30; n.r = 150;
    n.p = Math.min(1, Math.max(0, 1 - Math.abs(N.s - h.s) / 1400)) * (N.phase === 2 ? Math.max(0, 1 - N.t / 26) : 1);
    const sol = Math.max(0, j.monde.h(N.x, N.s));
    j.navire.poser(N.x, sol + ALT + (N.phase === 2 ? N.t * N.t * 0.03 : 0), N.s, Math.PI, j.temps);
    j.navire.corde(N.corde);
    j.viser(N.x, N.s, sol + ALT + 56);
  }

  // --- Les chrones ---
  chrone(k) {
    const { j } = this, s = j.horde.s + 230 + this.r() * 80, cote = this.r() < 0.5 ? -1 : 1;
    const x = j.monde.xRoute(s) + cote * (10 + this.r() * 44);
    const c = { k, x, s, r: k === 'eau' ? 50 : k === 'temps' ? 56 : 42, f: 2.3 + this.r() * 0.9, vie: 95, marque: 0, dx: (this.r() - 0.5) * 3 };
    if (k === 'eau') { c.f = 2.7; this.dire('talweg', 'Un puits qui tourne, sans eau ni fond. Il boit ce qui passe. N’y marchez pas.'); }
    if (k === 'temps') this.dire('oroshi', 'Le vent bégaie, devant. Un chrone : le temps s’y étire. Contournez.');
    if (k === 'vera') this.dire('sov', 'Une forme droite dans le vent. Elle montre ce qu’on est, à qui y entre.');
    if (k === 'errant') this.dire('arval', 'Chrone. Regardez comme les lignes s’enroulent.');
    c.rem = { x: c.x, s: c.s, r: c.r, f: c.f };
    j.vent.remous.push(c.rem);
    this.chrones.push(c);
  }
  majChrones(dt) {
    const { j } = this, h = j.horde;
    for (const c of this.chrones) {
      c.vie -= dt; c.s -= 1.4 * dt; c.x += c.dx * Math.sin(j.temps * 0.2) * dt;
      const d = Math.hypot(c.x - h.x, c.s - h.s), dans = d < c.r * 0.72, oeil = d < c.r * 0.3;
      // Ils sentent la Horde : de près, ils viennent à elle.
      if (d < c.r * 3.5 && c.k !== 'vera') { c.x += (h.x - c.x) / d * R.chasseChrone * dt; c.s += (h.s - c.s) / d * R.chasseChrone * dt; }
      c.rem.x = c.x; c.rem.s = c.s;
      if (dans) {
        if (c.k === 'eau') h.souffle = Math.max(0, h.souffle - 0.075 * dt);
        if (c.k === 'temps') { j.pesanteur = 2.6; j.ralentiCible = 0.55; }
        if (c.k === 'errant') h.souffle = Math.max(0, h.souffle - 0.06 * dt);
        if (c.k === 'vera' && oeil && h.vit('caracole')) {
          c.vie = 0; h.souffle = 1;
          j.hud.dire('sov', 'Caracole y est entré en riant. La forme s’est défaite autour de lui. Rien de ce qu’elle cherchait n’était là.');
          j.audio.decouverte();
        }
        if (oeil && c.k !== 'vera') {
          c.marque += dt;
          if (c.marque > R.oeilChrone) { c.marque = 0; h.fauchee('chrone'); c.pris = (c.pris || 0) + 1; if (c.pris >= R.repuChrone) c.vie = 0; }
        }
      }
    }
    const fin = this.chrones.filter((c) => c.vie <= 0 || c.s < h.s - 280);
    for (const c of fin) j.vent.remous.splice(j.vent.remous.indexOf(c.rem), 1);
    if (fin.length) this.chrones = this.chrones.filter((c) => !fin.includes(c));
  }
  // La nuit n'arrête pas la Poursuite.
  campAttaque() {
    const { j } = this, f = j.horde.s / j.monde.L;
    if (f < 0.11 || this.r() > mix(R.embuscade, R.embuscadeFin, f * f)) return false;
    setTimeout(() => {
      if (!j.camp) return;
      this.dire('erg', 'Debout ! Ils sont sur le camp.');
      this.apparaitre(3 + Math.floor(f * 4));
      j.audio.alerte();
    }, 3500 + this.r() * 4000);
    return true;
  }

  krafla(l) { const r = { x: l.x, s: l.s, r: 92, f: 1.1 }; this.j.vent.remous.push(r); this.colonne = r; }

  // --- La Poursuite ---
  apparaitre(n, opts = {}) {
    const { j } = this, h = j.horde;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (this.r() - 0.5) * 2.4, d = 190 + this.r() * 60;
      const x = Math.max(16, Math.min(j.monde.W - 16, h.x + Math.sin(a) * d)), s = h.s + Math.cos(a) * d;
      this.ennemis.push({ x, s, y: 0, pv: opts.pv || 1, v: opts.v || R.vitesseAssaut + this.r() * 5, phase: this.r() * 6.28, presence: 1, recul: 0, nom: opts.nom });
    }
  }
  silene() {
    this.dire('erg', 'Silène. Un poursuiveur. Il vient pour moi, je m’en occupe.');
    this.apparaitre(1, { pv: 4, v: 24, nom: 'silene' });
    this.j.hud.aide('Cliquez sur l’assaillant : Erg frappe.', 12);
  }
  poursuite(n, chef, pv = 1) {
    this.dire('erg', chef ? `${chef}, et ses lames. Tenez-vous à côté de moi.` : 'La Poursuite. Encore. Derrière nous.');
    this.apparaitre(n, { pv });
    this.j.hud.aide('Cliquez sur les assaillants : Erg frappe.', 6);
  }
  majEnnemis(dt) {
    const { j } = this, h = j.horde;
    let proche = 1e9;
    this.ecartParade -= dt; this.ecartFrappe = (this.ecartFrappe || 0) - dt; this.lameDans = (this.lameDans || 0) - dt;
    for (const e of this.ennemis) {
      const dx = h.x - e.x, ds = h.s - e.s, d = Math.hypot(dx, ds) || 1;
      proche = Math.min(proche, d);
      const zig = Math.sin(j.temps * 3 + e.phase) * 0.45;
      if (e.recul > 0) { e.recul -= dt; e.x -= dx / d * 34 * dt; e.s -= ds / d * 34 * dt; }
      else { e.x += (dx / d - ds / d * zig) * e.v * dt; e.s += (ds / d + dx / d * zig) * e.v * dt; }
      e.y = Math.max(0, j.monde.h(e.x, e.s));
      e.vx = -dx / d; e.vs = -ds / d; e.force = 1.2; e.phase += dt * 11; e.amp = 1; e.cap = Math.atan2(dx, ds);
      if (d < 7) {
        const erg = h.membres.find((m) => m.id === 'erg');
        if (erg && erg.vivant && this.ecartParade <= 0) {
          this.ecartParade = R.paradeErg; e.pv -= 1; e.recul = 0.7;
          j.fx.ajouter(erg.x, erg.y, erg.s, e.x, e.y, e.s); j.audio.coup(); j.eclats.gerbe(e.x, e.y, e.s);
        } else if (d < 4 && this.ecartFrappe <= 0) {
          // Ils frappent, reculent, et reviennent tant qu'on ne les abat pas. Plus la fin approche, moins ils laissent de temps.
          const cible = h.fauchee('poursuite'); e.recul = 1.4;
          this.ecartFrappe = mix(R.frappe, R.frappeFin, h.s / j.monde.L);
          if (cible) j.secousse(0.5);
        } else if (d < 4) e.recul = 0.5;
      }
    }
    if (this.ennemis.some((e) => e.pv <= 0)) {
      if (this.ennemis.some((e) => e.pv <= 0 && e.nom === 'silene')) this.dire('erg', 'Silène est tombé. Quelque chose l’a fini avant moi.');
      this.ennemis = this.ennemis.filter((e) => e.pv > 0);
    }
    j.combat = Math.min(1, proche < 1e8 ? Math.max(0.4, 1 - proche / 180) : 0);
    if (proche < 60) j.ralentiCible = Math.min(j.ralentiCible, 0.58);
  }

  // --- Le Corroyeur : sans corps, il ne se voit qu'à ce qu'il fait au vent ---
  lancerCorroyeur() {
    const { j } = this, h = j.horde;
    const c = { x: h.x + 90, s: h.s - 70, pv: 5, vie: 120, rem: null, marque: 0 };
    c.rem = { x: c.x, s: c.s, r: 15, f: -3.4 };
    j.vent.remous.push(c.rem);
    this.corroyeur = c;
    this.dire('sov', 'Rien sur l’eau. Et pourtant, Alme a les mains qui tremblent.');
    setTimeout(() => { if (this.corroyeur) this.dire('erg', 'Le Corroyeur. On ne le voit pas. Regardez où le vent se trompe, et cliquez-y.'); }, 3500);
    j.hud.aide('Cherchez où les lignes se tordent, et cliquez.', 12);
  }
  majCorroyeur(dt) {
    const c = this.corroyeur, { j } = this;
    if (!c) return;
    const h = j.horde, dx = h.x - c.x, ds = h.s - c.s, d = Math.hypot(dx, ds) || 1;
    c.vie -= dt;
    const zig = Math.sin(j.temps * 1.7) * 0.8;
    c.x += (dx / d - ds / d * zig) * 12 * dt; c.s += (ds / d + dx / d * zig) * 12 * dt;
    c.rem.x = c.x; c.rem.s = c.s;
    j.combat = Math.max(j.combat, Math.max(0.35, 1 - d / 150));
    if (d < 30) { h.souffle = Math.max(0, h.souffle - 0.05 * dt); j.ralentiCible = Math.min(j.ralentiCible, 0.7); }
    if (d < 10) { c.marque += dt; if (c.marque > 3.5) { c.marque = 0; h.fauchee('poursuite'); } }
    if (c.pv <= 0 || c.vie <= 0) {
      j.vent.remous.splice(j.vent.remous.indexOf(c.rem), 1); this.corroyeur = null;
      this.dire('sov', c.pv <= 0 ? 'Le Corroyeur s’est défait dans le vent. Personne n’ose dire qu’il est mort.' : 'Il s’est éloigné. Il a assez mangé pour aujourd’hui.');
    }
  }

  // Un clic sur le monde : renvoie vrai s'il touche quelque chose.
  clic(x, s) {
    const { j } = this, h = j.horde, erg = h.membres.find((m) => m.id === 'erg');
    if (this.lameDans > 0) return false;
    const a = erg && erg.vivant ? erg : h.membres.find((m) => m.vivant && m.role === 'croc') || h.vivants()[0];
    if (!a) return false;
    let best = null, d0 = R.porteeClic;
    for (const e of this.ennemis) { const d = Math.hypot(e.x - x, e.s - s); if (d < d0) { d0 = d; best = e; } }
    if (best) {
      best.pv -= 1; best.recul = 0.45; this.lameDans = R.lame;
      j.fx.ajouter(a.x, a.y, a.s, best.x, best.y, best.s); j.audio.coup(); j.secousse(0.18); j.eclats.gerbe(best.x, best.y, best.s);
      j.vent.remous.push({ x: best.x, s: best.s, r: 16, f: 2.4, vie: 0.7 });
      return true;
    }
    const c = this.corroyeur;
    if (c && Math.hypot(c.x - x, c.s - s) < 17) {
      c.pv -= 1; this.lameDans = R.lame;
      j.fx.ajouter(a.x, a.y, a.s, c.x, Math.max(0, j.monde.h(c.x, c.s)), c.s); j.audio.coup(); j.secousse(0.3); j.eclats.gerbe(c.x, Math.max(0, j.monde.h(c.x, c.s)), c.s);
      const b = this.r() * 6.28; c.x = h.x + Math.cos(b) * 95; c.s = h.s + Math.sin(b) * 95;
      if (c.pv > 0) j.hud.dire('erg', c.pv > 1 ? 'Touché. Il s’est reformé plus loin.' : 'Encore. Il faiblit.');
      return true;
    }
    return false;
  }
}

function monde_x(j, s) { return j.monde.xRoute(s) - 18; }
