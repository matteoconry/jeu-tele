/*
 * Fiesta Royale — deuxième série de mini-jeux (même format que minijeux.js).
 *   creer(participants, env) → { fini, message(p, m), maj(dt), dessiner(c), scores() }
 * Le temps de jeu est compté avec dt (déjà multiplié par la vitesse de test F.V).
 */
(function (F) {
  'use strict';

  function posX(i, n) { return n === 1 ? 800 : 260 + i * (1080 / (n - 1)); }
  function couloirs(n, marge) {
    marge = marge || 80;
    var l = (1600 - marge * 2) / n, r = [];
    for (var i = 0; i < n; i++) r.push({ x: marge + l * i, w: l, cx: marge + l * i + l / 2 });
    return r;
  }
  function trouver(etats, p) { return etats.filter(function (e) { return e.p === p; })[0]; }
  function appui(m) { return m.t === 'bouton' && m.appui; }
  function ciel(c, h, b) {
    var g = c.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, h); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
  }
  function etoiles(c, n) {
    for (var s = 0; s < n; s++) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(F.t * 2 + s)) + ')'; c.fillRect((s * 397) % 1600, (s * 211) % 500, 3, 3); }
  }
  // bandeau des joueurs en bas de l'écran (nom + score)
  function bandeau(c, etats, texte, opts) {
    opts = opts || {};
    etats.forEach(function (e, i) {
      var x = posX(i, etats.length), y = opts.y || 800;
      F.pion(c, x, y, opts.r || 36, e.p.couleur, null, { phase: i, triste: opts.triste && opts.triste(e), saut: opts.saut ? opts.saut(e) : 0 });
      F.texte(c, e.p.nom, x, y + 62, 28, '#fff');
      if (texte) F.texte(c, texte(e), x, y - 70, 34, '#ffd166');
    });
  }
  var QUATRE = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0'];
  var NOMS4 = ['ROUGE', 'BLEU', 'JAUNE', 'VERT'];

  var NOUVEAUX = [

    // ---------------------------------------------------------------- La pluie de pièces
    {
      id: 'pluie', nom: 'La pluie de pièces', emoji: '🌧️', duree: 20,
      regle: 'Il pleut des pièces sur le château ! Cours à gauche et à droite pour les attraper. Les étoiles valent 3. Attention aux pierres : elles t\'assomment.',
      controles: 'Gauche / droite sur la croix',
      ui: function () { return { pad: true }; },
      creer: function (ps, env) {
        var etats = ps.map(function (p, i) { return { p: p, x: posX(i, ps.length), dx: 0, n: 0, ko: 0, dir: 1, joie: 0 }; });
        var chutes = [], prochain = 0;
        return {
          fini: false,
          message: function (p, m) { var e = trouver(etats, p); if (e && m.t === 'dir') e.dx = F.borne(+m.x || 0, -1, 1); },
          maj: function (dt) {
            prochain -= dt;
            if (prochain <= 0) {
              prochain = F.alea(0.18, 0.34);
              var r = Math.random();
              chutes.push({ x: F.alea(80, 1520), y: -40, v: F.alea(330, 520), sorte: r < 0.1 ? 'etoile' : (r < 0.32 ? 'pierre' : 'piece'), rot: F.alea(0, 6) });
            }
            chutes.forEach(function (o) { o.y += o.v * dt; o.rot += dt * 3; });
            etats.forEach(function (e) {
              e.ko = Math.max(0, e.ko - dt); e.joie = Math.max(0, e.joie - dt);
              if (e.ko <= 0 && e.dx) { e.x = F.borne(e.x + e.dx * 560 * dt, 60, 1540); e.dir = e.dx > 0 ? 1 : -1; }
              chutes.forEach(function (o) {
                if (o.pris || o.y < 690 || o.y > 800 || Math.abs(o.x - e.x) > 58) return;
                o.pris = true;
                if (o.sorte === 'pierre') { if (e.ko <= 0) { e.ko = 1.1; env.son.buzz(); } }
                else if (e.ko <= 0) {
                  e.n += o.sorte === 'etoile' ? 3 : 1; e.joie = 0.3;
                  o.sorte === 'etoile' ? env.son.gain() : env.son.pop();
                  env.particules.gerbe(o.x, o.y, 8, { couleurs: ['#ffd166', '#fff'], g: -200, haut: 0, vmax: 220 });
                } else o.pris = false;
              });
            });
            chutes = chutes.filter(function (o) { return !o.pris && o.y < 940; });
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 560, ciel1: '#6d83c9', ciel2: '#c9d6ff' });
            for (var w = 0; w < 9; w++) F.dessinerSprite(c, 'arene/wall', 400 + w * 100, 570, 110, { taille: 160, angle: 0, hauteur: 0.15 });
            chutes.forEach(function (o) {
              if (o.sorte === 'piece') F.coquillage(c, o.x, o.y, 22);
              else if (o.sorte === 'etoile') F.etoile(c, o.x, o.y, 30, o.rot * 0.3);
              else {
                c.save(); c.translate(o.x, o.y); c.rotate(o.rot);
                c.fillStyle = '#6c757d'; c.beginPath(); c.moveTo(-26, -8); c.lineTo(-10, -26); c.lineTo(18, -22); c.lineTo(28, 4); c.lineTo(10, 24); c.lineTo(-20, 20); c.closePath(); c.fill();
                c.fillStyle = '#adb5bd'; c.beginPath(); c.arc(-6, -8, 8, 0, 7); c.fill();
                c.restore();
              }
            });
            etats.forEach(function (e, i) {
              F.pion(c, e.x, 760, 40, e.p.couleur, null, { triste: e.ko > 0, regard: e.dir, phase: i, saut: e.joie * 40 });
              if (e.ko > 0) F.texte(c, '✶ ✶', e.x, 690, 32, '#ffd166');
              F.texte(c, e.p.nom + ' · ' + e.n, e.x, 840, 28, '#fff');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.n, texte: e.n + ' pièce' + (e.n > 1 ? 's' : '') }; }); }
        };
      }
    },

    // ---------------------------------------------------------------- Le sablier caché
    {
      id: 'sablier', nom: 'Le sablier caché', emoji: '⏱️', duree: 30,
      regle: 'Le compteur part de 0 puis disparaît au bout de 3 secondes. Tape quand tu penses qu\'il arrive pile à 10 secondes !',
      controles: 'Un seul bouton, une seule fois',
      ui: function () { return { boutons: [{ id: 'A', label: '⏱️ STOP !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var BUT = 10;
        var etats = ps.map(function (p) { return { p: p, t: null }; });
        var T = 0, revele = 0, derniereSec = 0;
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e.t !== null || revele) return;
            e.t = T; env.son.clic();
            env.envoyerUI(p, { emoji: '🤞', titre: 'C\'est noté !', texte: 'Attends le résultat sur la télé.' });
          },
          maj: function (dt) {
            T += dt;
            if (T < 3 && Math.floor(T) > derniereSec) { derniereSec = Math.floor(T); env.son.tic(); }
            if (!revele && (etats.every(function (e) { return e.t !== null; }) || T > 16)) { revele = T; env.son.fanfare(); }
            if (revele && T - revele > 3) inst.fini = true;
          },
          dessiner: function (c) {
            ciel(c, '#2b2d42', '#5c4d7d'); etoiles(c, 50);
            F.dessinerSprite(c, 'arene/column', 140, 700, 420, { taille: 200, angle: 0.2, hauteur: 0.15 });
            F.dessinerSprite(c, 'arene/column', 1460, 700, 420, { taille: 200, angle: 0.2, hauteur: 0.15 });
            c.fillStyle = 'rgba(16,24,40,.85)'; F.rr(c, 500, 150, 600, 300, 40); c.fill();
            c.lineWidth = 8; c.strokeStyle = '#ffd166'; F.rr(c, 500, 150, 600, 300, 40); c.stroke();
            var aff = revele ? BUT.toFixed(2) : (T < 3 ? T.toFixed(2) : '?.??');
            F.texte(c, aff, 800, 300, 150, T < 3 || revele ? '#fff' : '#ffd166');
            F.texte(c, 'Objectif : 10,00 s', 800, 100, 46, '#fff');
            etats.forEach(function (e, i) {
              var x = posX(i, etats.length);
              F.pion(c, x, 760, 40, e.p.couleur, null, { phase: i, saut: e.t !== null && !revele ? 0 : Math.abs(Math.sin(F.t * 3 + i)) * 6 });
              F.texte(c, e.p.nom, x, 830, 30, '#fff');
              if (revele) {
                var d = e.t === null ? null : e.t - BUT;
                F.texte(c, e.t === null ? '—' : e.t.toFixed(2) + ' s', x, 620, 46, '#ffd166');
                if (d !== null) F.texte(c, (d >= 0 ? '+' : '') + d.toFixed(2), x, 670, 32, Math.abs(d) < 0.5 ? '#80ed99' : '#ff8fa3');
              } else F.texte(c, e.t !== null ? '✔' : '…', x, 670, 44, e.t !== null ? '#80ed99' : '#adb5bd');
            });
          },
          scores: function () {
            return etats.map(function (e) {
              var d = e.t === null ? 99 : Math.abs(e.t - BUT);
              return { p: e.p, score: -d, texte: e.t === null ? 'pas tapé' : 'écart ' + d.toFixed(2) + ' s' };
            });
          }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Le lancer d'anneau
    {
      id: 'anneau', nom: 'Le lancer d\'anneau', emoji: '🎯', duree: 45,
      regle: 'La jauge de force monte et descend. Tape au bon moment pour lancer ton anneau le plus près possible du piquet. 3 lancers, les points s\'additionnent.',
      controles: 'Tape pour lancer',
      ui: function () { return { boutons: [{ id: 'A', label: '🎯 LANCE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var MANCHES = 3, X0 = 230, XMAX = 1450;
        var rangees = ps.map(function (p, i) { return 230 + i * (560 / Math.max(1, ps.length - 1)); });
        if (ps.length === 1) rangees = [500];
        var etats = ps.map(function (p, i) { return { p: p, y: rangees[i], pts: 0, phase: F.alea(0, 6), lance: null, dernier: '' }; });
        var manche = 0, cible = 0, T = 0, pauseJusqua = 0.6;
        function nouvelleManche() {
          manche++;
          if (manche > MANCHES) { inst.fini = true; return; }
          cible = F.alea(700, 1350);
          etats.forEach(function (e) { e.lance = null; e.dernier = ''; });
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e.lance || !manche || T < pauseJusqua) return;
            var force = 0.5 - 0.5 * Math.cos(e.phase);
            e.lance = { x: X0 + force * (XMAX - X0), t: 0 };
            env.son.pop();
          },
          maj: function (dt) {
            T += dt;
            if (!manche) { if (T > pauseJusqua) nouvelleManche(); return; }
            etats.forEach(function (e) {
              if (!e.lance) e.phase += dt * (2.6 + manche * 0.5);
              else if (e.lance.t < 1) {
                e.lance.t = Math.min(1, e.lance.t + dt * 1.4);
                if (e.lance.t >= 1) {
                  var d = Math.abs(e.lance.x - cible), g = d < 25 ? 10 : d < 70 ? 5 : d < 140 ? 2 : 0;
                  e.pts += g; e.dernier = g ? '+' + g : 'raté';
                  g >= 5 ? env.son.gain() : (g ? env.son.pop() : env.son.buzz());
                  if (g === 10) env.particules.gerbe(cible, e.y, 24, { couleurs: [e.p.couleur, '#ffd166', '#fff'] });
                }
              }
            });
            if (etats.every(function (e) { return e.lance && e.lance.t >= 1; })) {
              if (!inst.attente) inst.attente = T;
              if (T - inst.attente > 1.4) { inst.attente = 0; pauseJusqua = T + 0.3; nouvelleManche(); }
            }
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 150 });
            F.texte(c, manche ? 'Lancer ' + Math.min(manche, MANCHES) + ' / ' + MANCHES : 'Prêts ?', 800, 100, 52, '#fff');
            etats.forEach(function (e, i) {
              c.fillStyle = 'rgba(255,255,255,.18)'; F.rr(c, 140, e.y - 60, 1380, 120, 30); c.fill();
              if (manche) {
                // zones de points autour du piquet
                [[140, 'rgba(255,209,102,.25)'], [70, 'rgba(255,209,102,.45)'], [25, 'rgba(255,77,109,.55)']].forEach(function (z) {
                  c.fillStyle = z[1]; c.beginPath(); c.ellipse(cible, e.y + 20, z[0], 22, 0, 0, 7); c.fill();
                });
                c.fillStyle = '#7f4f24'; c.fillRect(cible - 6, e.y - 50, 12, 70);
                c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(cible, e.y - 52, 9, 0, 7); c.fill();
              }
              F.pion(c, 190, e.y, 36, e.p.couleur, null, { phase: i });
              // jauge
              if (!e.lance && manche) {
                var f = 0.5 - 0.5 * Math.cos(e.phase);
                c.fillStyle = 'rgba(0,0,0,.4)'; F.rr(c, 240, e.y - 52, 18, 90, 9); c.fill();
                c.fillStyle = f > 0.8 ? '#ff4d6d' : '#ffd166'; F.rr(c, 240, e.y - 52 + 90 * (1 - f), 18, 90 * f, 9); c.fill();
              }
              if (e.lance) {
                var q = e.lance.t, x = F.lerp(X0, e.lance.x, q), y = e.y + 10 - Math.sin(q * Math.PI) * 160;
                c.strokeStyle = e.p.couleur; c.lineWidth = 9; c.beginPath(); c.ellipse(x, y, 26, 10, 0, 0, 7); c.stroke();
                c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y - 2, 26, 10, 0, Math.PI, 2 * Math.PI); c.stroke();
              }
              F.texte(c, e.p.nom, 60, e.y - 70, 26, '#fff', { align: 'left' });
              F.texte(c, e.pts + ' pts', 1560, e.y, 40, '#fff', { align: 'right', contour: e.p.couleur, epaisseur: 8 });
              if (e.dernier) F.texte(c, e.dernier, 1430, e.y - 50, 30, e.dernier === 'raté' ? '#ff4d6d' : '#ffd166');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.pts, texte: e.pts + ' points' }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Les couleurs farceuses
    {
      id: 'couleurs', nom: 'Les couleurs farceuses', emoji: '🎨', duree: 30,
      regle: 'Un mot de couleur s\'affiche… mais écrit dans une autre couleur ! Tape la couleur de l\'ENCRE, pas le mot. Le plus rapide gagne le point, une erreur te fait perdre un point.',
      controles: '4 boutons de couleur',
      ui: function () {
        return { boutons: QUATRE.map(function (col, k) { return { id: String(k), label: NOMS4[k], couleur: col }; }), mode: 'manette', disposition: 'grille' };
      },
      creer: function (ps, env) {
        var TOTAL = 12;
        var etats = ps.map(function (p) { return { p: p, pts: 0, bloque: false, flash: 0, ok: false }; });
        var n = 0, mot = 0, encre = 0, T = 0, attente = 0.6, gagnant = null;
        function suivant() {
          n++;
          if (n > TOTAL) { inst.fini = true; return; }
          mot = F.entier(0, 3); encre = F.entier(0, 3);
          if (Math.random() < 0.8) while (encre === mot) encre = F.entier(0, 3);
          gagnant = null;
          etats.forEach(function (e) { e.bloque = false; });
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || !n || gagnant || e.bloque || attente > 0) return;
            if (+m.b === encre) {
              gagnant = e; e.pts++; e.flash = 0.6; e.ok = true; env.son.gain(); attente = 0.9;
            } else { e.bloque = true; e.pts--; e.flash = 0.6; e.ok = false; env.son.buzz(); }
          },
          maj: function (dt) {
            T += dt;
            etats.forEach(function (e) { e.flash = Math.max(0, e.flash - dt); });
            if (attente > 0) { attente -= dt; if (attente <= 0) suivant(); return; }
            if (n && !gagnant && etats.every(function (e) { return e.bloque; })) attente = 0.6;
          },
          dessiner: function (c) {
            ciel(c, '#f8f1e5', '#e9dcc5');
            c.fillStyle = '#fff'; F.rr(c, 300, 170, 1000, 360, 40); c.fill();
            c.lineWidth = 10; c.strokeStyle = '#1b1b2f'; F.rr(c, 300, 170, 1000, 360, 40); c.stroke();
            if (n && n <= TOTAL) {
              F.texte(c, NOMS4[mot], 800, 350, 170, QUATRE[encre], { contour: 'rgba(0,0,0,.15)', epaisseur: 6 });
              F.texte(c, n + ' / ' + TOTAL, 800, 120, 40, '#1b1b2f', { contour: false });
            } else F.texte(c, 'Prêts ?', 800, 350, 120, '#1b1b2f', { contour: false });
            F.texte(c, 'Tape la couleur de l\'ENCRE !', 800, 590, 40, '#1b1b2f', { contour: false });
            etats.forEach(function (e, i) {
              var x = posX(i, etats.length);
              F.pion(c, x, 760, 40, e.p.couleur, null, { phase: i, triste: e.bloque, saut: gagnant === e ? Math.abs(Math.sin(F.t * 10)) * 26 : 0 });
              F.texte(c, e.p.nom, x, 830, 30, '#1b1b2f', { contour: 'rgba(255,255,255,.8)', epaisseur: 5 });
              F.texte(c, String(e.pts), x, 680, 46, '#fff', { contour: e.p.couleur, epaisseur: 10 });
              if (e.flash > 0) F.texte(c, e.ok ? '+1' : '−1', x + 60, 690, 36, e.ok ? '#2a9d8f' : '#e63946', { contour: false });
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.pts, texte: e.pts + ' point' + (Math.abs(e.pts) > 1 ? 's' : '') }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Le plateau glissant
    {
      id: 'glissant', nom: 'Le plateau glissant', emoji: '🛡️', duree: 30,
      regle: 'Tout le monde sur la tour ! Pousse les autres dans le vide et reste dessus le plus longtemps possible. Le bouton 💥 donne un grand coup d\'épaule.',
      controles: 'Croix pour bouger, 💥 pour foncer',
      ui: function () { return { pad: true, boutons: [{ id: 'A', label: '💥' }] }; },
      creer: function (ps, env) {
        var CX = 800, CY = 470, R = 330, RAYON = 38;
        var etats = ps.map(function (p, i) {
          var a = i / ps.length * Math.PI * 2 + 0.4;
          return { p: p, x: CX + Math.cos(a) * 170, y: CY + Math.sin(a) * 170, vx: 0, vy: 0, dx: 0, dy: 0, dash: 0, recharge: 0, tombe: 0, out: false, tOut: 0, dir: 1 };
        });
        var T = 0, ordreChute = 0;
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || e.out) return;
            if (m.t === 'dir') { e.dx = F.borne(+m.x || 0, -1, 1); e.dy = F.borne(+m.y || 0, -1, 1); }
            else if (appui(m) && e.recharge <= 0) {
              var l = Math.hypot(e.dx, e.dy) || 1, ax = e.dx || e.dir, ay = e.dy;
              l = Math.hypot(ax, ay) || 1;
              e.vx += ax / l * 560; e.vy += ay / l * 560; e.dash = 0.25; e.recharge = 1.3; env.son.pop();
            }
          },
          maj: function (dt) {
            T += dt;
            etats.forEach(function (e) {
              e.dash = Math.max(0, e.dash - dt); e.recharge = Math.max(0, e.recharge - dt);
              if (e.out) { e.tombe += dt; return; }
              var l = Math.hypot(e.dx, e.dy) || 1;
              e.vx += e.dx / Math.max(1, l) * 950 * dt; e.vy += e.dy / Math.max(1, l) * 950 * dt;
              var fr = Math.pow(0.05, dt); e.vx *= fr; e.vy *= fr;
              e.x += e.vx * dt; e.y += e.vy * dt;
              if (e.dx) e.dir = e.dx > 0 ? 1 : -1;
            });
            // chocs entre joueurs
            for (var i = 0; i < etats.length; i++) for (var j = i + 1; j < etats.length; j++) {
              var a = etats[i], b = etats[j];
              if (a.out || b.out) continue;
              var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
              if (d < RAYON * 2) {
                var nx = dx / d, ny = dy / d, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                var recul = (RAYON * 2 - d) / 2;
                a.x -= nx * recul; a.y -= ny * recul; b.x += nx * recul; b.y += ny * recul;
                if (rel > 0) {
                  var fa = a.dash > 0 ? 1.8 : 1.1, fb = b.dash > 0 ? 1.8 : 1.1;
                  a.vx -= nx * rel * fb * 0.9; a.vy -= ny * rel * fb * 0.9; b.vx += nx * rel * fa * 0.9; b.vy += ny * rel * fa * 0.9;
                  if (rel > 200) env.son.de();
                }
              }
            }
            etats.forEach(function (e) {
              if (!e.out && Math.hypot(e.x - CX, (e.y - CY) * 1.6) > R) {
                e.out = true; e.tOut = T; e.ordre = ++ordreChute; env.son.perte();
                env.envoyerUI(e.p, { emoji: '😵', titre: 'Tombé !', texte: 'Regarde la fin sur la télé.' });
              }
            });
            if (etats.filter(function (e) { return !e.out; }).length <= 1) { if (!inst.finT) inst.finT = T; if (T - inst.finT > 1) inst.fini = true; }
          },
          dessiner: function (c) {
            ciel(c, '#4cc9f0', '#caf0f8');
            F.texte(c, 'Pousse les autres dans le vide !', 800, 80, 46, '#fff');
            // tombés (derrière la plateforme)
            etats.forEach(function (e, i) { if (e.out && e.y < CY) F.pion(c, e.x, e.y + e.tombe * e.tombe * 900, 36, e.p.couleur, null, { triste: true, phase: i }); });
            c.fillStyle = '#6c757d'; c.beginPath(); c.ellipse(CX, CY + 60, R, R / 1.6, 0, 0, Math.PI); c.lineTo(CX - R, CY); c.fill();
            c.fillStyle = '#495057'; c.fillRect(CX - R, CY, 2 * R, 60);
            c.fillStyle = '#8d99ae'; c.beginPath(); c.ellipse(CX, CY + 60, R, R / 1.6, 0, 0, Math.PI); c.fill();
            var g = c.createRadialGradient(CX, CY, 20, CX, CY, R);
            g.addColorStop(0, '#e9ecef'); g.addColorStop(1, '#ced4da');
            c.fillStyle = g; c.beginPath(); c.ellipse(CX, CY, R, R / 1.6, 0, 0, 7); c.fill();
            c.strokeStyle = '#ffd166'; c.lineWidth = 8; c.beginPath(); c.ellipse(CX, CY, R - 14, R / 1.6 - 10, 0, 0, 7); c.stroke();
            c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 3;
            for (var k = 1; k < 4; k++) { c.beginPath(); c.ellipse(CX, CY, R * k / 4, R * k / 6.4, 0, 0, 7); c.stroke(); }
            etats.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (e) {
              var i = etats.indexOf(e);
              if (e.out && e.y < CY) return;
              var y = e.out ? e.y + e.tombe * e.tombe * 900 : e.y;
              if (y > 1000) return;
              F.pion(c, e.x, y - 30, RAYON, e.p.couleur, null, { triste: e.out, regard: e.dir, phase: i });
              if (e.dash > 0) env.particules.ajouter(e.x - e.dir * 30, e.y, { vx: -e.dir * 80, g: -60, vie: 0.3, taille: 6, couleur: '#fff' });
              if (!e.out) F.texte(c, e.p.nom, e.x, y - 100, 26, '#fff');
            });
          },
          scores: function () {
            return etats.map(function (e) {
              return { p: e.p, score: e.out ? e.tOut : 1000, texte: e.out ? 'tombé à ' + Math.round(e.tOut) + ' s' : 'resté debout !' };
            });
          }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- La bombe farceuse
    {
      id: 'bombe', nom: 'La bombe farceuse', emoji: '💣', duree: 60,
      regle: 'Une bombe passe de main en main. Si tu l\'as, tape vite pour la lancer à quelqu\'un d\'autre ! Quand elle explose, celui qui la tient perd. 3 explosions.',
      controles: 'Tape pour te débarrasser de la bombe',
      ui: function () { return { boutons: [{ id: 'A', label: '💣 PASSE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var MANCHES = 3;
        var etats = ps.map(function (p, i) { return { p: p, boum: 0, i: i }; });
        var porteur = null, vol = null, meche = 0, manche = 0, T = 0, pause = 0.5, explosion = null;
        function placer(i) {
          var n = etats.length, a = -Math.PI / 2 + i / n * Math.PI * 2;
          return { x: 800 + Math.cos(a) * 420, y: 470 + Math.sin(a) * 250 };
        }
        function nouvelleManche() {
          manche++;
          if (manche > MANCHES) { inst.fini = true; return; }
          porteur = F.choisir(etats); meche = F.alea(5, 10); vol = null; explosion = null;
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e !== porteur || vol) return;
            var autres = etats.filter(function (x) { return x !== e; });
            var vers = F.choisir(autres);
            vol = { de: e, vers: vers, t: 0 }; porteur = null; env.son.pop();
          },
          maj: function (dt) {
            T += dt;
            if (pause > 0) { pause -= dt; if (pause <= 0) nouvelleManche(); return; }
            if (!manche) return;
            meche -= dt;
            if (vol) { vol.t += dt / 0.35; if (vol.t >= 1) { porteur = vol.vers; vol = null; } }
            if (meche <= 0 && !explosion) {
              var perdant = porteur || (vol && vol.de);
              if (vol) { porteur = vol.de; vol = null; }
              perdant.boum++; explosion = { e: perdant, t: T };
              env.son.buzz(); env.son.cymbale();
              var q = placer(perdant.i);
              env.particules.gerbe(q.x, q.y - 40, 50, { couleurs: ['#ff5400', '#ffbe0b', '#6c757d', '#fff'], haut: 500 });
              pause = 2;
            }
          },
          dessiner: function (c) {
            ciel(c, '#3a0ca3', '#7209b7'); etoiles(c, 40);
            c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(800, 500, 560, 320, 0, 0, 7); c.fill();
            F.texte(c, manche ? 'Explosion ' + Math.min(manche, MANCHES) + ' / ' + MANCHES : 'Prêts ?', 800, 70, 50, '#fff');
            etats.forEach(function (e) {
              var q = placer(e.i), triste = explosion && explosion.e === e;
              F.pion(c, q.x, q.y, 44, e.p.couleur, null, { phase: e.i, triste: triste, saut: e === porteur ? Math.abs(Math.sin(F.t * 16)) * 10 : 0 });
              F.texte(c, e.p.nom, q.x, q.y + 70, 30, '#fff');
              for (var k = 0; k < e.boum; k++) F.texte(c, '💥', q.x - (e.boum - 1) * 20 + k * 40, q.y + 112, 30, '#fff', { contour: false });
            });
            var bx, by;
            if (vol) {
              var a = placer(vol.de.i), b = placer(vol.vers.i);
              bx = F.lerp(a.x, b.x, vol.t); by = F.lerp(a.y, b.y, vol.t) - 60 - Math.sin(vol.t * Math.PI) * 120;
            } else if (porteur) { var q = placer(porteur.i); bx = q.x; by = q.y - 90; }
            if (bx !== undefined && !explosion) {
              var tremble = meche < 2 ? F.alea(-4, 4) : 0;
              c.fillStyle = '#1b1b2f'; c.beginPath(); c.arc(bx + tremble, by, 34, 0, 7); c.fill();
              c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(bx - 10 + tremble, by - 12, 9, 0, 7); c.fill();
              c.strokeStyle = '#7f4f24'; c.lineWidth = 6; c.beginPath(); c.moveTo(bx + 20, by - 26); c.quadraticCurveTo(bx + 40, by - 50, bx + 30, by - 60); c.stroke();
              c.fillStyle = Math.floor(F.t * 12) % 2 ? '#ffbe0b' : '#ff5400'; c.beginPath(); c.arc(bx + 30, by - 62, 8, 0, 7); c.fill();
            }
            if (explosion) F.texte(c, 'BOUM ! ' + explosion.e.p.nom, 800, 470, 90, '#ffbe0b', { contour: '#d00000', epaisseur: 14 });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: -e.boum, texte: e.boum ? e.boum + ' explosion' + (e.boum > 1 ? 's' : '') : 'jamais explosé !' }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Trouve l'intrus
    {
      id: 'intrus', nom: 'Trouve l\'intrus', emoji: '🔍', duree: 50,
      regle: 'Quatre chevaliers… mais l\'un d\'eux n\'a pas tout à fait la même couleur ! Trouve-le le premier. Attention, ça devient de plus en plus dur.',
      controles: '4 boutons : la position de l\'intrus',
      ui: function () {
        return { boutons: [{ id: '0', label: '↖ en haut à gauche' }, { id: '1', label: '↗ en haut à droite' }, { id: '2', label: '↙ en bas à gauche' }, { id: '3', label: '↘ en bas à droite' }], mode: 'manette', disposition: 'grille' };
      },
      creer: function (ps, env) {
        var TOTAL = 7;
        var etats = ps.map(function (p) { return { p: p, pts: 0, bloque: false }; });
        var n = 0, bon = 0, base = '#888', autre = '#999', attente = 0.6, gagnant = null;
        function teinte(h, s, l) { // hsl -> hex
          var a = s * Math.min(l, 1 - l);
          function f(k) { var x = (k + h * 12) % 12, v = l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)); return ('0' + Math.round(v * 255).toString(16)).slice(-2); }
          return '#' + f(0) + f(8) + f(4);
        }
        function suivant() {
          n++;
          if (n > TOTAL) { inst.fini = true; return; }
          var h = Math.random(), ecart = Math.max(0.09, 0.32 - n * 0.035);
          base = teinte(h, 0.7, 0.55); autre = teinte(h, 0.7, 0.55 + (Math.random() < 0.5 ? -ecart : ecart));
          bon = F.entier(0, 3); gagnant = null;
          etats.forEach(function (e) { e.bloque = false; });
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || !n || gagnant || e.bloque || attente > 0) return;
            if (+m.b === bon) { gagnant = e; e.pts++; env.son.gain(); attente = 1.4; }
            else { e.bloque = true; env.son.buzz(); }
          },
          maj: function (dt) {
            if (attente > 0) { attente -= dt; if (attente <= 0) suivant(); return; }
            if (n && !gagnant && etats.every(function (e) { return e.bloque; })) attente = 1.2;
          },
          dessiner: function (c) {
            ciel(c, '#264653', '#2a9d8f');
            F.texte(c, n && n <= TOTAL ? 'Manche ' + n + ' / ' + TOTAL : 'Prêts ?', 800, 60, 46, '#fff');
            for (var k = 0; k < 4; k++) {
              var x = 560 + (k % 2) * 480, y = 230 + Math.floor(k / 2) * 300;
              var montre = gagnant || (n && !gagnant && etats.every(function (e) { return e.bloque; }));
              c.fillStyle = montre && k === bon ? 'rgba(255,209,102,.5)' : 'rgba(255,255,255,.12)';
              F.rr(c, x - 200, y - 130, 400, 260, 30); c.fill();
              F.texte(c, ['↖', '↗', '↙', '↘'][k], x - 170, y - 100, 34, 'rgba(255,255,255,.6)', { contour: false });
              if (n && n <= TOTAL) F.pion(c, x, y + 20, 80, k === bon ? autre : base, null, { phase: k });
            }
            etats.forEach(function (e, i) {
              var x = 90 + (i % 2) * 1420, y = 300 + Math.floor(i / 2) * 330;
              F.pion(c, x, y, 34, e.p.couleur, null, { phase: i, triste: e.bloque, saut: gagnant === e ? Math.abs(Math.sin(F.t * 10)) * 20 : 0 });
              F.texte(c, e.p.nom, x, y + 60, 26, '#fff');
              F.texte(c, String(e.pts), x, y - 70, 44, '#ffd166');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.pts, texte: e.pts + ' trouvé' + (e.pts > 1 ? 's' : '') }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Le calcul du roi
    {
      id: 'calcul', nom: 'Le calcul du roi', emoji: '➗', duree: 60,
      regle: 'Le roi pose des calculs. Le premier qui tape la bonne réponse gagne le point. Une erreur et tu attends le calcul suivant.',
      controles: '4 réponses sur le téléphone',
      ui: function () { return { emoji: '👑', titre: 'Le calcul du roi', texte: 'Regarde la télé !' }; },
      creer: function (ps, env) {
        var TOTAL = 7;
        var etats = ps.map(function (p) { return { p: p, pts: 0, bloque: false }; });
        var n = 0, q = null, attente = 0.4, gagnant = null;
        function question() {
          var op = F.choisir(n < 3 ? ['+', '-'] : ['+', '-', '×', '×']), a, b, r;
          if (op === '+') { a = F.entier(6, 49); b = F.entier(5, 39); r = a + b; }
          else if (op === '-') { a = F.entier(20, 80); b = F.entier(3, a - 5); r = a - b; }
          else { a = F.entier(2, 9); b = F.entier(3, 12); r = a * b; }
          var rep = [r];
          while (rep.length < 4) { var x = r + F.choisir([-10, -2, -1, 1, 2, 10, 3, -3, 5]); if (x >= 0 && rep.indexOf(x) === -1) rep.push(x); }
          rep = F.melanger(rep);
          return { txt: a + ' ' + op + ' ' + b, r: r, rep: rep };
        }
        function suivant() {
          n++;
          if (n > TOTAL) { inst.fini = true; return; }
          q = question(); gagnant = null;
          etats.forEach(function (e) {
            e.bloque = false;
            env.envoyerUI(e.p, { titre: q.txt + ' = ?', boutons: q.rep.map(function (x, k) { return { id: String(x), label: String(x), couleur: QUATRE[k] }; }), mode: 'manette', disposition: 'grille' });
          });
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || !q || gagnant || e.bloque || attente > 0) return;
            if (+m.b === q.r) { gagnant = e; e.pts++; env.son.gain(); attente = 1.4; }
            else { e.bloque = true; env.son.buzz(); }
          },
          maj: function (dt) {
            if (attente > 0) { attente -= dt; if (attente <= 0) suivant(); return; }
            if (q && !gagnant && etats.every(function (e) { return e.bloque; })) attente = 1.2;
          },
          dessiner: function (c) {
            ciel(c, '#5a189a', '#9d4edd');
            F.dessinerSprite(c, 'arene/trophy', 800, 250, 170, { taille: 192, angle: 0.4, hauteur: 0.3 });
            c.fillStyle = '#fff'; F.rr(c, 330, 280, 940, 220, 40); c.fill();
            if (q) {
              var fin = gagnant || etats.every(function (e) { return e.bloque; });
              F.texte(c, q.txt + ' = ' + (fin ? q.r : '?'), 800, 390, 120, '#3c096c', { contour: false });
              F.texte(c, 'Calcul ' + Math.min(n, TOTAL) + ' / ' + TOTAL, 800, 50, 40, '#fff');
              q.rep.forEach(function (x, k) {
                var bx = 410 + k * 260;
                c.fillStyle = fin && x === q.r ? '#80ed99' : QUATRE[k]; F.rr(c, bx - 110, 530, 220, 90, 24); c.fill();
                F.texte(c, String(x), bx, 575, 50, '#fff');
              });
            } else F.texte(c, 'Prêts ?', 800, 390, 100, '#3c096c', { contour: false });
            bandeau(c, etats, function (e) { return String(e.pts); }, { y: 770, triste: function (e) { return e.bloque; }, saut: function (e) { return gagnant === e ? Math.abs(Math.sin(F.t * 10)) * 24 : 0; } });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.pts, texte: e.pts + ' bonne' + (e.pts > 1 ? 's' : '') + ' réponse' + (e.pts > 1 ? 's' : '') }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- La tour du château
    {
      id: 'tour', nom: 'La tour du château', emoji: '🧱', duree: 30,
      regle: 'Une pierre glisse au-dessus de ta tour. Tape pour la lâcher : ce qui dépasse tombe ! Construis la tour la plus haute.',
      controles: 'Tape pour lâcher la pierre',
      ui: function () { return { boutons: [{ id: 'A', label: '🧱 LÂCHE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var lanes = couloirs(ps.length, 60), H = 46;
        var etats = ps.map(function (p, i) {
          var L = lanes[i], w0 = Math.min(220, L.w * 0.6);
          return { p: p, L: L, pile: [{ x: L.cx - w0 / 2, w: w0 }], bloc: { x: L.x + 10, w: w0, v: 260 }, fini: false, debris: [], cam: 0 };
        });
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e.fini) return;
            var haut = e.pile[e.pile.length - 1], b = e.bloc;
            var g = Math.max(b.x, haut.x), d = Math.min(b.x + b.w, haut.x + haut.w);
            if (d - g < 6) {
              e.fini = true; env.son.buzz(); e.debris.push({ x: b.x, w: b.w, y: 0, n: e.pile.length });
              env.envoyerUI(p, { emoji: '🏰', titre: 'Ta tour : ' + (e.pile.length - 1) + ' étages', texte: 'Regarde les autres sur la télé.' });
              return;
            }
            if (b.x < g) e.debris.push({ x: b.x, w: g - b.x, y: 0, n: e.pile.length });
            if (b.x + b.w > d) e.debris.push({ x: d, w: b.x + b.w - d, y: 0, n: e.pile.length });
            var parfait = d - g > b.w - 8;
            if (parfait) { g = haut.x; d = haut.x + haut.w; env.son.gain(); } else env.son.pop();
            e.pile.push({ x: g, w: d - g, parfait: parfait });
            e.bloc = { x: Math.random() < 0.5 ? e.L.x + 10 : e.L.x + e.L.w - 10 - (d - g), w: d - g, v: (Math.random() < 0.5 ? 1 : -1) * Math.min(620, 260 + e.pile.length * 22) };
          },
          maj: function (dt) {
            etats.forEach(function (e) {
              e.debris.forEach(function (d) { d.y += 600 * dt; });
              e.debris = e.debris.filter(function (d) { return d.y < 900; });
              e.cam += (Math.max(0, e.pile.length - 9) * H - e.cam) * Math.min(1, dt * 5);
              if (e.fini) return;
              var b = e.bloc; b.x += b.v * dt;
              if (b.x < e.L.x + 6) { b.x = e.L.x + 6; b.v = Math.abs(b.v); }
              if (b.x + b.w > e.L.x + e.L.w - 6) { b.x = e.L.x + e.L.w - 6 - b.w; b.v = -Math.abs(b.v); }
            });
            if (etats.every(function (e) { return e.fini; })) inst.fini = true;
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 760 });
            etats.forEach(function (e, i) {
              c.save(); c.beginPath(); c.rect(e.L.x, 0, e.L.w, 900); c.clip();
              var y0 = 790 + e.cam;
              e.pile.forEach(function (b, k) {
                var y = y0 - k * H;
                if (y < -60 || y > 960) return;
                c.fillStyle = k === 0 ? '#6c757d' : (k % 2 ? '#adb5bd' : '#ced4da'); c.fillRect(b.x, y - H, b.w, H - 2);
                c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(b.x, y - 8, b.w, 6);
                c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2;
                for (var s = b.x + (k % 2 ? 20 : 45); s < b.x + b.w; s += 50) { c.beginPath(); c.moveTo(s, y - H); c.lineTo(s, y - 2); c.stroke(); }
                if (b.parfait) { c.fillStyle = 'rgba(255,209,102,.5)'; c.fillRect(b.x, y - H, b.w, 6); }
              });
              e.debris.forEach(function (d) { c.fillStyle = '#adb5bd'; c.fillRect(d.x, y0 - d.n * H + d.y - H, d.w, H - 2); });
              if (!e.fini) {
                var yb = y0 - e.pile.length * H - 30;
                c.fillStyle = e.p.couleur; c.fillRect(e.bloc.x, yb - H, e.bloc.w, H - 2);
                c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(e.bloc.x, yb - H, e.bloc.w, 8);
              }
              c.restore();
              if (i > 0) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(e.L.x - 2, 0, 4, 900); }
              F.texte(c, e.p.nom, e.L.cx, 60, 32, '#fff', { contour: e.p.couleur, epaisseur: 8 });
              F.texte(c, (e.pile.length - 1) + ' étage' + (e.pile.length > 2 ? 's' : ''), e.L.cx, 110, 34, '#fff');
              if (e.fini) F.texte(c, 'Terminé !', e.L.cx, 170, 34, '#ffd166');
            });
          },
          scores: function () { return etats.map(function (e) { var n = e.pile.length - 1; return { p: e.p, score: n, texte: n + ' étage' + (n > 1 ? 's' : '') }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Le ballon qui gonfle
    {
      id: 'ballon', nom: 'Le ballon qui gonfle', emoji: '🎈', duree: 20,
      regle: 'Gonfle ton ballon le plus gros possible… mais il éclate à une taille secrète ! Tape STOP pour garder ta taille. Si ton ballon éclate, tu as zéro.',
      controles: 'GONFLE et STOP',
      ui: function () { return { boutons: [{ id: 'A', label: '🎈 GONFLE' }, { id: 'B', label: '✋ STOP', couleur: '#adb5bd' }], mode: 'manette', disposition: 'ligne' }; },
      creer: function (ps, env) {
        var LIMITE = F.entier(18, 42);
        var etats = ps.map(function (p) { return { p: p, n: 0, aff: 0, stop: false, eclate: false, t: 0 }; });
        var revele = 0, T = 0;
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e.stop || e.eclate || revele) return;
            if (m.b === 'B') {
              e.stop = true; env.son.clic();
              env.envoyerUI(p, { emoji: '✋', titre: 'Arrêté à ' + e.n, texte: 'Attends le résultat !' });
              return;
            }
            e.n++; env.son.pop();
            if (e.n > LIMITE) {
              e.eclate = true; e.t = T; env.son.buzz();
              env.envoyerUI(p, { emoji: '💥', titre: 'PAF !', texte: 'Ton ballon a éclaté…' });
            }
          },
          maj: function (dt) {
            T += dt;
            etats.forEach(function (e) { e.aff += (e.n - e.aff) * Math.min(1, dt * 10); });
            if (!revele && (etats.every(function (e) { return e.stop || e.eclate; }) || T > 18)) {
              revele = T; etats.forEach(function (e) { if (!e.eclate) e.stop = true; }); env.son.fanfare();
            }
            if (revele && T - revele > 2.5) inst.fini = true;
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 700 });
            F.texte(c, revele ? 'Les ballons éclataient après ' + LIMITE + ' coups !' : 'Ne le fais pas éclater !', 800, 90, 48, '#fff');
            etats.forEach(function (e, i) {
              var x = posX(i, etats.length), r = 30 + e.aff * 5.2;
              c.strokeStyle = '#495057'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 700); c.quadraticCurveTo(x + 10, 640, x, 600 - r * 0.2); c.stroke();
              if (e.eclate) {
                F.texte(c, 'PAF !', x, 450, 70, '#ff4d6d', { contour: '#fff', epaisseur: 10 });
                c.fillStyle = e.p.couleur;
                for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2 + 0.3; c.beginPath(); c.ellipse(x + Math.cos(a) * 70, 560 + Math.sin(a) * 40, 16, 8, a, 0, 7); c.fill(); }
              } else {
                var cy = 590 - r;
                var g = c.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r);
                g.addColorStop(0, F.eclaircir(e.p.couleur, 0.5)); g.addColorStop(1, e.p.couleur);
                c.fillStyle = g; c.beginPath(); c.ellipse(x, cy, r * 0.9, r, 0, 0, 7); c.fill();
                c.fillStyle = F.assombrir(e.p.couleur, 0.2); c.beginPath(); c.moveTo(x - 8, 594); c.lineTo(x + 8, 594); c.lineTo(x, 584); c.fill();
                if (e.stop) F.texte(c, '✋', x + r * 0.8, cy - r * 0.8, 40, '#fff', { contour: false });
              }
              F.pion(c, x, 770, 36, e.p.couleur, null, { phase: i, triste: e.eclate });
              F.texte(c, e.p.nom, x, 840, 28, '#fff');
              F.texte(c, e.eclate ? '0' : String(e.n), x, 690, 36, '#fff', { contour: e.p.couleur, epaisseur: 8 });
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.eclate ? -1 + e.t / 1000 : e.n, texte: e.eclate ? 'éclaté !' : 'taille ' + e.n }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Le saut à la corde
    {
      id: 'corde', nom: 'Le saut à la corde', emoji: '🪢', duree: 60,
      regle: 'Deux gardes font tourner une grande corde, de plus en plus vite. Saute au bon moment ! Si la corde te touche, tu es éliminé. Le dernier qui saute gagne.',
      controles: 'Tape pour sauter',
      ui: function () { return { boutons: [{ id: 'A', label: '⬆ SAUTE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var etats = ps.map(function (p, i) { return { p: p, x: 800 - (ps.length - 1) * 75 + i * 150, saut: 0, out: false, sauts: 0, tOut: 0 }; });
        var angle = -Math.PI / 2 - 1.2, vitesse = 2.6, T = 0, tours = 0, finT = 0;
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || e.out || e.saut > 0) return;
            e.saut = 0.001; env.son.pop();
          },
          maj: function (dt) {
            T += dt;
            var avant = angle;
            angle += vitesse * dt;
            etats.forEach(function (e) { if (e.saut > 0) { e.saut += dt; if (e.saut > 0.55) e.saut = 0; } });
            // la corde passe en bas quand l'angle franchit π/2 (modulo 2π)
            var bas = Math.PI / 2;
            var a0 = ((avant - bas) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), a1 = ((angle - bas) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            if (a1 < a0) {
              tours++; env.son.tic();
              etats.forEach(function (e) {
                if (e.out) return;
                var h = e.saut > 0 ? Math.sin(e.saut / 0.55 * Math.PI) : 0;
                if (h < 0.35) { e.out = true; e.tOut = T; env.son.buzz(); env.envoyerUI(e.p, { emoji: '😵', titre: 'Touché !', texte: 'Regarde la fin sur la télé.' }); }
                else e.sauts++;
              });
              vitesse = Math.min(7.5, vitesse + 0.18);
            }
            var restants = etats.filter(function (e) { return !e.out; }).length;
            if ((restants <= (etats.length > 1 ? 1 : 0)) && !finT) finT = T;
            if (finT && T - finT > 1.2) inst.fini = true;
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 520 });
            F.texte(c, 'Sauts : ' + tours, 800, 90, 54, '#fff');
            var gx = 800 - (etats.length - 1) * 75 - 230, dx = 800 + (etats.length - 1) * 75 + 230, yb = 740;
            var dev = Math.sin(angle) >= 0; // corde devant les joueurs
            function corde() {
              var hy = 600 + Math.sin(angle) * 150, s = Math.cos(angle);
              c.strokeStyle = '#7f4f24'; c.lineWidth = 8; c.beginPath(); c.moveTo(gx + 30, 620); c.quadraticCurveTo(800, hy * 2 - 620 + s * 20, dx - 30, 620); c.stroke();
            }
            if (!dev) corde();
            [gx, dx].forEach(function (x, k) {
              if (!F.dessinerSprite(c, 'arene/character-soldier', x, yb + 30, 200, { taille: 192, angle: k ? -0.8 : 0.8, hauteur: 0.2 }))
                F.pion(c, x, yb, 50, '#6c757d', null, { phase: k });
            });
            etats.forEach(function (e, i) {
              var h = e.saut > 0 ? Math.sin(e.saut / 0.55 * Math.PI) * 130 : 0;
              F.pion(c, e.x, yb, 40, e.p.couleur, null, { saut: h, triste: e.out, phase: i });
              F.texte(c, e.p.nom, e.x, yb + 70, 26, e.out ? '#ced4da' : '#fff');
              if (e.out) F.texte(c, '✖', e.x + 40, yb - 60, 40, '#ff4d6d');
            });
            if (dev) corde();
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.out ? e.sauts : 1000 + e.sauts, texte: e.sauts + ' saut' + (e.sauts > 1 ? 's' : '') + (e.out ? '' : ' · debout !') }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- Compte les moutons
    {
      id: 'moutons', nom: 'Compte les moutons', emoji: '🐑', duree: 45,
      regle: 'Des moutons traversent le pré à toute vitesse. Compte-les bien ! Ensuite, donne ton nombre sur le téléphone. Le plus proche gagne.',
      controles: 'Regarde, puis −  +  et Valider',
      ui: function () { return { emoji: '👀', titre: 'Compte les moutons !', texte: 'Regarde bien la télé…' }; },
      creer: function (ps, env) {
        var TOTAL = F.entier(14, 26), DUREE = 9;
        var moutons = [];
        for (var k = 0; k < TOTAL; k++) moutons.push({ t: F.alea(0, DUREE - 1.6), y: F.alea(400, 800), v: F.alea(520, 820), sens: Math.random() < 0.5 ? 1 : -1, noir: Math.random() < 0.15 });
        var etats = ps.map(function (p) { return { p: p, n: 10, ok: false }; });
        var T = 0, phase = 'regarde', revele = 0;
        function ui(e) {
          return { titre: 'Combien de moutons ?', texte: 'Ton nombre : ' + e.n, boutons: [{ id: 'm5', label: '−5', couleur: '#adb5bd' }, { id: 'p5', label: '+5', couleur: '#adb5bd' }, { id: 'm1', label: '−1' }, { id: 'p1', label: '+1' }, { id: 'ok', label: '✅ Valider ' + e.n, couleur: '#80ed99' }], mode: 'manette', disposition: 'grille' };
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            var e = trouver(etats, p);
            if (!e || !appui(m) || phase !== 'reponse' || e.ok) return;
            var d = { m5: -5, p5: 5, m1: -1, p1: 1 }[m.b];
            if (d) { e.n = Math.max(0, e.n + d); env.son.clic(); env.envoyerUI(p, ui(e)); }
            else if (m.b === 'ok') { e.ok = true; env.son.pop(); env.envoyerUI(p, { emoji: '✅', titre: 'Réponse : ' + e.n, texte: 'Attends les autres…' }); }
          },
          maj: function (dt) {
            T += dt;
            if (phase === 'regarde' && T > DUREE) { phase = 'reponse'; etats.forEach(function (e) { env.envoyerUI(e.p, ui(e)); }); }
            else if (phase === 'reponse' && (etats.every(function (e) { return e.ok; }) || T > DUREE + 25)) { phase = 'fin'; revele = T; env.son.fanfare(); }
            else if (phase === 'fin' && T - revele > 3) inst.fini = true;
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 330 });
            // barrière
            c.fillStyle = '#a0662f'; for (var b = 0; b < 17; b++) c.fillRect(b * 100, 300, 14, 70); c.fillRect(0, 316, 1600, 10); c.fillRect(0, 346, 1600, 10);
            if (phase === 'regarde') {
              moutons.forEach(function (m) {
                var dt = T - m.t; if (dt < 0) return;
                var x = m.sens > 0 ? -100 + dt * m.v : 1700 - dt * m.v;
                if (x < -120 || x > 1720) return;
                var bond = Math.abs(Math.sin(dt * 12)) * 12;
                c.save(); c.translate(x, m.y - bond); c.scale(m.sens, 1);
                c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(0, 40 + bond, 50, 10, 0, 0, 7); c.fill();
                c.fillStyle = '#343a40'; c.fillRect(-28, 14, 8, 26); c.fillRect(18, 14, 8, 26);
                c.fillStyle = m.noir ? '#495057' : '#fff';
                [[-26, 0], [0, -10], [24, 0], [0, 10], [-10, 4], [12, 4]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 22, 0, 7); c.fill(); });
                c.fillStyle = '#343a40'; c.beginPath(); c.ellipse(46, -8, 16, 20, 0.3, 0, 7); c.fill();
                c.fillStyle = '#fff'; c.beginPath(); c.arc(52, -12, 4, 0, 7); c.fill();
                c.restore();
              });
              F.texte(c, 'Compte bien !', 800, 90, 60, '#fff');
            } else {
              c.fillStyle = 'rgba(16,24,40,.75)'; F.rr(c, 400, 420, 800, 200, 30); c.fill();
              if (phase === 'fin') {
                F.texte(c, 'Il y avait ' + TOTAL + ' moutons !', 800, 520, 70, '#ffd166');
                for (var k = 0; k < TOTAL; k++) F.texte(c, '🐑', 300 + (k % 13) * 80, 150 + Math.floor(k / 13) * 80, 50, '#fff', { contour: false });
              } else F.texte(c, 'Combien de moutons ?', 800, 520, 64, '#fff');
            }
            if (phase !== 'regarde') bandeau(c, etats, function (e) { return phase === 'fin' ? e.n + ' (' + (e.n - TOTAL >= 0 ? '+' : '') + (e.n - TOTAL) + ')' : (e.ok ? '✔' : '…'); }, { y: 770 });
          },
          scores: function () { return etats.map(function (e) { var d = Math.abs(e.n - TOTAL); return { p: e.p, score: -d, texte: e.n + ' (écart ' + d + ')' }; }); }
        };
        return inst;
      }
    }
  ];

  NOUVEAUX.forEach(function (m) { F.MINIJEUX.push(m); });
})(Fiesta);
