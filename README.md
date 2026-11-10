# Jeu télé

Une petite « console » de jeux pour la télé, avec les téléphones comme manettes. Rien à installer.

- **Télé** : ouvrir `https://matteoconry.github.io/jeu-tele/`. Menu avec QR code, joueurs connectés, catalogue de jeux et réglages.
- **Téléphones** : scanner le QR code. On choisit son pseudo et sa couleur, puis on lance un jeu depuis l'onglet 🎮 Jeux.
  Pendant un jeu, le bouton ⏸ Menu ramène tout le monde au catalogue.
- **Télécommande** : flèches + OK pour choisir un jeu, Retour pour quitter un jeu.

## Jeux du catalogue
- **Fiesta Royale** (2 à 4 joueurs) : jeu de plateau autour d'un château, dans une prairie entourée de forêt. Dé de 1 à 10,
  cases bonus (+3), pièges (−3), surprises, duels, étoiles à acheter (20 pièces d'or), un raccourci par le château, un mini-jeu
  à la fin de chaque tour, bonus et podium final. 17 mini-jeux : bloc à pièces, drapeau réflexe, cloches qui chantent,
  course en sac, chasse aux pièces, pluie de pièces, sablier caché, lancer d'anneau, couleurs farceuses, plateau glissant,
  bombe farceuse, trouve l'intrus, calcul du roi, tour du château, ballon qui gonfle, saut à la corde, compte les moutons
  (17 au total, tirés dans une pioche pour ne pas revoir le même trop tôt ; `jeux/fiesta/minijeux.js` et `minijeux2.js`).
  Fichiers dans `jeux/fiesta/`. Décor et personnages en modèles 3D Kenney, sons synthétisés.
- **Le Grand Quiz** (1 à 4 joueurs) : culture générale, 145 questions dans 8 thèmes (`jeux/quiz/questions.js`, facile à enrichir).
  Réponse secrète sur le téléphone, 15 s par question, points selon la rapidité et bonus de série.
- **Dino Sprint** (1 à 4 joueurs) : course sans fin, un couloir par joueur, mêmes obstacles pour tous.
  Sauter (garder appuyé = plus haut), se baisser, ramasser les œufs dorés, 3 vies. Record sauvegardé sur la télé.
- **Magnats de la Ville** (2 à 4 joueurs) : jeu de plateau original dans une petite ville. On achète des rues et des stations de tram, on construit des étages puis des gratte-ciel, on encaisse les loyers. Enveloppes surprises, embouteillage, fontaine aux vœux, faillite. Fin après 12 ou 20 tours, ou jusqu'à la ruine.
- **Duel d'Archers** (1 ou 2 joueurs) : duel de stickmen à l'arc, chacun son tour, avec le vent. 5 cartes avec obstacles, tir à la tête = gros dégâts, 2 manches gagnantes. Seul, on affronte Robin le robot (3 niveaux).
- **Poker** (2 à 4 joueurs) : Texas Hold'em avec des jetons pour rire. Cartes cachées sur le téléphone, blindes qui doublent toutes les 6 mains, relances, tapis, pots partagés.
- **Turbo Karts** (1 à 4 joueurs) : course en vraie 3D (three.js + modèles Kenney), écran partagé, 6 pilotes (l'ordinateur complète). 3 circuits en tuiles (Forêt des Pins, Centre-Ville, Arène Antique), objets (turbo, huile, missile, bouclier), plaques turbo, Grand Prix. La qualité baisse toute seule si la télé rame. Fichiers `jeux/kart/kart.js` (règles) et `jeux/kart/rendu3d.js` (affichage).
- **Le Défi Dessin** (2 à 4 joueurs) : un mot, tout le monde le dessine sur son téléphone en 60 s, les dessins sont dévoilés à la télé et chacun vote pour le meilleur (pas le sien).
- **Le Petit Bac** (2 à 8 joueurs) : une lettre (sans K, Q, W, X, Y, Z) et 6 catégories tirées au hasard parmi 42. Chacun remplit
  sa liste en secret sur son téléphone (✅ dès que le mot commence par la bonne lettre). Le premier qui a tout rempli appuie sur
  STOP : les autres ont encore 10 secondes. Si personne n'y arrive, chacun peut appuyer sur « Je sèche ». Ensuite la télé dévoile
  les copies et chacun peut refuser les mots des autres (refusé si plus de la moitié des autres joueurs dit 👎).
  2 points pour un mot unique, 1 point si quelqu'un a le même (accents et majuscules ignorés), 0 sinon. 3, 5 ou 10 manches.
  Fichier `jeux/bac/bac.js`. Pour jouer à plus de 4, passer « Joueurs max » à 5, 6, 7 ou 8 dans les réglages.
- **HexGL** (solo) : le vrai jeu libre de course futuriste de Thibaut « BKcore » Despoulain, intégré tel quel (`jeux/hexgl/`).
  Le téléphone sert de volant : on le tient en paysage et on le penche pour tourner (ou boutons ◀ ▶), gaz automatique, aérofreins
  pour les virages serrés. 3 qualités d'image (Fluide pour la télé, Très belle pour un ordi en HDMI), 2 niveaux, record sauvegardé.
  Code télé : `jeux/hexgl.js` ; volant du téléphone : `js/volant.js`.
- **Test des manettes** : chacun déplace son carré.

## Organisation des fichiers
- `index.html`, `js/console.js`, `css/console.css` : la console télé (salle PeerJS, joueurs, menu, réglages).
- `manette.html`, `js/manette.js`, `css/manette.css` : la manette téléphone.
- `jeux/` : un fichier par jeu. `jeux/test-manettes.js` sert de modèle.
- `lib/` : PeerJS 1.5.4, qrcode-generator 1.4.4 et three.js r147, copiés ici pour ne pas dépendre d'un CDN.
- `assets/` : modèles 3D libres (Kenney, CC0) et vignettes du menu. Crédits et licences dans `CREDITS.md`.

## Ajouter un jeu
1. Créer `jeux/mon-jeu.js` avec `Console.ajouterJeu({ id, nom, emoji, description, min, max, boutons, creer(api) })`
   (voir le commentaire en haut de `jeux/test-manettes.js`).
2. Ajouter `<script src="jeux/mon-jeu.js"></script>` dans `index.html`.

La connexion passe par PeerJS (WebRTC) et son serveur public gratuit. Tous les liens sont relatifs,
donc le site marche sous `matteoconry.github.io/jeu-tele/`.
