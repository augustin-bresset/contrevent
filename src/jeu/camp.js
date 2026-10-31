// Le camp : l'immobilité à l'abri. On n'y récupère vraiment qu'avec un repas.
import { CAMP } from './textes.js';
import { R } from './reglages.js';

export class Camp {
  constructor(j, onPremier = () => {}) {
    this.j = j; this.onPremier = onPremier;
    this.immobile = 0; this.parole = 0;
  }
  // La règle, en un seul endroit : on campe là où le vent ne porte pas.
  abrite() { const h = this.j.horde; return h.abri > 0.4 || h.force < 0.5; }
  maj(dt, marche, ev) {
    const { j } = this, { horde, hud } = j;
    const abrite = this.abrite();
    this.immobile = marche || !abrite ? 0 : this.immobile + dt;
    if (marche || !abrite) this.demande = false;
    // On ne campe que fatigué, ou si on le demande : une Horde fraîche attend sans que la nuit tombe.
    const camper = (this.immobile > 2.4 || this.demande) && !ev.actifs() && (j.camp || horde.souffle < 0.8 || this.demande);
    if (camper && !j.camp) {
      j.camp = true; this.parole = 3.5;
      // Le repas : il faut en avoir un pour vraiment récupérer.
      j.repas = j.vivres > 0;
      if (j.repas) { j.vivres--; hud.vivres(j.vivres); }
      else hud.dire(horde.vit('alme') ? 'alme' : 'sov', 'Plus rien à manger. On dort le ventre vide, et ça ne suffira pas.');
      this.onPremier();
      if (horde.souffle < 0.92) j.sauver();
      ev.campAttaque();
    }
    if (!camper) j.camp = false;
    if (!j.camp) return;
    const soin = (j.repas ? R.soinRepas : R.soinJeune) * (horde.vit('alme') ? 1 : 0.65) * (horde.vit('callirhoe') ? 1 : 0.65);
    const plafond = j.repas ? 1 : R.plafondSansRepas;
    if (horde.souffle < plafond) horde.souffle = Math.min(plafond, horde.souffle + soin * dt);
    this.parole -= dt;
    if (this.parole <= 0 && horde.vivants().length) {
      this.parole = 15;
      const l = CAMP.filter(([id]) => horde.vit(id)), q = l[Math.floor(Math.random() * l.length)];
      if (q) hud.dire(q[0], q[1]);
    }
    if (horde.souffle >= 1 && this.immobile > 40) j.sauver();
  }
}
