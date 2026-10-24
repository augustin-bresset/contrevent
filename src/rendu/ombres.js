// Les ombres portées : ce que les monuments, les rochers et les corps font au sol. Deux cartes de profondeur vues du soleil :
// une large, mise à jour de loin en loin, et une serrée autour de la Horde, nette jusqu'à la silhouette d'un marcheur.
// Chacune suit par pas entiers de texel pour que le bord des ombres ne grouille pas.
import * as THREE from 'three';

function carte(cote) {
  const rt = new THREE.WebGLRenderTarget(cote, cote, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
  rt.depthTexture = new THREE.DepthTexture(cote, cote, THREE.UnsignedIntType);
  rt.depthTexture.compareFunction = THREE.LessEqualCompare;
  rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.LinearFilter;
  return rt;
}

export class Ombres {
  constructor(renderer, scene, soleil, u, corps) {
    this.r = renderer; this.scene = scene; this.soleil = soleil; this.u = u; this.corps = corps;
    this.cote = 2048; this.R = 700;
    this.coteP = 1536; this.RP = 62;
    this.rt = carte(this.cote); this.rtP = carte(this.coteP);
    renderer.initRenderTarget(this.rt); renderer.initRenderTarget(this.rtP);
    this.cam = new THREE.OrthographicCamera(-this.R, this.R, this.R, -this.R, 10, 3200);
    this.camP = new THREE.OrthographicCamera(-this.RP, this.RP, this.RP, -this.RP, 10, 900);
    this.cam.layers.set(1); this.camP.layers.set(1);
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, colorWrite: false,
      vertexShader: `void main() {
        #ifdef USE_INSTANCING
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 w = modelMatrix * vec4(position, 1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    });
    this.c = new THREE.Vector3(); this.m = new THREE.Matrix4();
    Object.assign(u, {
      tOmbre: { value: this.rt.depthTexture }, tOmbreP: { value: this.rtP.depthTexture }, uOmbreM: { value: new THREE.Matrix4() }, uOmbrePM: { value: new THREE.Matrix4() },
      uOmbreOn: { value: 1 }, uOmbreT: { value: new THREE.Vector2(1 / this.cote, 1 / this.coteP) },
    });
  }
  taille(n) {
    if (n === this.cote) return;
    this.cote = n; this.rt.setSize(n, n); this.u.uOmbreT.value.x = 1 / n;
  }
  poser(c, R, cote, x, y, s, loin) {
    const pas = R * 2 / cote, S = this.soleil;
    c.position.set(0, 0, 0); c.lookAt(-S.x, -S.y, -S.z); c.updateMatrixWorld();
    this.m.copy(c.matrixWorld).invert();
    this.c.set(x, y, -s).applyMatrix4(this.m);
    this.c.x = Math.round(this.c.x / pas) * pas; this.c.y = Math.round(this.c.y / pas) * pas;
    this.c.applyMatrix4(c.matrixWorld);
    c.position.copy(this.c).addScaledVector(S, loin); c.updateMatrixWorld();
    c.matrixWorldInverse.copy(c.matrixWorld).invert();
  }
  rendre(c, rt, m) {
    const r = this.r, sc = this.scene;
    sc.overrideMaterial = this.mat;
    r.setRenderTarget(rt); r.clear(); r.render(sc, c);
    sc.overrideMaterial = null;
    if (c === this.camP) {
      const m0 = c.layers.mask, ac = r.autoClear; c.layers.enableAll(); r.autoClear = false;
      r.render(this.corps, c);
      c.layers.mask = m0; r.autoClear = ac;
    }
    r.setRenderTarget(null);
    m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  }
  // La carte large, une image sur quelques-unes : les pierres ne bougent pas.
  majLarge(x, y, s) { this.poser(this.cam, this.R, this.cote, x, y, s, 1500); this.rendre(this.cam, this.rt, this.u.uOmbreM.value); }
  // La carte serrée, à chaque image : elle porte les corps.
  majProche(x, y, s) { this.poser(this.camP, this.RP, this.coteP, x, y, s, 400); this.rendre(this.camP, this.rtP, this.u.uOmbrePM.value); }
}
