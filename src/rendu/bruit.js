// Une texture de bruit répétable, avec ses mipmaps. Elle remplace le bruit calculé par pixel : une lecture au lieu
// de quatre hachages, et le filtrage éteint de lui-même le grain lointain, sans moiré.
import * as THREE from 'three';
import { alea } from '../monde/bruit.js';

export function textureBruit() {
  const N = 256, d = new Uint8Array(N * N * 4), r = alea(0x51ab);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r() * 256; d[i + 1] = r() * 256; d[i + 2] = r() * 256; d[i + 3] = r() * 256;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
