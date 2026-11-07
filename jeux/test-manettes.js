/*
 * Jeu « Test des manettes » : chaque joueur déplace son carré, A fait un flash.
 * Sert aussi de modèle pour écrire un nouveau jeu :
 *   Console.ajouterJeu({ id, nom, emoji, description, min, max, boutons, creer(api) })
 *   creer(api) renvoie un objet avec (tout est facultatif) :
 *     message(joueur, m)   → un message du téléphone (m.t = 'dir' ou 'bouton', ou autre)
 *     image(ctx, W, H, dt) → dessiner une image (appelé ~60 fois par seconde)
 *     arrivee(joueur) / depart(joueur) / fin()
 */
Console.ajouterJeu({
  id: 'test-manettes',
  nom: 'Test des manettes',
  emoji: '🕹️',
  description: 'Chacun déplace son carré sur l\'île. A fait un flash.',
  min: 1,
  max: 4,
  boutons: ['A'],

  creer: function (api) {
    var VITESSE = 0.45; // fraction de la hauteur d'écran par seconde
    var etats = {};     // numero → {x, y, dx, dy, flash}

    function etatDe(j) {
      if (!etats[j.numero]) etats[j.numero] = { x: 0.2 + 0.15 * j.numero, y: 0.5, dx: 0, dy: 0, flash: 0 };
      return etats[j.numero];
    }
    api.joueurs().forEach(etatDe);

    return {
      arrivee: etatDe,
      depart: function (j) { var e = etats[j.numero]; if (e) { e.dx = 0; e.dy = 0; } },
      message: function (j, m) {
        var e = etatDe(j);
        if (m.t === 'dir') { e.dx = Math.max(-1, Math.min(1, +m.x || 0)); e.dy = Math.max(-1, Math.min(1, +m.y || 0)); }
        else if (m.t === 'bouton' && m.b === 'A' && m.appui) { e.flash = 1; api.son(440 + 110 * j.numero, 0.1); }
      },
      image: function (ctx, W, H, dt) {
        ctx.fillStyle = '#0b3d4f';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e9d8a6';
        ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.55, W * 0.36, H * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a9e4b';
        ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.55, W * 0.32, H * 0.31, 0, 0, Math.PI * 2); ctx.fill();

        var taille = H * 0.08;
        api.tousLesJoueurs().forEach(function (j) {
          var e = etats[j.numero];
          if (!e) return;
          e.x = Math.max(0, Math.min(1, e.x + e.dx * VITESSE * dt * H / W));
          e.y = Math.max(0, Math.min(1, e.y + e.dy * VITESSE * dt));
          var px = e.x * (W - taille), py = e.y * (H - taille);
          ctx.globalAlpha = j.conn ? 1 : 0.35;
          if (e.flash > 0) {
            var g = taille * (0.3 + 0.7 * e.flash);
            ctx.fillStyle = '#fff';
            ctx.fillRect(px - g / 2, py - g / 2, taille + g, taille + g);
            e.flash = Math.max(0, e.flash - dt * 2.5);
          }
          ctx.fillStyle = j.couleur;
          ctx.fillRect(px, py, taille, taille);
          ctx.fillStyle = '#000';
          ctx.font = 'bold ' + Math.round(taille * 0.55) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(j.numero), px + taille / 2, py + taille / 2);
          ctx.fillStyle = '#fff';
          ctx.font = Math.round(taille * 0.3) + 'px sans-serif';
          ctx.fillText(j.nom, px + taille / 2, py + taille * 1.3);
          ctx.globalAlpha = 1;
        });
      }
    };
  }
});
