# Jeu télé

Une petite « console » de jeux pour la télé, avec les téléphones comme manettes. Rien à installer.

- **Télé** : ouvrir `https://matteoconry.github.io/jeu-tele/`. Menu avec QR code, joueurs connectés, catalogue de jeux et réglages.
- **Téléphones** : scanner le QR code. On choisit son pseudo et sa couleur, puis on lance un jeu depuis l'onglet 🎮 Jeux.
  Pendant un jeu, le bouton ⏸ Menu ramène tout le monde au catalogue.
- **Télécommande** : flèches + OK pour choisir un jeu, Retour pour quitter un jeu.

## Jeux du catalogue
- **Fiesta des Îles** (2 à 4 joueurs) : jeu de plateau sur une île. Dé de 1 à 10, cases bonus (+3), pièges (−3),
  surprises, duels, étoiles de mer à acheter (20 coquillages), un embranchement par le volcan, un mini-jeu à la fin
  de chaque tour, bonus et podium final. 5 mini-jeux : noix de coco, flamant réflexe, totems, course de crabes, pêche aux perles.
  Fichiers dans `jeux/fiesta/`. Tout est dessiné et les sons sont synthétisés : aucune image ni fichier audio.
- **Le Grand Quiz** (1 à 4 joueurs) : culture générale, 145 questions dans 8 thèmes (`jeux/quiz/questions.js`, facile à enrichir).
  Réponse secrète sur le téléphone, 15 s par question, points selon la rapidité et bonus de série.
- **Dino Sprint** (1 à 4 joueurs) : course sans fin, un couloir par joueur, mêmes obstacles pour tous.
  Sauter (garder appuyé = plus haut), se baisser, ramasser les œufs dorés, 3 vies. Record sauvegardé sur la télé.
- **Magnats des Îles** (2 à 4 joueurs) : jeu de plateau original sur une île. On achète des lieux, on construit villas et palais, on encaisse les loyers. Bouteilles à la mer, île déserte, faillite. Fin après 12 ou 20 tours, ou jusqu'à la ruine.
- **Duel d'Archers** (1 ou 2 joueurs) : duel de stickmen à l'arc, chacun son tour, avec le vent. 5 cartes avec obstacles, tir à la tête = gros dégâts, 2 manches gagnantes. Seul, on affronte Robin le robot (3 niveaux).
- **Poker** (2 à 4 joueurs) : Texas Hold'em avec des jetons pour rire. Cartes cachées sur le téléphone, blindes qui doublent toutes les 6 mains, relances, tapis, pots partagés.
- **Turbo Karts** (1 à 4 joueurs) : course de karts en fausse 3D, écran partagé, 6 pilotes (l'ordinateur complète). 3 circuits (Ville Néon, Montagne Enneigée, Canyon Rouge), objets (turbo, huile, missile, bouclier), plaques turbo, Grand Prix.
- **Test des manettes** : chacun déplace son carré.

## Organisation des fichiers
- `index.html`, `js/console.js`, `css/console.css` : la console télé (salle PeerJS, joueurs, menu, réglages).
- `manette.html`, `js/manette.js`, `css/manette.css` : la manette téléphone.
- `jeux/` : un fichier par jeu. `jeux/test-manettes.js` sert de modèle.
- `lib/` : PeerJS 1.5.4 et qrcode-generator 1.4.4, copiés ici pour ne pas dépendre d'un CDN.

## Ajouter un jeu
1. Créer `jeux/mon-jeu.js` avec `Console.ajouterJeu({ id, nom, emoji, description, min, max, boutons, creer(api) })`
   (voir le commentaire en haut de `jeux/test-manettes.js`).
2. Ajouter `<script src="jeux/mon-jeu.js"></script>` dans `index.html`.

La connexion passe par PeerJS (WebRTC) et son serveur public gratuit. Tous les liens sont relatifs,
donc le site marche sous `matteoconry.github.io/jeu-tele/`.
