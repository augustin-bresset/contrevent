// Le mode admin, pour vérifier la carte : invincible, téléportation, événements à la demande. Il n'existe qu'en local.
// npm run admin, ou ?admin sur le serveur de développement. Alt + clic téléporte là où l'on vise. F : le spectateur, caméra libre.
import { SDEPART } from './monde/contrees.js';
import { Spectateur } from './spectateur.js';
const STYLE = `
#admin { position: fixed; left: 12px; top: 12px; z-index: 9; width: 250px; max-height: calc(100vh - 24px); overflow: auto; padding: 10px 12px; background: rgba(12, 16, 22, .84); color: #f6f0e4; font: 13px/1.35 system-ui, sans-serif; border-radius: 6px; }
#admin h3 { margin: 10px 0 4px; font-size: 12px; font-weight: 600; opacity: .7; }
#admin button { margin: 0 4px 4px 0; padding: 2px 7px; color: inherit; background: rgba(255, 255, 255, .1); border: 0; border-radius: 3px; font: inherit; text-decoration: none; cursor: pointer; }
#admin button:hover { background: rgba(255, 255, 255, .26); }
#admin input[type=range] { width: 100%; }
#admin label { display: block; }
#admin pre { margin: 6px 0 0; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; }
#admin.plie > :not(#admin-plier) { display: none; }
body.spectateur #hud { display: none; }
`;

export function ouvrirAdmin({ j, horde, monde, ev, vent, canvas, versMonde, graine, camera, peint, aller, vite, voler }) {
  horde.invincible = true;
  j.sauver = () => {};            // une partie d'essai n'écrase pas la vraie
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const p = document.createElement('div'); p.id = 'admin'; document.body.append(p);
  const titre = (t) => { const h = document.createElement('h3'); h.textContent = t; p.append(h); };
  const bouton = (t, fn, ou = p) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = fn; ou.append(b); return b; };
  const allerS = (s) => {
    // Jamais plus bas que le départ : derrière, c'est Aberlaas puis la Falaise, où la caméra ne descend pas.
    s = Math.max(SDEPART, Math.min(monde.L - 8, s));
    const q = monde.degager(monde.xRoute(s), s, 6) || { x: monde.xRoute(s), s };
    aller(q.x, q.s);
  };

  bouton('Plier le panneau', () => p.classList.toggle('plie')).id = 'admin-plier';

  const inv = document.createElement('label'); inv.innerHTML = '<input type="checkbox" checked> Invincible'; p.append(inv);
  inv.firstChild.onchange = (e) => { horde.invincible = e.target.checked; };
  const pe = document.createElement('label'); pe.innerHTML = `<input type="checkbox"${peint.value ? ' checked' : ''}> Lumière peinte`; p.append(pe);
  pe.firstChild.onchange = (e) => { peint.value = e.target.checked ? 1 : 0; };

  const spect = new Spectateur({ camera, canvas, monde, versMonde, aller, figer: (v) => vite(v ? 0 : 1) });
  voler(spect);
  const vol = bouton('Spectateur (F)', () => spect.basculer());
  const aideVol = document.createElement('pre');
  aideVol.textContent = 'Clic : la souris tourne le regard\n(Échap la relâche)\nZQSD : avancer   Espace / C : monter, descendre\nMaj : vite   molette : allure\nH : la Horde vient ici   P : figer le temps';
  p.append(aideVol);

  titre('Aller à');
  const curseur = document.createElement('input'); curseur.type = 'range'; curseur.min = 0; curseur.max = 1000; p.append(curseur);
  curseur.onchange = () => allerS(curseur.value / 1000 * monde.L);
  for (const l of monde.lieux) bouton(l.nom, () => { ev.lieuxVus.delete(l.id); allerS(l.s - Math.min(l.rayon, 60) - 40); });
  titre('Contrées');
  let avant = '';
  for (let s = 0; s < monde.L; s += 100) {
    const c = monde.contreeA(s);
    if (c.id !== avant) { avant = c.id; bouton(c.nom || c.id, () => allerS(s + 60)); }
  }

  titre('Événements');
  const planFurvent = (m) => ({ t: 'furvent', m: m ?? 2.2 + 1.5 * horde.s / monde.L });
  bouton('Furvent annoncé', () => { ev.presage = null; ev.furvent(planFurvent()); });
  bouton('Furvent direct', () => { if (!ev.tempete) { ev.presage = null; vent.impose = 1.6; ev.dechainer(planFurvent()); } });
  bouton('Physalis', () => { if (!ev.nav) ev.navire(); });
  bouton('Poursuite', () => ev.poursuite(6));
  bouton('Corroyeur', () => { if (!ev.corroyeur) ev.lancerCorroyeur(); });
  bouton('Chrone', () => ev.chrone('errant'));

  titre('Vent');
  bouton('Accalmie', () => { vent.impose = null; vent.humeurC = 0.28; vent.humeurT = 45; });
  bouton('Normal', () => { vent.impose = null; vent.humeurC = 1; vent.humeurT = 45; });
  bouton('Soutenu', () => { vent.impose = null; vent.humeurC = 1.4; vent.humeurT = 45; });
  const lu = document.createElement('pre'); p.append(lu);

  // Alt + clic : on y est.
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.altKey) return;
    e.stopImmediatePropagation();
    const q = versMonde(e.clientX, e.clientY, true);
    if (q) { const l = monde.degager(q.x, q.s, 6) || q; aller(l.x, l.s); }
  }, { capture: true });

  setInterval(() => {
    vol.textContent = spect.actif ? `Quitter le vol (F)${spect.fige ? ', temps figé' : ''}` : 'Spectateur (F)';
    aideVol.hidden = !spect.actif;
    const f = horde.s / monde.L;
    if (document.activeElement !== curseur) curseur.value = f * 1000;
    lu.textContent = `graine ${graine}\ns ${Math.round(horde.s)}  x ${Math.round(horde.x)}  ${(f * 100).toFixed(1)} %\n${monde.contreeA(horde.s).nom || monde.contreeA(horde.s).id}\nforce ${horde.force.toFixed(2)}  humeur ${vent.humeur.toFixed(2)}\nrafale ${vent.rafale.toFixed(2)}${ev.presage ? `\nprésage ${ev.presage.t.toFixed(0)} s` : ''}${ev.tempete ? '\nfurvent' : ''}`;
  }, 250);
}
