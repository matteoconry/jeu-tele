/*
 * Fourgandine — le faux jeu. Il n'y a rien d'autre à faire que répondre à la question.
 */
(function (F) {
  'use strict';
  var QUESTION = 'Voulez-vous que je vous fasse besogne ma fourgandine ?';

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { t0: F.t, reponses: [], particules: new F.Particules() };
    var ui = {
      emoji: '🤨', titre: QUESTION,
      boutons: [{ id: 'oui', label: '😏 Oui', couleur: '#ff70a6' }, { id: 'non', label: '😳 Non merci', couleur: '#adb5bd' }]
    };

    async function poser(P) {
      while (!L.arrete) {
        var r = await L.demander(P, JSON.parse(JSON.stringify(ui)), 'rien', 3600);
        if (L.arrete || r === 'rien') return;
        S.reponses.unshift({ nom: P.nom, couleur: P.couleur, oui: r === 'oui', t: F.t });
        if (S.reponses.length > 6) S.reponses.pop();
        if (r === 'oui') { F.son.fanfare(); S.particules.gerbe(800, 420, 50, { couleurs: ['#ff70a6', '#ffd166', '#fff'], haut: 350, vmax: 500, forme: 'confetti' }); }
        else F.son.buzz();
        await F.attendre(1);
      }
    }
    L.initialiser({});
    F.son.surprise();
    L.joueurs.forEach(function (P) { poser(P); });

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt); L.verifier(dt); S.particules.maj(dt);
      F.virtuel(c, W, H, '#14001f');
      var t = F.t - S.t0;
      var g = c.createRadialGradient(800, 420, 50, 800, 450, 900);
      g.addColorStop(0, '#5a189a'); g.addColorStop(1, '#10002b');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      // rayons qui tournent
      c.save(); c.translate(800, 420); c.rotate(t * 0.2);
      for (var i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,112,166,.06)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(1200, -150); c.lineTo(1200, 150); c.fill(); }
      c.restore();
      var e = F.ease.back(Math.min(1, t / 0.8));
      c.save(); c.translate(800, 330); c.scale(e, e); c.rotate(Math.sin(t * 1.5) * 0.02);
      F.texte(c, 'FOURGANDINE', 0, -150, 130, '#ffd166', { contour: '#ff006e', epaisseur: 16 });
      F.texteMultiligne(c, QUESTION, 0, 30, 1300, 70, '#fff', { centrerV: true, contour: 'rgba(0,0,0,.5)' });
      c.restore();
      F.texte(c, 'Répondez sur votre téléphone…', 800, 560, 30, 'rgba(255,255,255,.7)', { contour: false });
      S.reponses.forEach(function (r, k) {
        c.globalAlpha = 1 - k * 0.15;
        F.texte(c, r.nom + (r.oui ? ' a dit OUI 😏' : ' a dit non 😳'), 800, 640 + k * 42, k ? 28 : 38, r.oui ? '#ff70a6' : '#adb5bd', { contour: false });
        c.globalAlpha = 1;
      });
      S.particules.dessiner(c);
      c.restore();
    }

    return {
      image: image,
      message: function (j, m) { L.recevoir(j, m); },
      arrivee: function (j) { var P = L.PDe(j); if (P) L.arrivee(j); else api.envoyer(j, { t: 'ui', ui: ui }); },
      fin: function () { L.fin(); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'fourgandine', nom: 'Fourgandine', emoji: '🤨',
    description: 'Le jeu le plus court du monde. Une seule question.',
    min: 1, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
