# Jeu télé

Jeu à deux sur la télé, avec les téléphones comme manettes. Rien à installer.

- `index.html` : la page à ouvrir sur la télé. Elle crée une salle et affiche un QR code.
- `manette.html` : la page ouverte en scannant le QR code. Croix directionnelle + bouton A.
- `lib/` : PeerJS 1.5.4 et qrcode-generator 1.4.4, copiés ici pour ne pas dépendre d'un CDN.

La connexion télé ↔ téléphones passe par PeerJS (WebRTC) et le serveur public gratuit de PeerJS.
Tous les liens sont relatifs, donc le site marche sous `matteoconry.github.io/<nom-du-depot>/`.

## Étape 1 : test de connexion
1. Ouvrir `https://matteoconry.github.io/<nom-du-depot>/` sur la télé.
2. Scanner le QR code avec deux téléphones.
3. Chaque téléphone bouge son carré. Le bouton A fait un flash.
