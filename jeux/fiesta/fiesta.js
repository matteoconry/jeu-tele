/*
 * Fiesta Royale — déroulement de la partie (plateau, tours, cases, duels, mini-jeux, finale).
 * S'enregistre dans le catalogue de la console.
 */
(function (F) {
  'use strict';

  var PRIX_ETOILE = 20;
  var PIECES_DEPART = 10;

  var EVENEMENTS = [
    { id: 'tresor', nom: 'Trésor enfoui !', texte: '+10 pièces' },
    { id: 'crabe', nom: 'Un voleur masqué !', texte: '−5 pièces' },
    { id: 'tornade', nom: 'Tornade !', texte: 'Tu échanges ta place avec un autre joueur' },
    { id: 'dauphin', nom: 'Un dauphin t\'emmène', texte: 'Avance de 4 cases' },
    { id: 'genereux', nom: 'Cœur généreux', texte: 'Donne 3 pièces à chaque joueur' },
    { id: 'pluie', nom: 'Pluie de pièces d\'or', texte: 'Tout le monde gagne 5 pièces' },
    { id: 'fugue', nom: 'L\'étoile s\'enfuit !', texte: 'L\'étoile change de place' },
    { id: 'volcan', nom: 'L\'orage gronde sur le château !', texte: 'Les autres joueurs perdent 3 pièces' }
  ];

  var BONUS = [
    { id: 'mj', titre: 'Champion des mini-jeux', texte: 'Le plus de mini-jeux gagnés', val: function (P) { return P.victoiresMJ; } },
    { id: 'riche', titre: 'Chasseur de trésors', texte: 'Le plus de pièces gagnés', val: function (P) { return P.gainsTotal; } },
    { id: 'malchance', titre: 'Pas de chance !', texte: 'Le plus de cases pièges', val: function (P) { return P.rouges; } }
  ];

  function creer(api) {
    F.viderAnims();
    if (F.prechargerPlateau) F.prechargerPlateau();
    if (F.prechargerSprites) F.prechargerSprites();
    F.sonActif = function () { return api.params().son !== false; };
    if (document.fonts && document.fonts.load) { try { document.fonts.load('700 20px Fredoka'); } catch (e) {} }

    var arrete = false;
    var S = {
      phase: 'intro', cases: F.construirePlateau(), joueurs: [], tour: 0, nbTours: 8,
      cam: { x: 800, y: 450, z: 1 }, camCible: { x: 800, y: 450, z: 1 },
      decor: null, decorEchelle: 0, banniere: null, flottants: [], particules: new F.Particules(),
      etoileCase: -1, etoileVol: null, de: null, actif: null, roulette: null, carte: null, vs: null,
      rideau: 0, eclatCase: null, volcanColere: 0, mj: null, podium: null, intro: { t0: F.t }, dernierMJ: null
    };
    var demandes = {};   // numero → { cle, ok, defaut, limite }
    var compteurCle = 0;

    // ---------- Joueurs ----------
    function jDe(P) {
      var l = api.tousLesJoueurs();
      for (var i = 0; i < l.length; i++) if (l[i].numero === P.num) return l[i];
      return null;
    }
    function connecte(P) { var j = jDe(P); return !!(j && j.conn); }
    function PDe(j) {
      for (var i = 0; i < S.joueurs.length; i++) if (S.joueurs[i].num === j.numero) return S.joueurs[i];
      return null;
    }
    function classement() {
      var l = S.joueurs.slice().sort(function (a, b) { return (b.etoiles - a.etoiles) || (b.pieces - a.pieces); });
      var rang = 0;
      l.forEach(function (P, i) {
        if (i === 0 || P.etoiles !== l[i - 1].etoiles || P.pieces !== l[i - 1].pieces) rang = i + 1;
        P.rang = rang;
      });
      return l;
    }
    function texteRang(r) { return r === 1 ? '1er' : r + 'e'; }

    // ---------- Téléphones ----------
    function envoyerUI(P, ui) {
      if (arrete) return;
      classement();
      ui.stats = { pieces: P.pieces, etoiles: P.etoiles, rang: texteRang(P.rang) };
      P.ui = ui;
      var j = jDe(P);
      if (j) api.envoyer(j, { t: 'ui', ui: ui });
    }
    function rafraichirStats() { S.joueurs.forEach(function (P) { if (P.ui) envoyerUI(P, P.ui); }); }

    function demander(P, ui, defaut, delai) {
      return new Promise(function (ok) {
        var cle = 'q' + (++compteurCle);
        ui.cle = cle;
        demandes[P.num] = { cle: cle, ok: ok, defaut: defaut, limite: F.t + (delai || 30) / F.V, horsLigne: 0 };
        envoyerUI(P, ui);
      });
    }
    function verifierDemandes(dt) {
      Object.keys(demandes).forEach(function (n) {
        var d = demandes[n], P = null;
        S.joueurs.forEach(function (x) { if (String(x.num) === n) P = x; });
        if (!P) return;
        d.horsLigne = connecte(P) ? 0 : d.horsLigne + dt;
        if (F.t > d.limite || d.horsLigne > 1.5) { delete demandes[n]; d.ok(d.defaut); }
      });
    }
    function attendreTous(liste, uiFn, defaut, delai) {
      return Promise.all(liste.map(function (P) { return demander(P, uiFn(P), defaut, delai); }));
    }
    function infoAutres(sauf, ui) {
      S.joueurs.forEach(function (P) { if (P !== sauf) envoyerUI(P, JSON.parse(JSON.stringify(ui))); });
    }

    // ---------- Effets visuels ----------
    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.8;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#ff006e', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }
    function flottant(x, y, texte, couleur) { S.flottants.push({ x: x, y: y, texte: texte, couleur: couleur || '#fff', t0: F.t }); }
    function transition(milieu) {
      return F.anim(0.45, function (p) { S.rideau = p; }).then(function () {
        if (milieu) milieu();
        return F.attendre(0.15);
      }).then(function () {
        return F.anim(0.45, function (p) { S.rideau = 1 - p; });
      });
    }
    function viser(x, y, z) { S.camCible = { x: x, y: y, z: z }; }
    function vueGenerale() { viser(800, 450, 1); }

    function changerPieces(P, n, sansSon) {
      var avant = P.pieces;
      P.pieces = Math.max(0, P.pieces + n);
      var reel = P.pieces - avant;
      if (reel > 0) P.gainsTotal += reel;
      if (reel !== 0) {
        flottant(P.x, P.y - 70, (reel > 0 ? '+' : '−') + Math.abs(reel), reel > 0 ? '#ffd166' : '#ff4d6d');
        if (!sansSon) (reel > 0 ? F.son.gain : F.son.perte)();
        if (reel > 0) S.particules.gerbe(P.x, P.y - 30, Math.min(14, 3 + reel), { forme: 'coquillage', tmin: 7, tmax: 11, haut: 380, vmax: 260 });
        else P.triste = F.t + 1.2 / F.V;
      }
      return reel;
    }

    // Position d'un pion sur sa case (décalé s'ils sont plusieurs)
    function positionSurCase(P) {
      var cs = S.cases[P.case];
      var ici = S.joueurs.filter(function (x) { return x.case === P.case; });
      if (ici.length <= 1) return { x: cs.x, y: cs.y - 6 };
      var k = ici.indexOf(P), a = -Math.PI / 2 + k / ici.length * Math.PI * 2;
      return { x: cs.x + Math.cos(a) * 24, y: cs.y - 6 + Math.sin(a) * 14 };
    }

    // ---------- Déplacements ----------
    function sauter(P, vers, i) {
      var x0 = P.x, y0 = P.y;
      P.case = vers;
      var cible = positionSurCase(P);
      P.enMouvement = true;
      F.son.pas(i || 0);
      return F.anim(0.26, function (p) {
        P.x = F.lerp(x0, cible.x, p); P.y = F.lerp(y0, cible.y, p);
        P.saut = Math.sin(p * Math.PI) * 42;
        viser(P.x, P.y, 1.55);
      }).then(function () {
        P.saut = 0;
        return F.anim(0.1, function (p) { P.ecrase = Math.sin(p * Math.PI); });
      }).then(function () { P.ecrase = 0; P.enMouvement = false; });
    }

    // ---------- Étoile ----------
    function placerEtoile(premiere) {
      var possibles = [];
      S.cases.forEach(function (cs, i) {
        if (cs.type !== 'bleu' || i === S.etoileCase) return;
        if (S.joueurs.some(function (P) { return P.case === i; })) return;
        if (premiere && (i < 8 || cs.raccourci)) return;
        possibles.push(i);
      });
      return F.choisir(possibles);
    }
    function deplacerEtoile() {
      var de = S.etoileCase, vers = placerEtoile(false);
      var a = S.cases[de], b = S.cases[vers];
      S.etoileCase = -1;
      S.etoileVol = { x: a.x, y: a.y };
      viser(F.lerp(a.x, b.x, 0.5), F.lerp(a.y, b.y, 0.5), 1);
      F.son.surprise();
      return F.anim(1.4, function (p) {
        var e = F.ease.inOut(p);
        S.etoileVol.x = F.lerp(a.x, b.x, e);
        S.etoileVol.y = F.lerp(a.y, b.y, e) - Math.sin(p * Math.PI) * 220;
      }).then(function () {
        S.etoileVol = null; S.etoileCase = vers;
        F.son.etoile();
        S.particules.gerbe(b.x, b.y - 40, 20, { forme: 'etoile', tmin: 6, tmax: 10 });
        viser(b.x, b.y, 1.5);
        return banniere('L\'étoile s\'est posée ici !', '', '#ff9f1c', 1.6);
      });
    }

    async function offreEtoile(P) {
      var cs = S.cases[P.case];
      viser(cs.x, cs.y, 1.7);
      if (P.pieces < PRIX_ETOILE) {
        envoyerUI(P, { emoji: '😢', titre: 'Pas assez…', texte: 'Il faut ' + PRIX_ETOILE + ' pièces pour l\'étoile.' });
        await banniere('Pas assez de pièces…', 'Il en faut ' + PRIX_ETOILE + ' pour l\'étoile', '#6c757d', 1.6);
        return;
      }
      infoAutres(P, { emoji: '⭐', titre: P.nom + ' hésite…', texte: 'Achat de l\'étoile ?' });
      var r = await demander(P, {
        emoji: '⭐', titre: 'L\'étoile !', texte: 'Acheter une étoile pour ' + PRIX_ETOILE + ' pièces ?',
        boutons: [{ id: 'oui', label: '⭐ Oui, je la prends !', sous: 'Il te restera ' + (P.pieces - PRIX_ETOILE) + ' 🪙' }, { id: 'non', label: 'Non merci', couleur: '#adb5bd' }]
      }, 'oui', 25);
      if (r !== 'oui') return;
      P.pieces -= PRIX_ETOILE;
      P.etoiles++;
      F.son.etoile();
      S.particules.gerbe(cs.x, cs.y - 40, 40, { forme: 'etoile', tmin: 7, tmax: 14, haut: 500 });
      S.particules.gerbe(cs.x, cs.y - 40, 40, { forme: 'confetti', couleurs: ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0'] });
      P.joie = F.t + 2 / F.V;
      flottant(P.x, P.y - 80, '+1 étoile', '#ffd166');
      envoyerUI(P, { emoji: '🌟', titre: 'Étoile !', texte: 'Tu en as maintenant ' + P.etoiles + '.', vibrer: 200 });
      await banniere(P.nom + ' obtient une étoile !', P.etoiles + ' étoile' + (P.etoiles > 1 ? 's' : '') + ' au total', P.couleur, 2.2);
      await deplacerEtoile();
    }

    // ---------- Effets des cases ----------
    async function effetCase(P) {
      var cs = S.cases[P.case];
      S.eclatCase = { id: P.case, t0: F.t };
      var double = S.tour === S.nbTours ? 2 : 1;
      if (cs.type === 'bleu') {
        P.bleues++;
        changerPieces(P, 3 * double);
        envoyerUI(P, { emoji: '😄', titre: 'Case bonus !', texte: '+' + 3 * double + ' pièces' });
        await F.attendre(1.1);
      } else if (cs.type === 'rouge') {
        P.rouges++;
        changerPieces(P, -3 * double);
        envoyerUI(P, { emoji: '😖', titre: 'Case piège !', texte: '−' + 3 * double + ' pièces' });
        await F.attendre(1.1);
      } else if (cs.type === 'chance') {
        await evenement(P);
      } else if (cs.type === 'duel') {
        await duel(P);
      } else {
        await F.attendre(0.5);
      }
    }

    async function evenement(P) {
      var liste = EVENEMENTS.filter(function (e) { return e.id !== 'tornade' || S.joueurs.length > 1; });
      var choisi = F.choisir(liste);
      envoyerUI(P, { emoji: '🎰', titre: 'Case surprise !', texte: 'Regarde la télé…' });
      S.roulette = { liste: liste, idx: 0, fini: false, choisi: choisi, t0: F.t };
      // Roulette qui ralentit
      var total = 22 + liste.indexOf(choisi) - (22 % liste.length) + liste.length;
      for (var i = 0; i < total; i++) {
        S.roulette.idx = i % liste.length;
        F.son.tic();
        await F.attendre(0.05 + Math.pow(i / total, 3) * 0.32);
      }
      S.roulette.idx = liste.indexOf(choisi);
      S.roulette.fini = true;
      F.son.surprise();
      await F.attendre(1.3);
      S.roulette = null;
      var autres = S.joueurs.filter(function (x) { return x !== P; });
      switch (choisi.id) {
        case 'tresor': changerPieces(P, 10); envoyerUI(P, { emoji: '💰', titre: 'Trésor !', texte: '+10 pièces' }); await F.attendre(1.2); break;
        case 'crabe': changerPieces(P, -5); envoyerUI(P, { emoji: '🦹', titre: 'Aïe !', texte: 'Un voleur t\'a pris 5 pièces' }); await F.attendre(1.2); break;
        case 'pluie':
          vueGenerale();
          S.joueurs.forEach(function (x) { changerPieces(x, 5, true); });
          F.son.gain(); await F.attendre(1.5); break;
        case 'genereux':
          autres.forEach(function (x) { var d = Math.min(3, P.pieces); P.pieces -= d; if (d) changerPieces(x, d, true); });
          flottant(P.x, P.y - 70, 'Merci !', '#fff'); F.son.gain(); await F.attendre(1.5); break;
        case 'volcan':
          vueGenerale(); S.volcanColere = F.t + 2 / F.V; F.son.roulement(1.2);
          await F.attendre(1.2);
          autres.forEach(function (x) { changerPieces(x, -3, true); });
          F.son.perte(); await F.attendre(1.2); break;
        case 'fugue': await deplacerEtoile(); break;
        case 'dauphin':
          envoyerUI(P, { emoji: '🐬', titre: 'Youpi !', texte: 'Le dauphin t\'emmène 4 cases plus loin' });
          for (var k = 0; k < 4; k++) await sauter(P, S.cases[P.case].suivantes[0], k);
          if (P.case === S.etoileCase) await offreEtoile(P);
          break;
        case 'tornade':
          var Q = F.choisir(autres);
          vueGenerale();
          F.son.roulement(1);
          var a = { x: P.x, y: P.y }, b = { x: Q.x, y: Q.y }, ca = P.case;
          P.enMouvement = Q.enMouvement = true;
          await F.anim(1.2, function (p) {
            var e = F.ease.inOut(p);
            P.x = F.lerp(a.x, b.x, e); P.y = F.lerp(a.y, b.y, e); P.saut = Math.sin(p * Math.PI) * 160; P.tourne = p * 12;
            Q.x = F.lerp(b.x, a.x, e); Q.y = F.lerp(b.y, a.y, e); Q.saut = Math.sin(p * Math.PI) * 160; Q.tourne = p * 12;
          });
          P.case = Q.case; Q.case = ca;
          P.saut = Q.saut = P.tourne = Q.tourne = 0;
          P.enMouvement = Q.enMouvement = false;
          await banniere(P.nom + ' et ' + Q.nom + ' échangent leur place !', '', '#3a86ff', 1.6);
          break;
      }
    }

    // ---------- Duel ----------
    async function duel(P) {
      var autres = S.joueurs.filter(function (x) { return x !== P; });
      if (!autres.length) { await F.attendre(0.5); return; }
      F.son.duel();
      await banniere('DUEL !', P.nom + ' provoque un duel', '#9b5de5', 1.6);
      var Q;
      if (autres.length === 1) Q = autres[0];
      else {
        infoAutres(P, { emoji: '😬', titre: 'Duel !', texte: P.nom + ' choisit son adversaire…' });
        var id = await demander(P, {
          emoji: '⚔️', titre: 'Duel !', texte: 'Qui veux-tu défier ? Le gagnant prend 10 pièces au perdant.',
          boutons: autres.map(function (x) { return { id: String(x.num), label: x.nom, sous: x.pieces + ' 🪙 · ' + x.etoiles + ' ⭐', couleur: x.couleur }; })
        }, String(F.choisir(autres).num), 25);
        Q = autres.filter(function (x) { return String(x.num) === id; })[0] || autres[0];
      }
      var mise = 10;
      S.vs = { a: P, b: Q, t0: F.t, mise: mise };
      F.son.cymbale();
      await F.attendre(2.4);
      S.vs = null;
      var mj = choisirMiniJeu();
      var res = await jouerMiniJeu([P, Q], mj, 'DUEL ÉCLAIR', 'Le gagnant prend ' + mise + ' pièces');
      res[0].gain = null;
      var g = res[0], p = res[1];
      await transition(function () { S.phase = 'plateau'; S.mj = null; F.musique('plateau'); viser(P.x, P.y, 1.3); });
      if (g.rang === p.rang) {
        await banniere('Égalité !', 'Personne ne gagne de pièces', '#6c757d', 1.8);
      } else {
        g.p.victoiresMJ++;
        var pris = Math.min(mise, p.p.pieces);
        p.p.pieces -= pris;
        changerPieces(g.p, pris, true);
        flottant(p.p.x, p.p.y - 70, '−' + pris, '#ff4d6d');
        F.son.gain();
        await banniere(g.p.nom + ' gagne le duel !', 'et prend ' + pris + ' pièces à ' + p.p.nom, g.p.couleur, 2.2);
      }
    }

    // ---------- Mini-jeux ----------
    function choisirMiniJeu() {
      var l = F.MINIJEUX.filter(function (m) { return m.id !== S.dernierMJ; });
      var m = F.choisir(l);
      S.dernierMJ = m.id;
      return m;
    }

    async function jouerMiniJeu(parts, mj, titre, enjeu, gains) {
      var particulesMJ = new F.Particules();
      await transition(function () {
        S.phase = 'minijeu';
        S.mj = { def: mj, titre: titre, enjeu: enjeu, parts: parts, etape: 'intro', prets: {}, inst: null, particules: particulesMJ, t0: F.t };
        F.musique('minijeu');
      });
      // Les spectateurs (en duel) regardent
      S.joueurs.forEach(function (P) {
        if (parts.indexOf(P) === -1) envoyerUI(P, { emoji: '🍿', titre: 'Duel en cours', texte: parts[0].nom + ' contre ' + parts[1].nom + ' : regarde la télé !' });
      });
      await attendreTous(parts, function (P) {
        return {
          emoji: mj.emoji, titre: mj.nom, texte: mj.regle + '\n\n🎮 ' + mj.controles,
          boutons: [{ id: 'pret', label: '✋ Je suis prêt !' }]
        };
      }, 'pret', 20).then(function () {});
      // Les "prêts" sont visibles sur la télé au fur et à mesure (voir message)
      S.mj.etape = 'compte';
      parts.forEach(function (P) { envoyerUI(P, { emoji: '⏳', titre: 'Attention…', texte: 'Ça commence !' }); });
      for (var n = 3; n >= 1; n--) { S.mj.compte = n; S.mj.compteT = F.t; F.son.compte(); await F.attendre(0.75); }
      var env = {
        son: F.son, particules: particulesMJ,
        envoyerUI: function (P, ui) { envoyerUI(P, ui); }
      };
      S.mj.inst = mj.creer(parts, env);
      parts.forEach(function (P) { envoyerUI(P, mj.ui(P)); });
      S.mj.compte = 'GO !'; S.mj.compteT = F.t; F.son.go();
      S.mj.etape = 'jeu'; S.mj.debut = F.t;
      while (!arrete && !S.mj.inst.fini && F.t - S.mj.debut < mj.duree / F.V) await F.attendre(0.05);
      S.mj.etape = 'fin';
      F.son.cymbale();
      parts.forEach(function (P) { envoyerUI(P, { emoji: '🏁', titre: 'Terminé !', texte: 'Regarde les résultats sur la télé' }); });
      await F.attendre(1.4);
      var scores = S.mj.inst.scores().sort(function (a, b) { return b.score - a.score; });
      var rang = 0;
      scores.forEach(function (s, i) { if (i === 0 || s.score !== scores[i - 1].score) rang = i + 1; s.rang = rang; });
      if (gains) scores.forEach(function (r) { r.gain = gains(r); });
      S.mj.resultats = scores;
      S.mj.etape = 'resultats';
      S.mj.resT = F.t;
      F.son.fanfare();
      await F.attendre(3.6);
      return scores;
    }

    async function miniJeuDeFinDeTour() {
      vueGenerale();
      await banniere('C\'est l\'heure du mini-jeu !', 'Tout le monde joue', '#ff006e', 1.8);
      var mj = choisirMiniJeu();
      var n = S.joueurs.length;
      var gains = n >= 3 ? [10, 5, 2] : [10, 3];
      var res = await jouerMiniJeu(S.joueurs.slice(), mj, 'MINI-JEU', 'Le gagnant remporte 10 pièces',
        function (r) { return gains[r.rang - 1] || 0; });
      await transition(function () { S.phase = 'plateau'; S.mj = null; F.musique('plateau'); vueGenerale(); });
      res.forEach(function (r) {
        if (r.rang === 1) r.p.victoiresMJ++;
        if (r.gain) changerPieces(r.p, r.gain, true);
      });
      F.son.gain();
      await F.attendre(1.6);
    }

    // ---------- Tour d'un joueur ----------
    async function tourJoueur(P) {
      S.actif = P;
      viser(P.x, P.y, 1.45);
      infoAutres(P, { emoji: '👀', titre: 'Tour de ' + P.nom, texte: 'Regarde la télé !' });
      await banniere('À toi, ' + P.nom + ' !', 'Tour ' + S.tour + ' / ' + S.nbTours, P.couleur, 1.5);
      S.de = { roule: true, valeur: 1, prochain: 0, rot: 0, echelle: 0, restant: null };
      F.anim(0.4, function (p) { S.de.echelle = F.ease.back(p); });
      await demander(P, {
        emoji: '🎲', titre: 'À toi de jouer !', texte: 'Lance le dé (1 à 10)',
        boutons: [{ id: 'lancer', label: '🎲 LANCER LE DÉ' }], disposition: 'geant', vibrer: [60, 40, 60]
      }, 'lancer', 30);
      var valeur = F.entier(1, 10);
      S.de.roule = false; S.de.valeur = valeur; S.de.rot = 0;
      F.son.deStop();
      F.anim(0.3, function (p) { S.de.echelle = 1 + Math.sin(p * Math.PI) * 0.35; });
      envoyerUI(P, { emoji: '🏃', titre: valeur + (valeur > 1 ? ' cases !' : ' case !'), texte: 'Ton pion avance…' });
      await F.attendre(0.7);
      S.de.restant = valeur;
      for (var i = 0; i < valeur; i++) {
        var cs = S.cases[P.case], vers = cs.suivantes[0];
        if (cs.suivantes.length > 1) {
          viser(cs.x + 60, cs.y, 1.3);
          var choix = await demander(P, {
            emoji: '🔀', titre: 'Embranchement !', texte: 'Quel chemin prends-tu ?',
            boutons: [
              { id: '0', label: '🌳 Le tour par la forêt', sous: 'Plus long, plus tranquille' },
              { id: '1', label: '🏰 Le raccourci du château', sous: 'Plus court, mais plein de pièges' }
            ]
          }, '0', 25);
          vers = cs.suivantes[+choix] !== undefined ? cs.suivantes[+choix] : vers;
          envoyerUI(P, { emoji: '🏃', titre: (valeur - i) + ' cases restantes', texte: 'Ton pion avance…' });
        }
        await sauter(P, vers, i);
        P.parcours++;
        S.de.restant = valeur - i - 1;
        if (P.case === S.etoileCase) { await offreEtoile(P); viser(P.x, P.y, 1.55); }
      }
      S.de = null;
      await effetCase(P);
      rafraichirStats();
      await F.attendre(0.4);
    }

    // ---------- Partie ----------
    async function introduction() {
      S.phase = 'intro';
      F.musique('plateau');
      var chef = S.joueurs[0];
      infoAutres(chef, { emoji: '👑', titre: 'Fiesta Royale', texte: chef.nom + ' choisit la durée de la partie…' });
      var n = await demander(chef, {
        emoji: '👑', titre: 'Fiesta Royale', texte: 'Combien de tours ?',
        boutons: [
          { id: '5', label: '5 tours', sous: 'Partie rapide · environ 15 min' },
          { id: '8', label: '8 tours', sous: 'Partie normale · environ 25 min' },
          { id: '12', label: '12 tours', sous: 'Longue partie · environ 40 min' }
        ]
      }, '8', 60);
      S.nbTours = window.FIESTA_TOURS || +n || 8;
      S.phase = 'regles';
      await attendreTous(S.joueurs, function () {
        return { emoji: '📜', titre: 'Les règles', texte: 'Lis les règles sur la télé.', boutons: [{ id: 'ok', label: '👍 C\'est parti !' }] };
      }, 'ok', 25);
      await transition(function () { S.phase = 'plateau'; viser(S.cases[0].x, S.cases[0].y, 1.6); });
      // Arrivée des pions
      for (var i = 0; i < S.joueurs.length; i++) {
        var P = S.joueurs[i], pos = positionSurCase(P);
        P.x = pos.x; P.y = pos.y; P.visible = true; P.enMouvement = true;
        await F.anim(0.5, function (p) { P.saut = (1 - F.ease.rebond(p)) * 500; });
        P.saut = 0; P.enMouvement = false;
        F.son.pas(i * 2);
        S.particules.gerbe(P.x, P.y + 20, 10, { couleur: '#f6e2b3', haut: 100, vmax: 200, g: 600 });
      }
      await banniere('Chacun commence avec ' + PIECES_DEPART + ' pièces', '', '#06d6a0', 1.6);
      S.etoileCase = placerEtoile(true);
      var e = S.cases[S.etoileCase];
      viser(e.x, e.y, 1.5);
      F.son.etoile();
      await banniere('Voici l\'étoile !', 'Passe dessus avec ' + PRIX_ETOILE + ' pièces pour l\'acheter', '#ff9f1c', 2.4);
    }

    async function finale() {
      await transition(function () { S.phase = 'plateau'; vueGenerale(); F.musique('final'); });
      await banniere('Fin de la partie !', 'Place aux récompenses…', '#ff006e', 2);
      S.joueurs.forEach(function (P) { envoyerUI(P, { emoji: '🥁', titre: 'Les récompenses…', texte: 'Regarde la télé !' }); });
      for (var b = 0; b < BONUS.length; b++) {
        var bo = BONUS[b];
        var max = Math.max.apply(null, S.joueurs.map(bo.val));
        var gagnants = max > 0 ? S.joueurs.filter(function (P) { return bo.val(P) === max; }) : [];
        S.carte = { titre: 'Bonus : ' + bo.titre, texte: bo.texte, gagnants: gagnants, t0: F.t, valeur: max };
        F.son.roulement(1.4);
        await F.attendre(1.6);
        S.carte.revele = true;
        if (gagnants.length) { F.son.etoile(); gagnants.forEach(function (P) { P.etoiles++; }); }
        await F.attendre(2.6);
        S.carte = null;
        await F.attendre(0.3);
      }
      // Podium
      var cl = classement();
      await transition(function () { S.phase = 'podium'; S.podium = { ordre: cl, reveles: 0, t0: F.t }; });
      for (var r = cl.length - 1; r >= 0; r--) {
        F.son.roulement(r === 0 ? 2 : 1);
        await F.attendre(r === 0 ? 2.2 : 1.3);
        S.podium.reveles = cl.length - r;
        if (r === 0) { F.son.cymbale(); F.son.fanfare(); S.podium.fete = F.t; } else F.son.pop();
        await F.attendre(1);
      }
      cl.forEach(function (P) {
        var emo = P.rang === 1 ? '🏆' : (P.rang === 2 ? '🥈' : (P.rang === 3 ? '🥉' : '🎉'));
        envoyerUI(P, {
          emoji: emo, titre: P.rang === 1 ? 'Victoire !' : texteRang(P.rang) + ' place',
          texte: P.etoiles + ' étoile(s) · ' + P.pieces + ' pièces', vibrer: P.rang === 1 ? [100, 60, 100, 60, 300] : 80
        });
      });
      await F.attendre(3);
      var choix = await Promise.race(S.joueurs.map(function (P) {
        return demander(P, {
          emoji: P.rang === 1 ? '🏆' : '🎉', titre: P.rang === 1 ? 'Victoire !' : texteRang(P.rang) + ' place',
          texte: 'Encore une partie ?', boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      demandes = {};
      return choix;
    }

    function initialiserJoueurs() {
      S.joueurs = api.joueurs().map(function (j) {
        return {
          num: j.numero, nom: j.nom, couleur: j.couleur, pieces: PIECES_DEPART, etoiles: 0, case: 0,
          x: S.cases[0].x, y: S.cases[0].y, saut: 0, ecrase: 0, visible: false, enMouvement: false,
          affPieces: PIECES_DEPART, affEtoiles: 0, victoiresMJ: 0, gainsTotal: 0, rouges: 0, bleues: 0, parcours: 0, rang: 1
        };
      });
    }

    async function partie() {
      initialiserJoueurs();
      S.tour = 0; S.etoileCase = -1; S.podium = null; S.carte = null;
      await introduction();
      for (S.tour = 1; S.tour <= S.nbTours && !arrete; S.tour++) {
        vueGenerale();
        if (S.tour === S.nbTours) await banniere('Dernier tour !', 'Les cases bleues et rouges comptent double', '#d00000', 2.4);
        else await banniere('Tour ' + S.tour + ' / ' + S.nbTours, '', '#3a86ff', 1.4);
        for (var i = 0; i < S.joueurs.length && !arrete; i++) await tourJoueur(S.joueurs[i]);
        S.actif = null;
        if (!arrete) await miniJeuDeFinDeTour();
      }
      if (arrete) return;
      var choix = await finale();
      if (arrete) return;
      if (choix === 'rejouer') {
        await transition(function () { S.phase = 'intro'; S.intro.t0 = F.t; vueGenerale(); });
        partie();
      } else api.quitter();
    }

    // ---------- Dessin ----------
    function echelleBase(W, H) { return Math.min(W / 1600, H / 900); }

    function image(c, W, H, dt) {
      if (arrete) return;
      F.majAnims(dt);
      verifierDemandes(dt);
      S.particules.maj(dt);
      if (S.mj && S.mj.particules) S.mj.particules.maj(dt);
      // caméra
      var k = 1 - Math.exp(-dt * 4);
      S.cam.x += (S.camCible.x - S.cam.x) * k; S.cam.y += (S.camCible.y - S.cam.y) * k; S.cam.z += (S.camCible.z - S.cam.z) * k;
      // pions immobiles : glissent vers leur place
      S.joueurs.forEach(function (P) {
        if (!P.enMouvement && P.visible) { var p = positionSurCase(P); P.x += (p.x - P.x) * k * 2; P.y += (p.y - P.y) * k * 2; }
        P.affPieces += (P.pieces - P.affPieces) * Math.min(1, dt * 6);
      });
      // dé qui roule
      if (S.de && S.de.roule && F.t >= S.de.prochain) { S.de.valeur = F.entier(1, 10); S.de.prochain = F.t + 0.07; S.de.rot = F.alea(-0.25, 0.25); F.son.de(); }

      if (S.phase === 'minijeu') dessinerMiniJeu(c, W, H, dt);
      else if (S.phase === 'podium') dessinerPodium(c, W, H);
      else {
        dessinerMonde(c, W, H);
        if (S.phase === 'intro' || S.phase === 'regles') dessinerTitre(c, W, H);
        else dessinerHUD(c, W, H);
      }
      dessinerBanniere(c, W, H);
      if (S.roulette) dessinerRoulette(c, W, H);
      if (S.vs) dessinerVS(c, W, H);
      if (S.carte) dessinerCarteBonus(c, W, H);
      if (S.rideau > 0) dessinerRideau(c, W, H);
    }

    function dessinerMonde(c, W, H) {
      var bs = echelleBase(W, H), s = bs * S.cam.z;
      var voulue = Math.min(1.4, bs * 1.3); // limite la taille de l'image (mémoire de la télé)
      if (!S.decor || Math.abs(S.decorEchelle - voulue) > 0.01 || (S.decor.sans3d && F.decor3dPret() && Kenney3D.pret())) { S.decor = F.dessinerDecor(S.cases, voulue); S.decorEchelle = voulue; }
      F.dessinerMer(c, W, H, S.cam);
      c.save();
      c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-S.cam.x, -S.cam.y);
      F.dessinerEcume(c);
      var Md = F.MARGE_DECOR;
      c.drawImage(S.decor, -Md, -Md, 1600 + 2 * Md, 900 + 2 * Md);
      F.dessinerVolcanVivant(c, F.t < S.volcanColere);
      if (S.eclatCase && F.t - S.eclatCase.t0 < 1.2) F.dessinerCase(c, S.cases[S.eclatCase.id], 1 - (F.t - S.eclatCase.t0) / 1.2);
      // étoile
      if (S.etoileCase >= 0) {
        var e = S.cases[S.etoileCase], b = Math.sin(F.t * 3) * 6;
        var g = c.createRadialGradient(e.x, e.y - 40, 5, e.x, e.y - 40, 80);
        g.addColorStop(0, 'rgba(255,220,120,.75)'); g.addColorStop(1, 'rgba(255,220,120,0)');
        c.fillStyle = g; c.beginPath(); c.arc(e.x, e.y - 40, 80, 0, 7); c.fill();
        F.etoile(c, e.x, e.y - 52 + b, 30, Math.sin(F.t * 1.5) * 0.2);
        c.fillStyle = 'rgba(0,0,0,.6)'; F.rr(c, e.x - 26, e.y - 106 + b, 52, 26, 13); c.fill();
        F.coquillage(c, e.x - 11, e.y - 93 + b, 8);
        F.texte(c, String(PRIX_ETOILE), e.x + 9, e.y - 92 + b, 17, '#fff', { contour: false });
      }
      if (S.etoileVol) F.etoile(c, S.etoileVol.x, S.etoileVol.y - 40, 34, F.t * 6);
      // pions
      S.joueurs.filter(function (P) { return P.visible; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (P) {
        var actif = S.actif === P;
        if (actif && !P.enMouvement) {
          c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(F.t * 5)) + ')'; c.lineWidth = 4;
          c.beginPath(); c.ellipse(P.x, P.y + 20, 34, 15, 0, 0, 7); c.stroke();
        }
        c.save();
        if (P.tourne) { c.translate(P.x, P.y - P.saut); c.rotate(P.tourne); c.translate(-P.x, -(P.y - P.saut)); }
        F.pion(c, P.x, P.y, 22, P.couleur, P.nom.charAt(0).toUpperCase(), {
          saut: P.saut + (P.joie > F.t ? Math.abs(Math.sin(F.t * 12)) * 25 : 0) + (!P.enMouvement && actif ? Math.abs(Math.sin(F.t * 4)) * 6 : 0),
          ecrase: P.ecrase, triste: P.triste > F.t, phase: P.num
        });
        c.restore();
      });
      // dé
      if (S.de && S.actif) {
        var A = S.actif, dy = Math.sin(F.t * 4) * 5;
        var taille = 54 * (S.de.echelle || 1);
        if (S.de.restant === null) F.de(c, A.x, A.y - 105 - A.saut + dy, taille, S.de.valeur, S.de.roule ? S.de.rot : 0, A.couleur, true);
        else if (S.de.restant > 0) {
          c.fillStyle = A.couleur; c.beginPath(); c.arc(A.x, A.y - 92 - A.saut, 24, 0, 7); c.fill();
          c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();
          F.texte(c, String(S.de.restant), A.x, A.y - 91 - A.saut, 30, '#fff');
        }
      }
      // textes flottants
      S.flottants = S.flottants.filter(function (f) { return F.t - f.t0 < 1.6; });
      S.flottants.forEach(function (f) {
        var p = (F.t - f.t0) / 1.6;
        c.globalAlpha = 1 - Math.pow(p, 3);
        F.texte(c, f.texte, f.x, f.y - p * 70, 40 * (p < 0.15 ? F.ease.back(p / 0.15) : 1), f.couleur, { contour: 'rgba(0,0,0,.7)', epaisseur: 7 });
        c.globalAlpha = 1;
      });
      S.particules.dessiner(c);
      c.restore();
    }

    function dessinerHUD(c, W, H) {
      var u = H / 1080;
      var cl = classement();
      var cw = 380 * u, ch = 112 * u, m = 26 * u;
      var places = [[m, H - ch - m], [W - cw - m, H - ch - m], [m, m], [W - cw - m, m]];
      S.joueurs.forEach(function (P, i) {
        var x = places[i][0], y = places[i][1], actif = S.actif === P;
        c.save();
        if (actif) { c.shadowColor = P.couleur; c.shadowBlur = 30 * u * (0.6 + 0.4 * Math.sin(F.t * 5)); }
        c.fillStyle = 'rgba(16,24,40,.82)'; F.rr(c, x, y, cw, ch, 22 * u); c.fill();
        c.restore();
        c.fillStyle = P.couleur; F.rr(c, x, y, 14 * u, ch, 7 * u); c.fill();
        if (actif) { c.lineWidth = 4 * u; c.strokeStyle = P.couleur; F.rr(c, x, y, cw, ch, 22 * u); c.stroke(); }
        F.pion(c, x + 62 * u, y + ch / 2 + 4 * u, 30 * u, P.couleur, null, { phase: P.num, triste: P.triste > F.t });
        F.texte(c, P.nom, x + 108 * u, y + 34 * u, 32 * u, '#fff', { align: 'left', contour: false });
        F.coquillage(c, x + 122 * u, y + 80 * u, 16 * u);
        F.texte(c, String(Math.round(P.affPieces)), x + 146 * u, y + 81 * u, 34 * u, '#ffd166', { align: 'left', contour: false });
        F.etoile(c, x + 236 * u, y + 80 * u, 19 * u, 0);
        F.texte(c, String(P.etoiles), x + 262 * u, y + 81 * u, 34 * u, '#ffb4a2', { align: 'left', contour: false });
        // rang
        var rc = P.rang === 1 ? '#ffd166' : (P.rang === 2 ? '#ced4da' : (P.rang === 3 ? '#e09f3e' : '#6c757d'));
        c.fillStyle = rc; c.beginPath(); c.arc(x + cw - 42 * u, y + ch / 2, 28 * u, 0, 7); c.fill();
        F.texte(c, texteRang(P.rang), x + cw - 42 * u, y + ch / 2 + 2 * u, 22 * u, '#1b1b2f', { contour: false });
      });
      // tour
      if (S.tour > 0) {
        var tw = 300 * u, th = 64 * u, tx = W / 2 - tw / 2, ty = 22 * u;
        c.fillStyle = 'rgba(16,24,40,.82)'; F.rr(c, tx, ty, tw, th, th / 2); c.fill();
        F.texte(c, (S.tour === S.nbTours ? 'DERNIER TOUR' : 'Tour ' + Math.min(S.tour, S.nbTours) + ' / ' + S.nbTours), W / 2, ty + th / 2 + 2 * u, 34 * u, S.tour === S.nbTours ? '#ff4d6d' : '#fff', { contour: false });
      }
    }

    function dessinerTitre(c, W, H) {
      var u = H / 1080;
      c.fillStyle = 'rgba(3, 20, 40, .55)'; c.fillRect(0, 0, W, H);
      var t = F.t - S.intro.t0;
      var titre = 'Fiesta Royale';
      c.font = '700 ' + Math.round(150 * u) + 'px ' + F.POLICE;
      var largeur = c.measureText(titre).width, x = W / 2 - largeur / 2;
      var couleurs = ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff', '#06d6a0'];
      for (var i = 0; i < titre.length; i++) {
        var ch = titre.charAt(i), w = c.measureText(ch).width;
        var y = H * 0.26 + Math.sin(t * 3 + i * 0.5) * 12 * u;
        F.texte(c, ch, x + w / 2, y, 150 * u, couleurs[i % couleurs.length], { contour: '#1b1b2f', epaisseur: 18 * u });
        x += w;
      }
      F.etoile(c, W / 2 - largeur / 2 - 80 * u, H * 0.26, 50 * u, Math.sin(t) * 0.3);
      F.etoile(c, W / 2 + largeur / 2 + 80 * u, H * 0.26, 50 * u, -Math.sin(t) * 0.3);
      if (S.phase === 'intro') {
        F.texte(c, 'Le grand jeu de plateau du royaume !', W / 2, H * 0.4, 44 * u, '#fff');
        var n = S.joueurs.length, esp = 240 * u;
        S.joueurs.forEach(function (P, k) {
          var px = W / 2 - (n - 1) * esp / 2 + k * esp;
          F.pion(c, px, H * 0.6, 60 * u, P.couleur, null, { saut: Math.abs(Math.sin(t * 3 + k)) * 30 * u, phase: k });
          F.texte(c, P.nom, px, H * 0.6 + 110 * u, 40 * u, '#fff');
        });
        if (S.joueurs[0]) F.texte(c, S.joueurs[0].nom + ' choisit le nombre de tours sur son téléphone…', W / 2, H * 0.88, 36 * u, '#ffd166');
      } else {
        var bw = 1240 * u, bh = 560 * u, bx = W / 2 - bw / 2, by = H * 0.37;
        c.fillStyle = 'rgba(16,24,40,.88)'; F.rr(c, bx, by, bw, bh, 30 * u); c.fill();
        F.texte(c, 'Les règles en bref (' + S.nbTours + ' tours)', W / 2, by + 60 * u, 48 * u, '#ffd166', { contour: false });
        var lignes = [
          ['de', 'Lance le dé sur ton téléphone et avance de 1 à 10 cases.'],
          ['etoile', 'Passe sur l\'étoile avec 20 pièces pour l\'acheter.'],
          ['bleu', 'Case bleue : +3 pièces.   Case rouge : −3.'],
          ['chance', 'Case verte : surprise !   Case violette : duel contre un joueur.'],
          ['coquillage', 'À la fin de chaque tour : un mini-jeu pour gagner des pièces.'],
          ['podium', 'À la fin, le plus d\'étoiles gagne. Bonne chance !']
        ];
        lignes.forEach(function (l, k) {
          var ly = by + 140 * u + k * 70 * u, ix = bx + 90 * u;
          if (l[0] === 'de') F.de(c, ix, ly, 46 * u, 6, 0, '#ff006e');
          else if (l[0] === 'etoile') F.etoile(c, ix, ly, 26 * u, 0);
          else if (l[0] === 'bleu') { c.fillStyle = '#3a86ff'; c.beginPath(); c.arc(ix - 14 * u, ly, 16 * u, 0, 7); c.fill(); c.fillStyle = '#ef476f'; c.beginPath(); c.arc(ix + 14 * u, ly, 16 * u, 0, 7); c.fill(); }
          else if (l[0] === 'chance') { c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(ix - 14 * u, ly, 16 * u, 0, 7); c.fill(); c.fillStyle = '#9b5de5'; c.beginPath(); c.arc(ix + 14 * u, ly, 16 * u, 0, 7); c.fill(); }
          else if (l[0] === 'coquillage') F.coquillage(c, ix, ly, 22 * u);
          else F.texte(c, '1', ix, ly, 40 * u, '#ffd166');
          F.texte(c, l[1], ix + 60 * u, ly + 2 * u, 34 * u, '#fff', { align: 'left', contour: false });
        });
        F.texte(c, 'Appuyez sur « C\'est parti ! » sur vos téléphones', W / 2, by + bh + 50 * u, 32 * u, '#ffd166');
      }
    }

    function dessinerBanniere(c, W, H) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0, d = b.duree;
      if (t > d) { S.banniere = null; return; }
      var u = H / 1080;
      var entree = Math.min(1, t * F.V / 0.35), sortie = Math.max(0, (t - (d - 0.3 / F.V)) * F.V / 0.3);
      var x = (1 - F.ease.back(entree)) * -W + sortie * W;
      var y = H * 0.42, h = (b.sous ? 190 : 150) * u;
      c.save();
      c.translate(x, 0);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y - h / 2 + 10 * u, W, h);
      var g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      g.addColorStop(0, F.eclaircir(b.couleur, 0.2)); g.addColorStop(1, F.assombrir(b.couleur, 0.2));
      c.fillStyle = g; c.fillRect(0, y - h / 2, W, h);
      c.fillStyle = 'rgba(255,255,255,.18)';
      for (var i = 0; i < 20; i++) { c.beginPath(); c.moveTo(i * 120 * u + (F.t * 80 * u) % (120 * u), y - h / 2); c.lineTo(i * 120 * u + 50 * u + (F.t * 80 * u) % (120 * u), y - h / 2); c.lineTo(i * 120 * u - 40 * u + (F.t * 80 * u) % (120 * u), y + h / 2); c.lineTo(i * 120 * u - 90 * u + (F.t * 80 * u) % (120 * u), y + h / 2); c.fill(); }
      c.fillStyle = '#fff'; c.fillRect(0, y - h / 2, W, 6 * u); c.fillRect(0, y + h / 2 - 6 * u, W, 6 * u);
      F.texte(c, b.texte, W / 2, y - (b.sous ? 26 * u : 0), 84 * u, '#fff', { contour: 'rgba(0,0,0,.45)', epaisseur: 12 * u });
      if (b.sous) F.texte(c, b.sous, W / 2, y + 52 * u, 38 * u, '#fff', { contour: 'rgba(0,0,0,.35)', epaisseur: 6 * u });
      c.restore();
    }

    function dessinerRoulette(c, W, H) {
      var u = H / 1080, r = S.roulette;
      var bw = 900 * u, bh = 330 * u, x = W / 2 - bw / 2, y = H * 0.18;
      c.save();
      c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 30 * u;
      c.fillStyle = '#073b4c'; F.rr(c, x, y, bw, bh, 34 * u); c.fill();
      c.restore();
      c.lineWidth = 8 * u; c.strokeStyle = '#06d6a0'; F.rr(c, x, y, bw, bh, 34 * u); c.stroke();
      F.texte(c, 'SURPRISE !', W / 2, y + 56 * u, 50 * u, '#06d6a0', { contour: false });
      var ev = r.liste[r.idx];
      var pulse = r.fini ? 1 + Math.sin(F.t * 10) * 0.04 : 1;
      F.texte(c, ev.nom, W / 2, y + 160 * u, 72 * u * pulse, r.fini ? '#ffd166' : '#fff');
      F.texte(c, ev.texte, W / 2, y + 250 * u, 38 * u, '#caf0f8', { contour: false });
      if (!r.fini) {
        c.fillStyle = 'rgba(255,255,255,.25)';
        for (var k = 0; k < r.liste.length; k++) { c.beginPath(); c.arc(W / 2 - (r.liste.length - 1) * 14 * u + k * 28 * u, y + bh - 30 * u, (k === r.idx ? 9 : 6) * u, 0, 7); c.fill(); }
      }
    }

    function dessinerVS(c, W, H) {
      var u = H / 1080, t = F.t - S.vs.t0, p = Math.min(1, t / 0.5);
      c.fillStyle = 'rgba(40, 0, 70, ' + 0.85 * p + ')'; c.fillRect(0, 0, W, H);
      var A = S.vs.a, B = S.vs.b;
      var ax = F.lerp(-200 * u, W * 0.27, F.ease.back(p)), bx = F.lerp(W + 200 * u, W * 0.73, F.ease.back(p));
      c.save();
      c.fillStyle = A.couleur; c.globalAlpha = 0.35;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.55, 0); c.lineTo(W * 0.45, H); c.lineTo(0, H); c.fill();
      c.fillStyle = B.couleur;
      c.beginPath(); c.moveTo(W * 0.55, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(W * 0.45, H); c.fill();
      c.restore();
      F.pion(c, ax, H * 0.52, 130 * u, A.couleur, null, { phase: 1 });
      F.pion(c, bx, H * 0.52, 130 * u, B.couleur, null, { phase: 2, regard: -1 });
      F.texte(c, A.nom, ax, H * 0.78, 64 * u, '#fff');
      F.texte(c, B.nom, bx, H * 0.78, 64 * u, '#fff');
      var s = t > 0.4 ? 1 + Math.max(0, 0.6 - (t - 0.4)) * 1.2 : 0;
      F.texte(c, 'VS', W / 2, H * 0.5, 200 * u * s, '#ffd166', { contour: '#d00000', epaisseur: 22 * u });
      F.texte(c, 'Mise : ' + S.vs.mise + ' pièces', W / 2, H * 0.9, 44 * u, '#fff');
    }

    function dessinerCarteBonus(c, W, H) {
      var u = H / 1080, k = S.carte, p = Math.min(1, (F.t - k.t0) / 0.4);
      c.fillStyle = 'rgba(0,0,0,' + 0.55 * p + ')'; c.fillRect(0, 0, W, H);
      var bw = 1000 * u, bh = 560 * u, x = W / 2 - bw / 2, y = H / 2 - bh / 2 + (1 - F.ease.back(p)) * H;
      c.fillStyle = '#fff8e1'; F.rr(c, x, y, bw, bh, 40 * u); c.fill();
      c.lineWidth = 10 * u; c.strokeStyle = '#ffb703'; F.rr(c, x, y, bw, bh, 40 * u); c.stroke();
      F.texte(c, k.titre, W / 2, y + 80 * u, 60 * u, '#fb8500', { contour: false });
      F.texte(c, k.texte, W / 2, y + 150 * u, 38 * u, '#6c757d', { contour: false });
      if (!k.revele) {
        F.texte(c, '?', W / 2, y + 330 * u + Math.sin(F.t * 8) * 10 * u, 160 * u, '#ffb703', { contour: false });
      } else if (!k.gagnants.length) {
        F.texte(c, 'Personne !', W / 2, y + 330 * u, 70 * u, '#6c757d', { contour: false });
      } else {
        var n = k.gagnants.length, esp = 260 * u;
        k.gagnants.forEach(function (P, i) {
          var px = W / 2 - (n - 1) * esp / 2 + i * esp;
          F.pion(c, px, y + 310 * u, 70 * u, P.couleur, null, { saut: Math.abs(Math.sin(F.t * 8 + i)) * 24 * u, phase: i });
          F.texte(c, P.nom, px, y + 420 * u, 44 * u, '#1b1b2f', { contour: false });
        });
        F.etoile(c, W / 2 - 60 * u, y + 495 * u, 28 * u, 0);
        F.texte(c, '+1 étoile', W / 2 + 40 * u, y + 497 * u, 40 * u, '#fb8500', { contour: false });
      }
    }

    function dessinerRideau(c, W, H) {
      var d = Math.hypot(W, H) / 2, r = (1 - F.ease.inOut(S.rideau)) * d;
      c.save();
      c.fillStyle = '#ff006e';
      c.beginPath(); c.rect(0, 0, W, H); c.arc(W / 2, H / 2, Math.max(0, r), 0, Math.PI * 2, true); c.fill('evenodd');
      if (S.rideau > 0.95) F.etoile(c, W / 2, H / 2, H * 0.12, F.t * 3);
      c.restore();
    }

    // ---------- Dessin des mini-jeux ----------
    function dessinerMiniJeu(c, W, H, dt) {
      var M = S.mj, u = H / 1080, def = M.def;
      var bs = echelleBase(W, H);
      c.fillStyle = (M.inst && M.inst.fond) || '#1b1b2f';
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate((W - 1600 * bs) / 2, (H - 900 * bs) / 2);
      c.scale(bs, bs);
      c.beginPath(); c.rect(0, 0, 1600, 900); c.clip();
      if (M.inst) {
        try { if (M.etape === 'jeu') M.inst.maj(Math.min(0.05, dt) * F.V); } catch (e) { console.error(e); }
        M.inst.dessiner(c);
      } else {
        var g = c.createLinearGradient(0, 0, 1600, 900);
        g.addColorStop(0, '#3a0ca3'); g.addColorStop(1, '#f72585');
        c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
        c.fillStyle = 'rgba(255,255,255,.07)';
        for (var i = 0; i < 12; i++) { c.save(); c.translate(800, 450); c.rotate(F.t * 0.2 + i * Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(1200, -110); c.lineTo(1200, 110); c.fill(); c.restore(); }
      }
      M.particules.dessiner(c);
      c.restore();

      if (M.etape === 'compte') { c.fillStyle = 'rgba(10,10,30,.35)'; c.fillRect(0, 0, W, H); }
      if (M.etape === 'intro') {
        c.fillStyle = 'rgba(10,10,30,.55)'; c.fillRect(0, 0, W, H);
        var bw = 1300 * u, bh = 700 * u, x = W / 2 - bw / 2, y = H / 2 - bh / 2;
        c.fillStyle = 'rgba(16,24,40,.92)'; F.rr(c, x, y, bw, bh, 40 * u); c.fill();
        c.lineWidth = 8 * u; c.strokeStyle = '#ffd166'; F.rr(c, x, y, bw, bh, 40 * u); c.stroke();
        F.texte(c, M.titre, W / 2, y + 60 * u, 40 * u, '#ff4d6d', { contour: false });
        F.texte(c, def.nom, W / 2, y + 140 * u, 86 * u, '#ffd166');
        enveloppe(c, def.regle, W / 2, y + 250 * u, bw - 160 * u, 38 * u, '#fff');
        F.texte(c, 'Commandes : ' + def.controles, W / 2, y + 420 * u, 34 * u, '#90e0ef', { contour: false });
        if (M.enjeu) F.texte(c, M.enjeu, W / 2, y + 475 * u, 32 * u, '#ffd166', { contour: false });
        var n = M.parts.length, esp = Math.min(260 * u, (bw - 100 * u) / n);
        M.parts.forEach(function (P, k) {
          var px = W / 2 - (n - 1) * esp / 2 + k * esp, pret = !demandes[P.num] || M.etape === 'compte';
          F.pion(c, px, y + 580 * u, 40 * u, P.couleur, null, { phase: k, saut: pret ? Math.abs(Math.sin(F.t * 6 + k)) * 12 * u : 0 });
          F.texte(c, P.nom, px, y + 650 * u, 30 * u, '#fff');
          F.texte(c, pret ? 'Prêt !' : '…', px + 56 * u, y + 548 * u, 26 * u, pret ? '#80ed99' : '#adb5bd');
        });
      }
      if ((M.etape === 'compte' || M.etape === 'jeu') && M.compte && F.t - M.compteT < 0.75 / F.V) {
        var p = (F.t - M.compteT) * F.V / 0.75;
        c.globalAlpha = 1 - p;
        F.texte(c, String(M.compte), W / 2, H / 2, (M.compte === 'GO !' ? 260 : 300) * u * (0.6 + 0.6 * F.ease.out(p)), '#ffd166', { contour: '#d00000', epaisseur: 24 * u });
        c.globalAlpha = 1;
      }
      if (M.etape === 'jeu' && def.duree <= 30) {
        var reste = Math.max(0, def.duree - (F.t - M.debut) * F.V);
        var lw = 560 * u, lx = W / 2 - lw / 2, ly = 18 * u;
        c.fillStyle = 'rgba(0,0,0,.5)'; F.rr(c, lx, ly, lw, 54 * u, 27 * u); c.fill();
        c.fillStyle = reste < 3 ? '#ff4d6d' : '#ffd166'; F.rr(c, lx + 6 * u, ly + 6 * u, (lw - 12 * u) * reste / def.duree, 42 * u, 21 * u); c.fill();
        F.texte(c, Math.ceil(reste) + ' s', W / 2, ly + 28 * u, 34 * u, '#fff');
      }
      if (M.etape === 'fin') F.texte(c, 'TERMINÉ !', W / 2, H / 2, 200 * u, '#fff', { contour: '#3a0ca3', epaisseur: 24 * u });
      if (M.etape === 'resultats') {
        var q = Math.min(1, (F.t - M.resT) * F.V / 0.4);
        c.fillStyle = 'rgba(10,10,30,' + 0.7 * q + ')'; c.fillRect(0, 0, W, H);
        F.texte(c, 'Résultats', W / 2, H * 0.14, 90 * u, '#ffd166');
        var res = M.resultats, lh = 130 * u;
        res.forEach(function (r, k) {
          var ly2 = H * 0.28 + k * lh, lx2 = W / 2 - 520 * u + (1 - F.ease.back(Math.min(1, Math.max(0, q * 2 - k * 0.2)))) * -W;
          c.fillStyle = r.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.12)';
          F.rr(c, lx2, ly2, 1040 * u, lh - 20 * u, 26 * u); c.fill();
          var col = r.rang === 1 ? '#1b1b2f' : '#fff';
          F.texte(c, texteRang(r.rang), lx2 + 70 * u, ly2 + 55 * u, 46 * u, col, { contour: false });
          F.pion(c, lx2 + 170 * u, ly2 + 58 * u, 34 * u, r.p.couleur, null, { phase: k, saut: r.rang === 1 ? Math.abs(Math.sin(F.t * 8)) * 12 * u : 0 });
          F.texte(c, r.p.nom, lx2 + 230 * u, ly2 + 55 * u, 46 * u, col, { align: 'left', contour: false });
          F.texte(c, r.texte, lx2 + (r.gain !== undefined && r.gain !== null ? 780 : 960) * u, ly2 + 55 * u, 38 * u, col, { align: 'right', contour: false });
          if (r.gain !== undefined && r.gain !== null) {
            F.coquillage(c, lx2 + 850 * u, ly2 + 55 * u, 18 * u);
            F.texte(c, '+' + r.gain, lx2 + 960 * u, ly2 + 55 * u, 42 * u, r.rang === 1 ? '#1b1b2f' : '#ffd166', { align: 'right', contour: false });
          }
        });
      }
    }
    function enveloppe(c, texte, x, y, largeur, taille, couleur) {
      c.font = '600 ' + Math.round(taille) + 'px ' + F.POLICE;
      var mots = texte.split(' '), ligne = '', lignes = [];
      mots.forEach(function (m) {
        var essai = ligne ? ligne + ' ' + m : m;
        if (c.measureText(essai).width > largeur && ligne) { lignes.push(ligne); ligne = m; } else ligne = essai;
      });
      if (ligne) lignes.push(ligne);
      lignes.forEach(function (l, i) { F.texte(c, l, x, y + i * taille * 1.3, taille, couleur, { contour: false, poids: 600 }); });
    }

    // ---------- Podium ----------
    function dessinerPodium(c, W, H) {
      var u = H / 1080, P = S.podium;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#240046'); g.addColorStop(1, '#5a189a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // projecteurs
      for (var i = 0; i < 3; i++) {
        var a = Math.sin(F.t * 0.8 + i * 2) * 0.35;
        c.save(); c.translate(W * (0.2 + i * 0.3), 0); c.rotate(a);
        var gl = c.createLinearGradient(0, 0, 0, H);
        gl.addColorStop(0, 'rgba(255,255,200,.35)'); gl.addColorStop(1, 'rgba(255,255,200,0)');
        c.fillStyle = gl; c.beginPath(); c.moveTo(-30 * u, 0); c.lineTo(30 * u, 0); c.lineTo(260 * u, H); c.lineTo(-260 * u, H); c.fill();
        c.restore();
      }
      F.texte(c, 'Le classement final', W / 2, H * 0.1, 80 * u, '#ffd166');
      var ordre = P.ordre, n = ordre.length;
      var hauteurs = { 1: 330, 2: 240, 3: 170, 4: 110 };
      var positions = n === 1 ? [0.5] : n === 2 ? [0.4, 0.6] : n === 3 ? [0.5, 0.3, 0.7] : [0.5, 0.3, 0.7, 0.88];
      ordre.forEach(function (J, k) {
        var visible = k >= n - P.reveles;
        var hx = W * positions[k], hh = (hauteurs[J.rang] || 100) * u, bw = 300 * u, by = H - 80 * u - hh;
        c.fillStyle = J.rang === 1 ? '#ffd166' : (J.rang === 2 ? '#ced4da' : (J.rang === 3 ? '#e09f3e' : '#6c757d'));
        F.rr(c, hx - bw / 2, by, bw, hh + 100 * u, 18 * u); c.fill();
        F.texte(c, texteRang(J.rang), hx, by + 60 * u, 70 * u, '#1b1b2f', { contour: false });
        if (!visible) { F.texte(c, '?', hx, by - 110 * u, 110 * u, '#fff'); return; }
        var gagnant = J.rang === 1 && P.fete;
        F.pion(c, hx, by - 90 * u, (gagnant ? 85 : 66) * u, J.couleur, null, { saut: gagnant ? Math.abs(Math.sin(F.t * 7)) * 50 * u : 0, phase: k, triste: J.rang === n && n > 1 });
        F.texte(c, J.nom, hx, by - 210 * u - (gagnant ? 40 * u : 0), 54 * u, '#fff');
        F.etoile(c, hx - 70 * u, by + 140 * u, 22 * u, 0);
        F.texte(c, String(J.etoiles), hx - 34 * u, by + 142 * u, 38 * u, '#1b1b2f', { contour: false });
        F.coquillage(c, hx + 40 * u, by + 140 * u, 18 * u);
        F.texte(c, String(J.pieces), hx + 82 * u, by + 142 * u, 38 * u, '#1b1b2f', { contour: false });
      });
      if (P.fete) {
        if (Math.random() < 0.7) S.particules.ajouter(F.alea(0, W), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18) * u, couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#fff']), forme: 'confetti' });
        F.texte(c, ordre[0].nom + ' remporte la Fiesta !', W / 2, H * 0.21, 64 * u * (1 + Math.sin(F.t * 4) * 0.03), '#fff', { contour: '#ff006e', epaisseur: 12 * u });
      }
      S.particules.dessiner(c);
    }

    // ---------- Liens avec la console ----------
    partie().catch(function (e) { console.error('Fiesta :', e); });

    return {
      image: image,
      message: function (j, m) {
        var P = PDe(j);
        if (!P) return;
        if (m.t === 'choix') {
          var d = demandes[P.num];
          if (d && (!m.cle || m.cle === d.cle)) { delete demandes[P.num]; F.son.clic(); d.ok(m.id); }
          return;
        }
        if (S.phase === 'minijeu' && S.mj && S.mj.inst && S.mj.etape === 'jeu' && S.mj.parts.indexOf(P) !== -1 && S.mj.inst.message) {
          S.mj.inst.message(P, m);
        }
      },
      arrivee: function (j) {
        var P = PDe(j);
        if (P) { if (P.ui) envoyerUI(P, P.ui); }
        else api.envoyer(j, { t: 'ui', ui: { emoji: '🍿', titre: 'Partie en cours', texte: 'Regarde la télé ! Tu pourras jouer à la prochaine partie.' } });
      },
      fin: function () { arrete = true; F.musique(null); F.viderAnims(); demandes = {}; }
    };
  }

  Console.ajouterJeu({
    id: 'fiesta',
    nom: 'Fiesta Royale',
    emoji: '👑',
    description: 'Le grand jeu de plateau du royaume : dé, pièces d\'or, étoiles, duels et mini-jeux !',
    min: 2,
    max: 4,
    perso: true,
    barre: false,
    creer: creer
  });
})(Fiesta);
