// Le spectateur, en mode admin : la caméra vole où l'on veut, et la partie continue sans elle.
// F l'ouvre et le ferme. Clic : la souris tourne le regard (Échap la relâche), ou glisser bouton tenu.
// ZQSD ou flèches : avancer ; Espace et C : monter, descendre ; Maj : vite ; molette : l'allure.
// H : la Horde vient sous le centre de l'image. P : le temps se fige.
export class Spectateur {
  constructor({ camera, canvas, monde, versMonde, aller, figer }) {
    Object.assign(this, { camera, canvas, monde, versMonde, aller, figer });
    this.actif = false; this.fige = false;
    this.pos = { x: 0, y: 0, s: 0 }; this.lacet = 0; this.tangage = 0; this.allure = 60;
    this.foyer = { x: 0, s: 0 };
    this.touches = new Set(); this.glisse = false;
    const ici = () => this.actif;
    // Tant qu'il vole, rien ne va au jeu : on capture tout avant lui.
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.repeat && !(e.target instanceof HTMLInputElement)) { this.basculer(); e.stopImmediatePropagation(); return; }
      if (!ici()) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.repeat) return;
      this.touches.add(e.code);
      if (e.code === 'KeyH') { const p = this.versMonde(innerWidth / 2, innerHeight / 2) || { x: this.pos.x, s: this.pos.s }; const q = this.monde.degager(p.x, p.s, 6) || p; this.aller(q.x, q.s); }
      if (e.code === 'KeyP') { this.fige = !this.fige; this.figer(this.fige); }
    }, { capture: true });
    addEventListener('keyup', (e) => { this.touches.delete(e.code); }, { capture: true });
    addEventListener('blur', () => { this.touches.clear(); this.glisse = false; });
    canvas.addEventListener('pointerdown', (e) => {
      if (!ici()) return;
      e.stopImmediatePropagation();
      this.glisse = true;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
    }, { capture: true });
    addEventListener('pointerup', (e) => { if (ici()) { this.glisse = false; e.stopImmediatePropagation(); } }, { capture: true });
    canvas.addEventListener('pointermove', (e) => {
      if (!ici()) return;
      e.stopImmediatePropagation();
      if (document.pointerLockElement !== canvas && !this.glisse) return;
      this.lacet += e.movementX * 0.0025;
      this.tangage = Math.max(-1.55, Math.min(1.55, this.tangage - e.movementY * 0.0025));
    }, { capture: true });
    canvas.addEventListener('wheel', (e) => {
      if (!ici()) return;
      e.stopImmediatePropagation(); e.preventDefault();
      this.allure = Math.max(4, Math.min(1500, this.allure * Math.exp(-e.deltaY * 0.0012)));
    }, { capture: true, passive: false });
  }

  basculer(v = !this.actif) {
    this.actif = v;
    document.body.classList.toggle('spectateur', v);
    this.touches.clear(); this.glisse = false;
    if (v) {
      // On part d'où regardait la caméra du jeu.
      const c = this.camera, d = c.getWorldDirection(c.position.clone());
      this.pos = { x: c.position.x, y: c.position.y, s: -c.position.z };
      this.lacet = Math.atan2(d.x, -d.z); this.tangage = Math.asin(Math.max(-1, Math.min(1, d.y)));
    } else {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      if (this.fige) { this.fige = false; this.figer(false); }
    }
  }

  // `dt` : le temps vrai, pas celui du jeu : on vole aussi quand le temps est figé.
  maj(dt) {
    const k = (c) => this.touches.has(c), p = this.pos, m = this.monde;
    const av = (k('KeyW') || k('KeyZ') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const co = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('KeyQ') || k('ArrowLeft') ? 1 : 0);
    const mo = (k('Space') || k('KeyE') ? 1 : 0) - (k('KeyC') || k('ControlLeft') ? 1 : 0);
    const v = this.allure * (k('ShiftLeft') || k('ShiftRight') ? 5 : 1) * dt;
    // On avance là où l'on regarde, y compris vers le haut ou le bas.
    const ct = Math.cos(this.tangage), dx = Math.sin(this.lacet) * ct, ds = Math.cos(this.lacet) * ct, dy = Math.sin(this.tangage);
    p.x += (dx * av + Math.cos(this.lacet) * co) * v;
    p.s += (ds * av - Math.sin(this.lacet) * co) * v;
    p.y += (dy * av + mo) * v;
    // On reste dans ce qui existe : la bande chargée, et au-dessus du sol.
    p.x = Math.max(-800, Math.min(m.W + 800, p.x));
    p.s = Math.max(m.sA + 60, Math.min(m.sB - 60, p.s));
    p.y = Math.max(Math.max(0, m.h(p.x, p.s)) + 1.2, Math.min(4000, p.y));
    // Ce que la caméra regarde, au sol : c'est là que le relief se fait fin et que les ombres se posent.
    const loin = Math.min(400, Math.max(30, (p.y - Math.max(0, m.h(p.x, p.s))) * 1.5));
    this.foyer.x = Math.max(0, Math.min(m.W, p.x + Math.sin(this.lacet) * loin * 0.6));
    this.foyer.s = Math.max(m.sA, Math.min(m.sB, p.s + Math.cos(this.lacet) * loin * 0.6));
  }

  poser(camera) {
    const p = this.pos, ct = Math.cos(this.tangage);
    camera.position.set(p.x, p.y, -p.s);
    camera.lookAt(p.x + Math.sin(this.lacet) * ct, p.y + Math.sin(this.tangage), -(p.s + Math.cos(this.lacet) * ct));
    if (camera.fov !== 55 || camera.near !== 0.5) { camera.fov = 55; camera.near = 0.5; camera.updateProjectionMatrix(); }
  }
}
