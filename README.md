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

Chaque push sur `main` publie le site sur https://augustin-bresset.github.io/contrevent/.

L'adresse accepte `?graine=34` pour rejouer un monde, et `?debug` pour exposer `window.__j`.

## Jouer

| Geste | Effet |
|---|---|
| Clic bref | Pose un point de passage ; les suivants s'enchaînent. Sur un point déjà posé, le retire. Marche aussi sur la bande du monde |
| Maintenir le clic | Golgoth marche vers le point visé, et le chemin prévu est oublié. ZQSD, WASD et les flèches marchent aussi |
| Retour, Suppr | Efface le dernier point, ou tout le chemin |
| Espace, ou clic droit | Fait bloc ou desserre : une bascule, pas une touche à tenir. La Horde est plus lente, mais elle tient dans le vent |
| T, ou « temps normal » en haut à droite | Accélère le temps : ×2, ×4, ×8, ×16. Le moindre danger le ramène à la normale |
| C, tenu | Lit le pays : le relief se dessine en courbes de niveau, et le vent ressort |
| Molette | Rapproche la caméra du sol, ou l'élève pour lire le chemin |
| V | Regarder à hauteur de Horde, ou revenir au-dessus. En arrivant dans un lieu, la caméra y descend seule : le jeu s'arrête, le chemin est oublié, personne ne se fatigue et rien n'attaque. V reprend la marche |
| Cliquer sur un assaillant | Erg frappe. Le Corroyeur se frappe dans son cercle blanc, cinq coups en tout ; les chrones ne se frappent pas, ils se contournent |
| R, ou le message en bas de l'écran | Camper, si l'endroit est à l'abri. Les zones dorées au sol sont celles où le vent ne porte pas : elles s'affichent quand le souffle baisse, ou en tenant C. S'y arrêter fatigué suffit aussi : la nuit tombe, le souffle revient, la partie s'enregistre |
| M, Échap, ou le numéro de page | La bande du monde, le fil rouge, le son |

Au doigt, les boutons à droite de l'écran remplacent le clavier :

| Geste | Effet |
|---|---|
| Toucher bref, doigt posé | Comme le clic bref et le clic maintenu. Toucher un assaillant le frappe |
| Pincer à deux doigts | Zoome |
| Faire bloc, Camper | Comme Espace et R. Camper s'allume en doré à l'abri ; ailleurs, il montre l'abri le plus proche |
| Regarder, puis Reprendre | Comme V |
| Relief | Comme C, mais une bascule : un doigt reste libre pour viser |
| Effacer | Retire le dernier point. Un appui long retire tout le chemin. Il n'apparaît que s'il y a un chemin |
| « temps normal », « menu » en haut à droite | Comme T et M |

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

**Un pays, pas une carte.** La caméra voit l'horizon : la Horde marche en bas de l'image, et le monde se perd dans l'air.
Le dessin de carte d'origine n'a pas disparu : tenir C fait revenir les courbes de niveau, et le vent ressort.
Le furvent s'annonce de loin : un mur de sable en volume, sans bords, plus large que tout ce qu'on peut voir, surgit à l'horizon, prend le soleil de côté et avale le jour.

**Le fil rouge.** Golgoth est le traceur : la Horde laisse un fil qui ne s'efface pas. La fin le montre, sur toute la bande.

