// Le son, entièrement synthétisé. Le vent n'est pas un bruit : c'est un orchestre. Un grave qui porte, un corps qui respire,
// des voix qui hurlent dans le relief, du sable, de la toile qui claque. Des rafales le traversent de gauche à droite,
// l'abri l'étouffe, et chaque contrée a ses bruits à elle. Une nappe très lente et un piano rare tiennent le reste.
const GAMMES = [[0, 2, 7, 9, 12, 14, 19], [0, 3, 7, 10, 12, 15, 19], [0, 2, 5, 7, 12, 14, 17]];
const hasard = (a, b) => a + Math.random() * (b - a);

// Ce que chaque sol ajoute au vent : grave, voix, sable, sifflet, et le bruit qui lui est propre.
const LIEUX = {
  banquise: { grave: 0.8, voix: 0.7, sable: 0.5, sifflet: 1, bruit: 'glace', tous: 9 },
  coteaux: { grave: 0.7, voix: 0.5, sable: 0.2, sifflet: 0.2, bruit: 'oiseau', tous: 7 },
  flaque: { grave: 0.6, voix: 0.4, sable: 0.1, sifflet: 0.3, bruit: 'eau', tous: 2.4 },
  dunes: { grave: 0.8, voix: 0.5, sable: 1.3, sifflet: 0.3, bruit: 'grain', tous: 5 },
  canyon: { grave: 0.9, voix: 1.4, sable: 0.5, sifflet: 0.7, bruit: 'pierre', tous: 8, echo: 1 },
  massif: { grave: 1, voix: 1.2, sable: 0.3, sifflet: 0.6, bruit: 'oiseau', tous: 12, echo: 0.8 },
  plateforme: { grave: 0.5, voix: 0.3, sable: 0.8, sifflet: 0.2, bruit: 'grain', tous: 9 },
  terrasses: { grave: 0.8, voix: 0.7, sable: 0.5, sifflet: 0.4, bruit: 'oiseau', tous: 11 },
  cimes: { grave: 1.1, voix: 1.3, sable: 0.6, sifflet: 1.3, bruit: 'glace', tous: 8, echo: 0.8 },
  cendres: { grave: 1.4, voix: 0.7, sable: 0.6, sifflet: 0.4, bruit: 'braise', tous: 1.6 },
  vide: { grave: 0.2, voix: 0.1, sable: 0, sifflet: 0.1, bruit: null, tous: 30 },
};

export class Audio {
  constructor() { this.ok = false; this.muet = false; this.pause = false; }

