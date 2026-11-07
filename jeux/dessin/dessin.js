/*
 * Le Défi Dessin — 2 à 4 joueurs.
 * Un mot, tout le monde dessine en même temps sur son téléphone, puis la télé dévoile les dessins
 * et chacun vote pour son dessin préféré (pas le sien). 100 points par vote reçu.
 */
(function (F) {
  'use strict';
  var DUREE = 60;
  var MOTS = ["une pomme", "une banane", "un vélo", "un oiseau", "un livre", "un bus", "un papillon", "un gâteau", "un appareil photo", "une voiture", "un chat", "une chaise", "une horloge", "un nuage", "une tasse", "un chien", "une porte", "un canard", "un éléphant", "un œil", "un visage", "un poisson", "une fleur", "une guitare", "un hamburger", "un chapeau", "une maison", "une glace", "une clé", "une échelle", "un éclair", "la lune", "une montagne", "un champignon", "une pizza", "un lapin", "un arc-en-ciel", "des ciseaux", "un escargot", "un bonhomme de neige", "une araignée", "une étoile", "le soleil", "une épée", "un t-shirt", "une table", "un arbre", "un parapluie", "un avion", "une hache", "un lit", "une abeille", "un pont", "une bougie", "une carotte", "un château", "une couronne", "un diamant", "un dauphin", "un donut", "un dragon", "des lunettes", "une fourchette", "une girafe", "un marteau", "une main", "un casque audio", "un hélicoptère", "un cheval", "une montgolfière", "un couteau", "une feuille", "un lion", "une sucette", "une pieuvre", "un hibou", "une poire", "un crayon", "un pingouin", "un cochon", "un voilier", "un requin", "un mouton", "une chaussure", "un serpent", "une cuillère", "une fraise", "un téléphone", "une télévision", "une tente", "une brosse à dents", "un tracteur", "un train", "un camion", "une pastèque", "un moulin à vent", "un zèbre", "une vache", "une grenouille", "un crabe", "une baleine", "un piano", "un ballon de basket", "un ballon de foot", "du pain", "un cookie", "du raisin", "un ananas", "un cactus", "un flocon de neige", "un ours en peluche", "une souris", "un singe", "une chauve-souris", "une enveloppe", "un phare", "un skateboard", "un seau"];

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', t0: F.t, manche: 0, nbManches: 3, mot: null, cle: null, fin: 0, revele: null, galerie: null, fin2: null, particules: new F.Particules(), utilises: {} };

    L.stats = function (P) { return { texte: '🎨 ' + P.score + ' pts' }; };

    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.6;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#8338ec', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }

    async function partie() {
      L.initialiser({ score: 0, traits: [], fini: false, resultat: null, votes: 0, gain: 0, ia: 0 });
      S.phase = 'titre'; S.t0 = F.t; S.fin2 = null; S.manche = 0;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '🎨', titre: 'Le Défi Dessin', texte: chef.nom + ' choisit le nombre de manches…' }, chef);
      var n = await L.demander(chef, {
        emoji: '🎨', titre: 'Le Défi Dessin', texte: 'Combien de manches ?',
        boutons: [{ id: '3', label: '3 manches' }, { id: '5', label: '5 manches' }, { id: '8', label: '8 manches' }]
      }, '3', 60);
      S.nbManches = window.DESSIN_MANCHES || +n;
      F.musique(null);
      for (S.manche = 1; S.manche <= S.nbManches && !L.arrete; S.manche++) await manche();
      if (!L.arrete) await finale();
    }

    function choisirMot() {
      var libres = MOTS.filter(function (m) { return !S.utilises[m]; });
      if (!libres.length) { S.utilises = {}; libres = MOTS; }
      var m = F.choisir(libres);
      S.utilises[m] = true;
      return { fr: m };
    }

    async function manche() {
      S.mot = choisirMot();
      S.revele = null; S.galerie = null;
      L.joueurs.forEach(function (P) { P.traits = []; P.fini = false; P.resultat = null; P.votes = 0; P.gain = 0; P.ia = 0; });
      S.phase = 'annonce';
      L.uiTous({ emoji: '👀', titre: 'Manche ' + S.manche, texte: 'Regarde la télé…' });
      await banniere('Manche ' + S.manche + ' / ' + S.nbManches, 'Dessinez : ' + S.mot.fr, '#8338ec', 2.6);
      // dessin
      S.phase = 'dessin';
      S.fin = F.t + DUREE / F.V;
      F.musique('minijeu');
      await Promise.all(L.joueurs.map(function (P) {
        var ui = { titre: 'Dessine : ' + S.mot.fr, dessin: {}, boutons: [{ id: 'fini', label: '✅ J\'ai fini !' }] };
        var p = L.demander(P, ui, 'temps', DUREE);
        P.cle = ui.cle;
        return p.then(function (r) {
          P.fini = true;
          if (r === 'fini') F.son.pop();
          if (!L.arrete && L.joueurs.some(function (Q) { return !Q.fini; })) L.ui(P, { emoji: '⏳', titre: 'Bien joué !', texte: 'On attend les autres dessinateurs…' });
        });
      }));
      if (L.arrete) return;
      F.musique(null);
      F.son.cymbale();
      L.uiTous({ emoji: '🖼️', titre: 'Exposition !', texte: 'Regarde les dessins sur la télé…' });
      S.phase = 'revele';
      for (var i = 0; i < L.joueurs.length && !L.arrete; i++) {
        S.revele = { P: L.joueurs[i], t0: F.t };
        F.son.surprise();
        await F.attendre(4);
      }
      S.revele = null;
      // votes (chacun vote pour un autre)
      S.phase = 'galerie';
      S.galerie = { t0: F.t };
      {
        await Promise.all(L.joueurs.map(function (P) {
          var autres = L.joueurs.filter(function (Q) { return Q !== P; });
          return L.demander(P, {
            emoji: '🗳️', titre: 'Vote pour le meilleur dessin', texte: 'Tu ne peux pas voter pour toi !',
            boutons: autres.map(function (Q) { return { id: String(Q.num), label: 'Le dessin de ' + Q.nom, couleur: Q.couleur }; }), disposition: autres.length > 2 ? 'colonne' : 'colonne'
          }, 'aucun', 30).then(function (r) {
            var Q = L.joueurs.filter(function (x) { return String(x.num) === r; })[0];
            if (Q) { Q.votes++; F.son.pop(); }
            L.ui(P, { emoji: '✅', titre: 'Vote enregistré', texte: 'Résultats sur la télé…' });
          });
        }));
      }
      if (L.arrete) return;
      L.joueurs.forEach(function (P) { P.gain = 100 * P.votes; P.score += P.gain; });
      S.galerie.resultats = F.t;
      F.son.fanfare();
      var meilleur = L.joueurs.slice().sort(function (a, b) { return b.gain - a.gain; })[0];
      L.joueurs.forEach(function (P) { L.ui(P, { emoji: P === meilleur ? '🏆' : '🎨', titre: '+' + P.gain + ' points', texte: P.votes + ' vote' + (P.votes > 1 ? 's' : '') + ' · total : ' + P.score + ' points' }); });
      await F.attendre(6);
    }

    async function finale() {
      var ordre = F.classer(L.joueurs, 'score');
      S.phase = 'fin'; S.fin2 = { ordre: ordre, t0: F.t };
      F.musique('final'); F.son.cymbale(); F.son.fanfare();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '🎨', titre: P.rang === 1 ? 'Meilleur artiste !' : F.texteRang(P.rang) + ' place', texte: P.score + ' points',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    function feuille(c, P, x, y, taille, o) {
      o = o || {};
      c.save();
      c.translate(x, y); c.rotate(o.rot || 0);
      c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -taille / 2 + 6, -taille / 2 + 10, taille, taille, 16); c.fill();
      c.fillStyle = '#fff'; F.rr(c, -taille / 2, -taille / 2, taille, taille, 16); c.fill();
      c.lineWidth = 6; c.strokeStyle = P.couleur; F.rr(c, -taille / 2, -taille / 2, taille, taille, 16); c.stroke();
      c.beginPath(); c.rect(-taille / 2 + 4, -taille / 2 + 4, taille - 8, taille - 8); c.clip();
      c.lineCap = 'round'; c.lineJoin = 'round';
      var e = taille - 8, ox = -taille / 2 + 4, oy = -taille / 2 + 4;
      P.traits.forEach(function (t) {
        c.strokeStyle = t.c; c.lineWidth = Math.max(1.5, t.w * e);
        c.beginPath();
        t.p.forEach(function (q, i) { if (i) c.lineTo(ox + q[0] * e, oy + q[1] * e); else c.moveTo(ox + q[0] * e, oy + q[1] * e); });
        if (t.p.length === 1) c.lineTo(ox + t.p[0][0] * e + 0.5, oy + t.p[0][1] * e);
        c.stroke();
      });
      if (!P.traits.length) F.texte(c, '(feuille blanche)', 0, 0, taille * 0.08, '#adb5bd', { contour: false });
      c.restore();
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt); L.verifier(dt); S.particules.maj(dt);
      F.virtuel(c, W, H, '#1a0b2e');
      var g = c.createLinearGradient(0, 0, 1600, 900); g.addColorStop(0, '#3a0ca3'); g.addColorStop(1, '#7209b7');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      // gribouillis de fond
      c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 6; c.lineCap = 'round';
      for (var i = 0; i < 8; i++) { c.beginPath(); for (var k = 0; k < 6; k++) { var x = (i * 230 + k * 60) % 1700, y = 100 + i * 100 + Math.sin(k + i + F.t * 0.5) * 30; if (k) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
      if (S.phase === 'titre') titre(c);
      else if (S.phase === 'annonce' || S.phase === 'dessin') ecranDessin(c);
      else if (S.phase === 'revele' && S.revele) ecranRevele(c);
      else if (S.phase === 'galerie') ecranGalerie(c);
      S.particules.dessiner(c);
      banniereDessin(c);
      if (S.fin2) fin(c);
      c.restore();
    }

    function ecranDessin(c) {
      F.texte(c, 'Manche ' + S.manche + ' / ' + S.nbManches, 800, 70, 34, '#e0aaff', { contour: false });
      F.texte(c, 'Dessinez…', 800, 160, 56, '#fff', { contour: false });
      F.texte(c, S.mot ? S.mot.fr.toUpperCase() : '', 800, 270, 110, '#ffd166', { contour: '#3a0ca3', epaisseur: 14 });
      if (S.phase === 'dessin') {
        var reste = Math.max(0, Math.ceil((S.fin - F.t) * F.V));
        var q = reste / DUREE;
        c.fillStyle = 'rgba(0,0,0,.3)'; F.rr(c, 400, 360, 800, 30, 15); c.fill();
        c.fillStyle = reste <= 10 ? '#ff006e' : '#06d6a0'; F.rr(c, 400, 360, Math.max(30, 800 * q), 30, 15); c.fill();
        F.texte(c, '⏱ ' + reste + ' s', 800, 440, 44, reste <= 10 ? '#ff4d6d' : '#fff', { contour: false });
        // les joueurs : feuille cachée + nombre de traits
        var n = L.joueurs.length;
        L.joueurs.forEach(function (P, k) {
          var x = 800 + (k - (n - 1) / 2) * 320, y = 650;
          c.save(); c.translate(x, y); c.rotate(Math.sin(F.t * 2 + k) * 0.03);
          c.fillStyle = '#fff'; F.rr(c, -110, -110, 220, 220, 16); c.fill();
          c.lineWidth = 6; c.strokeStyle = P.couleur; F.rr(c, -110, -110, 220, 220, 16); c.stroke();
          F.texte(c, P.fini ? '✅' : '✏️', 0, -10 + (P.fini ? 0 : Math.sin(F.t * 8 + k) * 6), 70, '#000', { contour: false });
          F.texte(c, P.traits.length + ' trait' + (P.traits.length > 1 ? 's' : ''), 0, 70, 22, '#6c757d', { contour: false });
          c.restore();
          F.texte(c, P.nom, x, y + 145, 32, '#fff', { contour: false });
        });
      }
    }

    function ecranRevele(c) {
      var r = S.revele, P = r.P, t = (F.t - r.t0) * F.V;
      F.texte(c, 'Le dessin de ' + P.nom, 800, 70, 56, '#fff', { contour: false });
      F.texte(c, 'Le mot : ' + S.mot.fr, 800, 130, 32, '#ffd166', { contour: false });
      var e = F.ease.back(Math.min(1, t / 0.5));
      c.save(); c.translate(800, 510); c.scale(e, e); feuille(c, P, 0, 0, 640, { rot: -0.02 }); c.restore();
    }

    function ecranGalerie(c) {
      var g = S.galerie, n = L.joueurs.length;
      F.texte(c, S.galerie.resultats ? 'Résultats de la manche' : 'Votez pour le meilleur dessin !', 800, 70, 52, '#fff', { contour: false });
      F.texte(c, 'Le mot : ' + S.mot.fr, 800, 125, 30, '#ffd166', { contour: false });
      var taille = n <= 2 ? 420 : n === 3 ? 380 : 330;
      L.joueurs.forEach(function (P, k) {
        var x = 800 + (k - (n - 1) / 2) * (taille + 40), y = 440;
        feuille(c, P, x, y, taille, { rot: (k % 2 ? 1 : -1) * 0.025 });
        F.texte(c, P.nom, x, y + taille / 2 + 40, 34, '#fff', { contour: false });
        if (g.resultats) {
          var q = F.ease.back(Math.min(1, (F.t - g.resultats) * F.V / 0.5));
          c.save(); c.translate(x + taille / 2 - 20, y - taille / 2 + 10); c.scale(q, q);
          c.fillStyle = '#ffd166'; c.beginPath(); c.arc(0, 0, 54, 0, 7); c.fill();
          F.texte(c, '+' + P.gain, 0, -6, 32, '#1b1b2f', { contour: false });
          F.texte(c, P.votes + ' vote' + (P.votes > 1 ? 's' : ''), 0, 24, 16, '#1b1b2f', { contour: false });
          c.restore();
        } else if (L.enAttente(P)) F.texte(c, '🗳️ vote…', x, y + taille / 2 + 84, 24, '#fff', { contour: false });
      });
    }

    function banniereDessin(c) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0;
      if (t > b.duree) { S.banniere = null; return; }
      var e = Math.min(1, t * F.V / 0.3), s = Math.max(0, (t - (b.duree - 0.3 / F.V)) * F.V / 0.3), h = b.sous ? 170 : 120;
      c.save(); c.globalAlpha = 1 - s; c.translate(800, 450); c.scale(F.ease.back(e), F.ease.back(e));
      c.fillStyle = b.couleur; F.rr(c, -620, -h / 2, 1240, h, 30); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#fff'; F.rr(c, -620, -h / 2, 1240, h, 30); c.stroke();
      F.texte(c, b.texte, 0, b.sous ? -28 : 0, 58, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 8 });
      if (b.sous) F.texte(c, b.sous, 0, 42, 44, '#ffd166', { contour: false });
      c.restore();
    }

    function titre(c) {
      var t = F.t - S.t0;
      F.texte(c, 'Le Défi Dessin', 800, 220 + Math.sin(t * 2) * 8, 130, '#ffd166', { contour: '#3a0ca3', epaisseur: 18 });
      F.texte(c, 'Un mot, tout le monde dessine sur son téléphone… et vous votez pour le meilleur !', 800, 330, 32, '#fff', { contour: false });
      c.save(); c.translate(800, 560); c.rotate(Math.sin(t * 2) * 0.15 - 0.6);
      c.fillStyle = '#ffd166'; c.fillRect(-30, -160, 60, 260);
      c.fillStyle = '#ff006e'; c.fillRect(-30, -190, 60, 40);
      c.fillStyle = '#f4d3a1'; c.beginPath(); c.moveTo(-30, 100); c.lineTo(30, 100); c.lineTo(0, 170); c.fill();
      c.fillStyle = '#1b1b2f'; c.beginPath(); c.moveTo(-9, 149); c.lineTo(9, 149); c.lineTo(0, 170); c.fill();
      c.restore();
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit le nombre de manches sur son téléphone…', 800, 790, 30, '#ffd166', { contour: false });
    }

    function fin(c) {
      var f = S.fin2, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(26,11,46,' + 0.92 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, f.ordre[0].nom + ' est le meilleur artiste !', 800, 140, 70, '#ffd166', { contour: '#3a0ca3', epaisseur: 12 });
      f.ordre.forEach(function (P, k) {
        var y = 250 + k * 130;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.12)'; F.rr(c, 300, y, 1000, 110, 26); c.fill();
        var col = P.rang === 1 ? '#1b1b2f' : '#fff';
        F.texte(c, F.texteRang(P.rang), 370, y + 55, 46, col, { contour: false });
        c.fillStyle = P.couleur; c.beginPath(); c.arc(470, y + 55, 24, 0, 7); c.fill();
        F.texte(c, P.nom, 520, y + 55, 46, col, { align: 'left', contour: false });
        F.texte(c, P.score + ' pts', 1260, y + 55, 42, col, { align: 'right', contour: false });
      });
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
    }

    partie().catch(function (e) { console.error('Dessin :', e); });

    return {
      image: image,
      message: function (j, m) {
        if (L.recevoir(j, m)) return;
        var P = L.PDe(j);
        if (!P || S.phase !== 'dessin' || P.fini || (m.cle && m.cle !== P.cle)) return;
        if (m.t === 'trait' && m.trait && Array.isArray(m.trait.p) && P.traits.length < 400) {
          var t = m.trait;
          P.traits.push({ c: /^#[0-9a-f]{6}$/i.test(t.c) ? t.c : '#1b1b2f', w: F.borne(+t.w || 0.012, 0.003, 0.05), p: t.p.slice(0, 2000).map(function (q) { return [F.borne(+q[0] || 0, 0, 1), F.borne(+q[1] || 0, 0, 1)]; }) });
        } else if (m.t === 'annuler') P.traits.pop();
        else if (m.t === 'effacer') P.traits = [];
      },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'dessin', nom: 'Le Défi Dessin', emoji: '🎨',
    description: 'Tout le monde dessine le même mot sur son téléphone, puis vous votez pour le meilleur dessin !',
    min: 2, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
