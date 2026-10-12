// Les ombres portées : ce que les monuments et les rochers font au sol. Une carte de profondeur vue du soleil,
// qui suit la Horde par pas entiers de texel pour que le bord des ombres ne grouille pas.
import * as THREE from 'three';

export class Ombres {
  constructor(renderer, scene, soleil, u) {
    this.r = renderer; this.scene = scene; this.soleil = soleil; this.u = u;
    this.cote = 2048; this.R = 560;
    this.rt = new THREE.WebGLRenderTarget(this.cote, this.cote, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    this.rt.depthTexture = new THREE.DepthTexture(this.cote, this.cote, THREE.UnsignedIntType);
    const R = this.R;
    this.cam = new THREE.OrthographicCamera(-R, R, R, -R, 10, 2600);
    this.cam.layers.set(1);
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
    u.tOmbre = { value: this.rt.depthTexture }; u.uOmbreM = { value: new THREE.Matrix4() }; u.uOmbreOn = { value: 1 };
  }
  taille(n) {
    if (n === this.cote) return;
    this.cote = n; this.rt.setSize(n, n);
  }
  maj(x, y, s) {
    const pas = this.R * 2 / this.cote, S = this.soleil, c = this.cam;
    // Le centre, ramené sur la grille des texels vue du soleil.
    c.position.set(0, 0, 0); c.lookAt(-S.x, -S.y, -S.z); c.updateMatrixWorld();
    this.m.copy(c.matrixWorld).invert();
    this.c.set(x, y, -s).applyMatrix4(this.m);
    this.c.x = Math.round(this.c.x / pas) * pas; this.c.y = Math.round(this.c.y / pas) * pas;
    this.c.applyMatrix4(c.matrixWorld);
    c.position.copy(this.c).addScaledVector(S, 1300); c.updateMatrixWorld();
    const r = this.r, sc = this.scene, fond = sc.background;
    sc.overrideMaterial = this.mat; sc.background = null;
    r.setRenderTarget(this.rt); r.clear(); r.render(sc, c); r.setRenderTarget(null);
    sc.overrideMaterial = null; sc.background = fond;
    this.u.uOmbreM.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  }
}
