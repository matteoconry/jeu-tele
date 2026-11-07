/*
 * Duel d'Archers — un contre un (ou contre le robot si on est seul).
 * Chacun son tour : on règle l'angle, on garde « TIRER » appuyé pour la puissance et on lâche.
 * Le vent change à chaque tir. Tête = gros dégâts. Deux manches gagnantes.
 */
(function (F) {
  'use strict';

  var G = 700, VMIN = 330, VMAX = 1200, PV = 100, MANCHES = 2, TEMPS_VISEE = 20;
  var DEGATS = { tete: 50, corps: 30, jambes: 15 };

  function lisse(a, b, x) { var t = F.borne((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var CARTES = [
    {
      id: 'prairie', nom: 'La Prairie', emoji: '🌄', xs: [180, 1420],
      ciel: ['#4cc9f0', '#bde0fe'], terre: '#6a994e', herbe: '#a7c957', sous: '#7f5539',
      sol: function (x) { return 740 - 80 * Math.exp(-Math.pow((x - 800) / 230, 2)); },
      obstacles: [{ cercle: true, x: 800, y: 630, r: 48, sorte: 'rocher' }]
    },
    {
      id: 'falaises', nom: 'Les Falaises', emoji: '🏜️', xs: [200, 1400],
      ciel: ['#ff7b54', '#ffd56b'], terre: '#bc6c25', herbe: '#dda15e', sous: '#7f4f24',
      sol: function (x) { return 560 + 340 * lisse(400, 470, x) * (1 - lisse(1130, 1200, x)); },
      obstacles: [{ x: 765, y: 470, w: 70, h: 430, sorte: 'pilier' }]
    },
    {
      id: 'foret', nom: 'La Forêt', emoji: '🌲', xs: [190, 1410],
      ciel: ['#52b788', '#d8f3dc'], terre: '#40916c', herbe: '#74c69d', sous: '#5c4033',
      sol: function (x) { return 740 + 14 * Math.sin(x / 110); },
      obstacles: [{ x: 772, y: 360, w: 56, h: 400, sorte: 'tronc' }, { cercle: true, x: 800, y: 320, r: 125, sorte: 'feuillage' }]
    },
    {
      id: 'chateau', nom: 'Le Château', emoji: '🏰', xs: [190, 1410], nuit: true,
      ciel: ['#03045e', '#3a0ca3'], terre: '#344e41', herbe: '#588157', sous: '#283618',
      sol: function (x) { return (x < 300 || x > 1300) ? 520 : 770; },
      tours: [[70, 300], [1300, 1530]],
      obstacles: [{ x: 740, y: 470, w: 120, h: 300, sorte: 'mur' }]
    },
    {
      id: 'volcan', nom: 'Le Volcan', emoji: '🌋', xs: [170, 1430],
      ciel: ['#370617', '#e85d04'], terre: '#3d3d3d', herbe: '#6c757d', sous: '#212529',
      sol: function (x) {
        var d = Math.abs(x - 800);
        var m = 400 * Math.pow(Math.max(0, 1 - d / 430), 1.3);
        if (d < 60) m -= 40 * (1 - d / 60);
        return 770 - m;
      },
      obstacles: []
    }
  ];

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = {
      phase: 'titre', carte: CARTES[0], manche: 0, actif: null, vent: 0, fleche: null, plantees: [], particules: new F.Particules(),
      flottants: [], tremble: 0, limite: 0, t0: F.t, fin: null, choixCarte: 'aleatoire', ordreCartes: F.melanger(CARTES.slice()), nuages: []
    };
    for (var n = 0; n < 6; n++) S.nuages.push({ x: F.alea(0, 1600), y: F.alea(60, 300), s: F.alea(0.6, 1.3) });
    var robot = null;

    L.stats = function (P) { return { texte: '❤️ ' + Math.max(0, Math.round(P.pv)) + ' · 🏆 ' + P.manches + '/' + MANCHES }; };

    // ---------- Physique ----------
    function solY(x) { return S.carte.sol(x); }
    function adversaire(P) { return S.duel[0] === P ? S.duel[1] : S.duel[0]; }
    function main(P) {
      var gy = solY(P.x), a = P.angle * Math.PI / 180;
      return { x: P.x + P.dir * Math.cos(a) * 30, y: gy - 86 - Math.sin(a) * 30 };
    }
    function vitesse(p) { return VMIN + (VMAX - VMIN) * p; }

    // Que touche-t-on au point (x, y) ? null si rien.
    function collision(x, y, tireur) {
      if (x < -150 || x > 1750 || y > 950) return { type: 'sortie' };
      if (y >= solY(x)) return { type: 'sol' };
      var obs = S.carte.obstacles;
      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];
        if (o.cercle ? (x - o.x) * (x - o.x) + (y - o.y) * (y - o.y) < o.r * o.r : (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h)) return { type: 'obstacle' };
      }
      if (S.carte.tours) for (var k = 0; k < S.carte.tours.length; k++) { var t = S.carte.tours[k]; if (x > t[0] && x < t[1] && y > 500 && y < 520 && Math.floor((x - t[0]) / 30) % 2 === 0) return { type: 'obstacle' }; }
      var C = adversaire(tireur);
      if (C && !C.ko) {
        var gy = solY(C.x), dx = x - C.x;
        if (dx * dx + (y - (gy - 110)) * (y - (gy - 110)) < 17 * 17) return { type: 'tete', cible: C };
        if (Math.abs(dx) < 14 && y > gy - 96 && y < gy - 52) return { type: 'corps', cible: C };
        if (Math.abs(dx) < 16 && y >= gy - 52 && y < gy) return { type: 'jambes', cible: C };
      }
      return null;
    }

    function simuler(P, angle, puissance) {
      var a = angle * Math.PI / 180, v = vitesse(puissance);
      var gy = solY(P.x);
      var x = P.x + P.dir * Math.cos(a) * 30, y = gy - 86 - Math.sin(a) * 30;
      var vx = P.dir * Math.cos(a) * v, vy = -Math.sin(a) * v, dt = 1 / 90;
      for (var i = 0; i < 900; i++) {
        vx += S.vent * dt; vy += G * dt; x += vx * dt; y += vy * dt;
        var h = collision(x, y, P);
        if (h) { h.x = x; h.y = y; return h; }
      }
      return { type: 'sortie', x: x, y: y };
    }

    // ---------- Le robot ----------
    function viseeRobot(P) {
      var C = adversaire(P), cy = solY(C.x) - 80, meilleur = null;
      for (var ang = -10; ang <= 82; ang += 3) {
        for (var p = 0.15; p <= 1.001; p += 0.03) {
          var r = simuler(P, ang, p), s;
          if (r.type === 'tete') s = 1000; else if (r.type === 'corps') s = 900; else if (r.type === 'jambes') s = 700;
          else s = -Math.hypot(r.x - C.x, r.y - cy);
          if (!meilleur || s > meilleur.s) meilleur = { s: s, ang: ang, p: p };
        }
      }
      var erreur = { facile: [7, 0.07], moyen: [4, 0.045], fort: [2, 0.025] }[robot.niveau];
      return { ang: F.borne(meilleur.ang + F.alea(-erreur[0], erreur[0]), -25, 85), p: F.borne(meilleur.p + F.alea(-erreur[1], erreur[1]), 0.05, 1) };
    }

    // ---------- Partie ----------
    function uiVisee() {
      return {
        titre: 'À toi de tirer !', texte: '⬆ ⬇ pour viser · garde TIRER appuyé puis lâche au bon moment',
        boutons: [{ id: 'bas', label: '⬇', couleur: '#adb5bd' }, { id: 'haut', label: '⬆', couleur: '#adb5bd' }, { id: 'tir', label: '🏹 TIRER', couleur: '#ff006e' }],
        mode: 'manette', disposition: 'ligne'
      };
    }
    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.6;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#3a86ff', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }

    async function partie() {
      var tous = L.initialiser({ pv: PV, affPv: PV, manches: 0, angle: 35, puissance: 0, charge: false, tc: 0, monte: false, descend: false, ko: 0, touche: 0, x: 0, dir: 1, robot: false });
      S.duel = tous.slice(0, 2);
      tous.slice(2).forEach(function (P) { L.ui(P, { emoji: '🍿', titre: 'Spectateur', texte: 'C\'est un duel à deux : regarde la télé et joue la prochaine fois !' }); });
      S.phase = 'titre'; S.t0 = F.t; S.fin = null; S.manche = 0; S.plantees = [];
      F.musique('plateau');
      var chef = S.duel[0];
      if (S.duel.length === 1) {
        var niv = await L.demander(chef, {
          emoji: '🤖', titre: 'Duel contre le robot', texte: 'Quel niveau pour Robin le robot ?',
          boutons: [{ id: 'facile', label: '🙂 Facile' }, { id: 'moyen', label: '😐 Moyen' }, { id: 'fort', label: '😈 Fort' }]
        }, 'moyen', 60);
        robot = { niveau: niv };
        S.duel.push({ num: 99, nom: 'Robin le robot', couleur: '#adb5bd', robot: true, pv: PV, affPv: PV, manches: 0, angle: 35, puissance: 0, charge: false, tc: 0, ko: 0, touche: 0, x: 0, dir: -1 });
      } else robot = null;
      var carte = await L.demander(chef, {
        emoji: '🗺️', titre: 'Choisis la carte', texte: 'Sur quelle carte voulez-vous vous affronter ?',
        boutons: CARTES.map(function (k) { return { id: k.id, label: k.emoji + ' ' + k.nom }; }).concat([{ id: 'aleatoire', label: '🎲 Une carte différente à chaque manche', couleur: '#ffd166' }]),
        disposition: 'grille'
      }, 'aleatoire', 60);
      S.choixCarte = carte;
      S.ordreCartes = F.melanger(CARTES.slice());
      while (!L.arrete) {
        S.manche++;
        await manche();
        if (L.arrete) return;
        if (S.duel.some(function (P) { return P.manches >= MANCHES; })) break;
      }
      await finale();
    }

    async function manche() {
      S.carte = S.choixCarte === 'aleatoire' ? S.ordreCartes[(S.manche - 1) % S.ordreCartes.length] : CARTES.filter(function (k) { return k.id === S.choixCarte; })[0];
      S.plantees = []; S.fleche = null;
      S.duel.forEach(function (P, i) { P.pv = PV; P.affPv = PV; P.ko = 0; P.x = S.carte.xs[i]; P.dir = i === 0 ? 1 : -1; P.angle = 35; P.puissance = 0; P.charge = false; });
      S.phase = 'jeu';
      S.duel.forEach(function (P) { if (!P.robot) L.ui(P, { emoji: '🏹', titre: 'Manche ' + S.manche, texte: S.carte.nom }); });
      await banniere('Manche ' + S.manche, S.carte.emoji + ' ' + S.carte.nom, '#8338ec', 2);
      var tireur = S.duel[(S.manche - 1) % 2];
      while (!L.arrete) {
        await tour(tireur);
        if (L.arrete) return;
        var mort = S.duel.filter(function (P) { return P.pv <= 0; })[0];
        if (mort) {
          var gagnant = adversaire(mort);
          gagnant.manches++;
          F.son.cymbale();
          await F.anim(0.8, function (q) { mort.ko = F.ease.out(q); });
          await banniere('K.O. !', gagnant.nom + ' remporte la manche', gagnant.couleur, 2.4);
          return;
        }
        tireur = adversaire(tireur);
      }
    }

    async function tour(P) {
      S.actif = P;
      S.vent = Math.random() < 0.15 ? 0 : Math.round(F.alea(-160, 160) / 10) * 10;
      P.puissance = 0; P.charge = false; P.monte = false; P.descend = false;
      var C = adversaire(P);
      if (!C.robot) L.ui(C, { emoji: '🛡️', titre: 'Tour de ' + P.nom, texte: 'Croise les doigts…' });
      if (!P.robot) L.ui(P, uiVisee());
      S.phase = 'vise';
      S.limite = F.t + TEMPS_VISEE / F.V;
      F.son.compte();
      if (P.robot) await jouerRobot(P);
      else {
        await new Promise(function (ok) { S.tirFait = ok; });
      }
      S.tirFait = null;
      if (L.arrete) return;
      if (!P.robot) L.ui(P, { emoji: '🎯', titre: 'Flèche partie !', texte: 'Regarde la télé…' });
      if (S.fleche) await new Promise(function (ok) { S.fleche.fini = ok; });
      await F.attendre(0.9);
    }

    async function jouerRobot(P) {
      await F.attendre(0.8);
      var v = viseeRobot(P), a0 = P.angle;
      await F.anim(0.9, function (q) { P.angle = F.lerp(a0, v.ang, F.ease.inOut(q)); });
      P.charge = true; P.tc = 0;
      // la puissance monte de 0 à 1 en 1,1 s
      var tCible = Math.acos(1 - 2 * v.p) / Math.PI * 1.1;
      await F.attendre(tCible);
      if (L.arrete) return;
      P.puissance = v.p;
      tirer(P);
    }

    function puissanceDe(tc) { return 0.5 - 0.5 * Math.cos(tc * Math.PI / 1.1); }

    function tirer(P) {
      if (S.phase !== 'vise' || S.actif !== P) return;
      P.charge = false;
      var m = main(P), a = P.angle * Math.PI / 180, v = vitesse(P.puissance);
      S.fleche = { x: m.x, y: m.y, vx: P.dir * Math.cos(a) * v, vy: -Math.sin(a) * v, tireur: P, trace: [], fini: null, t: 0 };
      S.phase = 'vol';
      F.son.pop();
      if (S.tirFait) S.tirFait();
    }

    function impact(f, h) {
      var ang = Math.atan2(f.vy, f.vx), v = Math.hypot(f.vx, f.vy);
      S.fleche = null;
      if (h.type === 'sortie') { flottant(F.borne(f.x, 80, 1520), F.borne(f.y, 120, 820), 'Raté !', '#fff'); F.son.buzz(); }
      else if (h.cible) {
        var C = h.cible;
        var deg = Math.round(DEGATS[h.type] * (0.6 + 0.4 * F.borne(v / VMAX, 0, 1)));
        C.pv = Math.max(0, C.pv - deg); C.touche = F.t;
        var gy = solY(C.x);
        S.plantees.push({ cible: C, dx: h.x - C.x, dy: h.y - gy, ang: ang });
        S.tremble = h.type === 'tete' ? 0.5 : 0.3;
        S.particules.gerbe(h.x, h.y, h.type === 'tete' ? 30 : 16, { couleurs: ['#fff', '#ffd166', C.couleur], haut: 120, vmax: 320, vie: 0.9 });
        flottant(h.x, h.y - 40, '−' + deg, h.type === 'tete' ? '#ffd166' : '#fff');
        F.son.perte();
        if (h.type === 'tete') { S.banniere = null; banniere('TIR À LA TÊTE !', '−' + deg + ' points de vie', '#d00000', 1.4); }
        if (!C.robot) L.ui(C, { emoji: '🤕', titre: 'Aïe ! −' + deg, texte: 'Il te reste ' + C.pv + ' points de vie.', fond: '#5c1a1a', vibrer: 200 });
      } else {
        S.plantees.push({ x: h.x, y: h.y, ang: ang });
        S.particules.gerbe(h.x, h.y, 10, { couleurs: [S.carte.herbe, S.carte.sous, '#fff'], haut: 100, vmax: 180, vie: 0.6, tmax: 6 });
        F.son.tic();
      }
      if (f.fini) f.fini();
    }

    function flottant(x, y, txt, col) { S.flottants.push({ x: x, y: y, txt: txt, col: col, t0: F.t }); }

    async function finale() {
      var ordre = S.duel.slice().sort(function (a, b) { return b.manches - a.manches; });
      var g = ordre[0];
      S.phase = 'fin';
      S.fin = { gagnant: g, perdant: ordre[1], t0: F.t };
      F.musique('final');
      F.son.fanfare();
      var humains = S.duel.filter(function (P) { return !P.robot; });
      var choix = await Promise.race(humains.map(function (P) {
        return L.demander(P, {
          emoji: P === g ? '🏆' : '🏹', titre: P === g ? 'Victoire !' : 'Défaite…', texte: g.nom + ' gagne ' + g.manches + ' manche(s) à ' + ordre[1].manches + '.',
          boutons: [{ id: 'rejouer', label: '🔁 Revanche' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Boucle ----------
    function maj(dt) {
      var P = S.actif;
      if (S.phase === 'vise' && P && !P.robot) {
        if (P.monte) P.angle = Math.min(85, P.angle + 40 * dt);
        if (P.descend) P.angle = Math.max(-25, P.angle - 40 * dt);
        if (P.charge) { P.tc += dt; P.puissance = puissanceDe(P.tc); }
        if (F.t > S.limite) {
          if (P.charge) tirer(P);
          else { S.phase = 'jeu'; flottant(P.x, solY(P.x) - 170, 'Trop tard !', '#ff4d6d'); F.son.buzz(); if (S.tirFait) S.tirFait(); }
        }
      } else if (S.phase === 'vise' && P && P.robot && P.charge) { P.tc += dt; P.puissance = puissanceDe(P.tc); }
      var f = S.fleche;
      if (f) {
        var pas = 6, h = dt / pas;
        for (var i = 0; i < pas && S.fleche; i++) {
          f.vx += S.vent * h; f.vy += G * h; f.x += f.vx * h; f.y += f.vy * h;
          var c = collision(f.x, f.y, f.tireur);
          if (c) { c.x = f.x; c.y = f.y; impact(f, c); }
        }
        f.trace.push({ x: f.x, y: f.y }); if (f.trace.length > 26) f.trace.shift();
      }
      S.duel && S.duel.forEach(function (Q) { Q.affPv += (Q.pv - Q.affPv) * Math.min(1, dt * 5); });
      S.tremble = Math.max(0, S.tremble - dt);
      S.nuages.forEach(function (n) { n.x += (12 + S.vent * 0.15) * n.s * dt; if (n.x > 1800) n.x = -200; if (n.x < -200) n.x = 1800; });
      S.particules.maj(dt);
    }

    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      if (S.phase !== 'titre' && S.duel) maj(dt * F.V);
      F.virtuel(c, W, H, '#000');
      c.save();
      c.beginPath(); c.rect(0, 0, 1600, 900); c.clip();
      if (S.tremble > 0) c.translate(F.alea(-1, 1) * S.tremble * 24, F.alea(-1, 1) * S.tremble * 24);
      decor(c);
      if (S.duel) {
        S.plantees.forEach(function (a) { if (!a.cible) dessinerFleche(c, a.x, a.y, a.ang, true); });
        S.duel.forEach(function (P) { stickman(c, P); });
        if (S.phase === 'vise' && S.actif) guide(c, S.actif);
        if (S.fleche) {
          var f = S.fleche;
          f.trace.forEach(function (p, i) { c.fillStyle = 'rgba(255,255,255,' + (i / f.trace.length) * 0.6 + ')'; c.beginPath(); c.arc(p.x, p.y, 2 + i / 10, 0, 7); c.fill(); });
          dessinerFleche(c, f.x, f.y, Math.atan2(f.vy, f.vx), false);
        }
      }
      S.particules.dessiner(c);
      S.flottants = S.flottants.filter(function (f) { return F.t - f.t0 < 1.4 / F.V; });
      S.flottants.forEach(function (f) {
        var q = (F.t - f.t0) * F.V / 1.4;
        c.globalAlpha = 1 - q * q;
        F.texte(c, f.txt, f.x, f.y - q * 70, 44, f.col, { contour: 'rgba(0,0,0,.7)', epaisseur: 8 });
        c.globalAlpha = 1;
      });
      c.restore();
      if (S.duel && S.phase !== 'titre') hud(c);
      banniereDessin(c);
      if (S.phase === 'titre') titre(c);
      if (S.fin) fin(c);
      c.restore();
    }

    // ---------- Dessin ----------
    function decor(c) {
      var k = S.carte;
      var g = c.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, k.ciel[0]); g.addColorStop(1, k.ciel[1]);
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      if (k.nuit) {
        c.fillStyle = '#fff';
        for (var i = 0; i < 60; i++) { c.globalAlpha = 0.4 + 0.4 * Math.sin(F.t * 2 + i); c.fillRect((i * 263) % 1600, (i * 97) % 420, 3, 3); }
        c.globalAlpha = 1;
        c.fillStyle = '#fefae0'; c.beginPath(); c.arc(1300, 150, 60, 0, 7); c.fill();
        c.fillStyle = k.ciel[0]; c.beginPath(); c.arc(1325, 135, 52, 0, 7); c.fill();
      } else if (k.id === 'volcan') {
        c.fillStyle = 'rgba(255,190,11,.5)'; c.beginPath(); c.arc(800, 370, 140 + Math.sin(F.t * 3) * 10, 0, 7); c.fill();
      } else {
        c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(1350, 150, 80, 0, 7); c.fill();
        c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(1350, 150, 56, 0, 7); c.fill();
      }
      // montagnes de fond
      c.fillStyle = 'rgba(255,255,255,.18)';
      c.beginPath(); c.moveTo(0, 900);
      for (var x = 0; x <= 1600; x += 40) c.lineTo(x, 520 - 120 * Math.abs(Math.sin(x / 260 + 1)) - 40 * Math.sin(x / 90));
      c.lineTo(1600, 900); c.fill();
      // nuages / fumée
      S.nuages.forEach(function (n) {
        c.fillStyle = k.id === 'volcan' ? 'rgba(60,60,60,.45)' : 'rgba(255,255,255,.75)';
        [[0, 0, 40], [40, -14, 50], [86, 0, 38]].forEach(function (b) { c.beginPath(); c.arc(n.x + b[0] * n.s, n.y + b[1] * n.s, b[2] * n.s, 0, 7); c.fill(); });
      });
      // tours du château (sous le sol)
      if (k.tours) k.tours.forEach(function (t) {
        c.fillStyle = '#6c757d'; c.fillRect(t[0], 520, t[1] - t[0], 380);
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
        for (var y = 540; y < 900; y += 30) { c.beginPath(); c.moveTo(t[0], y); c.lineTo(t[1], y); c.stroke(); }
        for (var xx = t[0]; xx < t[1]; xx += 60) { c.fillStyle = '#6c757d'; c.fillRect(xx, 500, 30, 20); }
      });
      // terrain
      c.beginPath(); c.moveTo(0, 900);
      for (x = 0; x <= 1600; x += 6) { if (k.tours && (x < 300 || x > 1300)) c.lineTo(x, 900); else c.lineTo(x, k.sol(x)); }
      c.lineTo(1600, 900); c.closePath();
      var gt = c.createLinearGradient(0, 400, 0, 900); gt.addColorStop(0, k.terre); gt.addColorStop(1, k.sous);
      c.fillStyle = gt; c.fill();
      c.strokeStyle = k.herbe; c.lineWidth = 12; c.lineJoin = 'round';
      c.beginPath();
      var debut = true;
      for (x = 0; x <= 1600; x += 6) {
        if (k.tours && (x < 300 || x > 1300)) { debut = true; continue; }
        if (debut) { c.moveTo(x, k.sol(x)); debut = false; } else c.lineTo(x, k.sol(x));
      }
      c.stroke();
      if (k.id === 'volcan') {
        c.fillStyle = '#ff5400'; c.beginPath(); c.ellipse(800, k.sol(800) + 6, 44, 12, 0, 0, 7); c.fill();
        if (Math.random() < 0.3) S.particules.ajouter(800 + F.alea(-30, 30), k.sol(800), { vx: F.alea(-40, 40), vy: F.alea(-260, -120), g: 300, vie: 1.2, taille: F.alea(4, 8), couleur: F.choisir(['#ff5400', '#ffbe0b', '#ff006e']) });
      }
      k.obstacles.forEach(function (o) { obstacle(c, o); });
      // vent : petites rafales
      if (S.vent) {
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
        for (var w = 0; w < 10; w++) {
          var vx = ((w * 173 + F.t * S.vent * 2) % 1800 + 1800) % 1800 - 100, vy = 120 + (w * 71) % 360;
          c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + Math.sign(S.vent) * 40, vy); c.stroke();
        }
      }
    }

    function obstacle(c, o) {
      if (o.sorte === 'rocher') {
        c.fillStyle = '#8d99ae'; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill();
        c.fillStyle = '#adb5bd'; c.beginPath(); c.arc(o.x - 14, o.y - 14, o.r * 0.45, 0, 7); c.fill();
      } else if (o.sorte === 'feuillage') {
        [[0, 0, 1], [-70, 30, 0.7], [70, 30, 0.7], [0, -60, 0.7]].forEach(function (b, i) {
          c.fillStyle = i % 2 ? '#2d6a4f' : '#1b4332'; c.beginPath(); c.arc(o.x + b[0], o.y + b[1], o.r * b[2], 0, 7); c.fill();
        });
        c.fillStyle = 'rgba(149,213,178,.35)'; c.beginPath(); c.arc(o.x - 30, o.y - 40, 40, 0, 7); c.fill();
      } else if (o.sorte === 'tronc') {
        c.fillStyle = '#6f4518'; c.fillRect(o.x, o.y, o.w, o.h);
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
        for (var y = o.y + 30; y < o.y + o.h; y += 50) { c.beginPath(); c.moveTo(o.x + 10, y); c.lineTo(o.x + o.w - 14, y + 10); c.stroke(); }
      } else if (o.sorte === 'pilier') {
        c.fillStyle = '#9c6644'; F.rr(c, o.x, o.y, o.w, o.h, 16); c.fill();
        c.fillStyle = '#dda15e'; F.rr(c, o.x - 6, o.y, o.w + 12, 18, 9); c.fill();
      } else if (o.sorte === 'mur') {
        c.fillStyle = '#6c757d'; c.fillRect(o.x, o.y, o.w, o.h);
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2;
        for (var yy = o.y + 30, r = 0; yy < o.y + o.h; yy += 30, r++) {
          c.beginPath(); c.moveTo(o.x, yy); c.lineTo(o.x + o.w, yy); c.stroke();
          for (var xx = o.x + (r % 2 ? 20 : 50); xx < o.x + o.w; xx += 60) { c.beginPath(); c.moveTo(xx, yy - 30); c.lineTo(xx, yy); c.stroke(); }
        }
        for (var cx = o.x; cx < o.x + o.w; cx += 40) { c.fillStyle = '#6c757d'; c.fillRect(cx, o.y - 22, 22, 22); }
      }
    }

    function dessinerFleche(c, x, y, ang, plantee) {
      c.save(); c.translate(x, y); c.rotate(ang);
      var l = 54, recul = plantee ? 14 : 0;
      c.strokeStyle = '#7f5539'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-l + recul, 0); c.lineTo(recul - 4, 0); c.stroke();
      if (!plantee) { c.fillStyle = '#adb5bd'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-12, -6); c.lineTo(-12, 6); c.closePath(); c.fill(); }
      c.fillStyle = '#ff006e';
      c.beginPath(); c.moveTo(-l + recul, 0); c.lineTo(-l + recul - 10, -8); c.lineTo(-l + recul + 6, 0); c.lineTo(-l + recul - 10, 8); c.closePath(); c.fill();
      c.restore();
    }

    function stickman(c, P) {
      var gy = solY(P.x), d = P.dir, a = P.angle * Math.PI / 180;
      var vise = S.actif === P && (S.phase === 'vise');
      c.save();
      c.translate(P.x, gy);
      if (P.ko) { c.rotate(-d * P.ko * Math.PI / 2); }
      var flash = F.t - P.touche < 0.25;
      var trait = flash ? '#ff4d6d' : (S.carte.nuit || S.carte.id === 'volcan' ? '#f8f9fa' : '#1b1b2f');
      c.strokeStyle = trait; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      var respire = Math.sin(F.t * 2 + P.num) * 2;
      // jambes
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(0, -52); c.lineTo(15, 0); c.stroke();
      // corps
      c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -96 + respire); c.stroke();
      // bras + arc
      var sx = 0, sy = -86 + respire;
      var hx = sx + d * Math.cos(a) * 30, hy = sy - Math.sin(a) * 30;
      var tire = vise ? 8 + 26 * P.puissance : 8;
      var tx = hx - d * Math.cos(a) * tire, ty = hy + Math.sin(a) * tire;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
      c.beginPath(); c.moveTo(sx, sy); c.lineTo((sx + tx) / 2 - d * 4, (sy + ty) / 2 + 8); c.lineTo(tx, ty); c.stroke();
      var dirA = d === 1 ? -a : Math.PI + a;
      c.strokeStyle = '#9c6644'; c.lineWidth = 6;
      c.beginPath(); c.arc(hx - Math.cos(dirA) * 14, hy - Math.sin(dirA) * 14, 34, dirA - 1.15, dirA + 1.15); c.stroke();
      var b1 = { x: hx - Math.cos(dirA) * 14 + Math.cos(dirA - 1.15) * 34, y: hy - Math.sin(dirA) * 14 + Math.sin(dirA - 1.15) * 34 };
      var b2 = { x: hx - Math.cos(dirA) * 14 + Math.cos(dirA + 1.15) * 34, y: hy - Math.sin(dirA) * 14 + Math.sin(dirA + 1.15) * 34 };
      c.strokeStyle = '#f8f9fa'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(b1.x, b1.y); c.lineTo(tx, ty); c.lineTo(b2.x, b2.y); c.stroke();
      if (vise) { c.restore(); c.save(); c.translate(P.x, gy); dessinerFleche(c, tx + Math.cos(dirA) * 52, ty + Math.sin(dirA) * 52, dirA, false); }
      // tête
      c.fillStyle = P.couleur; c.strokeStyle = trait; c.lineWidth = 5;
      c.beginPath(); c.arc(0, -110 + respire, 16, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#1b1b2f';
      if (P.ko) { c.font = '700 14px ' + F.POLICE; c.textAlign = 'center'; c.fillText('x  x', d * 2, -106 + respire); }
      else { c.beginPath(); c.arc(d * 6, -113 + respire, 2.8, 0, 7); c.fill(); }
      // bandeau
      c.strokeStyle = F.assombrir(P.couleur, 0.3); c.lineWidth = 4;
      c.beginPath(); c.moveTo(-15, -116 + respire); c.lineTo(15, -116 + respire); c.lineTo(-d * 30, -110 + Math.sin(F.t * 8) * 4); c.stroke();
      // flèches plantées dans ce joueur
      S.plantees.forEach(function (f) { if (f.cible === P) dessinerFleche(c, f.dx, f.dy, f.ang, true); });
      c.restore();
      if (P.robot && !P.ko) F.texte(c, '🤖', P.x, gy - 150, 26, '#fff', { contour: false });
    }

    function guide(c, P) {
      var a = P.angle * Math.PI / 180, v = vitesse(Math.max(0.35, P.puissance));
      var m = main(P), x = m.x, y = m.y, vx = P.dir * Math.cos(a) * v, vy = -Math.sin(a) * v;
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (var i = 0; i < 14; i++) {
        var dt = 0.022;
        for (var k = 0; k < 2; k++) { vy += G * dt; x += vx * dt; y += vy * dt; }
        c.globalAlpha = 1 - i / 14;
        c.beginPath(); c.arc(x, y, 5 - i * 0.25, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      // jauge de puissance au-dessus du tireur
      var gx = P.x - 60, gy = solY(P.x) - 190;
      c.fillStyle = 'rgba(0,0,0,.5)'; F.rr(c, gx - 4, gy - 4, 128, 26, 13); c.fill();
      var col = P.puissance > 0.85 ? '#ff006e' : P.puissance > 0.55 ? '#ffbe0b' : '#06d6a0';
      c.fillStyle = col; F.rr(c, gx, gy, Math.max(18, 120 * P.puissance), 18, 9); c.fill();
      F.texte(c, Math.round(P.angle) + '°', P.x, gy - 24, 28, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
    }

    function hud(c) {
      S.duel.forEach(function (P, i) {
        var w = 470, x = i === 0 ? 24 : 1600 - 24 - w, y = 22;
        c.fillStyle = 'rgba(16,24,40,.78)'; F.rr(c, x, y, w, 96, 22); c.fill();
        if (S.actif === P && S.phase !== 'jeu') { c.strokeStyle = P.couleur; c.lineWidth = 4; F.rr(c, x, y, w, 96, 22); c.stroke(); }
        var al = i === 0 ? 'left' : 'right', tx = i === 0 ? x + 22 : x + w - 22;
        F.texte(c, P.nom, tx, y + 28, 30, '#fff', { align: al, contour: false });
        for (var m = 0; m < MANCHES; m++) {
          var px = i === 0 ? x + w - 30 - m * 34 : x + 30 + m * 34;
          F.etoile(c, px, y + 28, 15, 0, m < P.manches ? 1 : 0.2);
        }
        var bx = x + 22, bw = w - 44, by = y + 54;
        c.fillStyle = 'rgba(255,255,255,.15)'; F.rr(c, bx, by, bw, 26, 13); c.fill();
        var q = Math.max(0, P.affPv / PV);
        c.fillStyle = q > 0.5 ? '#06d6a0' : q > 0.25 ? '#ffbe0b' : '#ff006e';
        if (q > 0) { if (i === 0) F.rr(c, bx, by, Math.max(20, bw * q), 26, 13); else F.rr(c, bx + bw - Math.max(20, bw * q), by, Math.max(20, bw * q), 26, 13); c.fill(); }
        F.texte(c, Math.round(Math.max(0, P.pv)) + ' PV', bx + bw / 2, by + 14, 20, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 4 });
      });
      // centre : manche, vent, chrono
      c.fillStyle = 'rgba(16,24,40,.78)'; F.rr(c, 650, 22, 300, 120, 22); c.fill();
      F.texte(c, 'Manche ' + S.manche, 800, 48, 26, '#ffd166', { contour: false });
      var v = S.vent;
      F.texte(c, v === 0 ? 'Pas de vent' : 'Vent ' + Math.abs(v / 10), 800, 84, 26, '#fff', { contour: false });
      if (v) {
        var l = 20 + Math.abs(v) / 160 * 70, s = Math.sign(v);
        c.strokeStyle = '#90e0ef'; c.fillStyle = '#90e0ef'; c.lineWidth = 6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(800 - s * l / 2, 116); c.lineTo(800 + s * l / 2, 116); c.stroke();
        c.beginPath(); c.moveTo(800 + s * (l / 2 + 12), 116); c.lineTo(800 + s * l / 2 - s * 4, 106); c.lineTo(800 + s * l / 2 - s * 4, 126); c.closePath(); c.fill();
      }
      if (S.phase === 'vise' && S.actif && !S.actif.robot) {
        var reste = Math.max(0, Math.ceil((S.limite - F.t) * F.V));
        F.texte(c, '⏱ ' + reste, 800, 170, 30, reste <= 5 ? '#ff4d6d' : '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
      }
      if (S.actif && (S.phase === 'vise' || S.phase === 'vol')) {
        F.texte(c, 'Au tour de ' + S.actif.nom, 800, 870, 32, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
      }
    }

    function banniereDessin(c) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0;
      if (t > b.duree) { S.banniere = null; return; }
      var e = Math.min(1, t * F.V / 0.3), s = Math.max(0, (t - (b.duree - 0.3 / F.V)) * F.V / 0.3);
      var h = b.sous ? 150 : 110;
      c.save();
      c.globalAlpha = 1 - s;
      c.translate(800, 400); c.scale(F.ease.back(e), F.ease.back(e));
      c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -556, -h / 2 + 8, 1120, h, 30); c.fill();
      c.fillStyle = b.couleur; F.rr(c, -560, -h / 2, 1120, h, 30); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#fff'; F.rr(c, -560, -h / 2, 1120, h, 30); c.stroke();
      F.texte(c, b.texte, 0, b.sous ? -22 : 0, 60, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 8 });
      if (b.sous) F.texte(c, b.sous, 0, 40, 30, '#fff', { contour: false });
      c.restore();
    }

    function titre(c) {
      c.fillStyle = 'rgba(10,10,30,.55)'; c.fillRect(0, 0, 1600, 900);
      var t = F.t - S.t0;
      F.texte(c, 'Duel d\'Archers', 800, 230 + Math.sin(t * 2) * 8, 130, '#ffd166', { contour: '#370617', epaisseur: 18 });
      F.texte(c, 'Vise, règle ta puissance, et touche l\'autre avant qu\'il te touche !', 800, 340, 34, '#fff', { contour: false });
      F.texte(c, 'Tête −50 · corps −30 · jambes −15 · deux manches pour gagner', 800, 400, 28, '#90e0ef', { contour: false });
      var chef = L.joueurs[0];
      if (chef) F.texte(c, chef.nom + ' choisit ' + (L.joueurs.length === 1 ? 'le niveau du robot et ' : '') + 'la carte sur son téléphone…', 800, 760, 32, '#ffd166', { contour: false });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.6);
      c.fillStyle = 'rgba(10,10,30,' + 0.7 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, f.gagnant.nom + ' gagne le duel !', 800, 200, 80, '#ffd166', { contour: '#370617', epaisseur: 14 });
      F.texte(c, f.gagnant.manches + ' manche(s) à ' + f.perdant.manches, 800, 290, 40, '#fff', { contour: false });
      // le vainqueur saute de joie
      var P = f.gagnant, saut = Math.abs(Math.sin(F.t * 5)) * 40;
      c.save(); c.translate(800, 680 - saut); c.scale(2, 2);
      c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(0, -52); c.lineTo(15, 0); c.stroke();
      c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -96); c.stroke();
      c.beginPath(); c.moveTo(-30, -130); c.lineTo(0, -86); c.lineTo(30, -130); c.stroke();
      c.fillStyle = P.couleur; c.beginPath(); c.arc(0, -110, 16, 0, 7); c.fill(); c.stroke();
      c.restore();
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
      S.particules.dessiner(c);
    }

    partie().catch(function (e) { console.error('Archers :', e); });

    return {
      image: image,
      message: function (j, m) {
        if (L.recevoir(j, m)) return;
        var P = L.PDe(j);
        if (!P || m.t !== 'bouton' || S.actif !== P || S.phase !== 'vise') return;
        if (m.b === 'haut') P.monte = m.appui;
        else if (m.b === 'bas') P.descend = m.appui;
        else if (m.b === 'tir') {
          if (m.appui) { P.charge = true; P.tc = 0; P.puissance = 0; }
          else if (P.charge) tirer(P);
        }
      },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'archers', nom: 'Duel d\'Archers', emoji: '🏹',
    description: 'Un contre un (ou contre le robot) : vise, règle ta puissance, attention au vent. Tir à la tête = gros dégâts !',
    min: 1, max: 2, perso: true, barre: false, creer: creer
  });
})(Fiesta);
