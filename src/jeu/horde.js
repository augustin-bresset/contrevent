// La Horde : une tête qui avance contre le vent, et 23 corps qui la suivent ou que le vent emporte.
import { HORDIERS } from './hordiers.js';
import { FORMES } from '../monde/contrees.js';
import { R } from './reglages.js';

const mix = (a, b, t) => a + (b - a) * t;

export function formeDuVent(f) {
  let i = 0;
  for (let k = 0; k < FORMES.length; k++) if (f >= FORMES[k].seuil) i = k;
  return i;
}

export class Horde {
  constructor(monde, vent, x, s) {
    this.monde = monde; this.vent = vent;
    this.x = x; this.s = s; this.cap = 0;      // cap : 0 = vers l'amont
    this.capF = 0;                             // le cap de la formation, plus lent que celui du traceur
    this.t = 0;
    this.souffle = 1; this.serre = 0; this.vitesse = 0;
    this.force = 0; this.abri = 0; this.bout = 0;
    this.w = { x: 0, s: 0, abri: 0 };
    this.immobile = 0; this.pas = 0; this.chuteDans = 8; this.veillee = 0; this.contour = 1; this.nb = 23;
    this.membres = HORDIERS.map((h, i) => ({
      ...h, i, x: x + h.slot[0], s: s - h.slot[1], y: 0, vx: 0, vs: 0,
      vivant: true, emporte: false, marche: Math.random() * 6.28, chute: 0, cap: 0, amp: 0, pasN: 0,
    }));
    this.onPerte = () => {};
    this.onPas = () => {};
  }

  vivants() { return this.membres.filter((m) => m.vivant); }
  vit(id) { const m = this.membres.find((q) => q.id === id); return m && m.vivant; }

  perdre(m, cause) {
    if (!m.vivant) return;
    m.vivant = false; m.chute = 1; this.nb--;
    this.onPerte(m, cause);
  }

  // Une chute au hasard. Le traceur tombe en dernier : il est ce qui tient les autres debout.
  fauchee(cause) {
    const v = this.vivants();
    if (!v.length) return null;
    const cand = v.length > 1 ? v.filter((m) => m.id !== 'golgoth') : v;
    const m = cand[Math.floor(Math.random() * cand.length)];
    this.perdre(m, cause);
    return m;
  }

  maj(dt, cmd, ralenti = 1) {
    const { monde, vent } = this, w = vent.ici(this.x, this.s, this.w);
    monde.majSolides(this.x, this.s);
    const f = Math.hypot(w.x, w.s);
    this.force = f; this.abri = w.abri;
    // Une scène : personne ne bouge, personne ne s'use.
    if (this.repos) { this.vitesse = 0; this.corps(dt, f, 1); return { effort: 0 }; }

    this.serre += ((cmd.serre ? 1 : 0) - this.serre) * (1 - Math.exp(-dt * 7));
    // Le bloc abrite, le nombre aussi : chaque perdu laisse plus de vent aux autres.
    const expoP = mix(1, 0.42, this.serre) * (1 + (23 - this.nb) * R.expoPerte);

    let vx = 0, vs = 0, effort = 0;
    if (cmd.actif) {
      const n = Math.hypot(cmd.dx, cmd.ds) || 1, dx = cmd.dx / n, ds = cmd.ds / n;
      const cible = Math.atan2(dx, ds);
      let d = cible - this.cap;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.cap += d * (1 - Math.exp(-dt * 3.4));
      const contre = Math.max(0, -(w.x * dx + w.s * ds));
      const poussee = contre * contre * R.prise * expoP;
      // La pente coûte, l'eau de la Flaque retient un peu les pieds.
      const h0 = monde.h(this.x, this.s), h1 = monde.h(this.x + dx * 2, this.s + ds * 2);
      const pente = (h1 - h0) / 2, monte = Math.max(0, pente);
      const sol = h0 < 0 ? 0.86 : 1;
      let vmax = 8.6 * mix(1, R.vitesseBloc, this.serre) * sol * (1 - Math.min(0.7, monte * 0.75));
      if (this.vit('golgoth')) vmax *= 1.06;
      if (this.souffle <= 0) vmax *= 0.45;
      const v = vmax * (1 - poussee);
      vx = dx * v; vs = ds * v;
      effort = R.effortMarche + contre * contre * R.effortVent * expoP + monte * R.effortPente + (cmd.serre ? R.effortBloc : 0);
      this.immobile = 0;
      this.pas += dt * 8;
    } else {
      this.immobile += dt;
      effort = Math.max(0, f - 0.85) * 0.006 * expoP;
    }
    // Quand le vent dépasse ce que les corps tiennent, il reprend du terrain.
    const excès = Math.max(0, f * f * R.prise * expoP - 1);
    // En bloc, on plie sans reculer : la rafale vole des pas, pas des heures de marche.
    const recule = excès * mix(2.4, 0.5, this.serre);
    vx += w.x * recule; vs += w.s * recule;
    if (cmd.vitesseMax) { const v = Math.hypot(vx, vs); if (v > cmd.vitesseMax) { vx *= cmd.vitesseMax / v; vs *= cmd.vitesseMax / v; } }

    // Ce qui est trop raide ne se franchit pas : on tâte le sol un pas devant et on contourne.
    const v = Math.hypot(vx, vs);
    if (v > 1e-3) {
      const h = Math.max(0, monde.h(this.x, this.s)), ux = vx / v, us = vs / v, PAS = 1.6;
      const libre = (a, b) => Math.max(0, monde.h(this.x + a * PAS, this.s + b * PAS)) - h <= 1.7 * PAS && !monde.bloque(this.x + a * PAS * 3, this.s + b * PAS * 3);
      if (!libre(ux, us)) {
        let trouve = false;
        for (const q of [0.6, 1.1, 1.6, 2.1]) {
          for (const c of [this.contour, -this.contour]) {
            const a = q * c, ca = Math.cos(a), sa = Math.sin(a), rx = ux * ca - us * sa, rs = ux * sa + us * ca;
            if (libre(rx, rs)) { vx = rx * v * 0.9; vs = rs * v * 0.9; this.contour = c; trouve = true; break; }
          }
          if (trouve) break;
        }
        if (!trouve) vx = vs = 0;
      }
    }
    this.x += vx * dt; this.s += vs * dt;
    this.x = Math.max(8, Math.min(monde.W - 8, this.x)); this.s = Math.max(30, Math.min(monde.L - 4, this.s));
    this.vitesse = Math.hypot(vx, vs);

    this.souffle = Math.max(0, Math.min(1, this.souffle - effort * dt * ralenti));
    if (this.souffle <= 0) {
      this.chuteDans -= dt;
      // Quand l'un tombe, les autres reprennent sa part : le temps d'atteindre un abri, pas plus.
      if (this.chuteDans <= 0) { this.chuteDans = R.chuteDebut + Math.random() * R.chuteAlea; this.fauchee('souffle'); this.souffle = R.repriseChute; }
    }

    this.corps(dt, f, expoP);
    return { effort };
  }

