// La bande du monde, vue d'un coup : d'ouest en est, comme dans le roman. L'amont est à droite.
import { MONDE } from './monde/contrees.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class Carte {
  constructor(monde) {
    this.monde = monde;
    this.cv = document.getElementById('bande');
    const W = (this.W = 1800), H = (this.H = Math.round(W * MONDE.W / MONDE.L));
    this.cv.width = W; this.cv.height = H;
    this.fond = document.createElement('canvas'); this.fond.width = W; this.fond.height = H;
    const x = this.fond.getContext('2d'), im = x.createImageData(W, H), { L, W: LW } = monde;
    const cs = monde.contrees.map((c) => ({ s: c.s, o: hex(c.ombre), l: hex(c.lumiere), e: hex(c.encre) }));
    for (let i = 0, ic = 0; i < W; i++) {
      const s = (i + 0.5) / W * L;
      while (ic < cs.length - 1 && s >= cs[ic + 1].s) ic++;
      const c = cs[ic];
      for (let j = 0; j < H; j++) {
        const p = (j + 0.5) / H * LW, h = monde.h(p, s), hx = monde.h(p + 12, s) - monde.h(p - 12, s), hs = monde.h(p, s + 12) - monde.h(p, s - 12);
        const t = Math.max(0, Math.min(1, 0.68 + (-hx * 0.6 - hs * 0.42) / 24));
        const k = (j * W + i) * 4, m = Math.floor(Math.max(0, h) / 12) % 2 ? 0.05 : 0;
        for (let q = 0; q < 3; q++) im.data[k + q] = c.o[q] + (c.l[q] - c.o[q]) * t - (c.l[q] - c.e[q]) * m;
        im.data[k + 3] = 255;
      }
    }
    x.putImageData(im, 0, 0);
    const lieux = document.getElementById('lieux');
    lieux.innerHTML = monde.lieux.filter((l) => !l.sansMonument).map((l, i) =>
      `<li class="${i % 2 ? 'b' : 'h'}" style="left:${(l.s / L * 100).toFixed(2)}%"><span>${l.nom}</span></li>`).join('');
  }
  // À la fin, le fil se redéroule d'un bout à l'autre de la bande.
  derouler(fil, x, s) {
    const n = fil.points.length, t0 = performance.now(), D = 6500;
    const f = (now) => {
      const q = Math.min(1, (now - t0) / D), e = q * q * (3 - 2 * q);
      this.dessiner({ points: fil.points.slice(0, Math.floor(e * n / 2) * 2) }, x, s, [], q >= 1);
      if (q < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  dessiner(fil, x, s, chemin = [], tete = true) {
    const c = this.cv.getContext('2d'), { W, H } = this, { L, W: LW } = this.monde;
    c.drawImage(this.fond, 0, 0);
    c.strokeStyle = '#a5432f'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath();
    const p = fil.points;
    for (let i = 0; i < p.length; i += 2) {
      const X = p[i + 1] / L * W, Y = p[i] / LW * H;
      if (i) c.lineTo(X, Y); else c.moveTo(X, Y);
    }
    c.stroke();
    c.setLineDash([9, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(s / L * W, x / LW * H);
    for (const q of chemin) c.lineTo(q.s / L * W, q.x / LW * H);
    c.stroke(); c.setLineDash([]);
    for (const q of chemin) { c.beginPath(); c.arc(q.s / L * W, q.x / LW * H, 5, 0, 6.283); c.stroke(); }
    if (tete) { c.fillStyle = '#a5432f'; c.beginPath(); c.arc(s / L * W, x / LW * H, 6, 0, 6.283); c.fill(); }
  }
}
