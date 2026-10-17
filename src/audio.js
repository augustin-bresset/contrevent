// Le son, entièrement synthétisé : le vent, un piano rare, et la peur quand il le faut.
const GAMMES = [[0, 2, 7, 9, 12, 14, 19], [0, 3, 7, 10, 12, 15, 19], [0, 2, 5, 7, 12, 14, 17]];

export class Audio {
  constructor() { this.ok = false; this.muet = false; }

  demarrer() {
    if (this.ok) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const c = (this.c = new C()); this.ok = true;
    this.maitre = c.createGain(); this.maitre.gain.value = this.muet ? 0 : 0.9;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -12; lim.ratio.value = 8;
    this.maitre.connect(lim); lim.connect(c.destination);

    // Une réverbération de plaine : longue, sombre.
    const d = 4.5, ir = c.createBuffer(2, d * c.sampleRate, c.sampleRate);
    for (let k = 0; k < 2; k++) {
      const a = ir.getChannelData(k);
      let lp = 0;
      for (let i = 0; i < a.length; i++) { const t = i / a.length; lp += (Math.random() * 2 - 1 - lp) * (0.32 - 0.26 * t); a[i] = lp * Math.pow(1 - t, 2.6); }
    }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const gr = c.createGain(); gr.gain.value = 0.9; this.rev.connect(gr); gr.connect(this.maitre);

    const n = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), a = n.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    this.bruit = n;
    const src = c.createBufferSource(); src.buffer = n; src.loop = true;
    this.bp = c.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 420; this.bp.Q.value = 0.7;
    this.hp = c.createBiquadFilter(); this.hp.type = 'bandpass'; this.hp.frequency.value = 2400; this.hp.Q.value = 2.5;
    this.gV = c.createGain(); this.gV.gain.value = 0; this.gS = c.createGain(); this.gS.gain.value = 0;
    src.connect(this.bp); this.bp.connect(this.gV); this.gV.connect(this.maitre);
    src.connect(this.hp); this.hp.connect(this.gS); this.gS.connect(this.maitre); src.start();

    // Le grondement du furvent.
    this.gG = c.createGain(); this.gG.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
    for (const f of [41.2, 41.9, 61.7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(this.gG); this.gG.connect(this.maitre); this.gG.connect(this.rev);

    this.gF = c.createGain(); this.gF.gain.value = 0;
    const sf = c.createBufferSource(); sf.buffer = n; sf.loop = true;
    const pf = c.createBiquadFilter(); pf.type = 'highpass'; pf.frequency.value = 1800;
    sf.connect(pf); pf.connect(this.gF); this.gF.connect(this.maitre); sf.start();

    this.prochaine = c.currentTime + 3; this.tension = 0; this.tambour = c.currentTime; this.gamme = GAMMES[0]; this.racine = 146.83;
  }

  regler(p, v, t = 0.4) { if (this.ok) p.setTargetAtTime(v, this.c.currentTime, t); }

  note(f, g = 0.2, dur = 3.4, lieu = this.rev, sec = 0.5, quand = 0) {
    const c = this.c, t = c.currentTime + quand, o = [1, 2.01, 3.02, 4.2], v = [1, 0.42, 0.14, 0.06];
    const s = c.createGain(); s.gain.setValueAtTime(0, t); s.gain.linearRampToValueAtTime(g, t + 0.008); s.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    for (let i = 0; i < o.length; i++) {
      const os = c.createOscillator(), g2 = c.createGain(); os.frequency.value = f * o[i]; g2.gain.value = v[i];
      os.connect(g2); g2.connect(s); os.start(t); os.stop(t + dur + 0.1);
    }
    s.connect(lieu); const d = c.createGain(); d.gain.value = sec; s.connect(d); d.connect(this.maitre);
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
    const c = this.c, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.bruit; f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.14);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    s.connect(f); f.connect(g); g.connect(this.maitre); s.start(t, Math.random() * 3, 0.25);
    this.tom(0.5, 200);
  }
  tonnerre() {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.bruit; f.type = 'lowpass'; f.frequency.setValueAtTime(1900, t); f.frequency.exponentialRampToValueAtTime(90, t + 1.6);
    g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    s.connect(f); f.connect(g); g.connect(this.maitre); const r = c.createGain(); r.gain.value = 0.5; g.connect(r); r.connect(this.rev); s.start(t, Math.random() * 1.2, 2.7);
  }
  alerte() { if (this.ok) { this.tom(0.7, 90); this.note(this.racine / 4, 0.3, 6); } }

  maj(dt, { force = 0, tempete = 0, combat = 0, camp = 0, silence = 0 }) {
    if (!this.ok) return;
    const c = this.c, f = Math.min(1, force / 2.2) * (1 - silence);
    this.regler(this.gV.gain, 0.24 + f * 0.6 + tempete * 0.14);
    this.regler(this.bp.frequency, 280 + f * 980 + 120 * Math.sin(c.currentTime * 0.7), 0.6);
    this.regler(this.gS.gain, 0.012 + f * f * 0.2);
    this.regler(this.hp.frequency, 1900 + f * 1800 + 500 * Math.sin(c.currentTime * 1.3), 0.3);
    this.regler(this.gG.gain, tempete * 0.3, 1.2);
    this.regler(this.gF.gain, camp * 0.012 * (0.6 + Math.random() * 0.9), 0.05);

    // Le piano ne joue que si rien d'autre ne parle.
    const calme = tempete < 0.2 && combat < 0.2;
    if (calme && c.currentTime > this.prochaine) {
      const g = this.gamme, n = 1 + Math.floor(Math.random() * 3), r = camp > 0.5 ? this.racine / 1.5 : this.racine;
      for (let i = 0; i < n; i++) {
        const d = g[Math.floor(Math.random() * g.length)];
        this.note(r * Math.pow(2, d / 12), 0.08 + Math.random() * 0.07, 4.5, this.rev, 0.32, i * (0.34 + Math.random() * 0.4));
      }
      this.prochaine = c.currentTime + 4 + Math.random() * 7;
    }
    // Le tambour accélère avec le danger.
    const p = Math.max(tempete, combat);
    if (p > 0.15 && c.currentTime > this.tambour) {
      const bpm = 76 + p * 90 + combat * 40;
      this.tom(0.28 + p * 0.5, 96 + Math.random() * 16);
      this.tambour = c.currentTime + 60 / bpm * (Math.random() < 0.18 ? 0.5 : 1);
    }
  }
  contree(i) { this.gamme = GAMMES[i % GAMMES.length]; this.racine = [146.83, 130.81, 164.81, 110, 146.83, 123.47][i % 6]; }
  couper(m) { this.muet = m; if (this.ok) this.regler(this.maitre.gain, m ? 0 : 0.9, 0.1); }
}
