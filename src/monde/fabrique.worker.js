import { fabriquerMonde } from './fabrique.js';
self.onmessage = (e) => {
  const m = fabriquerMonde(e.data.graine);
  self.postMessage(m, [m.hauteur.buffer, m.vent.buffer, m.route.buffer, m.lum.buffer]);
};
