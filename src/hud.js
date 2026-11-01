// Ce qui se lit à l'écran. Peu de choses, et seulement quand elles comptent.
import { HORDIERS } from './jeu/hordiers.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.ePage = $('page'); this.eForme = $('forme'); this.eBann = $('banniere'); this.eJour = $('journal');
    this.eSignes = $('signes'); this.eRoue = $('roue'); this.eArc = $('roue-arc'); this.eAide = $('aide');
    this.pageAff = -1; this.formeAff = ''; this.tAide = 0;
    const uniques = [];
    for (const h of HORDIERS) if (!uniques.find((u) => u.signe === h.signe)) uniques.push(h);
    this.eSignes.innerHTML = uniques.map((h) => {
      const jumeaux = h.signe === '∞';
      const titre = jumeaux ? 'Horst et Karst Dubka, ailiers' : `${h.nom}, ${h.role}`;
      return `<li data-s="${encodeURIComponent(h.signe)}" tabindex="0"><span>${h.signe}</span><i style="background:${h.ton}"></i><em>${titre}</em></li>`;
    }).join('');
    this.periph = 2 * Math.PI * 22;
    this.eArc.setAttribute('stroke-dasharray', this.periph);
  }

  page(n) { if (n !== this.pageAff) { this.pageAff = n; this.ePage.textContent = n; } }
  forme(nom) {
    if (nom === this.formeAff) return;
    this.formeAff = nom; this.eForme.textContent = nom;
    this.eForme.classList.remove('neuf'); void this.eForme.offsetWidth; this.eForme.classList.add('neuf');
  }

  banniere(nom, sous) {
    const h2 = this.eBann.querySelector('h2');
    h2.setAttribute('aria-label', nom);
    h2.innerHTML = [...nom].map((c, i) => `<span aria-hidden="true" style="animation-delay:${(0.12 + i * 0.045).toFixed(3)}s">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    this.eBann.querySelector('p').textContent = sous;
    this.eBann.classList.remove('vue'); void this.eBann.offsetWidth; this.eBann.classList.add('vue');
  }

  dire(id, texte) {
    const h = HORDIERS.find((q) => q.id === id), l = document.createElement('p');
    l.innerHTML = `<b aria-hidden="true" style="color:color-mix(in srgb, ${h ? h.ton : 'currentColor'} 78%, var(--encre))">${h ? h.signe : ''}</b><span></span>`;
    l.lastChild.textContent = texte;
    if (h) l.title = h.nom;
    this.eJour.append(l);
    // Deux voix au plus, et une seule si une consigne est affichée : on doit pouvoir tout lire d'un coup d'œil.
    const garde = this.eAide.classList.contains('vue') ? 1 : 2;
    while (this.eJour.children.length > garde) this.eJour.firstChild.remove();
    setTimeout(() => { l.classList.add('fuit'); setTimeout(() => l.remove(), 1600); }, 5200 + texte.length * 42);
  }

  signes(horde) {
    for (const li of this.eSignes.children) {
      const s = decodeURIComponent(li.dataset.s), ms = horde.membres.filter((m) => m.signe === s), v = ms.filter((m) => m.vivant).length;
      li.classList.toggle('tu', v === 0);
      li.classList.toggle('moitie', v > 0 && v < ms.length);
    }
    const n = horde.vivants().length;
    if (n !== this.nAff) {
      if (this.nAff !== undefined) { this.eSignes.classList.add('eveil'); clearTimeout(this.tEveil); this.tEveil = setTimeout(() => this.eSignes.classList.remove('eveil'), 7000); }
      this.nAff = n;
    }
  }

  aide(t, duree = 0) {
    clearTimeout(this.tAide);
    this.eAide.textContent = t; this.eAide.classList.remove('vue'); void this.eAide.offsetWidth; this.eAide.classList.toggle('vue', !!t);
    if (duree) this.tAide = setTimeout(() => this.eAide.classList.remove('vue'), duree * 1000);
  }

  roue(souffle, x, y, visible) {
    this.eRoue.classList.toggle('vue', visible);
    this.eRoue.classList.toggle('bas', souffle < 0.25);
    this.eRoue.style.transform = `translate(${x}px,${y}px)`;
    this.eArc.setAttribute('stroke-dashoffset', this.periph * (1 - souffle));
  }

  vivres(n) { const e = document.getElementById('vivres'); e.textContent = n === 0 ? 'plus de vivres' : n === 1 ? '1 ration' : `${n} rations`; e.classList.toggle('vide', n === 0); }

  temps(a, reel) {
    const cle = a * 10 + reel;
    if (cle === this.cleTemps) return;
    this.cleTemps = cle;
    const e = document.getElementById('temps');
    e.textContent = a === 1 ? 'temps normal' : reel === 1 ? `×${a} suspendu` : `temps ×${a}`;
    e.classList.toggle('actif', a > 1);
  }

  bloc(v) { document.body.classList.toggle('en-bloc', v); }

  // Peut-on se reposer ici ? Toujours dit au même endroit.
  repos(texte, classe) {
    if (texte === this.reposAff) return;
    this.reposAff = texte;
    const e = document.getElementById('repos');
    e.textContent = texte; e.className = classe; e.hidden = !texte;
  }

  sombre(v) { document.body.classList.toggle('sombre', v); }
}
