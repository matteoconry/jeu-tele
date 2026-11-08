/*
 * Le Grand Quiz — culture générale, 1 à 4 joueurs.
 * La question s'affiche sur la télé, chacun répond en secret sur son téléphone.
 * Points : 500 pour une bonne réponse + jusqu'à 500 selon la rapidité + bonus de série.
 */
(function (F) {
  'use strict';

  var DUREE = 15;
  var COULEURS = ['#e63946', '#3a86ff', '#f4a261', '#2a9d8f'];
  var LETTRES = ['A', 'B', 'C', 'D'];

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', q: null, num: 0, total: 10, particules: new F.Particules(), t0: F.t, podium: null, flottants: [] };
    var cl = [];

    L.stats = function (P) {
      cl = F.classer(L.joueurs, 'score');
      return { texte: '🧠 ' + P.score + ' pts · ' + F.texteRang(P.rang) };
    };

    async function partie() {
      L.initialiser({ score: 0, serie: 0, bonnes: 0, reponse: null, temps: 0, gain: 0, affScore: 0 });
      S.phase = 'titre'; S.t0 = F.t; S.podium = null;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '🧠', titre: 'Le Grand Quiz', texte: chef.nom + ' choisit le nombre de questions…' }, chef);
      var n = await L.demander(chef, {
        emoji: '🧠', titre: 'Le Grand Quiz', texte: 'Combien de questions ?',
        boutons: [{ id: '10', label: '10 questions', sous: 'environ 5 min' }, { id: '15', label: '15 questions', sous: 'environ 8 min' }, { id: '20', label: '20 questions', sous: 'environ 10 min' }]
      }, '10', 60);
      S.total = window.QUIZ_NB || +n || 10;
      var liste = F.melanger(QUIZ_QUESTIONS).slice(0, S.total);
      F.musique(null);
      for (S.num = 1; S.num <= S.total && !L.arrete; S.num++) await question(liste[S.num - 1]);
      if (L.arrete) return;
      await podium();
    }

    async function question(q) {
      var reponses = F.melanger([q[2], q[3], q[4], q[5]]);
      S.q = { theme: q[0], texte: q[1], reponses: reponses, bonne: reponses.indexOf(q[2]), t0: F.t, revele: false, entree: F.t };
      S.phase = 'question';
      L.joueurs.forEach(function (P) { P.reponse = null; P.gain = 0; });
      F.son.banniere();
      await F.attendre(1.2);
      S.q.t0 = F.t;
      S.q.ouvert = true;
      var tic = setInterval(function () {
        var reste = DUREE - (F.t - S.q.t0) * F.V;
        if (S.q.ouvert && reste < 5 && reste > 0) F.son.tic();
      }, 1000 / F.V);
      await Promise.all(L.joueurs.map(function (P) {
        return L.demander(P, {
          titre: 'Question ' + S.num + ' / ' + S.total, texte: q[1],
          boutons: reponses.map(function (r, i) { return { id: String(i), label: LETTRES[i] + '. ' + r, couleur: COULEURS[i] }; })
        }, null, DUREE + 0.3).then(function (id) {
          P.reponse = id === null ? null : +id;
          P.temps = (F.t - S.q.t0) * F.V;
          if (id !== null) {
            F.son.pop();
            L.ui(P, { emoji: '🤞', titre: 'Réponse ' + LETTRES[+id], texte: 'Attends les autres…' });
          }
        });
      }));
      clearInterval(tic);
      S.q.ouvert = false;
      S.q.fin = F.t;
      // Révélation
      await F.attendre(0.6);
      F.son.roulement(0.8);
      await F.attendre(0.9);
      S.q.revele = true; S.q.reveleT = F.t;
      var bons = 0;
      L.joueurs.forEach(function (P) {
        if (P.reponse === S.q.bonne) {
          bons++;
          P.serie++; P.bonnes++;
          var rapidite = Math.max(0, 1 - P.temps / DUREE);
          P.gain = 500 + Math.round(rapidite * 500 / 10) * 10 + Math.min(300, (P.serie - 1) * 100);
          P.score += P.gain;
        } else { P.serie = 0; P.gain = 0; }
      });
      if (bons) F.son.gain(); else F.son.perte();
      var a = 400 + (S.q.bonne % 2) * 740 + 340, b = 460 + Math.floor(S.q.bonne / 2) * 180;
      if (bons) S.particules.gerbe(a, b, 40, { couleurs: ['#ffd166', '#fff', '#80ed99'], forme: 'confetti' });
      L.joueurs.forEach(function (P) {
        if (P.reponse === S.q.bonne) {
          L.ui(P, { emoji: '✅', titre: 'Bonne réponse !', texte: '+' + P.gain + ' points' + (P.serie > 1 ? ' · série de ' + P.serie + ' 🔥' : ''), fond: '#1b4332', vibrer: 120 });
        } else {
          L.ui(P, { emoji: P.reponse === null ? '⌛' : '❌', titre: P.reponse === null ? 'Trop tard !' : 'Raté !', texte: 'La bonne réponse était : ' + S.q.reponses[S.q.bonne], fond: '#5c1a1a', vibrer: [60, 60, 60] });
        }
      });
      await F.attendre(4.2);
    }

    async function podium() {
      S.phase = 'podium';
      var ordre = F.classer(L.joueurs, 'score');
      S.podium = { ordre: ordre, reveles: 0, fete: 0 };
      F.musique('final');
      L.uiTous({ emoji: '🥁', titre: 'Résultats…', texte: 'Regarde la télé !' });
      for (var r = ordre.length - 1; r >= 0; r--) {
        F.son.roulement(r === 0 ? 1.8 : 0.9);
        await F.attendre(r === 0 ? 2 : 1.1);
        S.podium.reveles = ordre.length - r;
        if (r === 0) { F.son.cymbale(); F.son.fanfare(); S.podium.fete = F.t; } else F.son.pop();
        await F.attendre(0.8);
      }
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '🎉', titre: P.rang === 1 ? 'Victoire !' : F.texteRang(P.rang) + ' place',
          texte: P.score + ' points · ' + P.bonnes + ' bonne(s) réponse(s) sur ' + S.total,
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    function fond(c) {
      var g = c.createLinearGradient(0, 0, 1600, 900);
      g.addColorStop(0, '#3a0ca3'); g.addColorStop(1, '#7209b7');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      c.fillStyle = 'rgba(255,255,255,.05)';
      for (var i = 0; i < 14; i++) {
        c.beginPath(); c.arc((i * 337 + F.t * 12) % 1800 - 100, (i * 211) % 900, 60 + (i % 4) * 40, 0, 7); c.fill();
      }
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      S.particules.maj(dt);
      L.joueurs.forEach(function (P) { P.affScore += (P.score - P.affScore) * Math.min(1, dt * 5); });
      F.virtuel(c, W, H, '#240046');
      fond(c);
      if (S.phase === 'titre') dessinerTitre(c);
      else if (S.phase === 'question' && S.q) dessinerQuestion(c);
      else if (S.phase === 'podium') dessinerPodium(c);
      S.particules.dessiner(c);
      c.restore();
    }

    function dessinerTitre(c) {
      var t = F.t - S.t0;
      F.texte(c, 'Le Grand Quiz', 800, 250 + Math.sin(t * 2) * 8, 150, '#ffd166', { contour: '#3a0ca3', epaisseur: 20 });
      F.texte(c, 'Culture générale · ' + QUIZ_QUESTIONS.length + ' questions en réserve', 800, 370, 40, '#fff', { contour: false });
      var n = L.joueurs.length;
      L.joueurs.forEach(function (P, k) {
        var x = 800 - (n - 1) * 130 + k * 260;
        F.pion(c, x, 560, 56, P.couleur, null, { saut: Math.abs(Math.sin(t * 3 + k)) * 24, phase: k });
        F.texte(c, P.nom, x, 660, 38, '#fff');
      });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit le nombre de questions sur son téléphone…', 800, 790, 34, '#ffd166', { contour: false });
    }

    function dessinerQuestion(c) {
      var q = S.q, entree = F.ease.back(Math.min(1, (F.t - q.entree) * F.V / 0.5));
      // en-tête
      F.texte(c, 'Question ' + S.num + ' / ' + S.total, 90, 55, 40, '#fff', { align: 'left', contour: false });
      c.font = '700 32px ' + F.POLICE;
      var lt = c.measureText(q.theme).width + 50;
      c.fillStyle = 'rgba(255,255,255,.18)'; F.rr(c, 1510 - lt, 30, lt, 52, 26); c.fill();
      F.texte(c, q.theme, 1510 - lt / 2, 57, 32, '#ffd166', { contour: false });
      // carte question
      c.save(); c.translate(800, 215); c.scale(entree, entree);
      c.fillStyle = 'rgba(0,0,0,.25)'; F.rr(c, -712, -112, 1440, 240, 34); c.fill();
      c.fillStyle = '#fff'; F.rr(c, -720, -120, 1440, 240, 34); c.fill();
      F.texteMultiligne(c, q.texte, 0, 0, 1320, 54, '#1b1b2f', { centrerV: true });
      c.restore();
      // minuteur
      var reste = q.ouvert ? Math.max(0, DUREE - (F.t - q.t0) * F.V) : (q.fin ? Math.max(0, DUREE - (q.fin - q.t0) * F.V) : DUREE);
      c.fillStyle = 'rgba(0,0,0,.3)'; F.rr(c, 80, 350, 1440, 26, 13); c.fill();
      c.fillStyle = reste < 5 ? '#ff4d6d' : '#80ed99'; F.rr(c, 80, 350, 1440 * reste / DUREE, 26, 13); c.fill();
      if (q.ouvert) F.texte(c, String(Math.ceil(reste)), 1555, 363, 34, '#fff');
      // réponses
      for (var i = 0; i < 4; i++) {
        var x = 80 + (i % 2) * 740, y = 400 + Math.floor(i / 2) * 180, w = 700, h = 150;
        var p = Math.min(1, Math.max(0, ((F.t - q.entree) * F.V - 0.3 - i * 0.12) / 0.4));
        if (p <= 0) continue;
        var bonne = q.revele && i === q.bonne, eteinte = q.revele && i !== q.bonne;
        c.save();
        c.globalAlpha = (eteinte ? 0.3 : 1) * p;
        c.translate(x + w / 2, y + h / 2); c.scale(F.ease.back(p) * (bonne ? 1 + Math.sin(F.t * 8) * 0.02 : 1), F.ease.back(p));
        if (bonne) { c.shadowColor = '#80ed99'; c.shadowBlur = 40; }
        c.fillStyle = COULEURS[i]; F.rr(c, -w / 2, -h / 2, w, h, 26); c.fill();
        c.shadowBlur = 0;
        if (bonne) { c.lineWidth = 8; c.strokeStyle = '#fff'; F.rr(c, -w / 2, -h / 2, w, h, 26); c.stroke(); }
        c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.arc(-w / 2 + 70, 0, 44, 0, 7); c.fill();
        F.texte(c, LETTRES[i], -w / 2 + 70, 2, 54, '#fff', { contour: false });
        c.textAlign = 'left';
        F.texteMultiligne(c, q.reponses[i], -w / 2 + 140, 0, w - 170, 42, '#fff', { centrerV: true, align: 'left' });
        if (bonne) F.texte(c, '✔', w / 2 - 50, 0, 64, '#fff');
        c.restore();
        // pions des joueurs qui ont choisi cette réponse
        if (q.revele) {
          var qui = L.joueurs.filter(function (P) { return P.reponse === i; });
          qui.forEach(function (P, k) { F.pion(c, x + w - 60 - k * 62, y - 6, 24, P.couleur, null, { phase: k, triste: i !== q.bonne }); });
        }
      }
      // joueurs
      var n = L.joueurs.length, esp = 1440 / Math.max(n, 1);
      L.joueurs.forEach(function (P, k) {
        var cx = 80 + esp * k + esp / 2;
        c.fillStyle = 'rgba(0,0,0,.28)'; F.rr(c, cx - esp / 2 + 10, 768, esp - 20, 112, 24); c.fill();
        var repondu = P.reponse !== null && P.reponse !== undefined;
        F.pion(c, cx - esp / 2 + 70, 826, 32, P.couleur, null, { phase: k, saut: q.revele && P.gain ? Math.abs(Math.sin(F.t * 9)) * 14 : 0 });
        F.texte(c, P.nom, cx - esp / 2 + 120, 806, 32, '#fff', { align: 'left', contour: false });
        F.texte(c, Math.round(P.affScore) + ' pts', cx - esp / 2 + 120, 848, 30, '#ffd166', { align: 'left', contour: false });
        if (!q.revele) F.texte(c, repondu ? '✔' : '…', cx + esp / 2 - 50, 826, 44, repondu ? '#80ed99' : '#adb5bd', { contour: false });
        else if (P.gain) {
          var a = Math.min(1, (F.t - q.reveleT) * F.V / 0.4);
          F.texte(c, '+' + P.gain, cx + esp / 2 - 70, 826 - (1 - a) * 20, 40, '#80ed99');
          if (P.serie > 1) F.texte(c, 'série ×' + P.serie, cx + esp / 2 - 70, 860, 22, '#ffd166', { contour: false });
        } else F.texte(c, '✖', cx + esp / 2 - 50, 826, 44, '#ff4d6d', { contour: false });
      });
    }

    function dessinerPodium(c) {
      var P = S.podium, ordre = P.ordre, n = ordre.length;
      F.texte(c, 'Classement final', 800, 90, 80, '#ffd166', { contour: '#3a0ca3', epaisseur: 14 });
      var hauteurs = { 1: 300, 2: 220, 3: 160, 4: 110 };
      var pos = n === 1 ? [0.5] : n === 2 ? [0.4, 0.6] : n === 3 ? [0.5, 0.3, 0.7] : [0.5, 0.3, 0.7, 0.88];
      ordre.forEach(function (J, k) {
        var visible = k >= n - P.reveles;
        var x = 1600 * pos[k], h = hauteurs[J.rang] || 100, y = 860 - h;
        c.fillStyle = J.rang === 1 ? '#ffd166' : (J.rang === 2 ? '#ced4da' : (J.rang === 3 ? '#e09f3e' : '#6c757d'));
        F.rr(c, x - 130, y, 260, h + 60, 18); c.fill();
        F.texte(c, F.texteRang(J.rang), x, y + 55, 60, '#1b1b2f', { contour: false });
        if (!visible) { F.texte(c, '?', x, y - 90, 100, '#fff'); return; }
        var gagnant = J.rang === 1 && P.fete;
        F.pion(c, x, y - 80, gagnant ? 72 : 58, J.couleur, null, { saut: gagnant ? Math.abs(Math.sin(F.t * 7)) * 40 : 0, phase: k });
        F.texte(c, J.nom, x, y - 190 - (gagnant ? 30 : 0), 46, '#fff');
        F.texte(c, J.score + ' pts', x, y + 120, 34, '#1b1b2f', { contour: false });
      });
      if (P.fete) {
        if (Math.random() < 0.6) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#fff']), forme: 'confetti' });
        F.texte(c, ordre[0].nom + ' gagne le quiz !', 800, 190, 56, '#fff', { contour: '#ff006e', epaisseur: 10 });
      }
    }

    partie().catch(function (e) { console.error('Quiz :', e); });

    return {
      image: image,
      message: function (j, m) { L.recevoir(j, m); },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'quiz', vignette: 'assets/vignettes/quiz.jpg', nom: 'Le Grand Quiz', emoji: '🧠',
    description: 'Culture générale : réponds en secret sur ton téléphone, le plus rapide gagne plus de points !',
    min: 1, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
