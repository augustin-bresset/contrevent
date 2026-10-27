import { MeshoptSimplifier as M } from 'meshoptimizer';
import fs from 'node:fs';
// node outils/rochers.mjs <dossier des scans> : réduit les rochers, puis python3 outils/cuire.py <dossier des scans> cuit leurs normales.
process.chdir(process.argv[2] || '.');
await M.ready;
const ROCHES = { b3: 'namaqualand_boulder_03', b4: 'namaqualand_boulder_04', b5: 'namaqualand_boulder_05', ai: 'rock_09', fl: 'rock_07' };
const T = { ai: [1000, 220], fl: [1000, 220], tr: [1400, 300] }, TD = [1300, 260];
const sortie = {};
for (const [cle, id] of Object.entries(ROCHES)) {
  const g = JSON.parse(fs.readFileSync(`mod/${id}/m.gltf`)), bin = fs.readFileSync(`mod/${id}/${g.buffers[0].uri}`);
  const lire = (i, C, n) => { const a = g.accessors[i], v = g.bufferViews[a.bufferView], o = (v.byteOffset || 0) + (a.byteOffset || 0); const b = bin.buffer.slice(bin.byteOffset + o, bin.byteOffset + o + a.count * n * C.BYTES_PER_ELEMENT); return new C(b); };
  const p = g.meshes[0].primitives[0], P = lire(p.attributes.POSITION, Float32Array, 3).slice(), Nr = lire(p.attributes.NORMAL, Float32Array, 3).slice(), U = lire(p.attributes.TEXCOORD_0, Float32Array, 2).slice();
  const ia = g.accessors[p.indices], I = ia.componentType === 5125 ? lire(p.indices, Uint32Array, 1).slice() : Uint32Array.from(lire(p.indices, Uint16Array, 1));
  const node = g.nodes.find((n) => n.mesh === 0) || {}, nv = P.length / 3;
  if (node.rotation || node.scale || node.matrix) console.log(id, 'noeud', JSON.stringify(node).slice(0, 120));
  const sc = node.scale || [1, 1, 1], r = node.rotation;
  const rot = (v) => { if (!r) return v; const [x, y, z, w] = r, [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a); return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx]; };
  for (let i = 0; i < nv; i++) { const q = rot([P[i * 3] * sc[0], P[i * 3 + 1] * sc[1], P[i * 3 + 2] * sc[2]]); P.set(q, i * 3); Nr.set(rot([Nr[i * 3], Nr[i * 3 + 1], Nr[i * 3 + 2]]), i * 3); }
  // Les deux dressés : leur plus grande longueur devient la hauteur.
  if (cle === 'ai' || cle === 'fl') for (let i = 0; i < nv; i++) { const k = i * 3; let a = P[k + 1], b = P[k + 2]; P[k + 1] = b; P[k + 2] = -a; a = Nr[k + 1]; b = Nr[k + 2]; Nr[k + 1] = b; Nr[k + 2] = -a; }
  // Centré en x et z, le pied à y = 0, rayon 1.
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
  const R = Math.max(mx[0] - mn[0], mx[2] - mn[2], (cle === 'ai' || cle === 'fl') ? 0 : (mx[1] - mn[1])) / 2;
  for (let i = 0; i < nv; i++) { P[i * 3] = (P[i * 3] - (mn[0] + mx[0]) / 2) / R; P[i * 3 + 1] = (P[i * 3 + 1] - mn[1]) / R; P[i * 3 + 2] = (P[i * 3 + 2] - (mn[2] + mx[2]) / 2) / R; }
  const lods = [];
  for (const cible of T[cle] || TD) {
    const [J, err] = M.simplifyWithAttributes(I, P, 3, U, 2, [0.4, 0.4], null, cible * 3, 0.3, []);
    const nn = new Int32Array(nv).fill(-1), V = []; let c = 0;
    const J2 = new Uint32Array(J.length);
    J.forEach((q, i) => { if (nn[q] < 0) { nn[q] = c++; V.push(q); } J2[i] = nn[q]; });
    M.compactMesh ? 0 : 0;
    const pos = new Int16Array(c * 3), uv = new Uint16Array(c * 2), nor = new Int8Array(c * 3);
    V.forEach((q, i) => { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = Math.round(P[q * 3 + k] / 4 * 32767); nor[i * 3 + k] = Math.round(Nr[q * 3 + k] * 127); } uv[i * 2] = Math.round((U[q * 2] - Math.floor(U[q * 2])) * 65535); uv[i * 2 + 1] = Math.round((1 - (U[q * 2 + 1] - Math.floor(U[q * 2 + 1]))) * 65535); });
    const idx = new Uint16Array(J2);
    const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
    lods.push({ p: b64(pos), u: b64(uv), n: b64(nor), i: b64(idx) });
    console.log(cle, id, 'cible', cible, '→', J.length / 3, 'tri', c, 'sommets, erreur', err.toFixed(4), 'H/R', ((mx[1] - mn[1]) / R).toFixed(2));
  }
  sortie[cle] = lods;
  fs.writeFileSync(`bake-${cle}.bin`, Buffer.from(P.buffer));
  fs.writeFileSync(`bake-${cle}-n.bin`, Buffer.from(Nr.buffer));
  fs.writeFileSync(`bake-${cle}-u.bin`, Buffer.from(U.buffer));
  fs.writeFileSync(`bake-${cle}-i.bin`, Buffer.from(I.buffer));
}
const js = `// Les rochers : des scans réels, réduits à l'essentiel par outils/rochers. Positions, uv, normales, indices, en base64.\nexport const ROCHERS = ${JSON.stringify(sortie)};\n`;
fs.writeFileSync(new URL('../src/rendu/rochers-maillage.js', import.meta.url), js);
console.log('js', Math.round(js.length / 1024), 'Ko');
