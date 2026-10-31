// Construit une page unique pour un artefact : tout en ligne, matières comprises, sauf three.js et Spectral, servis par des CDN.
// node outils/artefact.mjs  →  dist-artefact/contrevent.html
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'dist-artefact');
const VERSION = JSON.parse(fs.readFileSync(path.join(racine, 'node_modules/three/package.json'))).version;

await build({
  root: racine, logLevel: 'warn', base: './', configFile: false,
  worker: { format: 'iife' },
  resolve: { alias: [{ find: /^@fontsource\/.*$/, replacement: path.join(racine, 'outils/vide.css') }] },
  build: {
    outDir: sortie, emptyOutDir: true, target: 'es2022', cssCodeSplit: false, modulePreload: false, assetsInlineLimit: 1e9,
    rollupOptions: { external: [/^three(\/.*)?$/] },
  },
});

const dossier = path.join(sortie, 'assets');
const fichiers = fs.readdirSync(dossier);
const js = fs.readFileSync(path.join(dossier, fichiers.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(dossier, fichiers.find((f) => f.endsWith('.css'))), 'utf8');
let html = fs.readFileSync(path.join(sortie, 'index.html'), 'utf8');
html = html.replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/, '').replace(/<link rel="stylesheet"[^>]*>\s*/, '');
const tete = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,200;0,300;0,400;1,300&display=swap">
<style>${css}</style>
<script type="importmap">{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${VERSION}/examples/jsm/"
} }</script>
`;
html = html.replace('</head>', () => `${tete}</head>`).replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
fs.writeFileSync(path.join(sortie, 'contrevent.html'), html);
fs.rmSync(dossier, { recursive: true, force: true });
fs.rmSync(path.join(sortie, 'index.html'));
console.log('dist-artefact/contrevent.html', Math.round(html.length / 1024), 'Ko');
