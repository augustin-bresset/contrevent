// Les matières du sol : des scans réels, chargés dans deux tableaux de textures (couleur ; pentes et hauteur).
// Tout passe par des <img> : ça marche aussi bien depuis un fichier que depuis une page d'un seul tenant.
import * as THREE from 'three';
import { COUCHES as NOMS } from '../monde/contrees.js';

// Les rochers scannés : rangés dans le même ordre que leurs maillages.
export const PIERRES = ['roc-b3', 'roc-b4', 'roc-b5', 'roc-ai', 'roc-fl'];
const BATI = ['bati-pierre', 'bati-mur', 'bati-bois', 'bati-toile'];
const fichiers = import.meta.glob('./matieres/*.webp', { eager: true, import: 'default', query: '?url' });

function lireImage(url) {
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
}

async function tableau(noms, suffixe, couleur, renderer) {
  const imgs = await Promise.all(noms.map((n) => lireImage(fichiers[`./matieres/${n}-${suffixe}.webp`])));
  const T = imgs[0].width, c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' }), d = new Uint8Array(T * T * 4 * noms.length);
  imgs.forEach((im, i) => { x.drawImage(im, 0, 0, T, T); d.set(x.getImageData(0, 0, T, T).data, i * T * T * 4); });
  const t = new THREE.DataArrayTexture(d, T, T, noms.length);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = couleur ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
  renderer.initTexture(t);
  return t;
}

export async function chargerMatieres(renderer) {
  const [tCouleur, tRelief, tRocC, tRocN, tBatC, tBatN] = await Promise.all([
    tableau(NOMS, 'c', true, renderer), tableau(NOMS, 'n', false, renderer), tableau(PIERRES, 'c', true, renderer), tableau(PIERRES, 'n', false, renderer),
    tableau(BATI, 'c', true, renderer), tableau(BATI, 'n', false, renderer),
  ]);
  return { tCouleur, tRelief, tRocC, tRocN, tBatC, tBatN };
}
