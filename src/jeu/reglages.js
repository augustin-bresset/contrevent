// La dureté du jeu, au même endroit. Tout ce qui décide si la Horde arrive se règle ici.
export const R = {
  // Marche
  prise: 0.37,           // prise du vent sur la marche : au-delà de 1,35 de vent, faire bloc va plus vite
  vitesseBloc: 0.52,     // vitesse en bloc, par rapport à la marche libre
  // Souffle
  effortMarche: 0.0012,  // ce que coûte la marche seule
  effortVent: 0.0025,    // ce que coûte le vent de face
  effortBloc: 0.0014,    // marcher serrés fatigue
  effortPente: 0.003,
  chuteDebut: 8,         // à bout de souffle : un hordier tombe toutes les 8 à 13 secondes
  chuteAlea: 5,
  repriseChute: 0.05,    // ce que les autres reprennent quand l'un tombe
  // Le nombre protège : chaque perdu laisse plus de vent aux autres
  expoPerte: 0.022,
  // Le vent emporte
  seuilEmporte: 4.2,
  emporteBloc: 0.015, emporteBlocFin: 0.05,   // chance par seconde de lâcher, en bloc, au-delà du seuil
  perduA: 58,
  // Vivres
  vivresDepart: 5,
  rations: { portchoon: 4, chawondasee: 4, alticcio: 6, urle: 4, egine: 3, boban: 14 },
  plafondSansRepas: 0.5, // sans repas, on ne dépasse pas ça
  soinRepas: 0.075,
  soinJeune: 0.035,
  cueilletteTous: 800,    // Aoi ou Larco trouvent une ration tous les tant d'unités, jusqu'à Norska
  // Furvent
  alerte: 8,             // secondes d'avance avec Oroshi
  delaiMur: 8.4,         // secondes entre l'alerte et le mur, en plus de l'avance d'Oroshi
  frontLent: 48, frontLance: 135, frontElan: 8,   // au loin il traîne ; les dernières secondes (frontElan), il fond sur nous
  frontVitesse: 62,      // le pas du corps de la tempête, une fois la tête passée : c'est lui qui la fait durer
  frontDepart: 520,      // à cette distance, on le sent déjà
  frontLoin: 3000,       // il paraît sur l'horizon à cette distance, pendant le présage
  frontParaitre: 9,      // secondes pour qu'il sorte du lointain
  ravageBloc: 9, ravageBlocFin: 5,   // à découvert, un hordier arraché toutes les tant de secondes, en bloc...
  ravageLibre: 1.2,      // ... et sans bloc
  // Écart entre deux furvents, en part de la bande : au départ, puis au bout du monde
  furventTous: 0.06, furventFin: 0.016,
  poursuiteTous: 0.14, poursuiteFin: 0.07,
  // Rafales
  rafaleMin: 13, rafaleAlea: 17, rafaleForce: 0.8, rafaleDuree: 2.6,
  // L'humeur du vent : ce qui multiplie la carte. Chances au départ et au bout du monde, où il ne dort presque plus
  calme: 0.28, calmeFin: 0.55, calmeChance: 0.34, calmeChanceFin: 0.13,
  soutenu: 1.35, soutenuFin: 1.12, soutenuChance: 0.28,
  // Avant un furvent : le vent tombe, puis monte jusqu'à son arrivée
  presageDuree: 46, presageCreux: 0.22, presageFort: 2, presageFortFin: 1.3,
  // Poursuite
  vitesseAssaut: 22,
  frappe: 3.5, frappeFin: 2.2,   // secondes entre deux coups qui portent, au départ et au bout du monde
  paradeErg: 4,          // Erg ne pare seul qu'une fois toutes les 4 secondes
  lame: 0.5,             // une frappe au clic toutes les demi-secondes
  porteeClic: 8,
  porteeCorroyeur: 22,  // rayon du cercle blanc où le clic le touche
  embuscade: 0.08, embuscadeFin: 0.13,   // chance qu'un camp soit attaqué, au départ et au bout du monde
  // Chrones
  chasseChrone: 2.6, oeilChrone: 2, repuChrone: 2,   // plus lents que la marche, et rassasiés au bout de deux
  // Froid de Norska et cendres de Krafla
  froid: 0.0024,
};
