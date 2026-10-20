// La bande du monde, de l'Extrême-Aval à l'Extrême-Amont. L'ordre vient du roman ;
// les bornes bougent un peu d'une graine à l'autre.
// Le monde se fabrique par tranches, à mesure qu'on avance : `tranche` unités de long, `nbTranches` en mémoire.
// La brume cache ce qui n'existe pas encore. Les pas divisent la largeur et la tranche, pour que tout s'aligne.
// La Horde part devant les aiguilles d'Aberlaas : assez loin pour que la caméra passe au-dessus d'elles.
export const SDEPART = 470;
export const MONDE = { W: 1600, L: 42000, pas: 2, pasVent: 8, pasLum: 5, tranche: 400, nbTranches: 17 };
// Tout est plus grand que les marcheurs : le relief, les routes, les monuments.
export const ECHELLE = { relief: 2, hauteur: 1.5, monument: 2.2 };
// Le soleil du monde : assez bas pour que le relief et les tours portent de vraies ombres.
export const SOLEIL = [-0.62, 0.47, -0.5];

const c = (id, nom, f, relief, force, ombre, lumiere, encre, trait, ciel, pasLigne, extra = {}) =>
  ({ id, nom, f, relief, force, ombre, lumiere, encre, trait, ciel, pasLigne, ...extra });

export const CONTREES = [
  c('aberlaas', 'Aberlaas', 0, 'banquise', 0.5, '#7ba0b0', '#eef4f3', '#4d7488', '#2f6480', '#dfe9ea', 3.2, { couloir: 42, solRoute: 6, rides: 0.25, grain: 0.3 }),
  c('choon', 'Terres de Port-Choon', 0.075, 'coteaux', 0.62, '#6c9a78', '#dbe6b2', '#3c6a58', '#ffffff', '#dfe8cf', 4, { couloir: 30, solRoute: 8, rides: 0, grain: 0.75, herbe: 1, herbeTon: '#7f9e58' }),
  c('lapsane', 'Flaque de Lapsane', 0.135, 'flaque', 0.8, '#8dbdb4', '#e9f2e8', '#4d8a84', '#ffffff', '#e4efe8', 2, { couloir: 0, solRoute: -0.9, rides: 0, grain: 0.2, herbe: 0.3, herbeTon: '#86a874' }),
  c('leergeem', 'Désert de Leergeem', 0.30, 'dunes', 1, '#c98a52', '#f3e2bc', '#8f5230', '#fff6e2', '#f1dfc0', 1.8, { couloir: 0, solRoute: 7, rides: 1, grain: 0.3, herbe: 0, herbeTon: '#a89a5a' }),
  c('alticcio', 'Alticcio', 0.455, 'canyon', 0.85, '#a8605c', '#efcfba', '#6e3236', '#fff0e4', '#eed6c6', 5, { couloir: 26, solRoute: 6, rides: 0.1, grain: 0.8, herbe: 0, herbeTon: '#a08a5e' }),
  c('malachites', 'Massif des Malachites', 0.55, 'massif', 0.9, '#2f7a68', '#a9d8b2', '#134c48', '#e9fff0', '#c6e3cf', 4.5, { couloir: 13, solRoute: 9, passe: true, rides: 0, grain: 0.8, herbe: 0.75, herbeTon: '#5fa77e' }),
  c('egine', "Désert d'Égine", 0.655, 'plateforme', 1.02, '#8b7fa8', '#e6deea', '#574c7c', '#ffffff', '#e4dde9', 1.4, { couloir: 0, solRoute: 3, rides: 0.5, grain: 0.5 }),
  c('scoverr', 'Hauts plateaux du Scóverr', 0.775, 'terrasses', 1.08, '#9a8f5e', '#ddd6a6', '#5e5a38', '#fffde8', '#dcd8b8', 3.6, { couloir: 20, solRoute: 20, rides: 0.1, grain: 0.8, herbe: 0.85, herbeTon: '#b4a65c' }),
  c('norska', 'Chaîne de Norska', 0.87, 'cimes', 0.95, '#5877a6', '#f2f5f8', '#2e4478', '#46659c', '#dde6f0', 5, { couloir: 16, solRoute: 34, rides: 0.3, grain: 0.35, herbe: 0, herbeTon: '#8fa0b0' }),
  c('krafla', 'Krafla', 0.925, 'cendres', 1.35, '#4a3834', '#b9a79e', '#201616', '#ffb27a', '#8d7c76', 2.6, { couloir: 24, solRoute: 40, rides: 0.1, grain: 1 }),
  c('amont', 'Extrême-Amont', 0.96, 'vide', 0.06, '#dcdad6', '#fbfaf8', '#5f5c58', '#ffffff', '#fbfaf8', 8, { couloir: 40, solRoute: 40 }),
];

