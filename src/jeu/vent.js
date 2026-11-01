// Le vent instantané : la carte résolue, plus ce qui passe (rafales, furvent, navire, remous).
// Même formule que `ventIci` dans rendu/communs.js.
import { NB_REMOUS } from '../rendu/communs.js';
import { R } from './reglages.js';

const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const ondeFront = (x) => 96 * Math.sin(x * 0.0017 + 1.3) + 54 * Math.sin(x * 0.0043 + 4.1) + 23 * Math.sin(x * 0.0097 + 2.2);

export class Vent {
  constructor(monde) {
    this.monde = monde;
    this.front = { a: -1e6, b: -1e6, m: 1, presence: 0 };
    this.navire = { x: 0, s: 0, r: 70, p: 0 };
    this.remous = [];
    this.respir = 1;
    this.t = 0;
    this.rafale = 0; this.rafaleT = 9; this.rafaleV = 0;     // rafale : 0 à 1
  }
  maj(dt) {
    this.t += dt;
    const t = this.t;
    // Les rafales : le vent frappe d'un coup, sans prévenir, et lâche.
    this.rafaleT -= dt;
    if (this.rafaleT <= 0) { this.rafaleV = R.rafaleDuree; this.rafaleT = R.rafaleMin + Math.random() * R.rafaleAlea; }
    if (this.rafaleV > 0) { this.rafaleV -= dt; const q = 1 - this.rafaleV / R.rafaleDuree; this.rafale = Math.sin(Math.min(1, q * 1.4) * Math.PI / 2) * (1 - Math.max(0, q - 0.6) / 0.4); }
    else this.rafale = 0;
    this.respir = 1 + 0.14 * Math.sin(t * 0.37) + 0.08 * Math.sin(t * 0.91 + 1.3) + 0.06 * Math.sin(t * 2.3) + this.rafale * R.rafaleForce;
    for (const r of this.remous) if (r.vie !== undefined) r.vie -= dt;
    this.remous = this.remous.filter((r) => r.vie === undefined || r.vie > 0);
  }
  masque(s, x) {
    const o = ondeFront(x), { a, b } = this.front;
    return lisse(a + o - 34, a + o + 34, s) * (1 - lisse(b + o - 90, b + o + 90, s));
  }
  ici(x, s, o) {
    this.monde.v(x, s, o);
    o.x *= this.respir; o.s *= this.respir;
    const m = 1 + (this.front.m - 1) * this.masque(s, x);
    o.x *= m; o.s *= m;
    const n = this.navire;
    if (n.p > 0) {
      const dx = (x - n.x) / (n.r * 0.8), ds = (s - n.s) / (n.r * 1.5) + 0.6;
      const k = 1 - 0.9 * n.p * Math.exp(-(dx * dx + ds * ds));
      o.x *= k; o.s *= k;
      if (k < 0.5) o.abri = Math.max(o.abri, 0.6);
    }
    for (const r of this.remous) {
      const dx = x - r.x, ds = s - r.s, q = (dx * dx + ds * ds) / (r.r * r.r), e = Math.exp(-q);
      if (e < 0.002) continue;
      o.x += (-ds / r.r * r.f - dx / r.r * Math.abs(r.f) * 0.34) * e;
      o.s += (dx / r.r * r.f - ds / r.r * Math.abs(r.f) * 0.34) * e;
    }
    return o;
  }
  // Les remous les plus proches passent au GPU.
  uniformes(u, x, s) {
    const tries = this.remous.slice().sort((p, q) => Math.hypot(p.x - x, p.s - s) - Math.hypot(q.x - x, q.s - s));
    for (let i = 0; i < NB_REMOUS; i++) {
      const r = tries[i];
      if (r) u.uRemous.value[i].set(r.x, r.s, r.r, r.f); else u.uRemous.value[i].set(0, 0, 0, 0);
    }
    u.uFront.value.set(this.front.a, this.front.b, this.front.m);
    u.uNavire.value.set(this.navire.x, this.navire.s, this.navire.r, this.navire.p);
    u.uRespir.value = this.respir;
  }
}