  demarrer() {
    if (this.ok) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const c = (this.c = new C()); this.ok = true;
    this.maitre = c.createGain(); this.maitre.gain.value = this.muet ? 0 : 1.5;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 6;
    this.maitre.connect(lim); lim.connect(c.destination); this.sortie = lim;

    // Une réverbération de plaine : longue, sombre, différente à gauche et à droite.
    const d = 5, ir = c.createBuffer(2, d * c.sampleRate, c.sampleRate);
    for (let k = 0; k < 2; k++) {
      const a = ir.getChannelData(k); let lp = 0;
      for (let i = 0; i < a.length; i++) { const t = i / a.length; lp += (Math.random() * 2 - 1 - lp) * (0.34 - 0.28 * t); a[i] = lp * Math.pow(1 - t, 2.4); }
    }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const gr = c.createGain(); gr.gain.value = 0.9; this.rev.connect(gr); gr.connect(this.maitre);

    // L'écho des parois, qu'on n'ouvre que dans les canyons et les massifs.
    this.gEcho = c.createGain(); this.gEcho.gain.value = 0;
    const de = c.createDelay(1.5), fe = c.createGain(), le = c.createBiquadFilter();
    de.delayTime.value = 0.46; fe.gain.value = 0.42; le.type = 'lowpass'; le.frequency.value = 1400;
    this.gEcho.connect(de); de.connect(le); le.connect(fe); fe.connect(de); le.connect(this.maitre);

    // Trois couleurs de bruit : blanc, rose, brun.
    const tampon = (f) => { const b = c.createBuffer(1, c.sampleRate * 8, c.sampleRate), a = b.getChannelData(0); f(a); return b; };
    this.bruit = tampon((a) => { for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; });
    const rose = tampon((a) => {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < a.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.0299; b1 = 0.963 * b1 + w * 0.2966; b2 = 0.57 * b2 + w * 1.0526; a[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    });
    const brun = tampon((a) => { let l = 0; for (let i = 0; i < a.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; a[i] = l * 3.4; } });
    const source = (b) => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(0, Math.random() * 7); return s; };

    // L'abri : tout le vent passe par ce filtre, qui se ferme derrière un mur.
    this.lpAbri = c.createBiquadFilter(); this.lpAbri.type = 'lowpass'; this.lpAbri.frequency.value = 16000; this.lpAbri.Q.value = 0.3;
    this.busV = c.createGain(); this.busV.gain.value = 1;
    this.lpAbri.connect(this.busV); this.busV.connect(this.maitre);
    const envoi = c.createGain(); envoi.gain.value = 0.14; this.busV.connect(envoi); envoi.connect(this.rev); this.busV.connect(this.gEcho);

    const couche = (b, type, f, q, pan = 0) => {
      const s = source(b), fi = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
      fi.type = type; fi.frequency.value = f; fi.Q.value = q; g.gain.value = 0; p.pan.value = pan;
      s.connect(fi); fi.connect(g); g.connect(p); p.connect(this.lpAbri);
      return { f: fi, g, p };
    };
    this.grave = couche(brun, 'lowpass', 170, 0.4);
    this.corps = couche(rose, 'bandpass', 420, 0.7);
    // Les voix : des résonances étroites qui glissent lentement. C'est elles qu'on entend hurler.
    this.voix = [couche(rose, 'bandpass', 310, 9, -0.7), couche(rose, 'bandpass', 520, 11, 0.15), couche(rose, 'bandpass', 790, 13, 0.75)];
    this.voixT = this.voix.map(() => ({ v: hasard(0.8, 1.3), c: 1, t: 0 }));
    this.sifflet = couche(this.bruit, 'bandpass', 2600, 22, 0.3);
    this.sable = couche(this.bruit, 'highpass', 5200, 0.5, -0.2);
    // La toile des capes, qui claque par saccades quand le vent forcit.
    this.toile = couche(rose, 'bandpass', 900, 1.1, 0.1);
    const lfo = c.createOscillator(), pl = c.createGain(); lfo.frequency.value = 11; pl.gain.value = 0; lfo.connect(pl); lfo.start();
    const am = c.createGain(); am.gain.value = 0.5; this.toile.g.disconnect(); this.toile.g.connect(am); am.connect(this.toile.p); pl.connect(am.gain);
    this.lfoT = lfo; this.prof = pl;

    // Le grondement du furvent.
    this.gG = c.createGain(); this.gG.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; this.lpG = lp;
    for (const f of [41.2, 41.9, 61.7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(this.gG); this.gG.connect(this.maitre); this.gG.connect(this.rev);

    // La nappe : trois voix désaccordées, un filtre qui respire. On l'entend à peine, on sentirait son absence.
    this.gN = c.createGain(); this.gN.gain.value = 0;
    this.lpN = c.createBiquadFilter(); this.lpN.type = 'lowpass'; this.lpN.frequency.value = 500; this.lpN.Q.value = 0.8;
    this.nappe = [0, 1, 2].map((i) => {
      const a = c.createOscillator(), b = c.createOscillator(), g = c.createGain();
      a.type = 'triangle'; b.type = 'sawtooth'; a.detune.value = -5 - i; b.detune.value = 6 + i; g.gain.value = 0.33;
      a.connect(g); b.connect(g); g.connect(this.lpN); a.start(); b.start();
      return { a, b };
    });
    this.lpN.connect(this.gN); this.gN.connect(this.rev); const dn = c.createGain(); dn.gain.value = 0.3; this.gN.connect(dn); dn.connect(this.maitre);

    this.prochaine = c.currentTime + 6; this.tambour = c.currentTime; this.gamme = GAMMES[0]; this.racine = 146.83;
    this.raf = { v: 0, cible: 0, fin: 0, suite: c.currentTime + 4, pan: 0, dp: 0 }; this.lent = 0; this.bruitSuite = c.currentTime + 3;
    this.lieu = LIEUX.banquise; this.chord = c.currentTime; this.feuSuite = 0; this.dernierPas = 0;
    this.accord();
  }

  regler(p, v, t = 0.4) { if (this.ok) p.setTargetAtTime(v, this.c.currentTime, t); }

  accord() {
    const g = this.gamme, r = this.racine / 2, n = [0, g[1 + Math.floor(Math.random() * 3)], g[3 + Math.floor(Math.random() * 3)]];
    this.nappe.forEach((v, i) => { const f = r * Math.pow(2, n[i] / 12); this.regler(v.a.frequency, f, 3); this.regler(v.b.frequency, f, 3); });
  }

  note(f, g = 0.2, dur = 3.4, lieu = this.rev, sec = 0.5, quand = 0) {
    const c = this.c, t = c.currentTime + quand, o = [1, 2.01, 3.02, 4.2], v = [1, 0.42, 0.14, 0.06];
    const s = c.createGain(); s.gain.setValueAtTime(0, t); s.gain.linearRampToValueAtTime(g, t + 0.008); s.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    for (let i = 0; i < o.length; i++) {
      const os = c.createOscillator(), g2 = c.createGain(); os.frequency.value = f * o[i]; g2.gain.value = v[i];
      os.connect(g2); g2.connect(s); os.start(t); os.stop(t + dur + 0.1);
    }
    s.connect(lieu); const d = c.createGain(); d.gain.value = sec; s.connect(d); d.connect(this.maitre);
  }

  // Un éclat de bruit filtré : la matière de tous les petits sons du monde.
  grain({ type = 'bandpass', f = 1000, f2 = 0, q = 1, g = 0.1, a = 0.002, d = 0.1, pan = 0, rev = 0.1, quand = 0, b = this.bruit }) {
    const c = this.c, t = c.currentTime + quand, s = c.createBufferSource(), fi = c.createBiquadFilter(), e = c.createGain(), p = c.createStereoPanner();
    s.buffer = b; fi.type = type; fi.Q.value = q; fi.frequency.setValueAtTime(f, t); if (f2) fi.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    p.pan.value = pan; s.connect(fi); fi.connect(e); e.connect(p); p.connect(this.maitre);
    if (rev) { const r = c.createGain(); r.gain.value = rev; p.connect(r); r.connect(this.rev); }
    s.start(t, Math.random() * 7, a + d + 0.05);
  }

  ton({ f, f2 = 0, g = 0.05, a = 0.01, d = 0.2, pan = 0, rev = 0.5, quand = 0, type = 'sine' }) {
    const c = this.c, t = c.currentTime + quand, o = c.createOscillator(), e = c.createGain(), p = c.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    p.pan.value = pan; o.connect(e); e.connect(p); p.connect(this.maitre); const r = c.createGain(); r.gain.value = rev; p.connect(r); r.connect(this.rev);
    o.start(t); o.stop(t + a + d + 0.05);
  }

  // Le bruit propre à la contrée, de loin en loin.
  bruitLieu(nom) {
    const pan = hasard(-0.8, 0.8);
    if (nom === 'eau') this.grain({ type: 'lowpass', f: hasard(380, 900), f2: 200, q: 2, g: hasard(0.03, 0.07), a: hasard(0.15, 0.4), d: hasard(0.5, 1.2), pan, rev: 0.3 });
    else if (nom === 'glace') {
      const f = hasard(700, 2400);
      this.ton({ f, f2: f * 0.42, g: 0.03, a: 0.002, d: hasard(0.12, 0.5), pan, rev: 1.4, type: 'triangle' });
      this.grain({ f: 3200, q: 3, g: 0.04, d: 0.03, pan, rev: 0.8 });
    } else if (nom === 'oiseau') {
      const f = hasard(1800, 3400), n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.ton({ f: f * hasard(0.96, 1.08), f2: f * hasard(0.7, 1.3), g: 0.012, a: 0.02, d: hasard(0.08, 0.2), pan, rev: 1.6, quand: i * hasard(0.16, 0.3) });
    } else if (nom === 'grain') this.grain({ type: 'highpass', f: 4200, g: hasard(0.02, 0.05), a: hasard(0.2, 0.6), d: hasard(0.6, 1.8), pan, rev: 0.1 });
    else if (nom === 'pierre') {
      for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) this.grain({ f: hasard(600, 1500), q: 4, g: 0.05, d: 0.04, pan, rev: 1.1, quand: i * hasard(0.1, 0.34) });
    } else if (nom === 'braise') this.grain({ f: hasard(1500, 4000), q: 6, g: hasard(0.02, 0.06), d: hasard(0.008, 0.03), pan, rev: 0.25 });
  }

  // Les pas : un peu de matière sous les pieds, jamais plus de quelques-uns par seconde.
  pas(relief) {
    if (!this.ok || this.pause) return;
    const t = this.c.currentTime; if (t < this.dernierPas) return;
    this.dernierPas = t + hasard(0.13, 0.26);
    const pan = hasard(-0.35, 0.35);
    if (relief === 'banquise' || relief === 'cimes') this.grain({ f: hasard(2400, 3800), q: 0.9, g: 0.024, a: 0.012, d: 0.08, pan, rev: 0.05 });
    else if (relief === 'flaque') this.grain({ type: 'lowpass', f: 900, f2: 300, g: 0.03, a: 0.01, d: 0.13, pan, rev: 0.1 });
    else if (relief === 'dunes' || relief === 'plateforme') this.grain({ type: 'highpass', f: 1800, g: 0.012, a: 0.02, d: 0.1, pan, rev: 0.02 });
    else this.grain({ f: hasard(700, 1300), q: 1.3, g: 0.022, a: 0.003, d: 0.05, pan, rev: 0.05 });
  }

  tom(g = 0.8, f0 = 120) {
    const c = this.c, t = c.currentTime, o = c.createOscillator(), s = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    s.gain.setValueAtTime(g, t); s.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(s); s.connect(this.maitre); const r = c.createGain(); r.gain.value = 0.3; s.connect(r); r.connect(this.rev); o.start(t); o.stop(t + 0.65);
  }

  // Un motif de cinq notes qui monte : quelqu'un a nommé un lieu.
  decouverte() {
    if (!this.ok) return;
    const r = this.racine * 2;
    [0, 7, 12, 14, 19].forEach((d, i) => this.note(r * Math.pow(2, d / 12), 0.13, 4, this.rev, 0.45, i * 0.17));
  }
  perte() { if (this.ok) { this.note(this.racine / 2, 0.3, 5.5); this.note(this.racine / 2 * Math.pow(2, 3 / 12), 0.13, 5.5, this.rev, 0.5, 0.4); } }
  coup() {
    if (!this.ok) return;
    this.grain({ f: 5200, f2: 700, q: 1.4, g: 0.55, a: 0.002, d: 0.18, pan: hasard(-0.3, 0.3), rev: 0.2 });
    this.tom(0.5, 200);
  }
  tonnerre() {
    if (!this.ok) return;
    this.grain({ type: 'lowpass', f: 1900, f2: 90, g: 0.75, a: 0.01, d: 2.6, pan: hasard(-0.6, 0.6), rev: 0.5 });
  }
  alerte() { if (this.ok) { this.tom(0.7, 90); this.note(this.racine / 4, 0.3, 6); } }

  maj(dt, { force = 0, tempete = 0, combat = 0, camp = 0, silence = 0, abri = 0, relief = 'banquise', avance = 0, vitesse = 0 }) {
    if (!this.ok || this.pause) return;
    const c = this.c, t = c.currentTime, L = (this.lieu = LIEUX[relief] || LIEUX.banquise), R = this.raf;
    this.lent -= dt;

    // Les rafales : elles naissent d'un côté, gonflent, et passent de l'autre.
    if (t > R.suite) {
      const fort = Math.min(1, force / 1.6);
      R.cible = hasard(0.35, 0.6 + 0.4 * fort); R.fin = t + hasard(1.2, 3.4); R.suite = R.fin + hasard(3, 15) * (1.25 - fort);
      R.pan = hasard(-0.9, 0.9); R.dp = -Math.sign(R.pan) * hasard(0.2, 0.5);
    }
    R.v += ((t < R.fin ? R.cible : 0) - R.v) * (1 - Math.exp(-dt * (t < R.fin ? 1.5 : 0.7)));
    R.pan = Math.max(-1, Math.min(1, R.pan + R.dp * dt));

    if (this.lent > 0) return;
    this.lent = 0.09;                                       // dix réglages par seconde suffisent : le filtre lisse le reste

    const f = Math.min(1, force / 2.2) * (1 - silence), r = R.v, ab = Math.min(1, abri), tot = Math.min(1.3, f + r * 0.3);
    // À l'abri, le vent passe au-dessus : on ne garde que le grave, et le silence relatif s'entend.
    this.regler(this.lpAbri.frequency, 16000 * Math.pow(0.05, ab * (0.65 + 0.35 * camp)), 0.5);
    this.regler(this.busV.gain, (1 - 0.5 * ab) * (1 - silence), 0.5);
    this.regler(this.gEcho.gain, (L.echo || 0) * 0.3, 2);

    this.regler(this.grave.g.gain, (0.05 + tot * 0.26) * L.grave + tempete * 0.14, 0.6);
    this.regler(this.grave.f.frequency, 120 + tot * 150, 0.8);
    this.regler(this.corps.g.gain, 0.09 + tot * 0.62 + tempete * 0.16, 0.4);
    this.regler(this.corps.f.frequency, 260 + tot * 900 + 140 * Math.sin(t * 0.37) + 90 * Math.sin(t * 1.1), 0.5);
    this.regler(this.corps.p.pan, R.pan * r * 0.8, 0.5);

    this.voix.forEach((v, i) => {
      const w = this.voixT[i];
      if (t > w.t) { w.t = t + hasard(2.5, 9); w.c = hasard(0.72, 1.42); }
      w.v += (w.c - w.v) * 0.05;
      const base = [300, 510, 780][i] * w.v * (0.8 + tot * 0.9);
      this.regler(v.f.frequency, base + 40 * Math.sin(t * (0.5 + i * 0.31)), 0.7);
      this.regler(v.g.gain, Math.max(0, tot - 0.18 - i * 0.07) * 3.4 * L.voix * (0.55 + 0.45 * Math.sin(t * (0.23 + i * 0.17) + i * 2)), 0.7);
    });
    this.regler(this.sifflet.f.frequency, 1900 + tot * 2000 + 420 * Math.sin(t * 0.8), 0.4);
    this.regler(this.sifflet.g.gain, Math.max(0, tot - 0.35) ** 2 * 1.3 * L.sifflet, 0.4);
    this.regler(this.sifflet.p.pan, -R.pan * 0.7, 0.8);
    this.regler(this.sable.g.gain, (tot * tot * 0.34 + r * 0.09) * L.sable, 0.25);
    this.regler(this.sable.p.pan, R.pan, 0.4);
    this.regler(this.toile.g.gain, Math.max(0, tot - 0.4) * 0.7 * (0.3 + 0.7 * Math.min(1, vitesse / 3 + r)), 0.3);
    this.regler(this.prof.gain, 0.5, 0.5); this.regler(this.lfoT.frequency, 8 + tot * 7 + 2 * Math.sin(t * 2.3), 0.2);

    this.regler(this.gG.gain, tempete * 0.3 + (relief === 'cendres' ? 0.05 : 0), 1.2);
    this.regler(this.lpG.frequency, 110 + tempete * 200, 1);

    // La nappe monte avec la route : au bout du monde, elle est presque une menace.
    this.regler(this.gN.gain, (0.012 + avance * 0.03) * (1 - tempete * 0.7) * (1 - silence * 0.5) * (1 + camp * 0.8), 2.5);
    this.regler(this.lpN.frequency, 280 + 280 * (0.5 + 0.5 * Math.sin(t * 0.09)) + avance * 500, 3);
    if (t > this.chord) { this.chord = t + hasard(16, 34); this.accord(); }

    // Le feu du camp : il crépite, sans rythme.
    if (camp > 0.3 && t > this.feuSuite) {
      this.feuSuite = t + hasard(0.04, 0.34);
      this.grain({ f: hasard(1400, 5000), q: 5, g: hasard(0.01, 0.05) * camp, d: hasard(0.006, 0.03), pan: hasard(-0.2, 0.2), rev: 0.1 });
    }
    if (L.bruit && t > this.bruitSuite && tempete < 0.3 && combat < 0.3) { this.bruitSuite = t + L.tous * hasard(0.5, 1.6); this.bruitLieu(L.bruit); }

    // Le piano ne joue que si rien d'autre ne parle.
    if (tempete < 0.2 && combat < 0.2 && t > this.prochaine) {
      const g = this.gamme, n = 1 + Math.floor(Math.random() * 3), rc = camp > 0.5 ? this.racine / 1.5 : this.racine;
      for (let i = 0; i < n; i++) this.note(rc * Math.pow(2, g[Math.floor(Math.random() * g.length)] / 12), 0.06 + Math.random() * 0.06, 4.5, this.rev, 0.3, i * hasard(0.34, 0.74));
      this.prochaine = t + hasard(7, 22);
    }
    // Le tambour accélère avec le danger.
    const p = Math.max(tempete, combat);
    if (p > 0.15 && t > this.tambour) {
      this.tom(0.28 + p * 0.5, 96 + Math.random() * 16);
      this.tambour = t + 60 / (76 + p * 90 + combat * 40) * (Math.random() < 0.18 ? 0.5 : 1);
    }
  }
  contree(i) { this.gamme = GAMMES[i % GAMMES.length]; this.racine = [146.83, 130.81, 164.81, 110, 146.83, 123.47][i % 6]; if (this.ok) this.accord(); }
  couper(m) { this.muet = m; if (this.ok) this.regler(this.maitre.gain, m || this.pause ? 0 : 1.5, 0.1); }
  // Le menu : tout se tait, et reprend où il en était.
  suspendre(v) {
    this.pause = v;
    if (!this.ok) return;
    clearTimeout(this.tSusp);
    if (v) { this.regler(this.maitre.gain, 0, 0.05); this.tSusp = setTimeout(() => this.c.suspend(), 260); }
    else { this.c.resume(); this.regler(this.maitre.gain, this.muet ? 0 : 1.5, 0.12); }
  }
}