// Les lieux du roman. `f` est la place sur la bande, `dx` l'écart à la route.
// Ce qui flotte dans l'air, vu à hauteur de Horde. taille : grains ; long : traînée ; chute : gravité ; vif : additif.
export const AIRS = {
  aberlaas: { c: '#f4fbff', taille: 1, long: 0.5, chute: 0.8 },
  choon: { c: '#f5ecb4', taille: 0.8, long: 0.25, chute: 0.05 },
  lapsane: { c: '#ffffff', taille: 0.7, long: 0.9, chute: 0.25 },
  leergeem: { c: '#f5d9a4', taille: 0.8, long: 1.6, chute: 0.02 },
  alticcio: { c: '#f3cdb2', taille: 0.8, long: 1, chute: 0.04 },
  malachites: { c: '#c9f2d4', taille: 0.9, long: 0.5, chute: 0.04 },
  egine: { c: '#f3ecf8', taille: 0.7, long: 1.5, chute: 0.02 },
  scoverr: { c: '#efe6b4', taille: 0.8, long: 0.8, chute: 0.08 },
  norska: { c: '#ffffff', taille: 1.25, long: 0.7, chute: 1.1 },
  krafla: { c: '#ff9a58', taille: 0.8, long: 0.3, chute: -0.4, vif: 1 },
  amont: { c: '#ffffff', taille: 0.6, long: 0.2, chute: 0 },
};

// Ce qui pousse ou traîne sur chaque sol : [forme, chance par case, tailles, couleur, options].
export const SEMIS = {
  banquise: [['eclat', 0.34, [1, 3.6], '#d5e6ec'], ['rocher', 0.22, [0.7, 2.2], '#a6bcc6'], ['eclat', 0.05, [4, 7], '#bcd6e0']],
  coteaux: [['touffe', 0.95, [0.8, 1.7], '#8aa65f'], ['arbuste', 0.2, [1.1, 2.7], '#5e8460'], ['rocher', 0.2, [0.6, 2], '#9c9b84'], ['touffe', 0.3, [0.8, 1.3], '#c4b768']],
  flaque: [['roseau', 0.5, [1.2, 2.6], '#7f9f7a', { eau: true }], ['rocher', 0.14, [0.5, 1.5], '#8ea9a2', { eau: true }], ['cote', 0.012, [3, 5], '#c9cfc0', { eau: true }]],
  dunes: [['rocher', 0.09, [0.7, 2.2], '#b78a5a'], ['arbuste', 0.08, [0.6, 1.3], '#8a7a4c'], ['cote', 0.012, [3, 6], '#e6d9bd'], ['touffe', 0.08, [0.5, 1], '#a89a5a']],
  canyon: [['rocher', 0.42, [0.8, 3.4], '#b57c70'], ['arbuste', 0.06, [0.8, 1.6], '#8a6a52'], ['touffe', 0.18, [0.5, 1], '#a08a5e']],
  massif: [['eclat', 0.4, [1, 4], '#58b89a'], ['rocher', 0.3, [0.8, 2.6], '#3d7f70'], ['arbuste', 0.14, [1.2, 2.6], '#2d6a56'], ['touffe', 0.4, [0.6, 1.2], '#7fbf90']],
  plateforme: [['eclat', 0.1, [0.8, 3], '#efe9f3'], ['rocher', 0.08, [0.4, 1.3], '#a79bc0'], ['eclat', 0.012, [6, 10], '#cfc4dc']],
  terrasses: [['touffe', 0.9, [0.8, 1.6], '#b0a35e'], ['rocher', 0.26, [0.6, 2.2], '#8c8460'], ['arbuste', 0.08, [0.9, 1.7], '#747449']],
  cimes: [['rocher', 0.36, [0.8, 3], '#6e88b0'], ['eclat', 0.3, [1, 3.4], '#e4edf5']],
  cendres: [['rocher', 0.42, [0.7, 3], '#3a2c2a'], ['eclat', 0.12, [1, 3], '#2a1f1e']],
  vide: [],
};