  corps(dt, f, expoP) {
    const { monde } = this;
    this.t += dt;
    let dc = this.cap - this.capF;
    while (dc > Math.PI) dc -= 2 * Math.PI;
    while (dc < -Math.PI) dc += 2 * Math.PI;
    this.capF += dc * (1 - Math.exp(-dt * 1.5));
    const c = Math.cos(this.capF), sn = Math.sin(this.capF);
    const ecart = mix(0.72, 0.42, this.serre), w = this.w;
    const dirW = f > 1e-4 ? [w.x / f, w.s / f] : [0, -1];
    for (const m of this.membres) {
      if (!m.vivant) { m.chute = Math.max(0, m.chute - dt * 0.35); continue; }
      // Chacun flotte un peu autour de sa place : une marche, pas une parade.
      const a = (m.slot[0] + Math.sin(this.t * 0.37 + m.i * 1.7) * 0.28) * ecart;
      const b = (-m.slot[1] + Math.sin(this.t * 0.29 + m.i * 2.3) * 0.28) * ecart * (m.avant ? 1.1 : 1);
      let sx = this.x + a * c + b * sn, ss = this.s - a * sn + b * c;
      // Au camp, on se défait de la formation : un cercle autour du feu.
      if (this.veillee > 0.01) {
        const n = this.membres.length, q = m.i / n * 6.283 + 0.4, ray = 2.6 + (m.i % 2) * 0.8;
        sx = mix(sx, this.x + Math.cos(q) * ray, this.veillee); ss = mix(ss, this.s + Math.sin(q) * ray, this.veillee);
      }
      const x0 = m.x, s0 = m.s;
      const pris = f * f * m.expo * expoP;
      // En bloc, on tient presque toujours : c'est ce qui rend le bloc vital, et il tient de moins en moins vers l'amont.
      const lache = mix(0.5, mix(R.emporteBloc, R.emporteBlocFin, (this.s / monde.L) ** 2), this.serre);
      if (!this.repos && !m.emporte && pris > R.seuilEmporte && m.id !== 'golgoth' && Math.random() < dt * lache) m.emporte = true;
      if (m.emporte) {
        m.x += dirW[0] * f * 11 * dt; m.s += dirW[1] * f * 11 * dt;
        const d = Math.hypot(m.x - this.x, m.s - this.s);
        if (f < 1.5 || this.serre > 0.9 && d < 12) m.emporte = false;
        if (d > R.perduA) { m.emporte = false; this.perdre(m, 'emporte'); }
      } else {
        const dx = sx - m.x, ds = ss - m.s, d = Math.hypot(dx, ds);
        const v = Math.min(d * 2.6, 15);
        if (d > 1e-3) { m.x += dx / d * v * dt; m.s += ds / d * v * dt; }
      }
      monde.ecarter(m);
      // Le pas suit la distance parcourue : pas de pieds qui glissent, pas de piétinement sur place.
      const dpl = Math.hypot(m.x - x0, m.s - s0), vit = dpl / Math.max(dt, 1e-4);
      m.marche += dpl * 3.8;
      const pasN = Math.floor(m.marche / Math.PI);
      if (pasN !== m.pasN) { m.pasN = pasN; if (m.amp > 0.35) this.onPas(m); }
      m.amp += (Math.min(1, vit / 4.5) - m.amp) * (1 - Math.exp(-dt * 7));
      let cible = vit > 0.7 ? Math.atan2(m.x - x0, m.s - s0) : this.capF;
      if (this.veillee > 0.5) cible = Math.atan2(this.x - m.x, this.s - m.s);
      let e = cible - m.cap;
      while (e > Math.PI) e -= 2 * Math.PI;
      while (e < -Math.PI) e += 2 * Math.PI;
      m.cap += e * (1 - Math.exp(-dt * 5));
      const h = Math.max(0, monde.h(m.x, m.s));
      m.y = m.y === 0 ? h : m.y + (h - m.y) * (1 - Math.exp(-dt * 14));
    }
  }
}
