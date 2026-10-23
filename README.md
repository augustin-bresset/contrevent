# Contrevent

Un jeu d'après *La Horde du Contrevent*, d'Alain Damasio : on voit le monde de haut,
on mène 23 marcheurs à pied, de l'Extrême-Aval à l'Extrême-Amont, contre un vent qui ne s'arrête jamais.
Projet de fan, sans but commercial ; le monde, les noms et les signes sont ceux du roman, tous les textes
du jeu sont écrits pour lui.

```sh
npm install
npm run dev        # http://localhost:4380
npm run build      # le site statique, dans dist/
```

L'adresse accepte `?graine=34` pour rejouer un monde, et `?debug` pour exposer `window.__j`.

## Jouer

| Geste | Effet |
|---|---|
| Clic bref | Pose un point de passage ; les suivants s'enchaînent. Sur un point déjà posé, le retire. Marche aussi sur la bande du monde |
| Maintenir le clic | Golgoth marche vers le point visé, et le chemin prévu est oublié. ZQSD, WASD et les flèches marchent aussi |
| Retour, Suppr | Efface le dernier point, ou tout le chemin |
| Espace, ou clic droit | Fait bloc ou desserre : une bascule, pas une touche à tenir. La Horde est plus lente, mais elle tient dans le vent |
| T, ou « temps normal » en haut à droite | Accélère le temps : ×2, ×4, ×8. Le moindre danger le ramène à la normale |
| V | Regarder à hauteur de Horde, ou revenir au-dessus. La caméra y descend seule en arrivant dans un lieu ; un clic ne l'interrompt pas, V oui |
| Cliquer sur un assaillant | Erg frappe. Le Corroyeur est invisible : il faut cliquer là où les lignes se tordent |
| S'arrêter à l'abri, fatigué | La Horde campe seule : la nuit tombe, le souffle revient, la partie s'enregistre |
| M, Échap, ou le numéro de page | La bande du monde, le fil rouge, le son |

Espace est une bascule parce que Linux coupe souvent le pavé tactile tant qu'une touche est enfoncée :
tenir une touche empêcherait de viser.

La Horde a peu de vivres : chaque camp consomme une ration, et sans repas on ne récupère qu'à moitié. Des rations se trouvent
dans les villes, et Aoi ou Larco en rapportent tant qu'ils vivent. Dans un furvent, le bloc ne suffit pas : à découvert, le vent
arrache quelqu'un toutes les quelques secondes, seul un vrai abri protège. Tout se règle dans `src/jeu/reglages.js`.

La route est longue : T accélère le temps jusqu'à ×16, et le moindre danger le ramène à la normale. Le vent monte par paliers
jusqu'à Krafla, avec des accalmies de plus en plus fortes, et les furvents comme la Poursuite se rapprochent : le dernier
sixième de la route est de loin le plus dur.

Les 23 signes en bas de l'écran sont la Horde. Quand un hordier tombe, ce qu'il apportait disparaît avec lui :
sans Oroshi, plus d'alerte avant le furvent ; sans Arval, plus de creux marqué ; sans Alme, on récupère moins vite ;
sans Callirhoé, plus de feu ; sans Erg, un croc frappe à sa place et moins bien.

Le numéro en haut à droite compte les pages à l'envers, de 521 à 0, comme le roman.

## Le parti

**Le vent est le seul personnage.** Ce n'est pas du bruit : il est résolu sur le relief (`monde/fabrique.js`),
par une fonction de courant, `div(r grad ψ) = 0`, où `r` est la résistance du terrain. Il contourne donc les massifs,
s'accélère dans les défilés (la porte d'Urle, ou le long détour par la glace) et laisse du calme sous le vent.
Les lignes à l'écran sont ces mêmes données : elles sont l'information de jeu. Lire le vent, c'est jouer.

**Deux états, rien entre les deux.** De jour, un dessin de carte : lavis à deux tons, courbes de niveau à l'encre.
Dans le furvent, un front noir descend la carte et inverse tout : la Horde devient braise, les lignes brûlent.

**Le fil rouge.** Golgoth est le traceur : la Horde laisse un fil qui ne s'efface pas. La fin le montre, sur toute la bande.