// Chaque lieu commande le sol sous lui : `ancre` dit à quelle altitude et sous quelle forme le relief doit le recevoir.
// plateau : le sol se pose à l'altitude y sur rx × rs, et rejoint le relief sur `raccord`.
// col : une gorge plate de demi-largeur rx, entre deux murs de `mur` de haut. cirque : un fond rond, un mur percé par la route.
export const LIEUX = [
  { id: 'aberlaas', nom: 'Aberlaas', sous: 'La Falaise des Confins', fixe: 252, dx: -34, rayon: 110, ancre: { forme: 'plateau', y: 11, rx: 300, rs: 70, raccord: 70 } },
  { id: 'portchoon', nom: 'Port-Choon', sous: 'Dernière ville abritée', borne: 'lapsane', ecart: -110, dx: 40, rayon: 60, ancre: { forme: 'plateau', y: 3, rx: 190, rs: 90, raccord: 150 } },
  { id: 'lapsane', nom: 'Flaque de Lapsane', sous: 'Nul n’en est ressorti', f: 0.1385, dx: 0, rayon: 40, sansMonument: true },
  { id: 'chawondasee', nom: 'Chawondasee', sous: 'La rive amont', borne: 'leergeem', ecart: -70, dx: 30, rayon: 60, ancre: { forme: 'plateau', y: 3, rx: 170, rs: 110, raccord: 150 } },
  { id: 'leergeem', nom: 'Désert de Leergeem', sous: 'Les dunes marchent vers l’aval', f: 0.306, dx: 0, rayon: 40, sansMonument: true },
  { id: 'alticcio', nom: 'Alticcio', sous: 'La cité verticale', f: 0.5, dx: 0, rayon: 110, ancre: { forme: 'plateau', y: 14, rx: 200, rs: 290, raccord: 160 } },
  { id: 'urle', nom: 'Porte d’Urle', sous: 'Le seul défilé des Malachites', f: 0.602, dx: 0, rayon: 60, ancre: { forme: 'col', y: 18, rx: 95, rs: 130, raccord: 210, mur: 130 } },
  { id: 'egine', nom: 'Désert d’Égine', sous: 'Ici s’est tue la 27e Horde', f: 0.70, dx: 44, rayon: 80, ancre: { forme: 'plateau', y: 6, rx: 150, rs: 150, raccord: 220 } },
  { id: 'boban', nom: 'Camp Bòban', sous: 'Les rescapés des Hordes', f: 0.815, dx: -36, rayon: 70, ancre: { forme: 'plateau', y: 28, rx: 105, rs: 105, raccord: 130 } },
  { id: 'norska', nom: 'Chaîne de Norska', sous: 'Fin des terres connues', f: 0.873, dx: 0, rayon: 40, sansMonument: true },
  { id: 'brakauer', nom: 'Cirque de Brakauer', sous: 'Le froid tient debout', f: 0.9, dx: 0, rayon: 70, ancre: { forme: 'cirque', y: 52, rx: 215, mur: 170, ouverture: 120 } },
  { id: 'krafla', nom: 'Krafla', sous: 'Le volcan suspendu', f: 0.94, dx: 60, rayon: 110, ancre: { forme: 'plateau', y: 60, rx: 230, rs: 230, raccord: 200 } },
];

export const FORMES = [
  { nom: 'zéfirine', seuil: 0 },
  { nom: 'slamino', seuil: 0.34 },
  { nom: 'choon', seuil: 0.62 },
  { nom: 'stèche', seuil: 0.88 },
  { nom: 'crivetz', seuil: 1.2 },
  { nom: 'furvent', seuil: 1.65 },
];
