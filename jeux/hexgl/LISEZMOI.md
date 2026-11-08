# HexGL dans Jeu télé

Ce dossier contient une copie du jeu libre **HexGL** de Thibaut « BKcore » Despoulain :
https://github.com/BKcore/HexGL (dernière version du dépôt, copiée le 8 novembre 2026).

## Licences
- Code et ressources : licence MIT (fichier `LICENSE`, © 2015 Thibaut Despoulain).
  Certains fichiers de code portent encore l'ancienne mention *Creative Commons Attribution-NonCommercial 3.0* :
  on les traite comme tels, donc **usage non commercial uniquement**, avec crédit à l'auteur (c'est le cas ici, jeu privé et gratuit).
- Modèle du vaisseau HexMKI : Charnel. Texture de la piste : Nobiax.
- Sons (`audio/LICENSE`) : CC BY 3.0 (IFartInUrGeneralDirection, kangaroovindaloo, beman87, retouchés par Licson) et domaine public (qubodup, mu6k).
- `libs/Three.dev.js` : three.js (MIT). `libs/ShaderExtras.js` : CC BY 3.0 (voir l'en-tête du fichier). Police Bebas Neue (Dharma Type).

## Ce qui a été changé
- `course.html` (nouveau) remplace le menu d'origine : la course démarre directement, résultats et record en français,
  pas de statistiques Google, pas de Leap Motion.
- `bkcore/hexgl/ShipControls.js` : ajout d'un volant analogique (`volant`, de -1 à 1) piloté par le téléphone.
- `bkcore/hexgl/Gameplay.js` : messages de course traduits en français.
- `bkcore/Audio.js` : un son illisible ne bloque plus le chargement.
- Fichiers non utilisés retirés (éditeur, archives, replays, sources CoffeeScript).