**La lumière est une seule lumière.** Une atmosphère calculée (diffusion de Rayleigh et de Mie, d'après Hillaire) donne à la fois
le ciel, la couleur du soleil au sol, l'éclairage ambiant et la brume : le sol, les pierres, les corps et les monuments vivent sous
le même ciel. Chaque contrée a son air : plus de poussière dans le désert, un ciel couvert à Norska, des cendres à Krafla.
Le soleil éclaire de trois quarts, derrière la Horde : à contre-jour, tout ce qu'on voit lui tournerait le dos.

**Une vraie matière.** Le sol mêle des scans réels selon la pente, l'altitude et la contrée, lus à deux échelles pour effacer la
répétition. Les rochers sont des scans réduits à environ 1 300 triangles, qui gardent le relief de l'original grâce à des normales cuites.
Le vent dépose sur eux ce qu'il transporte. Dunes à face d'avalanche, mesas en gradins et crêtes érodées sont dans le relief lui-même.

**Un bâti de masses.** Les villes sont faites de peu de pièces, sculptées en fonctions de distance (`outils/bati.mjs`) : des volumes
purs, fondus entre eux, avec l'ombre des creux et l'usure des arêtes cuites dedans. La forme et la lumière font le travail, pas le détail.
Les murs comptent pour le jeu : ils ne se traversent pas, arrêtent le vent, et on dort à l'abri derrière eux (`monde/villes.js`).

**L'image.** Rendu en lumière réelle, occlusion ambiante, poussière éclairée pas à pas dans l'air, nuages volumétriques qui portent
leur ombre au sol, lissage temporel, développement AgX. La qualité se compte en pixels : le lissage rattrape mieux une image un peu
moins grande qu'une image privée de ses ombres. On ne renonce aux effets qu'en dernier.

**Une contrée, une couleur.** Glace d'Aberlaas, vert de Port-Choon, jade de la Flaque, sable de Leergeem,
rose d'Alticcio, malachite, mauve d'Égine, ocre du Scóverr, bleu de Norska, cendre de Krafla, blanc de l'Extrême-Amont.

Une seule famille, Spectral (Production Type, licence OFL). Le vent est enregistré (voir plus bas), le reste du son est synthétisé.

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
src/rendu/       atmosphère, sol, matières, ombres, filets, herbe, souffle, semis, figures, monuments, Physalis, mur du furvent, foudre, chaîne d'image
src/jeu/         la Horde, le vent instantané, les événements, les textes
src/sons/        le vent enregistré, en boucles
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

## Matières

Le vent vient d'enregistrements en CC0, préparés par `outils/vent.py` à partir de leurs extraits en écoute de Freesound : le désert
d'Atacama ([146914](https://freesound.org/s/146914/)), une plaine d'Anatolie ([167684](https://freesound.org/s/167684/)), le désert
([711105](https://freesound.org/s/711105/)), un panneau qui chante ([349186](https://freesound.org/s/349186/)) et un barbelé
([147777](https://freesound.org/s/147777/)), tous de Felix Blume ; des dunes par Kinoton ([393567](https://freesound.org/s/393567/)) et
une église vide ([557380](https://freesound.org/s/557380/)).

Les textures et les rochers viennent de [Poly Haven](https://polyhaven.com), sous licence CC0. Rien de tout cela n'est versionné
sous sa forme brute : `src/rendu/matieres/` contient le résultat, déjà aplani et empaqueté (3 Mo de WebP).
Pour le refaire, à partir d'un dossier de scans téléchargés :

```
python3 outils/matieres.py <textures>       aplanit les scans, raccorde leurs bords, empaquette couleur, pentes et hauteur
node outils/rochers.mjs <modèles>           réduit les rochers  →  src/rendu/rochers-maillage.js
python3 outils/cuire.py <modèles>           cuit les normales du scan complet dans le repère de l'objet
node outils/bati.mjs [pièces…]              sculpte le bâti  →  src/rendu/bati-maillage.js
```

## Sources du monde

Noms, signes, lieux et rôles viennent de l'article Wikipédia du roman. L'ordre des épreuves vient d'un résumé de lecture.
Trois libertés assumées, faute de source ou pour le jeu :

- le **Physalis vole** : aucune source consultée ne dit comment se déplacent les vaisseaux fréoles ;
- la **graphie Chawondasee** est celle de Wikipédia, d'autres écrivent Shawondasee ;
- la **fin** propose le choix entre s'arrêter avec Oroshi et Sov, ou suivre Golgoth.
