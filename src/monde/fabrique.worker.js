// L'atelier : il dessine l'esquisse, puis les tranches qu'on lui réclame, la plus urgente d'abord.
import { creerFabrique } from './fabrique.js';

const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function demi(v) {
  f32[0] = v;
  const x = u32[0], signe = (x >>> 16) & 0x8000, e = (x >>> 23) & 0xff;
  let m = x & 0x7fffff;
  if (e < 103) return signe;
  if (e > 142) return signe | 0x7c00;
  if (e < 113) { m |= 0x800000; return signe | ((m >>> (126 - e)) + ((m >>> (125 - e)) & 1)); }
  return (signe | ((e - 112) << 10) | (m >>> 13)) + ((m >>> 12) & 1);
}
const demis = (a) => { const d = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) d[i] = demi(a[i]); return d; };

let fab = null, file = [], occupe = false;
function pomper() {
  if (occupe || !file.length) return;
  occupe = true;
  setTimeout(() => {
    occupe = false;
    const k = file.shift();
    if (k === undefined) return;
    const t = fab.tranche(k), hd = t.h.slice(), vd = demis(t.v);
    self.postMessage({ ...t, hd, vd }, [t.h.buffer, t.v.buffer, t.l.buffer, hd.buffer, vd.buffer]);
    pomper();
  }, 0);
}
self.onmessage = (e) => {
  if (e.data.graine !== undefined) { fab = creerFabrique(e.data.graine); self.postMessage({ esquisse: fab.esquisse }); }
  if (e.data.file) { file = e.data.file; pomper(); }
};
