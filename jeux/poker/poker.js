/*
 * Poker Texas Hold'em — 2 à 4 joueurs, avec des jetons pour rire (pas d'argent).
 * Chacun reçoit 2 cartes cachées sur son téléphone, 5 cartes communes au centre.
 * Blindes qui augmentent, relances, tapis, pots partagés. Le dernier avec des jetons gagne.
 */
(function (F) {
  'use strict';
  var C = F.Cartes;
  var DEPART = 1000;
  var NOMS_MAINS = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
  var NOMS_RANGS = ['', '', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valets', 'dames', 'rois', 'as'];
  var NOM_SEUL = ['', '', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valet', 'dame', 'roi', 'as'];

  // ---------- Évaluation des mains ----------
  function eval5(cs) {
    var r = cs.map(function (k) { return k.r === 1 ? 14 : k.r; }).sort(function (a, b) { return b - a; });
    var couleur = cs.every(function (k) { return k.s === cs[0].s; });
    var uniques = r.filter(function (x, i) { return r.indexOf(x) === i; });
    var haute = 0;
    if (uniques.length === 5) {
      if (r[0] - r[4] === 4) haute = r[0];
      else if (r[0] === 14 && r[1] === 5) haute = 5; // A-2-3-4-5
    }
    var nb = {}; r.forEach(function (x) { nb[x] = (nb[x] || 0) + 1; });
    var groupes = Object.keys(nb).map(Number).sort(function (a, b) { return nb[b] - nb[a] || b - a; });
    var formes = groupes.map(function (g) { return nb[g]; });
    if (haute && couleur) return [8, haute];
    if (formes[0] === 4) return [7].concat(groupes);
    if (formes[0] === 3 && formes[1] === 2) return [6].concat(groupes);
    if (couleur) return [5].concat(r);
    if (haute) return [4, haute];
    if (formes[0] === 3) return [3].concat(groupes);
    if (formes[0] === 2 && formes[1] === 2) return [2].concat(groupes);
    if (formes[0] === 2) return [1].concat(groupes);
    return [0].concat(r);
  }
  function comparer(a, b) { for (var i = 0; i < Math.max(a.length, b.length); i++) { var d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
  function meilleure(sept) {
    var best = null, cinq = null;
    for (var a = 0; a < sept.length; a++) for (var b = a + 1; b < sept.length; b++) {
      var c5 = sept.filter(function (_, i) { return i !== a && i !== b; });
      var s = eval5(c5);
      if (!best || comparer(s, best) > 0) { best = s; cinq = c5; }
    }
    return { score: best, cartes: cinq };
  }
  function de(m) { return /^[aeioué]/.test(m) ? 'd\'' + m : 'de ' + m; }
  function nomMain(s) {
    switch (s[0]) {
      case 0: return 'Carte haute ' + NOM_SEUL[s[1]];
      case 1: return 'Paire ' + de(NOMS_RANGS[s[1]]);
      case 2: return 'Double paire ' + NOMS_RANGS[s[1]] + ' et ' + NOMS_RANGS[s[2]];
      case 3: return 'Brelan ' + de(NOMS_RANGS[s[1]]);
      case 4: return 'Quinte au ' + NOM_SEUL[s[1]];
      case 5: return 'Couleur';
      case 6: return 'Full aux ' + NOMS_RANGS[s[1]] + ' par les ' + NOMS_RANGS[s[2]];
      case 7: return 'Carré ' + de(NOMS_RANGS[s[1]]);
      case 8: return s[1] === 14 ? 'Quinte flush royale !' : 'Quinte flush';
    }
    return '';
  }
  F.Poker = { eval5: eval5, meilleure: meilleure, nomMain: nomMain, comparer: comparer };

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', board: [], pot: 0, mise: 0, relanceMin: 0, bouton: -1, petite: 10, main: 0, journal: [], actif: null, t0: F.t, fin: null, particules: new F.Particules(), abattage: false, gagnants: null, maxMains: 0 };

    L.stats = function (P) { return { texte: '🪙 ' + P.jetons + (P.couche ? ' · couché' : '') }; };
    function log(txt, col) { S.journal.unshift({ txt: txt, col: col || '#fff' }); if (S.journal.length > 3) S.journal.pop(); }
    function enJeu() { return L.joueurs.filter(function (P) { return !P.elimine; }); }
    function dansLaMain() { return L.joueurs.filter(function (P) { return P.cartes.length && !P.couche; }); }
    function peutAgir(P) { return !P.couche && !P.elimine && P.jetons > 0 && P.cartes.length; }
    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.6;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#9d0208', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }
    function miser(P, montant) {
      montant = Math.min(montant, P.jetons);
      P.jetons -= montant; P.miseTour += montant; P.miseMain += montant; S.pot += montant;
      if (P.jetons === 0) P.tapis = true;
      if (montant) F.son.pop();
      return montant;
    }
    function uiAttente(P, titre) {
      L.ui(P, {
        titre: titre, texte: P.couche ? 'Tu t\'es couché pour cette main.' : 'Tes jetons : ' + P.jetons,
        cartes: { liste: P.cartes.map(function (k) { return C.versTel(k); }), grandes: true }
      });
    }

    // ---------- Partie ----------
    async function partie() {
      L.initialiser({ jetons: DEPART, cartes: [], couche: false, tapis: false, elimine: false, miseTour: 0, miseMain: 0, aParle: false, montre: false, derniere: '', ordreElim: 0, gain: 0 });
      S.phase = 'titre'; S.t0 = F.t; S.fin = null; S.main = 0; S.petite = 10; S.bouton = -1; S.board = []; S.pot = 0;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '♠️', titre: 'Poker', texte: chef.nom + ' choisit la durée…' }, chef);
      var d = await L.demander(chef, {
        emoji: '♠️', titre: 'Poker Texas Hold\'em', texte: 'Chacun commence avec ' + DEPART + ' jetons. Les blindes doublent toutes les 6 mains.',
        boutons: [{ id: '0', label: '🏆 Jusqu\'au dernier', sous: 'le dernier avec des jetons gagne' }, { id: '15', label: '⏱ 15 mains', sous: 'le plus riche gagne' }, { id: '30', label: '⏱ 30 mains', sous: 'le plus riche gagne' }]
      }, '0', 60);
      S.maxMains = window.POKER_MAINS || +d;
      F.musique(null);
      S.phase = 'jeu';
      await banniere('Poker Texas Hold\'em', 'Chacun commence avec ' + DEPART + ' jetons', '#9d0208', 2);
      while (!L.arrete && enJeu().length > 1 && (!S.maxMains || S.main < S.maxMains)) {
        S.main++;
        if (S.main > 1 && (S.main - 1) % 6 === 0) { S.petite *= 2; await banniere('Les blindes augmentent !', 'Petite blinde ' + S.petite + ' · grosse blinde ' + S.petite * 2, '#e85d04', 1.8); }
        await jouerMain();
      }
      if (!L.arrete) await finale();
    }

    function suivant(i, cond) {
      var n = L.joueurs.length;
      for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (cond(L.joueurs[j])) return j; }
      return -1;
    }

    async function jouerMain() {
      var paquet = C.paquet(1, 0);
      S.board = []; S.pot = 0; S.gagnants = null; S.abattage = false;
      L.joueurs.forEach(function (P) {
        P.cartes = []; P.couche = P.elimine; P.tapis = false; P.miseTour = 0; P.miseMain = 0; P.montre = false; P.derniere = ''; P.gain = 0; P.resultat = null;
      });
      S.bouton = suivant(S.bouton, function (P) { return !P.elimine; });
      var actifs = enJeu();
      // distribution
      for (var tour = 0; tour < 2; tour++) L.joueurs.forEach(function (P) { if (!P.elimine) P.cartes.push(paquet.pop()); });
      S.distribue = F.t;
      F.son.de();
      // blindes (à deux, le donneur met la petite blinde)
      var iPetite = actifs.length === 2 ? S.bouton : suivant(S.bouton, function (P) { return !P.elimine; });
      var iGrosse = suivant(iPetite, function (P) { return !P.elimine; });
      var pb = L.joueurs[iPetite], gb = L.joueurs[iGrosse];
      miser(pb, S.petite); pb.derniere = 'petite blinde';
      miser(gb, S.petite * 2); gb.derniere = 'grosse blinde';
      S.mise = Math.max(pb.miseTour, gb.miseTour); S.relanceMin = S.petite * 2;
      log('Main ' + S.main + ' · ' + L.joueurs[S.bouton].nom + ' distribue');
      L.joueurs.forEach(function (P) { if (!P.elimine) uiAttente(P, 'Main ' + S.main + ' : voici tes cartes'); });
      await F.attendre(1.2);

      var etapes = [['Pré-flop', 0], ['Flop', 3], ['Turn', 1], ['River', 1]];
      for (var e = 0; e < etapes.length && !L.arrete; e++) {
        if (e > 0) {
          paquet.pop(); // carte brûlée
          for (var k = 0; k < etapes[e][1]; k++) { S.board.push(paquet.pop()); S.boardT = F.t; F.son.de(); await F.attendre(0.35); }
          L.joueurs.forEach(function (P) { P.miseTour = 0; if (!P.couche) P.derniere = ''; });
          S.mise = 0; S.relanceMin = S.petite * 2;
          log(etapes[e][0] + ' : ' + S.board.map(C.texte).join(' '));
          await F.attendre(0.6);
        }
        if (dansLaMain().length > 1) await tourDeMises(e === 0 ? iGrosse : S.bouton);
        if (dansLaMain().length === 1) break;
      }
      if (L.arrete) return;
      await conclure();
    }

    async function tourDeMises(iDepart) {
      L.joueurs.forEach(function (P) { P.aParle = false; });
      var i = iDepart;
      while (!L.arrete) {
        if (dansLaMain().length <= 1) return;
        var j = suivant(i, function (P) { return peutAgir(P) && (!P.aParle || P.miseTour < S.mise); });
        if (j === -1) return;
        // personne d'autre ne peut répondre : inutile de demander
        var autres = dansLaMain().filter(function (Q) { return Q !== L.joueurs[j] && peutAgir(Q); });
        if (!autres.length && L.joueurs[j].miseTour >= S.mise) return;
        i = j;
        await action(L.joueurs[j]);
      }
    }

    async function action(P) {
      S.actif = P;
      L.joueurs.forEach(function (Q) { if (Q !== P && !Q.elimine) uiAttente(Q, 'Tour de ' + P.nom); });
      var aSuivre = Math.min(S.mise - P.miseTour, P.jetons);
      var boutons = [{ id: 'coucher', label: '🏳️ Se coucher', couleur: '#adb5bd' }];
      boutons.push(aSuivre > 0 ? { id: 'suivre', label: '✅ Suivre ' + aSuivre, couleur: '#80ed99' } : { id: 'parole', label: '👍 Parole', sous: 'ne rien miser', couleur: '#80ed99' });
      var maxTotal = P.miseTour + P.jetons;
      var minTotal = S.mise + S.relanceMin;
      var options = [];
      if (maxTotal > S.mise) {
        [minTotal, S.mise + Math.max(S.relanceMin, Math.round(S.pot / 2 / 10) * 10), S.mise + Math.max(S.relanceMin, S.pot + aSuivre)].forEach(function (t) {
          if (t < maxTotal && options.indexOf(t) === -1) options.push(t);
        });
        options.slice(0, 3).forEach(function (t, n) {
          boutons.push({ id: 'r' + t, label: (S.mise ? '⬆ Relancer à ' : '⬆ Miser ') + t, sous: ['minimum', 'moitié du pot', 'le pot'][n], couleur: '#ffd166' });
        });
        boutons.push({ id: 'tapis', label: '🔥 Tapis (' + P.jetons + ')', couleur: '#ff006e' });
      }
      var choix = await L.demander(P, {
        titre: 'À toi de parler !', texte: 'Pot : ' + S.pot + ' · Tes jetons : ' + P.jetons + (aSuivre ? ' · À suivre : ' + aSuivre : ''),
        cartes: { liste: P.cartes.map(function (k) { return C.versTel(k); }), grandes: true },
        boutons: boutons, disposition: 'grille'
      }, aSuivre > 0 ? 'coucher' : 'parole', 45);
      if (L.arrete) return;
      P.aParle = true;
      if (choix === 'coucher') { P.couche = true; P.derniere = 'couché'; log(P.nom + ' se couche'); F.son.perte(); }
      else if (choix === 'parole' || (choix === 'suivre' && aSuivre === 0)) { P.derniere = 'parole'; log(P.nom + ' : parole'); F.son.tic(); }
      else if (choix === 'suivre') { miser(P, aSuivre); P.derniere = P.tapis ? 'tapis !' : 'suit ' + aSuivre; log(P.nom + ' suit ' + aSuivre, P.couleur); }
      else {
        var total = choix === 'tapis' ? maxTotal : +choix.slice(1);
        if (!(total > S.mise)) total = Math.min(maxTotal, minTotal);
        miser(P, total - P.miseTour);
        var relance = P.miseTour - S.mise;
        if (relance >= S.relanceMin) S.relanceMin = relance;
        if (P.miseTour > S.mise) {
          S.mise = P.miseTour;
          // une vraie relance : tout le monde doit reparler
          L.joueurs.forEach(function (Q) { if (Q !== P) Q.aParle = false; });
        }
        P.derniere = P.tapis ? 'TAPIS !' : (relance > 0 ? 'relance à ' + P.miseTour : 'suit');
        log(P.nom + (P.tapis ? ' fait tapis (' + P.miseTour + ')' : ' relance à ' + P.miseTour), P.couleur);
        if (P.tapis) await banniere(P.nom + ' fait tapis !', 'Mise totale : ' + P.miseMain, P.couleur, 1.4);
      }
      S.actif = null;
      await F.attendre(0.4);
    }

    async function conclure() {
      S.actif = null;
      var restants = dansLaMain();
      if (restants.length === 1) {
        var g = restants[0];
        g.jetons += S.pot; g.gain = S.pot;
        S.gagnants = [g];
        log(g.nom + ' remporte ' + S.pot + ' jetons', g.couleur);
        F.son.gain();
        await banniere(g.nom + ' remporte le pot', S.pot + ' jetons · tout le monde s\'est couché', g.couleur, 2);
        S.pot = 0;
      } else {
        // compléter le tableau si des joueurs sont à tapis
        while (S.board.length < 5) { S.board.push(C.paquet(1, 0).filter(function (k) { return !dejaVue(k); })[0]); S.boardT = F.t; F.son.de(); await F.attendre(0.7); }
        S.abattage = true;
        restants.forEach(function (P) { P.montre = true; P.resultat = meilleure(P.cartes.concat(S.board)); });
        F.son.surprise();
        await F.attendre(1.5);
        // pots (avec pots partagés quand quelqu'un est à tapis)
        var niveaux = L.joueurs.map(function (P) { return P.miseMain; }).filter(function (x, i, a) { return x > 0 && a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
        var avant = 0, gagnantsTous = [];
        niveaux.forEach(function (niv) {
          var montant = 0;
          L.joueurs.forEach(function (P) { montant += Math.max(0, Math.min(P.miseMain, niv) - avant); });
          var eligibles = restants.filter(function (P) { return P.miseMain >= niv; });
          avant = niv;
          if (!montant || !eligibles.length) return;
          var best = null, gs = [];
          eligibles.forEach(function (P) { var d = best ? comparer(P.resultat.score, best) : 1; if (d > 0) { best = P.resultat.score; gs = [P]; } else if (d === 0) gs.push(P); });
          var part = Math.floor(montant / gs.length), reste = montant - part * gs.length;
          gs.forEach(function (P, i) { P.jetons += part + (i === 0 ? reste : 0); P.gain += part + (i === 0 ? reste : 0); if (gagnantsTous.indexOf(P) === -1) gagnantsTous.push(P); });
        });
        S.gagnants = gagnantsTous;
        S.pot = 0;
        F.son.fanfare();
        var g0 = gagnantsTous[0];
        gagnantsTous.forEach(function (P) { S.particules.gerbe(siege(L.joueurs.indexOf(P)).x, siege(L.joueurs.indexOf(P)).y, 30, { couleurs: [P.couleur, '#ffd166', '#fff'], haut: 300, vmax: 350 }); });
        log(gagnantsTous.map(function (P) { return P.nom; }).join(' et ') + ' gagne' + (gagnantsTous.length > 1 ? 'nt' : '') + ' avec : ' + nomMain(g0.resultat.score), g0.couleur);
        await banniere(gagnantsTous.length > 1 ? 'Partage !' : g0.nom + ' gagne ' + g0.gain + ' jetons', nomMain(g0.resultat.score), g0.couleur, 2.6);
      }
      L.joueurs.forEach(function (P) {
        if (P.cartes.length) L.ui(P, {
          emoji: P.gain ? '🤑' : '🃏', titre: P.gain ? 'Tu gagnes ' + P.gain + ' jetons !' : 'Main perdue', texte: 'Tes jetons : ' + P.jetons + (P.resultat ? '\nTa main : ' + nomMain(P.resultat.score) : ''),
          cartes: { liste: P.cartes.map(function (k) { return C.versTel(k); }), grandes: true }
        });
      });
      await F.attendre(2.5);
      // éliminations
      var elimines = L.joueurs.filter(function (P) { return !P.elimine && P.jetons <= 0; });
      for (var i = 0; i < elimines.length; i++) {
        var P = elimines[i];
        P.elimine = true; P.ordreElim = L.joueurs.filter(function (Q) { return Q.elimine; }).length;
        L.ui(P, { emoji: '💸', titre: 'Plus de jetons !', texte: 'Tu es éliminé. Regarde la fin sur la télé.' });
        await banniere(P.nom + ' est éliminé', 'Plus de jetons', '#6c757d', 1.8);
      }
      S.gagnants = null;
      L.joueurs.forEach(function (Q) { Q.montre = false; });
      S.abattage = false;
    }
    function dejaVue(k) {
      if (S.board.some(function (b) { return b.r === k.r && b.s === k.s; })) return true;
      return L.joueurs.some(function (P) { return P.cartes.some(function (b) { return b.r === k.r && b.s === k.s; }); });
    }

    async function finale() {
      L.joueurs.forEach(function (P) { P.valeur = P.elimine ? -1000 + P.ordreElim : P.jetons; });
      var ordre = F.classer(L.joueurs, 'valeur');
      S.phase = 'fin'; S.fin = { ordre: ordre, t0: F.t };
      F.musique('final'); F.son.cymbale(); F.son.fanfare();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '♠️', titre: P.rang === 1 ? 'Tu gagnes la partie !' : F.texteRang(P.rang) + ' place', texte: P.elimine ? 'Éliminé' : P.jetons + ' jetons',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    function siege(i) {
      var n = L.joueurs.length;
      var places = {
        2: [[800, 790], [800, 115]],
        3: [[800, 790], [250, 230], [1350, 230]],
        4: [[800, 790], [190, 430], [800, 115], [1410, 430]]
      }[Math.max(2, Math.min(4, n))];
      var p = places[i] || [800, 450];
      return { x: p[0], y: p[1] };
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      S.particules.maj(dt);
      F.virtuel(c, W, H, '#1b0a0a');
      var g = c.createRadialGradient(800, 450, 100, 800, 450, 1000);
      g.addColorStop(0, '#3d0c11'); g.addColorStop(1, '#120406');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      // table
      c.fillStyle = '#5c3a21'; c.beginPath(); c.ellipse(800, 455, 660, 330, 0, 0, 7); c.fill();
      var t = c.createRadialGradient(800, 420, 50, 800, 450, 640); t.addColorStop(0, '#2d936c'); t.addColorStop(1, '#14532d');
      c.fillStyle = t; c.beginPath(); c.ellipse(800, 455, 630, 302, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 3; c.beginPath(); c.ellipse(800, 455, 560, 250, 0, 0, 7); c.stroke();
      if (S.phase !== 'titre') {
        // cartes communes
        for (var i = 0; i < 5; i++) {
          var x = 800 + (i - 2) * 118, y = 420, k = S.board[i];
          if (k) {
            var age = (F.t - S.boardT) * F.V, nouveau = i === S.board.length - 1 && age < 0.35;
            var sc = nouveau ? F.ease.back(age / 0.35) : 1;
            c.save(); c.translate(x, y); c.scale(sc, 1);
            var gagnante = S.abattage && S.gagnants && S.gagnants[0] && S.gagnants[0].resultat && S.gagnants[0].resultat.cartes.indexOf(k) !== -1;
            C.dessiner(c, 0, gagnante ? -12 : 0, 104, k, { sel: gagnante ? '#ffd166' : null });
            c.restore();
          } else { c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 3; c.setLineDash([8, 8]); F.rr(c, x - 52, y - 73, 104, 146, 12); c.stroke(); c.setLineDash([]); }
        }
        // pot
        if (S.pot) { jetons(c, 640, 560, S.pot); F.texte(c, 'Pot : ' + S.pot, 800, 560, 34, '#ffd166', { contour: 'rgba(0,0,0,.5)', epaisseur: 6 }); }
        F.texte(c, 'Main ' + S.main + (S.maxMains ? ' / ' + S.maxMains : '') + ' · blindes ' + S.petite + ' / ' + S.petite * 2, 800, 328, 24, 'rgba(255,255,255,.7)', { contour: false });
        L.joueurs.forEach(function (P, i) { joueur(c, P, i); });
        if (S.journal[0]) F.texte(c, S.journal[0].txt, 800, 875, 26, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 5 });
      }
      S.particules.dessiner(c);
      banniereDessin(c);
      if (S.phase === 'titre') titre(c);
      if (S.fin) fin(c);
      c.restore();
    }

    function jetons(c, x, y, montant) {
      var piles = Math.min(5, Math.ceil(montant / 200)), cols = ['#e63946', '#3a86ff', '#06d6a0', '#ffbe0b', '#8338ec'];
      for (var p = 0; p < piles; p++) {
        var h = Math.min(6, 2 + Math.floor(montant / 100 / (p + 1)));
        for (var k = 0; k < h; k++) {
          var px = x + (p - (piles - 1) / 2) * 30, py = y - k * 5;
          c.fillStyle = F.assombrir(cols[p], 0.3); c.beginPath(); c.ellipse(px, py + 3, 13, 6, 0, 0, 7); c.fill();
          c.fillStyle = cols[p]; c.beginPath(); c.ellipse(px, py, 13, 6, 0, 0, 7); c.fill();
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.ellipse(px, py, 9, 4, 0, 0, 7); c.stroke(); c.setLineDash([]);
        }
      }
    }

    function joueur(c, P, i) {
      var p = siege(i), w = 300, h = 120, x = p.x - w / 2, y = p.y - h / 2, actif = S.actif === P;
      var gagnant = S.gagnants && S.gagnants.indexOf(P) !== -1;
      c.save();
      c.globalAlpha = P.elimine ? 0.4 : (P.couche ? 0.6 : 1);
      if (actif || gagnant) { c.shadowColor = gagnant ? '#ffd166' : P.couleur; c.shadowBlur = 26 * (0.6 + 0.4 * Math.sin(F.t * 5)); }
      c.fillStyle = 'rgba(10,10,20,.88)'; F.rr(c, x, y, w, h, 22); c.fill();
      c.shadowBlur = 0;
      if (actif || gagnant) { c.lineWidth = 4; c.strokeStyle = gagnant ? '#ffd166' : P.couleur; F.rr(c, x, y, w, h, 22); c.stroke(); }
      c.fillStyle = P.couleur; c.beginPath(); c.arc(x + 32, y + 32, 15, 0, 7); c.fill();
      F.texte(c, P.nom, x + 56, y + 32, 28, '#fff', { align: 'left', contour: false });
      F.texte(c, P.elimine ? 'éliminé' : P.jetons + ' jetons', x + 56, y + 72, 26, '#ffd166', { align: 'left', contour: false });
      if (P.derniere && !P.elimine) F.texte(c, P.derniere, x + 56, y + 102, 20, P.tapis ? '#ff4d6d' : '#b7e4c7', { align: 'left', contour: false });
      if (actif && L.enAttente(P)) F.texte(c, '⏳', x + w - 28, y + 30, 26, '#fff', { contour: false });
      c.restore();
      // donneur
      if (L.joueurs[S.bouton] === P && !P.elimine) {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(x + w - 24, y + h - 24, 16, 0, 7); c.fill();
        F.texte(c, 'D', x + w - 24, y + h - 23, 20, '#1b1b2f', { contour: false });
      }
      // cartes du joueur (cachées sauf abattage) vers le centre de la table
      if (P.cartes.length && !P.couche) {
        var dx = 800 - p.x, dy = 450 - p.y, d = Math.hypot(dx, dy) || 1;
        var cx = p.x + dx / d * 235, cy = p.y + dy / d * 125;
        var ouv = P.montre, gagnante = gagnant && S.abattage;
        var arrivee = Math.min(1, (F.t - S.distribue) * F.V / 0.5);
        P.cartes.forEach(function (k, n) {
          var ax = F.lerp(800, cx + (n - 0.5) * (ouv ? 84 : 34), F.ease.out(arrivee)), ay = F.lerp(450, cy, F.ease.out(arrivee));
          C.dessiner(c, ax, ay, ouv ? 80 : 58, ouv ? k : null, { dos: !ouv, rot: ouv ? 0 : (n - 0.5) * 0.18, sel: gagnante && P.resultat.cartes.indexOf(k) !== -1 ? '#ffd166' : null });
        });
        if (ouv && P.resultat) F.texte(c, nomMain(P.resultat.score), cx, cy + (dy > 0 ? 82 : -82), 24, gagnant ? '#ffd166' : '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: 6 });
        // mise devant le joueur
        if (P.miseTour && !ouv) { var mx = cx - dy / d * 120 + dx / d * 40, my = cy + dx / d * 70; jetons(c, mx, my, P.miseTour); F.texte(c, String(P.miseTour), mx, my + 30, 22, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 5 }); }
      }
    }

    function banniereDessin(c) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0;
      if (t > b.duree) { S.banniere = null; return; }
      var e = Math.min(1, t * F.V / 0.3), s = Math.max(0, (t - (b.duree - 0.3 / F.V)) * F.V / 0.3), h = b.sous ? 150 : 110;
      c.save(); c.globalAlpha = 1 - s; c.translate(800, 615); c.scale(F.ease.back(e), F.ease.back(e));
      c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -576, -h / 2 + 8, 1160, h, 30); c.fill();
      c.fillStyle = b.couleur; F.rr(c, -580, -h / 2, 1160, h, 30); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#ffd166'; F.rr(c, -580, -h / 2, 1160, h, 30); c.stroke();
      F.texte(c, b.texte, 0, b.sous ? -22 : 0, 56, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 8 });
      if (b.sous) F.texte(c, b.sous, 0, 40, 30, '#ffd166', { contour: false });
      c.restore();
    }

    function titre(c) {
      var t = F.t - S.t0;
      F.texte(c, 'Poker', 800, 220 + Math.sin(t * 2) * 8, 150, '#ffd166', { contour: '#3d0c11', epaisseur: 18 });
      F.texte(c, 'Texas Hold\'em · avec des jetons pour rire', 800, 330, 36, '#fff', { contour: false });
      [{ r: 1, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }].forEach(function (k, i) {
        C.dessiner(c, 800 + (i - 2) * 120, 520 + Math.sin(t * 2 + i) * 10, 104, k, { rot: (i - 2) * 0.06 });
      });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit la durée sur son téléphone…', 800, 780, 30, '#ffd166', { contour: false });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(18,4,6,' + 0.9 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, f.ordre[0].nom + ' gagne la partie !', 800, 150, 80, '#ffd166', { contour: '#3d0c11', epaisseur: 14 });
      f.ordre.forEach(function (P, k) {
        var y = 260 + k * 125;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.12)'; F.rr(c, 300, y, 1000, 105, 26); c.fill();
        var col = P.rang === 1 ? '#3d0c11' : '#fff';
        F.texte(c, F.texteRang(P.rang), 370, y + 52, 46, col, { contour: false });
        c.fillStyle = P.couleur; c.beginPath(); c.arc(470, y + 52, 24, 0, 7); c.fill();
        F.texte(c, P.nom, 520, y + 52, 46, col, { align: 'left', contour: false });
        F.texte(c, P.elimine ? 'éliminé' : P.jetons + ' jetons', 1260, y + 52, 40, col, { align: 'right', contour: false });
      });
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
      S.particules.dessiner(c);
    }

    partie().catch(function (e) { console.error('Poker :', e); });
    return {
      image: image,
      message: function (j, m) { L.recevoir(j, m); },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'poker', vignette: 'assets/vignettes/poker.jpg', nom: 'Poker', emoji: '♠️',
    description: 'Texas Hold\'em avec des jetons pour rire : tes cartes cachées sur ton téléphone, bluff et tapis !',
    min: 2, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
