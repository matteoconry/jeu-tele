# Jeu télé

Une petite « console » de jeux pour la télé, avec les téléphones comme manettes. Rien à installer.

- **Télé** : ouvrir `https://matteoconry.github.io/jeu-tele/`. Menu avec QR code, joueurs connectés, catalogue de jeux et réglages.
- **Téléphones** : scanner le QR code. On choisit son pseudo et sa couleur, puis on lance un jeu depuis l'onglet 🎮 Jeux.
  Pendant un jeu, le bouton ⏸ Menu ramène tout le monde au catalogue.
- **Télécommande** : flèches + OK pour choisir un jeu, Retour pour quitter un jeu.

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
