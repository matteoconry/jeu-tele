/*
 * Le Petit Bac — 2 à 8 joueurs.
 * Une lettre et 6 catégories tirées au hasard. Chacun remplit sa liste en secret sur son téléphone.
 * Le premier qui a tout rempli dit « STOP ! » : les autres ont encore quelques secondes.
 * Puis la télé dévoile les réponses, chacun peut contester celles des autres (👍 / 👎),
 * et on compte : 2 points pour un mot que personne d'autre n'a trouvé, 1 point s'il est partagé, 0 sinon.
 * Hooks de test : BAC_MANCHES (nombre de manches), BAC_COMPTE (secondes après le STOP).
 */
(function (F) {
  'use strict';
  var NB_CATEGORIES = 6;
  var COMPTE = window.BAC_COMPTE || 10;   // secondes laissées aux autres après le STOP
  var DUREE_VOTE = 90;
  var LETTRES = 'ABCDEFGHIJLMNOPRSTUV'.split(''); // sans K, Q, W, X, Y, Z (trop dures)
  var CATEGORIES = [
    'Prénom', 'Pays', 'Ville', 'Animal', 'Fruit ou légume', 'Métier', 'Sport', 'Marque',
    'Objet de la maison', 'Plat ou aliment', 'Vêtement ou accessoire', 'Moyen de transport', 'Instrument de musique',
    'Partie du corps', 'Célébrité', 'Personnage de fiction', 'Film ou série', 'Chanteur ou groupe', 'Plante ou fleur',
    'Boisson', 'Dessert ou sucrerie', 'Jeu ou jouet', 'Outil', 'Couleur', 'Verbe', 'Adjectif', 'Mot anglais',
    'Chose qu\'on trouve à l\'école', 'Chose qu\'on emporte en voyage', 'Chose qui pique', 'Chose ronde',
    'Super-héros ou méchant', 'Monument ou lieu célèbre', 'Personnage historique', 'Dessin animé', 'Cadeau', 'Insulte gentille',
    'Chose qu\'on trouve dans un frigo', 'Loisir ou passion', 'Prénom de garçon', 'Prénom de fille', 'Département ou région'
  ];
  var ENCRE = '#1d3557', ROUGE = '#e63946', VERT = '#2a9d8f', PAPIER = '#fdfaf2';

  // Comparaison des mots : sans accents, sans majuscules, sans tirets ni apostrophes.
  function norme(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function bonneLettre(mot, lettre) { var n = norme(mot); return n.length >= 2 && n.charAt(0) === lettre.toLowerCase(); }

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = {
      phase: 'titre', t0: F.t, manche: 0, nbManches: 3, lettre: '', categories: [], stop: null, roulette: null,
      correction: null, fin2: null, particules: new F.Particules(), lettresVues: {}, pioche: [], cle: 0
    };
    var fermer = null; // termine la phase d'écriture

    L.stats = function (P) { return { texte: '📝 ' + P.score + ' pts' }; };

    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.6;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || ENCRE, t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }

    async function partie() {
      L.initialiser({ score: 0, reponses: [], seche: false, gainManche: 0, cles: [], points: [], refus: [] });
      S.phase = 'titre'; S.t0 = F.t; S.fin2 = null; S.manche = 0; S.lettresVues = {};
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '📝', titre: 'Le Petit Bac', texte: chef.nom + ' choisit le nombre de manches…' }, chef);
      var n = await L.demander(chef, {
        emoji: '📝', titre: 'Le Petit Bac', texte: 'Combien de manches ?',
        boutons: [{ id: '3', label: '3 manches' }, { id: '5', label: '5 manches' }, { id: '10', label: '10 manches' }]
      }, '3', 60);
      if (L.arrete) return;
      S.nbManches = window.BAC_MANCHES || +n || 3;
      F.musique(null);
      for (S.manche = 1; S.manche <= S.nbManches && !L.arrete; S.manche++) await manche();
      if (!L.arrete) await finale();
    }

    function tirerLettre() {
      var libres = LETTRES.filter(function (l) { return !S.lettresVues[l]; });
      if (!libres.length) { S.lettresVues = {}; libres = LETTRES; }
      var l = F.choisir(libres);
      S.lettresVues[l] = true;
      return l;
    }
    function tirerCategories() {
      if (S.pioche.length < NB_CATEGORIES) S.pioche = S.pioche.concat(F.melanger(CATEGORIES.filter(function (c) { return S.pioche.indexOf(c) === -1; })));
      return S.pioche.splice(0, NB_CATEGORIES);
    }

    async function manche() {
      S.lettre = ''; S.categories = []; S.stop = null; S.correction = null;
      L.joueurs.forEach(function (P) { P.reponses = []; P.seche = false; P.gainManche = 0; P.points = []; P.refus = []; });
      L.uiTous({ emoji: '👀', titre: 'Manche ' + S.manche, texte: 'Regarde la télé : tirage de la lettre…' });
      S.phase = 'annonce';
      await banniere('Manche ' + S.manche + ' / ' + S.nbManches, 'Tirage de la lettre…', ENCRE, 1.8);
      if (L.arrete) return;
      // Roulette de lettres
      S.phase = 'tirage';
      var lettre = tirerLettre();
      S.roulette = { t0: F.t, fin: null, affichee: F.choisir(LETTRES) };
      F.son.roulement(2.2);
      var delai = 0.05;
      for (var t = 0; t < 2.4 && !L.arrete; t += delai, delai *= 1.12) {
        S.roulette.affichee = F.choisir(LETTRES.filter(function (x) { return x !== S.roulette.affichee; }));
        F.son.tic();
        await F.attendre(delai);
      }
      if (L.arrete) return;
      S.roulette.affichee = lettre; S.roulette.fin = F.t;
      S.lettre = lettre;
      F.son.deStop();
      S.particules.gerbe(800, 380, 40, { couleurs: [ROUGE, ENCRE, '#ffd166', VERT], haut: 300, vmax: 500, g: 700 });
      await F.attendre(1.4);
      // Les catégories arrivent une par une
      S.categories = tirerCategories();
      S.apparition = F.t;
      for (var k = 0; k < S.categories.length; k++) { F.son.pop(); await F.attendre(0.18); }
      await F.attendre(0.8);
      if (L.arrete) return;
      await ecriture();
      if (L.arrete) return;
      await correction();
    }

    // ---------- Écriture ----------
    function uiEcriture(P) {
      return {
        cle: P.cleBac,
        bac: {
          lettre: S.lettre, manche: 'Manche ' + S.manche + ' / ' + S.nbManches, categories: S.categories,
          reponses: P.reponses, seche: P.seche,
          bandeau: S.stop && S.stop.P !== P ? { texte: '✋ ' + S.stop.P.nom + ' a dit STOP !', reste: Math.max(0, (S.stop.fin - F.t) * F.V) } : null
        }
      };
    }
    function nbBons(P) {
      var n = 0;
      for (var i = 0; i < S.categories.length; i++) if (bonneLettre(P.reponses[i], S.lettre)) n++;
      return n;
    }
    function complet(P) { return nbBons(P) === S.categories.length; }

    function ecriture() {
      S.phase = 'ecriture'; S.t0 = F.t;
      F.musique('minijeu');
      L.joueurs.forEach(function (P) {
        P.cleBac = 'bac' + (++S.cle);
        P.reponses = S.categories.map(function () { return ''; });
        L.ui(P, uiEcriture(P));
      });
      return new Promise(function (ok) { fermer = ok; });
    }

    function direStop(P) {
      if (S.stop || S.phase !== 'ecriture' || !complet(P)) return;
      S.stop = { P: P, t0: F.t, fin: F.t + COMPTE / F.V };
      F.musique(null);
      F.son.buzz(); F.son.cymbale();
      L.ui(P, { emoji: '✋', titre: 'STOP !', texte: 'Bien joué ! Les autres ont encore ' + COMPTE + ' secondes…' });
      L.joueurs.forEach(function (Q) {
        if (Q === P) return;
        if (Q.ui) Q.ui.bac.bandeau = { texte: '✋ ' + P.nom + ' a dit STOP !', reste: COMPTE };
        var j = L.jDe(Q);
        if (j) api.envoyer(j, { t: 'bandeau', cle: Q.cleBac, texte: '✋ ' + P.nom + ' a dit STOP !', reste: COMPTE });
      });
    }

    function verifierEcriture() {
      if (S.phase !== 'ecriture' || !fermer) return;
      var fini = false;
      if (S.stop) {
        var reste = Math.ceil((S.stop.fin - F.t) * F.V);
        if (reste !== S.stop.dernier && reste > 0 && reste <= 5) F.son.compte();
        S.stop.dernier = reste;
        if (F.t >= S.stop.fin) fini = true;
      } else {
        // Plus personne n'écrit : tout le monde sèche (ou est parti).
        fini = L.joueurs.every(function (P) { return P.seche || !L.connecte(P); });
      }
      if (fini) {
        var f = fermer; fermer = null;
        S.phase = 'ramassage';
        f();
      }
    }

    // ---------- Correction ----------
    async function correction() {
      F.musique(null);
      F.son.cymbale();
      L.uiTous({ emoji: '📋', titre: 'On corrige !', texte: 'Regarde les réponses sur la télé…' });
      S.phase = 'correction';
      S.correction = { t0: F.t, votes: false, resultats: null };
      await F.attendre(2.2);
      if (L.arrete) return;
      // Refus automatiques : vide ou mauvaise lettre
      L.joueurs.forEach(function (P) {
        P.refus = S.categories.map(function (c, i) { return !bonneLettre(P.reponses[i], S.lettre); });
        P.contre = S.categories.map(function () { return 0; });
      });
      // Vote : chacun peut contester les réponses des autres
      S.correction.votes = true;
      var aVoter = L.joueurs.filter(function (P) { return L.connecte(P); });
      await Promise.all(aVoter.map(function (P) {
        var liste = [];
        S.categories.forEach(function (cat, i) {
          L.joueurs.forEach(function (Q) {
            if (Q === P || Q.refus[i]) return;
            liste.push({ id: String(Q.num * 100 + i), groupe: cat, texte: Q.reponses[i].trim(), sous: Q.nom, couleur: Q.couleur });
          });
        });
        P.aVote = false;
        return L.demander(P, {
          titre: 'Contrôle des copies', texte: 'Touche un mot pour le refuser (👎), puis valide.',
          bascules: liste, boutons: [{ id: 'ok', label: '✅ Valider' }]
        }, 'temps', DUREE_VOTE).then(function (r) {
          P.aVote = true;
          if (r === 'ok') (P.sel || []).forEach(function (id) {
            var Q = L.joueurs.filter(function (x) { return x.num === Math.floor(id / 100); })[0], i = id % 100;
            if (Q && Q !== P && i < S.categories.length) Q.contre[i]++;
          });
          F.son.pop();
          if (!L.arrete && L.joueurs.some(function (Q) { return L.enAttente(Q); })) L.ui(P, { emoji: '⏳', titre: 'Merci !', texte: 'On attend les autres correcteurs…' });
        });
      }));
      if (L.arrete) return;
      S.correction.votes = false;
      // Refus par vote : plus de la moitié des autres joueurs ont dit 👎
      L.joueurs.forEach(function (P) {
        var autres = aVoter.filter(function (Q) { return Q !== P; }).length;
        P.contre.forEach(function (n, i) { if (n > 0 && n * 2 > autres) P.refus[i] = 'vote'; });
      });
      // Points : 2 si unique, 1 si partagé
      L.joueurs.forEach(function (P) { P.points = []; P.gainManche = 0; });
      S.categories.forEach(function (cat, i) {
        var compte = {};
        L.joueurs.forEach(function (P) { if (!P.refus[i]) { var n = norme(P.reponses[i]); compte[n] = (compte[n] || 0) + 1; } });
        L.joueurs.forEach(function (P) {
          var pts = P.refus[i] ? 0 : compte[norme(P.reponses[i])] > 1 ? 1 : 2;
          P.points[i] = pts; P.gainManche += pts;
        });
      });
      L.joueurs.forEach(function (P) { P.score += P.gainManche; });
      S.correction.resultats = F.t;
      F.son.fanfare();
      var meilleur = Math.max.apply(null, L.joueurs.map(function (P) { return P.gainManche; }));
      L.joueurs.forEach(function (P) {
        var refuses = P.refus.filter(function (r) { return r === 'vote'; }).length;
        L.ui(P, {
          emoji: P.gainManche === meilleur && meilleur > 0 ? '🏆' : '📝', titre: '+' + P.gainManche + ' point' + (P.gainManche > 1 ? 's' : ''),
          texte: (refuses ? refuses + ' mot' + (refuses > 1 ? 's' : '') + ' refusé' + (refuses > 1 ? 's' : '') + ' par les autres · ' : '') + 'total : ' + P.score + ' points'
        });
      });
      await F.attendre(4 + L.joueurs.length * 0.6);
      if (L.arrete) return;
      if (S.manche < S.nbManches) {
        S.phase = 'scores'; S.t0 = F.t;
        await F.attendre(4);
      }
    }

    async function finale() {
      var ordre = F.classer(L.joueurs, 'score');
      S.phase = 'fin'; S.fin2 = { ordre: ordre, t0: F.t };
      F.musique('final'); F.son.cymbale(); F.son.fanfare();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '📝', titre: P.rang === 1 ? 'Champion du Petit Bac !' : F.texteRang(P.rang) + ' place', texte: P.score + ' points',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    function papier(c) {
      c.fillStyle = PAPIER; c.fillRect(0, 0, 1600, 900);
      c.strokeStyle = 'rgba(69,123,157,.18)'; c.lineWidth = 2;
      for (var x = 0; x <= 1600; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 900); c.stroke(); }
      for (var y = 0; y <= 900; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(1600, y); c.stroke(); }
      c.strokeStyle = 'rgba(230,57,70,.55)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(100, 0); c.lineTo(100, 900); c.stroke();
    }

    // Texte rétréci pour tenir dans une largeur.
    function texteAjuste(c, txt, x, y, largeur, taille, couleur, opts) {
      opts = opts || {};
      c.font = (opts.poids || 700) + ' ' + taille + 'px ' + F.POLICE;
      var w = c.measureText(txt).width;
      if (w > largeur) taille = Math.max(12, taille * largeur / w);
      F.texte(c, txt, x, y, taille, couleur, { contour: false, align: opts.align, poids: opts.poids });
      return taille;
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt); L.verifier(dt); S.particules.maj(dt);
      verifierEcriture();
      F.virtuel(c, W, H, PAPIER);
      papier(c);
      if (S.phase === 'titre') titre(c);
      else if (S.phase === 'tirage' || S.phase === 'ecriture' || S.phase === 'ramassage') ecranLettre(c);
      else if (S.phase === 'correction') ecranCorrection(c);
      else if (S.phase === 'scores') ecranScores(c);
      S.particules.dessiner(c);
      banniereDessin(c);
      if (S.fin2) fin(c);
      c.restore();
    }

    function bulleLettre(c, x, y, r, lettre, t) {
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.5) * 0.04);
      c.fillStyle = 'rgba(29,53,87,.18)'; c.beginPath(); c.arc(8, 12, r, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      c.lineWidth = 10; c.strokeStyle = ROUGE; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
      F.texte(c, lettre, 0, r * 0.06, r * 1.3, ENCRE, { contour: false, poids: 700 });
      c.restore();
    }

    function ecranLettre(c) {
      F.texte(c, 'Manche ' + S.manche + ' / ' + S.nbManches, 140, 50, 34, ROUGE, { contour: false, align: 'left' });
      var r = S.roulette, t = F.t;
      var cats = S.categories.length > 0;
      // Pendant le tirage la lettre est au centre, ensuite elle glisse à gauche.
      var p = cats ? F.ease.inOut(Math.min(1, (F.t - S.apparition) * F.V / 0.6)) : 0;
      var x = F.lerp(800, 340, p), y = F.lerp(420, 330, p), rayon = F.lerp(230, 180, p);
      var lettre = S.lettre || (r ? r.affichee : '?');
      var pop = r && r.fin ? 1 + 0.25 * Math.max(0, 1 - (F.t - r.fin) * F.V * 3) : 1;
      c.save(); c.translate(x, y); c.scale(pop, pop); bulleLettre(c, 0, 0, rayon, lettre, t); c.restore();
      if (!cats) {
        F.texte(c, S.lettre ? 'La lettre est…  ' + S.lettre + ' !' : 'Tirage de la lettre…', 800, 760, 54, ENCRE, { contour: false });
        return;
      }
      // Catégories
      S.categories.forEach(function (cat, k) {
        var q = Math.min(1, Math.max(0, ((F.t - S.apparition) * F.V - k * 0.18) / 0.3));
        if (q <= 0) return;
        var yy = 120 + k * 72;
        c.save(); c.globalAlpha = q; c.translate((1 - q) * 60, 0);
        F.texte(c, (k + 1) + '.', 660, yy, 40, ROUGE, { contour: false, align: 'right' });
        texteAjuste(c, cat, 680, yy, 820, 42, ENCRE, { align: 'left' });
        c.strokeStyle = 'rgba(29,53,87,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(620, yy + 32); c.lineTo(1520, yy + 32); c.stroke();
        c.restore();
      });
      if (S.phase === 'tirage') return;
      F.texte(c, 'Remplissez votre liste sur le téléphone !', 340, 560, 30, ENCRE, { contour: false });
      // Avancement de chacun (sans montrer les mots)
      var n = L.joueurs.length, parLigne = n <= 4 ? n : Math.ceil(n / 2), lignes = n <= 4 ? 1 : 2;
      var lw = Math.min(360, 1440 / parLigne), lh = lignes === 1 ? 150 : 104;
      L.joueurs.forEach(function (P, k) {
        var col = k % parLigne, lig = Math.floor(k / parLigne);
        var nl = lig === lignes - 1 ? n - lig * parLigne : parLigne;
        var cx = 800 + (col - (nl - 1) / 2) * lw, cy = (lignes === 1 ? 720 : 660) + lig * (lh + 12);
        var bons = nbBons(P);
        c.fillStyle = '#fff'; F.rr(c, cx - lw / 2 + 10, cy - lh / 2, lw - 20, lh, 18); c.fill();
        c.lineWidth = 5; c.strokeStyle = P.couleur; F.rr(c, cx - lw / 2 + 10, cy - lh / 2, lw - 20, lh, 18); c.stroke();
        var etat = S.stop && S.stop.P === P ? ' ✋' : P.seche ? ' 🏳️' : !L.connecte(P) ? ' 📵' : '';
        texteAjuste(c, P.nom + etat, cx, cy - lh / 2 + 32, lw - 50, 30, ENCRE);
        // une case par catégorie
        var m = S.categories.length, cw = Math.min(40, (lw - 60) / m);
        for (var i = 0; i < m; i++) {
          var bx = cx + (i - (m - 1) / 2) * (cw + 6), by = cy + (lignes === 1 ? 22 : 16);
          var ok = bonneLettre(P.reponses[i], S.lettre);
          c.fillStyle = ok ? P.couleur : 'rgba(29,53,87,.12)'; F.rr(c, bx - cw / 2, by - cw / 2, cw, cw, 8); c.fill();
          if (ok) F.texte(c, '✓', bx, by + 2, cw * 0.7, ENCRE, { contour: false });
        }
        if (lignes === 1) F.texte(c, bons + ' / ' + m, cx, cy + lh / 2 - 20, 22, 'rgba(29,53,87,.7)', { contour: false });
      });
      // STOP !
      if (S.stop) {
        var a = (F.t - S.stop.t0) * F.V, e = F.ease.back(Math.min(1, a / 0.4));
        var reste = Math.max(0, Math.ceil((S.stop.fin - F.t) * F.V));
        c.save(); c.translate(1150, 470); c.rotate(-0.12); c.scale(e, e);
        c.fillStyle = 'rgba(230,57,70,.95)'; F.rr(c, -330, -110, 660, 220, 30); c.fill();
        c.lineWidth = 8; c.strokeStyle = '#fff'; F.rr(c, -315, -95, 630, 190, 22); c.stroke();
        F.texte(c, 'STOP ! ' + reste, 0, -20, 96, '#fff', { contour: false });
        texteAjuste(c, S.stop.P.nom + ' a tout rempli', 0, 58, 560, 34, '#fff');
        c.restore();
      }
    }

    function ecranCorrection(c) {
      var cor = S.correction, n = L.joueurs.length, m = S.categories.length;
      F.texte(c, 'Lettre ' + S.lettre + ' · Manche ' + S.manche + ' / ' + S.nbManches, 140, 46, 32, ROUGE, { contour: false, align: 'left' });
      var titreTxt = cor.resultats ? 'Résultats de la manche' : cor.votes ? 'Contestez les mots douteux sur vos téléphones !' : 'On dévoile les copies…';
      texteAjuste(c, titreTxt, 1580, 46, 960, 38, ENCRE, { align: 'right' });
      // Grille : une ligne par joueur, une colonne par catégorie, + points de la manche
      var x0 = 120, nomW = 200, ptsW = cor.resultats ? 120 : 0, x1 = 1580;
      var colW = (x1 - x0 - nomW - ptsW) / m;
      var y0 = 100, hTete = 70, rowH = Math.min(150, (880 - y0 - hTete) / n);
      c.fillStyle = 'rgba(255,255,255,.85)'; F.rr(c, x0, y0, x1 - x0, hTete + rowH * n, 18); c.fill();
      for (var i = 0; i < m; i++) {
        var cx = x0 + nomW + i * colW + colW / 2;
        c.save(); c.beginPath(); c.rect(cx - colW / 2 + 4, y0, colW - 8, hTete); c.clip();
        F.texteMultiligne(c, S.categories[i], cx, y0 + hTete / 2, colW - 14, S.categories[i].length > 14 ? 20 : 24, ROUGE, { centrerV: true, interligne: 1.05 });
        c.restore();
      }
      if (ptsW) F.texte(c, 'Points', x1 - ptsW / 2, y0 + hTete / 2, 26, ROUGE, { contour: false });
      c.strokeStyle = 'rgba(29,53,87,.35)'; c.lineWidth = 2;
      for (i = 0; i <= m; i++) { var lx = x0 + nomW + i * colW; c.beginPath(); c.moveTo(lx, y0 + 8); c.lineTo(lx, y0 + hTete + rowH * n - 8); c.stroke(); }
      var revele = (F.t - cor.t0) * F.V;
      L.joueurs.forEach(function (P, k) {
        var y = y0 + hTete + k * rowH, cy = y + rowH / 2;
        c.strokeStyle = 'rgba(29,53,87,.25)'; c.beginPath(); c.moveTo(x0 + 10, y); c.lineTo(x1 - 10, y); c.stroke();
        c.fillStyle = P.couleur; c.beginPath(); c.arc(x0 + 26, cy, 12, 0, 7); c.fill();
        texteAjuste(c, P.nom, x0 + 46, cy, nomW - 54, Math.min(32, rowH * 0.42), ENCRE, { align: 'left' });
        if (cor.votes && L.enAttente(P)) F.texte(c, '🗳️', x0 + nomW - 18, cy - rowH * 0.3, 20, ENCRE, { contour: false });
        for (var i = 0; i < m; i++) {
          if (revele < 0.3 + (k * m + i) * 0.03) continue;
          var cx = x0 + nomW + i * colW + colW / 2, mot = (P.reponses[i] || '').trim();
          var refus = P.refus && P.refus[i];
          var faux = mot && !bonneLettre(mot, S.lettre);
          var col = !mot ? 'rgba(29,53,87,.3)' : (faux || (cor.resultats && refus)) ? ROUGE : ENCRE;
          var taille = texteAjuste(c, mot || '—', cx, cy - (cor.resultats ? rowH * 0.1 : 0), colW - 18, Math.min(30, rowH * 0.4), col);
          if (mot && (faux || (cor.resultats && refus))) {
            c.font = '700 ' + taille + 'px ' + F.POLICE;
            var w = Math.min(colW - 18, c.measureText(mot).width);
            c.strokeStyle = ROUGE; c.lineWidth = 3; c.beginPath();
            c.moveTo(cx - w / 2, cy - (cor.resultats ? rowH * 0.1 : 0)); c.lineTo(cx + w / 2, cy - (cor.resultats ? rowH * 0.1 : 0)); c.stroke();
          }
          if (cor.resultats) {
            var q = F.ease.back(Math.min(1, Math.max(0, ((F.t - cor.resultats) * F.V - (i * 0.12 + k * 0.05)) / 0.4)));
            if (q > 0) {
              var pts = P.points[i], couleur = pts === 2 ? VERT : pts === 1 ? '#e9a400' : 'rgba(29,53,87,.35)';
              c.save(); c.translate(cx, cy + rowH * 0.28); c.scale(q, q);
              var lab = pts === 2 ? '+2' : pts === 1 ? '+1 (doublon)' : refus === 'vote' ? '0 · refusé' : '0';
              F.texte(c, lab, 0, 0, Math.min(20, rowH * 0.24), couleur, { contour: false });
              c.restore();
            }
          }
        }
        if (cor.resultats) {
          var q2 = Math.min(1, Math.max(0, ((F.t - cor.resultats) * F.V - 1.2) / 0.4));
          if (q2 > 0) {
            c.save(); c.globalAlpha = q2;
            F.texte(c, '+' + P.gainManche, x1 - ptsW / 2, cy - rowH * 0.12, Math.min(40, rowH * 0.45), VERT, { contour: false });
            F.texte(c, P.score + ' pts', x1 - ptsW / 2, cy + rowH * 0.26, Math.min(20, rowH * 0.24), ENCRE, { contour: false });
            c.restore();
          }
        }
      });
      if (!cor.resultats && cor.votes) F.texte(c, 'Touchez un mot sur votre téléphone pour le refuser, puis validez.', 800, 880 - 10, 24, 'rgba(29,53,87,.7)', { contour: false, base: 'bottom' });
    }

    function ecranScores(c) {
      var ordre = F.classer(L.joueurs, 'score'), n = ordre.length;
      F.texte(c, 'Classement après ' + S.manche + ' manche' + (S.manche > 1 ? 's' : ''), 800, 90, 56, ENCRE, { contour: false });
      F.texte(c, 'Encore ' + (S.nbManches - S.manche) + ' manche' + (S.nbManches - S.manche > 1 ? 's' : '') + '…', 800, 150, 30, ROUGE, { contour: false });
      var h = Math.min(90, 680 / n);
      ordre.forEach(function (P, k) {
        var q = F.ease.out(Math.min(1, Math.max(0, ((F.t - S.t0) * F.V - k * 0.1) / 0.4)));
        var y = 200 + k * h;
        c.save(); c.globalAlpha = q; c.translate((1 - q) * -80, 0);
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.9)' : 'rgba(255,255,255,.9)'; F.rr(c, 360, y, 880, h - 12, 18); c.fill();
        c.lineWidth = 4; c.strokeStyle = P.couleur; F.rr(c, 360, y, 880, h - 12, 18); c.stroke();
        var cy = y + (h - 12) / 2, t = Math.min(40, h * 0.45);
        F.texte(c, F.texteRang(P.rang), 420, cy, t, ROUGE, { contour: false });
        texteAjuste(c, P.nom, 480, cy, 480, t, ENCRE, { align: 'left' });
        F.texte(c, '+' + P.gainManche, 1040, cy, t * 0.8, VERT, { contour: false });
        F.texte(c, P.score + ' pts', 1210, cy, t, ENCRE, { contour: false, align: 'right' });
        c.restore();
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
      F.texte(c, b.texte, 0, b.sous ? -28 : 0, 58, '#fff', { contour: false });
      if (b.sous) F.texte(c, b.sous, 0, 42, 40, '#ffd166', { contour: false });
      c.restore();
    }

    function titre(c) {
      var t = F.t - S.t0;
      F.texte(c, 'Le Petit Bac', 800, 200 + Math.sin(t * 2) * 6, 140, ENCRE, { contour: false });
      c.strokeStyle = ROUGE; c.lineWidth = 8; c.beginPath(); c.moveTo(420, 290); c.quadraticCurveTo(800, 320, 1180, 285); c.stroke();
      F.texte(c, 'Une lettre, des catégories : le premier qui a tout rempli crie STOP !', 800, 370, 32, ENCRE, { contour: false });
      'BAC'.split('').forEach(function (l, k) { bulleLettre(c, 600 + k * 200, 560, 80, l, t + k); });
      F.texte(c, '2 points pour un mot unique · 1 point si quelqu\'un a le même · les autres peuvent refuser vos mots', 800, 710, 26, 'rgba(29,53,87,.75)', { contour: false });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit le nombre de manches sur son téléphone…', 800, 800, 30, ROUGE, { contour: false });
    }

    function fin(c) {
      var f = S.fin2, q = Math.min(1, (F.t - f.t0) * F.V / 0.5), n = f.ordre.length;
      c.fillStyle = 'rgba(253,250,242,' + 0.96 * q + ')'; c.fillRect(0, 0, 1600, 900);
      c.save(); c.globalAlpha = q;
      F.texte(c, f.ordre[0].nom + ' gagne le Petit Bac !', 800, 110, 66, ENCRE, { contour: false });
      var h = Math.min(120, 700 / n);
      f.ordre.forEach(function (P, k) {
        var y = 180 + k * h;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(29,53,87,.08)'; F.rr(c, 300, y, 1000, h - 14, 24); c.fill();
        var cy = y + (h - 14) / 2, t = Math.min(46, h * 0.42);
        F.texte(c, F.texteRang(P.rang), 370, cy, t, ROUGE, { contour: false });
        c.fillStyle = P.couleur; c.beginPath(); c.arc(470, cy, Math.min(24, h * 0.2), 0, 7); c.fill();
        texteAjuste(c, P.nom, 520, cy, 520, t, ENCRE, { align: 'left' });
        F.texte(c, P.score + ' pts', 1260, cy, t * 0.92, ENCRE, { align: 'right', contour: false });
      });
      c.restore();
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir([ROUGE, ENCRE, '#ffd166', VERT, '#4895ef']), forme: 'confetti' });
    }

    partie().catch(function (e) { console.error('Petit Bac :', e); });

    return {
      image: image,
      message: function (j, m) {
        if (L.recevoir(j, m)) return;
        var P = L.PDe(j);
        if (!P || S.phase !== 'ecriture' || m.cle !== P.cleBac) return;
        if (S.stop && S.stop.P === P) return; // a déjà dit STOP
        if (m.t === 'mot') {
          var i = +m.i;
          if (i >= 0 && i < S.categories.length) P.reponses[i] = String(m.mot || '').slice(0, 30);
        } else if (m.t === 'stop') direStop(P);
        else if (m.t === 'seche') { P.seche = !!m.oui; if (P.ui && P.ui.bac) P.ui.bac.seche = P.seche; }
      },
      arrivee: function (j) {
        var P = L.PDe(j);
        // Pendant l'écriture on renvoie la liste avec les mots déjà tapés et le compte à rebours à jour.
        if (P && S.phase === 'ecriture' && P.ui && P.ui.bac) { L.ui(P, uiEcriture(P)); return; }
        L.arrivee(j);
      },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'bac', vignette: 'assets/vignettes/bac.jpg', nom: 'Le Petit Bac', emoji: '📝',
    description: 'Une lettre, des catégories : remplissez votre liste sur le téléphone, le premier qui a fini crie STOP !',
    min: 2, max: 8, perso: true, barre: false, creer: creer
  });
})(Fiesta);