**Rien n'est agrandi.** Les filets du vent sont de vrais rubans dessinés à la résolution de l'écran, le titre est un tracé net
rongé par un shader, et la qualité automatique renonce à de l'herbe plutôt qu'à des pixels : elle ne descend jamais sous l'écran.

**La lumière.** L'ombre du relief et ses creux sont précalculés avec le monde, les monuments et les rochers portent une ombre
en temps réel, la brume s'allume du côté du soleil. Un seul matériau sait être pierre appareillée, mur percé, tuile, cuivre, glace ou lave.

**Une contrée, une couleur.** Glace d'Aberlaas, vert de Port-Choon, jade de la Flaque, sable de Leergeem,
rose d'Alticcio, malachite, mauve d'Égine, ocre du Scóverr, bleu de Norska, cendre de Krafla, blanc de l'Extrême-Amont.

Une seule famille, Spectral (Production Type, licence OFL). Le son est entièrement synthétisé.

## Ce qui vient des inspirations

| Référence | Repris |
|---|---|
| Symphony of Vines, ch. 1 | Strates selon l'altitude, grain statique, aberration nulle au centre |
| Symphony of Vines, ch. 2 | Particules GPU, traits étirés, persistance, cuivre du furvent |
| Flow Field Gallery | Le titre en grains que le vent emporte, le souffle de particules à hauteur de Horde |
| Holographic Terrain | Courbes de niveau, dunes de Leergeem |
| Wind Waker | Les rafales blanches qui bouclent |
| Link's Awakening | L'effet maquette de la vue du dessus |
| Zelda | Roue de souffle à côté du personnage, nom des lieux en bannière, interface absente, piano rare, feu de camp qui fait passer la nuit |

## Fabrique

```
src/monde/       graine → esquisse, puis relief, vent et lumière par tranches, dans un worker
src/rendu/       sol, ciel, ombres, filets, herbe, souffle, semis, figures, monuments, Physalis, mur du furvent, foudre, post-traitement
src/jeu/         la Horde, le vent instantané, les événements, les textes
src/hud.js       interface  ·  src/carte.js  la bande  ·  src/audio.js  le son  ·  src/main.js  la boucle
```

Le monde se fabrique à la vue. L'esquisse (contrées, route, lieux, abris, grand vent à maille large) se calcule au chargement ;
chaque tranche de 400 unités se calcule ensuite à la demande, et ne dépend que de la graine et de son numéro. Dix-sept tranches
tournent en anneau autour de la Horde. La brume, plafonnée à 3 000 unités, ne s'ouvre jamais au-delà de ce qui existe.

Les lieux commandent le relief : chaque `ancre` de `monde/contrees.js` impose une altitude et une forme (plateau, col, cirque),
et le terrain rejoint le relief alentour sur un rayon de raccord. Le vent se résout ensuite sur le résultat.

`node outils/passage.mjs` vérifie qu'une série de mondes se traverse à pied.
`sh outils/tournoi.sh [adresse]` joue des parties complètes sans rendu, avec les vraies règles et un joueur automatique ;
`node outils/simulation.mjs <graine> <adresse> --detail` donne le détail d'une partie. C'est l'outil pour régler la difficulté.

Le vent de jeu et le vent des lignes sont écrits deux fois, à l'identique : `jeu/vent.js` et `rendu/communs.js`.
Toute modification doit toucher les deux.

La route est tirée par graine et garantit un passage. Les contrées, les lieux et les événements gardent l'ordre
du roman ; leurs positions, le relief, les abris et les chrones errants changent.

## Sources du monde

Noms, signes, lieux et rôles viennent de l'article Wikipédia du roman. L'ordre des épreuves vient d'un résumé de lecture.
Trois libertés assumées, faute de source ou pour le jeu :

- le **Physalis vole** : aucune source consultée ne dit comment se déplacent les vaisseaux fréoles ;
- la **graphie Chawondasee** est celle de Wikipédia, d'autres écrivent Shawondasee ;
- la **fin** propose le choix entre s'arrêter avec Oroshi et Sov, ou suivre Golgoth.
