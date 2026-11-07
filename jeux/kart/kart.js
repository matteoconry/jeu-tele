/*
 * Turbo Karts — course de petits bolides en 3D (modèles Kenney, voir rendu3d.js), écran partagé de 1 à 4 joueurs.
 * Les karts de l'ordinateur complètent la grille jusqu'à 6 pilotes.
 * Pilotage au téléphone : ◀ ▶ pour tourner (l'accélération est automatique), 🎁 pour utiliser l'objet.
 * Objets : turbo, flaque d'huile, missile à tête chercheuse, bouclier. Plaques turbo sur la piste.
 */
(function (F) {
  'use strict';

  var VMAX = 300, ACCEL = 190, VTURBO = 450, TOURS = 3, NB_PILOTES = 6;
  var BORD = 74; // distance max entre le centre du véhicule et le milieu de la route (barrières)
  var OBJETS = {
    turbo: { emoji: '⚡', nom: 'Turbo' },
    huile: { emoji: '🛢️', nom: 'Flaque d\'huile' },
    missile: { emoji: '🚀', nom: 'Missile' },
    bouclier: { emoji: '🛡️', nom: 'Bouclier' }
  };

  // ---------- Circuits ----------
  // Chaque circuit est un tracé sur une grille de tuiles Kenney (R droite, L gauche, D bas, U haut).
  var CIRCUITS = [
    { id: 'foret', nom: 'Forêt des Pins', emoji: '🌲', depart: [4, 1], trace: 'RRRRDDDLLLDDDRRRDDLLLLLLLUUUUUUUURRR', graine: 5 },
    { id: 'ville', nom: 'Centre-Ville', emoji: '🏙️', depart: [4, 1], trace: 'RRRRRRDDLLDDRRDDDDLLLLUULLLDDLLUUUUUUUURRR', graine: 9 },
    { id: 'arene', nom: 'Arène Antique', emoji: '🏛️', depart: [5, 1], trace: 'RRRDRRDDDDDDLLLUUULLLDDDDLLLUUUUURUUURRR', graine: 13 }
  ];
  var ROBOTS = [
    { nom: 'Zip', couleur: '#f6c90e' }, { nom: 'Bolt', couleur: '#3bb273' }, { nom: 'Nova', couleur: '#9b5de5' },
    { nom: 'Rocco', couleur: '#e63946' }, { nom: 'Yuki', couleur: '#00b4d8' }
  ];

  // ligne centrale régulière (un point tous les 8 unités), cubes à objets et plaques turbo
  function preparerCircuit(k) {
    if (k.centre) return;
    k.theme = KartRendu.THEMES[k.id];
    KartRendu.grille(k);
    var brut = k.brut;
    var c = [brut[0]], acc = 0;
    for (var j = 1; j < brut.length; j++) {
      var d = Math.hypot(brut[j][0] - brut[j - 1][0], brut[j][1] - brut[j - 1][1]);
      acc += d;
      if (acc >= 8) { c.push(brut[j]); acc = 0; }
    }
    k.centre = c;
    k.longueur = c.length * 8;
    k.dir = c.map(function (p, i) { var q = c[(i + 1) % c.length]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    var N = c.length;
    k.boites = [];
    [0.2, 0.47, 0.74].forEach(function (f) {
      var i = Math.floor(N * f), a = k.dir[i];
      for (var m = -1.5; m <= 1.5; m++) k.boites.push({ x: c[i][0] - Math.sin(a) * m * 34, y: c[i][1] + Math.cos(a) * m * 34, retour: 0 });
    });
    k.turbos = [0.33, 0.62, 0.9].map(function (f) { var i = Math.floor(N * f); return { i: i, x: c[i][0], y: c[i][1], a: k.dir[i] }; });
  }

  // point le plus proche, cherché autour de l'indice précédent
  function plusProche(k, x, y, i0) {
    var c = k.centre, N = c.length, best = 1e18, bi = i0;
    for (var d = -30; d <= 30; d++) {
      var i = (i0 + d + N) % N, dx = c[i][0] - x, dy = c[i][1] - y, e = dx * dx + dy * dy;
      if (e < best) { best = e; bi = i; }
    }
    return { i: bi, d: Math.sqrt(best) };
  }

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', t0: F.t, circuit: null, pilotes: [], objets: [], course: 0, nbCourses: 1, ordreCircuits: [], compte: null, tCourse: 0, fin: null, resultats: null, particules: new F.Particules(), sols: {} };

    L.stats = function (P) { return { texte: '🏎️ ' + (P.pts || 0) + ' pts' }; };

    function uiCourse() {
      return { boutons: [{ id: 'g', label: '◀', couleur: '#90e0ef' }, { id: 'objet', label: '🎁', couleur: '#ffd166' }, { id: 'd', label: '▶', couleur: '#90e0ef' }], mode: 'manette', disposition: 'ligne' };
    }

    // ---------- Partie ----------
    async function partie() {
      L.initialiser({ pts: 0, gauche: false, droite: false, objetAppui: false });
      S.phase = 'titre'; S.t0 = F.t; S.fin = null; S.resultats = null; S.course = 0;
      try { await KartRendu.preparer(); } catch (e) { console.error('Karts 3D :', e); S.erreur3d = true; return; }
      if (L.arrete) return;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '🏎️', titre: 'Turbo Karts', texte: chef.nom + ' choisit la course…' }, chef);
      var choix = await L.demander(chef, {
        emoji: '🏎️', titre: 'Turbo Karts', texte: 'Quelle course ?',
        boutons: [{ id: 'gp', label: '🏆 Grand Prix', sous: 'les 3 circuits, points à chaque course', couleur: '#ffd166' }].concat(CIRCUITS.map(function (k) { return { id: k.id, label: k.emoji + ' ' + k.nom, sous: '1 course' }; }))
      }, 'gp', 60);
      S.ordreCircuits = choix === 'gp' ? CIRCUITS.slice() : CIRCUITS.filter(function (k) { return k.id === choix; });
      if (window.KART_CIRCUIT) S.ordreCircuits = CIRCUITS.filter(function (k) { return k.id === window.KART_CIRCUIT; });
      S.nbCourses = S.ordreCircuits.length;
      // pilotes : les joueurs + l'ordinateur jusqu'à 6
      S.pilotes = L.joueurs.map(function (P) { return { P: P, nom: P.nom, couleur: P.couleur, humain: true, pts: 0 }; });
      var robots = F.melanger(ROBOTS.slice());
      for (var i = 0; S.pilotes.length < NB_PILOTES; i++) S.pilotes.push({ nom: robots[i].nom, couleur: robots[i].couleur, humain: false, pts: 0, niveau: 0.86 + Math.random() * 0.1 });
      for (S.course = 1; S.course <= S.nbCourses && !L.arrete; S.course++) await course(S.ordreCircuits[S.course - 1]);
      if (!L.arrete) await finale();
    }

    async function course(k) {
      preparerCircuit(k); KartRendu.carte(k);
      S.circuit = k; S.objets = []; S.resultats = null; S.arrivees = 0;
      k.boites.forEach(function (b) { b.retour = 0; });
      var a0 = k.dir[0], c0 = k.centre[0];
      var grille = F.melanger(S.pilotes.slice());
      grille.forEach(function (p, i) {
        var rang = Math.floor(i / 2), cote = i % 2 ? 1 : -1;
        var arr = 60 + rang * 80 + (i % 2) * 35;
        p.x = c0[0] - Math.cos(a0) * arr - Math.sin(a0) * cote * 38;
        p.y = c0[1] - Math.sin(a0) * arr + Math.cos(a0) * cote * 38;
        p.a = a0; p.v = 0; p.tour = 0; p.idx = plusProche(k, p.x, p.y, k.centre.length - 1).i; p.avance = 0; p.mi = false;
        p.objet = null; p.turbo = 0; p.tourne = 0; p.bouclier = 0; p.fini = false; p.temps = 0; p.place = i + 1; p.virage = 0;
        p.robotObjet = 0; p.decal = (Math.random() - 0.5) * 60; p.camA = a0;
      });
      // départ : la ligne est derrière le premier indice, on compte le 1er tour au premier passage
      S.pilotes.forEach(function (p) { p.tour = 0; p.idx = k.centre.length - 1 - Math.round((Math.hypot(p.x - c0[0], p.y - c0[1])) / 8); });
      S.phase = 'grille';
      F.musique(null);
      L.joueurs.forEach(function (P) {
        L.ui(P, { emoji: k.emoji, titre: 'Course ' + S.course + ' / ' + S.nbCourses + ' : ' + k.nom, texte: '◀ ▶ pour tourner, l\'accélération est automatique. 🎁 pour utiliser ton objet. Passe dans les cubes ? pour en gagner un !' });
      });
      await F.attendre(2.5);
      L.joueurs.forEach(function (P) { L.ui(P, uiCourse()); });
      S.phase = 'compte';
      for (var n = 3; n >= 1; n--) { S.compte = n; S.compteT = F.t; F.son.compte(); await F.attendre(0.9); }
      S.compte = 'GO !'; S.compteT = F.t; F.son.go();
      S.phase = 'course'; S.tCourse = 0;
      F.musique('minijeu');
      // fin : tous les humains arrivés, ou 25 s après le premier arrivé
      var premierFini = 0;
      while (!L.arrete) {
        await F.attendre(0.2);
        var humains = S.pilotes.filter(function (p) { return p.humain; });
        if (humains.every(function (p) { return p.fini; })) break;
        if (S.pilotes.some(function (p) { return p.fini; }) && !premierFini) premierFini = S.tCourse;
        if (premierFini && S.tCourse - premierFini > 25) break;
        if (S.tCourse > 600) break;
      }
      if (L.arrete) return;
      F.musique(null);
      // classement final de la course
      var ordre = classement();
      var bareme = [10, 8, 6, 5, 4, 3];
      ordre.forEach(function (p, i) { p.placeCourse = i + 1; p.gain = bareme[i] || 0; p.pts += p.gain; if (p.P) p.P.pts = p.pts; });
      S.phase = 'resultats';
      S.resultats = { ordre: ordre, t0: F.t };
      F.son.fanfare();
      L.joueurs.forEach(function (P) {
        var p = S.pilotes.filter(function (q) { return q.P === P; })[0];
        L.ui(P, { emoji: p.placeCourse === 1 ? '🏆' : '🏁', titre: F.texteRang(p.placeCourse) + ' place !', texte: '+' + p.gain + ' points · total ' + p.pts });
      });
      await F.attendre(7);
    }

    function classement() {
      return S.pilotes.slice().sort(function (a, b) {
        if (a.fini !== b.fini) return a.fini ? -1 : 1;
        if (a.fini) return a.temps - b.temps;
        return b.avance - a.avance;
      });
    }

    async function finale() {
      var ordre = S.pilotes.slice().sort(function (a, b) { return b.pts - a.pts; });
      var r = 0; ordre.forEach(function (p, i) { if (i === 0 || p.pts !== ordre[i - 1].pts) r = i + 1; p.rang = r; });
      S.phase = 'fin'; S.fin = { ordre: ordre, t0: F.t };
      F.musique('final'); F.son.cymbale();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        var p = S.pilotes.filter(function (q) { return q.P === P; })[0];
        return L.demander(P, {
          emoji: p.rang === 1 ? '🏆' : '🏎️', titre: (S.nbCourses > 1 ? 'Grand Prix : ' : '') + F.texteRang(p.rang) + ' place', texte: p.pts + ' points',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Simulation ----------
    function donnerObjet(p) {
      var place = p.place, n = S.pilotes.length;
      var tirage = Math.random(), liste;
      if (place <= 2) liste = ['huile', 'huile', 'bouclier', 'missile', 'turbo'];
      else if (place >= n - 1) liste = ['turbo', 'turbo', 'missile', 'missile', 'bouclier'];
      else liste = ['turbo', 'huile', 'missile', 'bouclier', 'missile'];
      p.objet = liste[Math.floor(tirage * liste.length)];
      p.objetT = F.t;
      if (p.humain) F.son.surprise();
      if (!p.humain) p.robotObjet = 1 + Math.random() * 3;
    }
    function utiliserObjet(p) {
      var o = p.objet;
      if (!o || S.phase !== 'course') return;
      p.objet = null;
      if (o === 'turbo') { p.turbo = 1.6; if (p.humain) F.son.go(); }
      else if (o === 'bouclier') { p.bouclier = 10; if (p.humain) F.son.etoile(); }
      else if (o === 'huile') { S.objets.push({ type: 'huile', x: p.x - Math.cos(p.a) * 40, y: p.y - Math.sin(p.a) * 40, vie: 30, auteur: p }); if (p.humain) F.son.pop(); }
      else if (o === 'missile') {
        var devant = classement().filter(function (q) { return q.place < p.place && !q.fini; }).pop() || null;
        S.objets.push({ type: 'missile', x: p.x + Math.cos(p.a) * 30, y: p.y + Math.sin(p.a) * 30, a: p.a, v: 560, cible: devant, vie: 5, auteur: p, idx: p.idx });
        if (p.humain) F.son.duel();
      }
    }
    function toucher(p) {
      if (p.bouclier > 0) { p.bouclier = 0; F.son.pop(); return; }
      p.tourne = 1.1; p.v *= 0.3; p.turbo = 0;
      S.particules.gerbe(p.x, p.y, 12, { couleurs: ['#fff', '#ffd166'], haut: 100, vmax: 160, vie: 0.6 });
      if (p.humain) F.son.perte();
    }

    function maj(dt) {
      var k = S.circuit;
      if (!k) return;
      if (S.phase === 'course') S.tCourse += dt;
      var enCourse = S.phase === 'course';
      S.pilotes.forEach(function (p) {
        // pilotage
        var dir = 0;
        if (p.humain && !window.KART_AUTO) { dir = (p.P.droite ? 1 : 0) - (p.P.gauche ? 1 : 0); }
        else {
          var cible = k.centre[(p.idx + 14) % k.centre.length], ac = k.dir[(p.idx + 14) % k.centre.length];
          var tx = cible[0] - Math.sin(ac) * p.decal, ty = cible[1] + Math.cos(ac) * p.decal;
          var voulu = Math.atan2(ty - p.y, tx - p.x), diff = Math.atan2(Math.sin(voulu - p.a), Math.cos(voulu - p.a));
          dir = F.borne(diff * 2.6, -1, 1);
          if (p.objet && !p.humain) { p.robotObjet -= dt; if (p.robotObjet <= 0 && enCourse) utiliserObjet(p); }
        }
        if (p.fini && p.humain) dir = 0;
        p.virage += (dir - p.virage) * Math.min(1, dt * 10);
        if (p.tourne > 0) { p.tourne -= dt; p.a += dt * 11; }
        else p.a += p.virage * dt * 2.3 * Math.min(1, 0.35 + p.v / VMAX);
        // vitesse
        var pr = plusProche(k, p.x, p.y, p.idx);
        var vmax = VMAX;
        if (!p.humain) vmax *= p.niveau * (p.place > 3 ? 1.04 : 1);
        if (p.turbo > 0) { p.turbo -= dt; vmax = VTURBO; }
        if (p.bouclier > 0) p.bouclier -= dt;
        if (!enCourse && S.phase !== 'resultats' && !p.fini) vmax = 0;
        if (p.fini && S.phase === 'resultats') vmax = 0;
        if (p.tourne > 0) vmax = 40;
        if (p.v < vmax) p.v = Math.min(vmax, p.v + (p.turbo > 0 ? ACCEL * 3 : ACCEL) * dt);
        else p.v = Math.max(vmax, p.v - 260 * dt);
        p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
        // barrières : on reste sur la route, on frotte et on ralentit
        pr = plusProche(k, p.x, p.y, pr.i);
        if (pr.d > BORD) {
          var c = k.centre[pr.i], ex = p.x - c[0], ey = p.y - c[1];
          p.x = c[0] + ex / pr.d * BORD; p.y = c[1] + ey / pr.d * BORD;
          var ar = k.dir[pr.i], ecart = Math.atan2(Math.sin(ar - p.a), Math.cos(ar - p.a));
          p.a += F.borne(ecart, -dt * 3, dt * 3);
          p.v = Math.max(p.v * (1 - dt * 2.5), 60);
        }
        // progression et tours
        var N = k.centre.length, ancien = p.idx;
        p.idx = pr.i;
        if (ancien > N * 0.8 && p.idx < N * 0.2) {
          if (p.mi || p.tour === 0) {
            p.tour++; p.mi = false;
            if (p.tour > TOURS && !p.fini) {
              p.fini = true; p.temps = S.tCourse; S.arrivees++;
              if (p.humain) { F.son.fanfare(); S.particules.gerbe(p.x, p.y, 40, { couleurs: [p.couleur, '#fff', '#ffd166'], haut: 300, vmax: 400, forme: 'confetti' }); }
            } else if (p.humain && p.tour === TOURS) F.son.etoile();
            else if (p.humain && p.tour > 1) F.son.tic();
          }
        } else if (ancien < N * 0.2 && p.idx > N * 0.8) { if (p.tour > 0 && !p.mi) { /* marche arrière sur la ligne */ } }
        if (p.idx > N * 0.45 && p.idx < N * 0.55) p.mi = true;
        p.avance = p.tour * N + p.idx;
        // plaques turbo
        k.turbos.forEach(function (t) { if (Math.hypot(t.x - p.x, t.y - p.y) < 40) { if (p.turbo < 0.8) { p.turbo = 0.9; if (p.humain) F.son.go(); } } });
        // boîtes
        k.boites.forEach(function (b) {
          if (b.retour > 0) return;
          if (Math.hypot(b.x - p.x, b.y - p.y) < 34) { b.retour = 3; if (!p.objet) donnerObjet(p); S.particules.gerbe(b.x, b.y, 10, { couleurs: ['#4cc9f0', '#f72585', '#ffd166'], haut: 120, vmax: 200, vie: 0.6 }); }
        });
        p.camA += Math.atan2(Math.sin(p.a - p.camA), Math.cos(p.a - p.camA)) * Math.min(1, dt * 6);
      });
      k.boites.forEach(function (b) { if (b.retour > 0) b.retour -= dt; });
      // chocs entre karts
      for (var i = 0; i < S.pilotes.length; i++) for (var j = i + 1; j < S.pilotes.length; j++) {
        var a = S.pilotes[i], b = S.pilotes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 44 && d > 0.01) { var push = (44 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
      }
      // objets posés / lancés
      S.objets = S.objets.filter(function (o) {
        o.vie -= dt;
        if (o.vie <= 0) return false;
        if (o.type === 'missile') {
          var cx, cy;
          if (o.cible && !o.cible.fini && Math.hypot(o.cible.x - o.x, o.cible.y - o.y) < 500) { cx = o.cible.x; cy = o.cible.y; }
          else { o.idx = plusProche(k, o.x, o.y, o.idx).i; var c = k.centre[(o.idx + 10) % k.centre.length]; cx = c[0]; cy = c[1]; }
          var va = Math.atan2(cy - o.y, cx - o.x), diff = Math.atan2(Math.sin(va - o.a), Math.cos(va - o.a));
          o.a += F.borne(diff, -dt * 5, dt * 5);
          o.x += Math.cos(o.a) * o.v * dt; o.y += Math.sin(o.a) * o.v * dt;
          if (Math.random() < 0.6) S.particules.ajouter(o.x, o.y, { vx: 0, vy: 0, g: 0, vie: 0.4, taille: 5, couleur: '#adb5bd' });
        }
        for (var n = 0; n < S.pilotes.length; n++) {
          var p = S.pilotes[n];
          if (p === o.auteur && o.vie > (o.type === 'huile' ? 29 : 4.6)) continue;
          if (Math.hypot(p.x - o.x, p.y - o.y) < (o.type === 'huile' ? 34 : 32)) { toucher(p); return false; }
        }
        return true;
      });
      // places
      classement().forEach(function (p, i) { p.place = i + 1; });
      S.particules.maj(dt);
    }

    // ---------- Rendu 3D (rendu3d.js) ----------
    function vues(c, liste) {
      var etiquettes = KartRendu.dessiner(c, S, liste);
      liste.forEach(function (v, i) {
        var p = v.p, u = Math.min(v.w / 800, v.h / 450);
        c.save();
        c.beginPath(); c.rect(v.x, v.y, v.w, v.h); c.clip();
        // noms des autres pilotes au-dessus de leur véhicule
        etiquettes[i].forEach(function (e) {
          var taille = Math.max(13, Math.min(24, 5000 / e.d)) * u;
          F.texte(c, e.o.nom, e.x, e.y, taille, e.o.humain ? e.o.couleur : '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: taille / 4 });
        });
        // lignes de vitesse pendant le turbo
        if (p.turbo > 0) {
          var kx = v.x + v.w / 2, ky = v.y + v.h * 0.55;
          c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3 * u;
          for (var l = 0; l < 16; l++) {
            var ang = (l / 16) * Math.PI * 2 + F.t * 3, r1 = v.h * 0.42, r2 = v.h * (0.6 + Math.random() * 0.25);
            c.beginPath(); c.moveTo(kx + Math.cos(ang) * r1 * 1.7, ky + Math.sin(ang) * r1); c.lineTo(kx + Math.cos(ang) * r2 * 1.7, ky + Math.sin(ang) * r2); c.stroke();
          }
        }
        hud(c, p, v.x, v.y, v.w, v.h);
        c.restore();
        c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeRect(v.x, v.y, v.w, v.h);
      });
    }

    function hud(c, p, vx, vy, vw, vh) {
      var u = Math.min(vw / 800, vh / 450);
      // position
      var px = vx >= 800 && vw <= 800 ? vx + vw - 190 * u : vx; // à droite pour les vues de droite (la mini-carte est au milieu)
      F.texte(c, F.texteRang(p.place), px + 70 * u, vy + vh - 60 * u, 76 * u, p.place === 1 ? '#ffd166' : '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: 10 * u });
      F.texte(c, '/' + S.pilotes.length, px + 140 * u, vy + vh - 44 * u, 32 * u, '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: 6 * u });
      // tour
      F.texte(c, p.fini ? 'ARRIVÉ !' : 'Tour ' + Math.max(1, Math.min(TOURS, p.tour)) + '/' + TOURS, vx + 24 * u, vy + 84 * u, 36 * u, '#fff', { align: 'left', contour: 'rgba(0,0,0,.7)', epaisseur: 7 * u });
      F.texte(c, p.nom, vx + 24 * u, vy + 40 * u, 30 * u, p.couleur, { align: 'left', contour: 'rgba(0,0,0,.8)', epaisseur: 7 * u });
      // objet
      var ox = vx + vw / 2, oy = vy + 62 * u;
      c.fillStyle = 'rgba(0,0,0,.55)'; F.rr(c, ox - 46 * u, oy - 46 * u, 92 * u, 92 * u, 18 * u); c.fill();
      c.strokeStyle = p.objet ? '#ffd166' : 'rgba(255,255,255,.4)'; c.lineWidth = 4 * u; F.rr(c, ox - 46 * u, oy - 46 * u, 92 * u, 92 * u, 18 * u); c.stroke();
      if (p.objet) {
        var tourne = F.t - p.objetT < 0.6 / F.V;
        var em = tourne ? OBJETS[Object.keys(OBJETS)[Math.floor(F.t * 15) % 4]].emoji : OBJETS[p.objet].emoji;
        F.texte(c, em, ox, oy + 4 * u, 52 * u, '#fff', { contour: false });
      }
      if (p.fini) {
        c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(vx, vy + vh * 0.32, vw, vh * 0.28);
        F.texte(c, F.texteRang(p.place) + ' place !', vx + vw / 2, vy + vh * 0.46, 70 * u, '#ffd166', { contour: 'rgba(0,0,0,.7)', epaisseur: 10 * u });
      }
      if (p.tour === TOURS && !p.fini && p.idx < S.circuit.centre.length * 0.1 && S.phase === 'course') F.texte(c, 'DERNIER TOUR !', vx + vw / 2, vy + vh * 0.25, 54 * u, '#ff4d6d', { contour: '#fff', epaisseur: 8 * u });
      if (p.v < 5 && S.phase === 'course' && !p.fini && p.tourne <= 0) void 0;
    }

    function miniCarte(c, x, y, taille) {
      var k = S.circuit;
      c.save();
      c.globalAlpha = 0.9;
      c.fillStyle = 'rgba(0,0,0,.5)'; F.rr(c, x - 8, y - 8, taille + 16, taille + 16, 14); c.fill();
      c.drawImage(KartRendu.carte(k), x, y, taille, taille);
      c.globalAlpha = 1;
      var e = taille / k.monde;
      S.pilotes.slice().reverse().forEach(function (p) {
        c.fillStyle = p.couleur; c.strokeStyle = p.humain ? '#fff' : '#000'; c.lineWidth = 2;
        c.beginPath(); c.arc(x + p.x * e, y + p.y * e, p.humain ? 7 : 5, 0, 7); c.fill(); c.stroke();
      });
      c.restore();
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      if (S.phase !== 'titre' && S.phase !== 'fin') maj(Math.min(dt, 0.05) * F.V);
      F.virtuel(c, W, H, '#000');
      if (S.circuit && S.phase !== 'titre') {
        var humains = S.pilotes.filter(function (p) { return p.humain; });
        var n = humains.length, rects;
        if (n <= 1) rects = [[0, 0, 1600, 900]];
        else if (n === 2) rects = [[0, 0, 1600, 450], [0, 450, 1600, 450]];
        else rects = [[0, 0, 800, 450], [800, 0, 800, 450], [0, 450, 800, 450], [800, 450, 800, 450]];
        vues(c, humains.map(function (p, i) { var r = rects[i]; return { p: p, x: r[0], y: r[1], w: r[2], h: r[3] }; }));
        if (n === 3) { c.fillStyle = '#1d3557'; c.fillRect(800, 450, 800, 450); F.texte(c, S.circuit.emoji + ' ' + S.circuit.nom, 1200, 520, 40, '#fff', { contour: false }); }
        if (n === 1) miniCarte(c, 1600 - 230, 30, 200);
        else if (n === 2) miniCarte(c, 1600 - 190, 450 - 85, 170);
        else if (n === 3) miniCarte(c, 1200 - 150, 560, 300);
        else miniCarte(c, 800 - 90, 450 - 90, 180);
        if (S.compte && F.t - S.compteT < 0.9 / F.V) {
          var q = (F.t - S.compteT) * F.V / 0.9;
          c.globalAlpha = 1 - q * 0.6;
          F.texte(c, String(S.compte), 800, 450, 200 * (1 + q * 0.3), S.compte === 'GO !' ? '#06d6a0' : '#ffd166', { contour: '#000', epaisseur: 16 });
          c.globalAlpha = 1;
        }
        if (S.phase === 'grille') {
          c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 330, 1600, 240);
          F.texte(c, 'Course ' + S.course + ' / ' + S.nbCourses, 800, 390, 40, '#ffd166', { contour: false });
          F.texte(c, S.circuit.emoji + ' ' + S.circuit.nom, 800, 470, 84, '#fff', { contour: '#000', epaisseur: 10 });
          F.texte(c, TOURS + ' tours · ' + S.pilotes.length + ' pilotes', 800, 535, 30, '#fff', { contour: false });
        }
      }
      S.particules.dessiner && void 0;
      if (S.resultats) resultats(c);
      if (S.phase === 'titre') titre(c);
      if (S.fin) fin(c);
      c.restore();
    }

    function resultats(c) {
      var r = S.resultats, q = Math.min(1, (F.t - r.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(10,20,40,' + 0.85 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Arrivée : ' + S.circuit.nom, 800, 90, 64, '#ffd166', { contour: '#000', epaisseur: 10 });
      r.ordre.forEach(function (p, i) {
        var y = 160 + i * 112, x = 260 + (1 - F.ease.back(Math.min(1, Math.max(0, q * 2 - i * 0.15)))) * -1600;
        c.fillStyle = p.humain ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'; F.rr(c, x, y, 1080, 96, 24); c.fill();
        if (p.humain) { c.strokeStyle = p.couleur; c.lineWidth = 4; F.rr(c, x, y, 1080, 96, 24); c.stroke(); }
        F.texte(c, F.texteRang(i + 1), x + 60, y + 48, 44, i === 0 ? '#ffd166' : '#fff', { contour: false });
        dessinerVehicule(c, p, x + 170, y + 100, 110);
        F.texte(c, p.nom + (p.humain ? '' : ' 🤖'), x + 240, y + 48, 40, '#fff', { align: 'left', contour: false });
        F.texte(c, '+' + p.gain + ' pts', x + 860, y + 48, 36, '#80ed99', { align: 'right', contour: false });
        F.texte(c, p.pts + ' au total', x + 1050, y + 48, 30, '#ffd166', { align: 'right', contour: false });
      });
    }

    // image 3D d'un véhicule, posée sur (x, y) = milieu du bas
    function dessinerVehicule(c, p, x, y, taille) {
      if (!KartRendu.estPret()) return;
      c.drawImage(KartRendu.portrait(p.couleur, p.humain !== false), x - taille / 2, y - taille * 0.8, taille, taille);
    }

    function titre(c) {
      var t = F.t - S.t0;
      if (KartRendu.estPret()) {
        preparerCircuit(CIRCUITS[0]);
        KartRendu.survol(c, CIRCUITS[0], t);
        var g = c.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
        c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      } else {
        c.fillStyle = '#1d3557'; c.fillRect(0, 0, 1600, 900);
        F.texte(c, S.erreur3d ? 'Ce navigateur ne sait pas afficher la 3D 😕' : 'Chargement des modèles 3D…', 800, 640, 36, '#fff', { contour: false });
      }
      F.texte(c, 'TURBO KARTS', 800, 170 + Math.sin(t * 2) * 8, 150, '#ffd166', { contour: '#1d3557', epaisseur: 20 });
      F.texte(c, 'Course en 3D · écran partagé · objets et turbos', 800, 275, 36, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 7 });
      L.joueurs.forEach(function (P, i) {
        var x = 800 + (i - (L.joueurs.length - 1) / 2) * 300;
        dessinerVehicule(c, P, x, 820 + Math.sin(t * 6 + i) * 4, 300);
        F.texte(c, P.nom, x, 850, 34, P.couleur, { contour: 'rgba(0,0,0,.8)', epaisseur: 7 });
      });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit la course sur son téléphone…', 800, 360, 32, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      if (KartRendu.estPret() && S.circuit) KartRendu.survol(c, S.circuit, F.t - f.t0);
      c.fillStyle = 'rgba(10,20,40,.55)'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, (S.nbCourses > 1 ? 'Grand Prix : ' : '') + f.ordre[0].nom + ' gagne !', 800, 110, 76, '#ffd166', { contour: '#1d3557', epaisseur: 12 });
      // podium
      var pod = [[800, 520, 1], [480, 600, 2], [1120, 650, 3]];
      pod.forEach(function (pp) {
        var p = f.ordre[pp[2] - 1];
        if (!p) return;
        c.fillStyle = ['#ffd166', '#dee2e6', '#cd7f32'][pp[2] - 1]; F.rr(c, pp[0] - 150, pp[1], 300, 900 - pp[1], 16); c.fill();
        F.texte(c, String(pp[2]), pp[0], pp[1] + 70, 90, '#1b1b2f', { contour: false });
        dessinerVehicule(c, p, pp[0], pp[1] + 40 - (pp[2] === 1 ? Math.abs(Math.sin(F.t * 6)) * 20 : 0), 250);
        F.texte(c, p.nom, pp[0], pp[1] - 220, 40, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
        F.texte(c, p.pts + ' pts', pp[0], pp[1] - 180, 30, '#ffd166', { contour: 'rgba(0,0,0,.6)', epaisseur: 5 });
      });
      f.ordre.slice(3).forEach(function (p, i) { F.texte(c, (i + 4) + 'e  ' + p.nom + ' · ' + p.pts + ' pts', 200, 250 + i * 40, 28, '#fff', { align: 'left', contour: false }); });
      if (q >= 1 && Math.random() < 0.5) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
      S.particules.maj(1 / 60); S.particules.dessiner(c);
    }

    partie().catch(function (e) { console.error('Karts :', e); });

    return {
      image: image,
      message: function (j, m) {
        if (L.recevoir(j, m)) return;
        var P = L.PDe(j);
        if (!P || m.t !== 'bouton') return;
        if (m.b === 'g') P.gauche = m.appui;
        else if (m.b === 'd') P.droite = m.appui;
        else if (m.b === 'objet' && m.appui) {
          var p = S.pilotes.filter(function (q) { return q.P === P; })[0];
          if (p) utiliserObjet(p);
        }
      },
      arrivee: function (j) { L.arrivee(j); },
      depart: function (j) { var P = L.PDe(j); if (P) { P.gauche = false; P.droite = false; } },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'kart', nom: 'Turbo Karts', emoji: '🏎️',
    description: 'Course en 3D sur 3 circuits : forêt, centre-ville et arène antique. Écran partagé, objets et turbos !',
    vignette: 'assets/vignettes/kart.jpg',
    min: 1, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
