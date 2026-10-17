// La dureté du jeu, au même endroit. Tout ce qui décide si la Horde arrive se règle ici.
export const R = {
  // Marche
  prise: 0.5,            // prise du vent sur la marche : au-delà de 1,1 de vent, faire bloc va plus vite
  vitesseBloc: 0.52,     // vitesse en bloc, par rapport à la marche libre
  // Souffle
  effortVent: 0.0074,    // ce que coûte le vent de face
  effortBloc: 0.0035,    // marcher serrés fatigue
  chuteDebut: 8,         // à bout de souffle : un hordier tombe toutes les 8 à 13 secondes
  chuteAlea: 5,
  repriseChute: 0.05,    // ce que les autres reprennent quand l'un tombe
  // Le nombre protège : chaque perdu laisse plus de vent aux autres
  expoPerte: 0.022,
  // Le vent emporte
  seuilEmporte: 3,
  perduA: 58,
  // Vivres
  vivresDepart: 5,
  plafondSansRepas: 0.5, // sans repas, on ne dépasse pas ça
  soinRepas: 0.075,
  soinJeune: 0.035,
  cueilletteTous: 1200,   // Aoi ou Larco trouvent une ration tous les tant d'unités
  // Furvent
  alerte: 8,             // secondes d'avance avec Oroshi
  frontVitesse: 62,
  frontDepart: 520,
  ravageBloc: 6,       // à découvert, un hordier arraché toutes les tant de secondes, en bloc...
  ravageLibre: 1.2,      // ... et sans bloc
  // Rafales
  rafaleMin: 13, rafaleAlea: 17, rafaleForce: 0.8, rafaleDuree: 2.6,
  // Poursuite
  vitesseAssaut: 22,
  paradeErg: 4,          // Erg ne pare seul qu'une fois toutes les 4 secondes
  lame: 0.5,             // une frappe au clic toutes les demi-secondes
  porteeClic: 8,
  embuscade: 0.3,        // chance qu'un camp soit attaqué
  // Chrones
  chasseChrone: 2.6, oeilChrone: 2, repuChrone: 3,   // plus lents que la marche, et rassasiés au bout de trois
  // Froid de Norska et cendres de Krafla
  froid: 0.0055,
};
