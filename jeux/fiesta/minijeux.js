/*
 * Fiesta des Îles — les mini-jeux (duels éclair et fins de tour).
 * Chaque mini-jeu dessine dans un espace virtuel de 1600 × 900.
 *   creer(participants, env) → { message(p, m), maj(dt), dessiner(c), fini, scores() }
 *   participants : [{ numero, nom, couleur, ... }]   env : { son, envoyerUI(p, ui), particules }
 */
(function (F) {
  'use strict';

  var COULEURS_TOTEM = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0'];
  var NOMS_TOTEM = ['Rouge', 'Bleu', 'Jaune', 'Vert'];

  function fondDegrade(c, h, b) {
    var g = c.createLinearGradient(0, 0, 0, 900);
    g.addColorStop(0, h); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
  }
  function posX(i, n) { return n === 1 ? 800 : 220 + i * (1160 / (n - 1)); }
  function couloirs(n, marge) {
    marge = marge || 80;
    var l = (1600 - marge * 2) / n, r = [];
    for (var i = 0; i < n; i++) r.push({ x: marge + l * i, w: l, cx: marge + l * i + l / 2 });
    return r;
  }

  F.MINIJEUX = [

    // ---------------------------------------------------------------- 1. Noix de coco
    {
      id: 'coco', nom: 'Noix de coco en folie', emoji: '🥥', duree: 8,
      regle: 'Tape le plus vite possible pour faire tomber un maximum de noix de coco dans ton panier !',
      controles: 'Tapote le gros bouton',
      ui: function () { return { boutons: [{ id: 'A', label: '🥥 SECOUE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var lanes = couloirs(ps.length, 120);
        var etats = ps.map(function (p, i) { return { p: p, n: 0, secousse: 0, noix: [], lane: lanes[i] }; });
        return {
          fond: '#8ecae6',
          message: function (p, m) {
            if (m.t !== 'bouton' || !m.appui) return;
            var e = etats.filter(function (x) { return x.p === p; })[0];
            if (!e) return;
            e.n++; e.secousse = 1;
            e.noix.push({ x: e.lane.cx + F.alea(-60, 60), y: 260, vy: F.alea(0, 120), r: F.alea(0, 6) });
            if (e.noix.length > 14) e.noix.shift();
            if (e.n % 5 === 0) env.son.pop();
          },
          maj: function (dt) {
            etats.forEach(function (e) {
              e.secousse = Math.max(0, e.secousse - dt * 5);
              e.noix.forEach(function (n) { n.vy += 1800 * dt; n.y = Math.min(705, n.y + n.vy * dt); n.r += dt * 6; });
            });
          },
          dessiner: function (c) {
            fondDegrade(c, '#8ecae6', '#bde0fe');
            c.fillStyle = '#f1d18a'; c.fillRect(0, 720, 1600, 180);
            c.fillStyle = '#e9c46a'; c.fillRect(0, 720, 1600, 12);
            etats.forEach(function (e) {
              var x = e.lane.cx, sh = Math.sin(F.t * 60) * 14 * e.secousse;
              c.save(); c.translate(x + sh, 720); c.scale(2.6, 2.6); F.palmier(c, 0, 0, 1, 0.5); c.restore();
              // noix accrochées
              c.fillStyle = '#6b4226';
              for (var k = 0; k < 4; k++) { c.beginPath(); c.arc(x + sh + (k - 1.5) * 18, 535 + (k % 2) * 10, 13, 0, 7); c.fill(); }
              e.noix.forEach(function (n) {
                c.save(); c.translate(n.x, n.y); c.rotate(n.r);
                c.fillStyle = '#6b4226'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
                c.fillStyle = '#3d2314'; c.beginPath(); c.arc(-4, -4, 2.5, 0, 7); c.arc(4, -4, 2.5, 0, 7); c.arc(0, 4, 2.5, 0, 7); c.fill();
                c.restore();
              });
              // panier
              c.fillStyle = '#a47148'; F.rr(c, x - 85, 700, 170, 70, 18); c.fill();
              c.strokeStyle = '#7f5539'; c.lineWidth = 4;
              for (var i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 80 + i * 32, 702); c.lineTo(x - 70 + i * 32, 768); c.stroke(); }
              F.pion(c, x, 830, 34, e.p.couleur, null, { saut: e.secousse * 20, phase: e.p.numero });
              F.texte(c, String(e.n), x, 120, 96, '#fff', { contour: e.p.couleur, epaisseur: 12 });
              F.texte(c, e.p.nom, x, 196, 34, '#1b1b2f', { contour: 'rgba(255,255,255,.8)', epaisseur: 6 });
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.n, texte: e.n + ' noix' }; }); }
        };
      }
    },

    // ---------------------------------------------------------------- 2. Flamant réflexe
    {
      id: 'flamant', nom: 'Le flamant réflexe', emoji: '🦩', duree: 40,
      regle: 'Attends que le flamant se réveille… et tape le premier ! Si tu tapes trop tôt, tu es bloqué pour la manche. 3 manches.',
      controles: 'Un seul bouton, au bon moment',
      ui: function () { return { boutons: [{ id: 'A', label: '🦩 TAPE !' }], mode: 'manette', disposition: 'geant' }; },
      creer: function (ps, env) {
        var MANCHES = 3;
        var etats = ps.map(function (p) { return { p: p, points: 0, temps: 0, bloque: false, msg: '', msgT: 0 }; });
        var manche = 0, phase = 'pause', debutPhase = 0, signal = 0, gagnant = null, fini = false;
        function nouvelleManche() {
          manche++;
          if (manche > MANCHES) { fini = true; inst.fini = true; return; }
          phase = 'attente'; debutPhase = F.t; signal = F.t + F.alea(1.6, 4.2) / F.V; gagnant = null;
          etats.forEach(function (e) { e.bloque = false; e.msg = ''; });
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            if (m.t !== 'bouton' || !m.appui) return;
            var e = etats.filter(function (x) { return x.p === p; })[0];
            if (!e || e.bloque) return;
            if (phase === 'attente') { e.bloque = true; e.msg = 'Trop tôt !'; e.msgT = F.t; env.son.buzz(); }
            else if (phase === 'go' && !gagnant) {
              gagnant = e; e.points++; e.temps += F.t - signal; e.msg = Math.round((F.t - signal) * 1000) + ' ms'; e.msgT = F.t;
              env.son.gain(); phase = 'pause'; debutPhase = F.t;
              env.particules.gerbe(posX(etats.indexOf(e), etats.length), 760, 30, { couleurs: [e.p.couleur, '#fff'] });
            }
          },
          maj: function () {
            if (fini) return;
            if (phase === 'pause' && F.t - debutPhase > (manche === 0 ? 1.2 : 2.2) / F.V) nouvelleManche();
            else if (phase === 'attente' && F.t >= signal) { phase = 'go'; env.son.go(); }
            else if (phase === 'go' && F.t - signal > 2.5 / F.V) { phase = 'pause'; debutPhase = F.t; }
            if (phase === 'attente' && etats.every(function (e) { return e.bloque; })) { phase = 'pause'; debutPhase = F.t; }
          },
          dessiner: function (c) {
            var go = phase === 'go';
            fondDegrade(c, go ? '#ffbe0b' : '#ff9e80', go ? '#fb5607' : '#6d597a');
            c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.arc(1300, 230, 90, 0, 7); c.fill();
            c.fillStyle = '#3d5a80'; c.fillRect(0, 600, 1600, 300);
            c.fillStyle = 'rgba(255,255,255,.15)';
            for (var i = 0; i < 12; i++) c.fillRect((i * 173 + F.t * 30) % 1700 - 100, 640 + (i % 4) * 50, 80, 4);
            // flamant
            var x = 800, y = 600, leve = go ? 1 : 0;
            c.save(); c.translate(x, y);
            c.strokeStyle = '#ff5d8f'; c.lineWidth = 8; c.lineCap = 'round';
            c.beginPath(); c.moveTo(0, -120); c.lineTo(0, 20); c.stroke();
            c.beginPath(); c.moveTo(0, -120); c.lineTo(leve ? 40 : 10, leve ? -70 : -60); c.lineTo(leve ? 10 : 0, leve ? -60 : 20); c.stroke();
            c.fillStyle = '#ff8fab';
            c.beginPath(); c.ellipse(-10, -150, 80, 48, -0.15, 0, 7); c.fill();
            if (go) { c.beginPath(); c.ellipse(-30, -200, 70, 30, -0.9 + Math.sin(F.t * 30) * 0.4, 0, 7); c.fill(); }
            c.strokeStyle = '#ff8fab'; c.lineWidth = 18;
            c.beginPath();
            if (go) { c.moveTo(50, -160); c.quadraticCurveTo(120, -260, 70, -330); }
            else { c.moveTo(50, -160); c.quadraticCurveTo(110, -150, 60, -110); }
            c.stroke();
            var tx = go ? 70 : 60, ty = go ? -340 : -105;
            c.fillStyle = '#ff8fab'; c.beginPath(); c.arc(tx, ty, 22, 0, 7); c.fill();
            c.fillStyle = '#1b1b2f';
            if (go) { c.beginPath(); c.arc(tx + 6, ty - 4, 5, 0, 7); c.fill(); } else c.fillRect(tx, ty - 4, 12, 3);
            c.fillStyle = '#fff'; c.beginPath(); c.moveTo(tx + 18, ty - 6); c.lineTo(tx + 48, ty + 10); c.lineTo(tx + 16, ty + 8); c.fill();
            c.restore();
            if (!go && phase === 'attente') F.texte(c, 'z z z', 900, 470 + Math.sin(F.t * 3) * 8, 44, '#fff');
            if (go) F.texte(c, 'TAPE !', 800, 110, 140, '#fff', { contour: '#d00000', epaisseur: 18 });
            else F.texte(c, 'Manche ' + Math.min(manche, MANCHES) + ' / ' + MANCHES, 800, 90, 54, '#fff');
            // joueurs
            etats.forEach(function (e, i) {
              var px = posX(i, etats.length);
              F.pion(c, px, 790, 44, e.p.couleur, null, { triste: e.bloque, saut: gagnant === e ? Math.abs(Math.sin(F.t * 10)) * 30 : 0, phase: i });
              F.texte(c, e.p.nom, px, 865, 30, '#fff');
              for (var k = 0; k < e.points; k++) F.etoile(c, px - (e.points - 1) * 22 + k * 44, 705, 18, 0);
              if (e.msg && F.t - e.msgT < 1.8 / F.V) F.texte(c, e.msg, px, 650, 38, e.msg === 'Trop tôt !' ? '#ff4d6d' : '#fff');
            });
          },
          scores: function () {
            return etats.map(function (e) { return { p: e.p, score: e.points * 1000 - e.temps, texte: e.points + ' point' + (e.points > 1 ? 's' : '') }; });
          }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- 3. Totems qui chantent
    {
      id: 'totems', nom: 'Les totems qui chantent', emoji: '🗿', duree: 120,
      regle: 'Les totems s\'allument dans un ordre. Retiens-le et reproduis-le sur ton téléphone. Une erreur et tu es éliminé !',
      controles: '4 boutons de couleur',
      ui: function () { return { emoji: '👀', titre: 'Regarde les totems !', texte: 'Retiens l\'ordre des couleurs.' }; },
      creer: function (ps, env) {
        var seq = [F.entier(0, 3), F.entier(0, 3)];
        var etats = ps.map(function (p) { return { p: p, vivant: true, idx: 0, ok: false, niveau: 0, eclair: -1, eclairT: 0 }; });
        var phase = 'debut', t0 = F.t, allume = -1, fini = false;
        function uiSaisie() {
          return {
            titre: 'À toi !', texte: 'Reproduis la suite de ' + seq.length + ' couleurs',
            boutons: COULEURS_TOTEM.map(function (col, k) { return { id: String(k), label: NOMS_TOTEM[k], couleur: col }; }),
            mode: 'manette', disposition: 'grille'
          };
        }
        function uiAttente(e) {
          if (!e.vivant) return { emoji: '💥', titre: 'Éliminé !', texte: 'Regarde les autres sur la télé.' };
          if (e.ok) return { emoji: '✅', titre: 'Bravo !', texte: 'Attends les autres…' };
          return { emoji: '👀', titre: 'Regarde les totems !', texte: 'Retiens l\'ordre des couleurs.' };
        }
        function niveauSuivant() {
          seq.push(F.entier(0, 3));
          etats.forEach(function (e) { if (e.vivant) { e.idx = 0; e.ok = false; env.envoyerUI(e.p, uiAttente(e)); } });
          phase = 'montre'; t0 = F.t;
        }
        var inst = {
          fini: false,
          message: function (p, m) {
            if (phase !== 'saisie' || m.t !== 'bouton' || !m.appui) return;
            var e = etats.filter(function (x) { return x.p === p; })[0];
            if (!e || !e.vivant || e.ok) return;
            var k = +m.b;
            e.eclair = k; e.eclairT = F.t;
            if (k === seq[e.idx]) {
              env.son.totem(k);
              e.idx++;
              if (e.idx >= seq.length) { e.ok = true; e.niveau = seq.length; env.envoyerUI(p, uiAttente(e)); }
            } else {
              e.vivant = false; env.son.buzz(); env.envoyerUI(p, uiAttente(e));
            }
          },
          maj: function () {
            if (fini) return;
            var pas = 0.62 / F.V;
            if (phase === 'debut' && F.t - t0 > 0.6 / F.V) { phase = 'montre'; t0 = F.t; }
            else if (phase === 'montre') {
              var i = Math.floor((F.t - t0) / pas), dans = ((F.t - t0) % pas) / pas;
              var nouv = i < seq.length && dans < 0.72 ? seq[i] : -1;
              if (nouv !== -1 && nouv !== allume) env.son.totem(nouv);
              allume = nouv;
              if (i >= seq.length) {
                phase = 'saisie'; t0 = F.t; allume = -1;
                etats.forEach(function (e) { if (e.vivant) env.envoyerUI(e.p, uiSaisie()); });
              }
            } else if (phase === 'saisie') {
              var limite = (2.5 + seq.length * 0.9) / F.V;
              var tousFinis = etats.every(function (e) { return !e.vivant || e.ok; });
              if (tousFinis || F.t - t0 > limite) {
                etats.forEach(function (e) { if (e.vivant && !e.ok) { e.vivant = false; env.envoyerUI(e.p, uiAttente(e)); } });
                var vivants = etats.filter(function (e) { return e.vivant; }).length;
                if (vivants <= 1 || seq.length >= 14) { fini = true; inst.fini = true; phase = 'fin'; }
                else { phase = 'pause'; t0 = F.t; }
              }
            } else if (phase === 'pause' && F.t - t0 > 1 / F.V) niveauSuivant();
          },
          dessiner: function (c) {
            fondDegrade(c, '#2b2d42', '#1d3557');
            for (var s = 0; s < 40; s++) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(F.t * 2 + s)) + ')'; c.fillRect((s * 397) % 1600, (s * 211) % 420, 3, 3); }
            c.fillStyle = '#386641'; c.fillRect(0, 640, 1600, 260);
            for (var k = 0; k < 4; k++) {
              var x = 290 + k * 340, on = allume === k;
              etats.forEach(function (e) { if (e.eclair === k && F.t - e.eclairT < 0.2) on = true; });
              if (on) { var g = c.createRadialGradient(x, 380, 20, x, 380, 230); g.addColorStop(0, COULEURS_TOTEM[k]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - 230, 150, 460, 460); }
              c.fillStyle = on ? F.eclaircir(COULEURS_TOTEM[k], 0.35) : F.assombrir(COULEURS_TOTEM[k], 0.45);
              F.rr(c, x - 85, 210, 170, 430, 30); c.fill();
              c.fillStyle = 'rgba(0,0,0,.35)';
              c.fillRect(x - 55, 290, 40, 22); c.fillRect(x + 15, 290, 40, 22); F.rr(c, x - 50, 380, 100, on ? 70 : 26, 12); c.fill();
              c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 85, 470, 170, 10); c.fillRect(x - 85, 540, 170, 10);
              F.texte(c, NOMS_TOTEM[k], x, 680, 34, '#fff');
            }
            var titre = phase === 'saisie' ? 'À vous ! (' + seq.length + ' couleurs)' : (phase === 'montre' ? 'Regardez bien…' : 'Niveau ' + seq.length);
            F.texte(c, titre, 800, 100, 64, '#fff');
            etats.forEach(function (e, i) {
              var px = etats.length === 1 ? 800 : 260 + i * (1080 / (etats.length - 1));
              F.pion(c, px, 790, 36, e.p.couleur, null, { triste: !e.vivant, phase: i });
              F.texte(c, e.p.nom, px, 860, 28, e.vivant ? '#fff' : '#aaa');
              if (!e.vivant) F.texte(c, '✖', px + 40, 750, 46, '#ff4d6d');
              else if (e.ok) F.texte(c, '✔', px + 40, 750, 46, '#80ed99');
              else if (phase === 'saisie') F.texte(c, e.idx + '/' + seq.length, px, 720, 30, '#fff');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.niveau + (e.vivant ? 0.5 : 0), texte: 'niveau ' + e.niveau }; }); }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- 4. Course de crabes
    {
      id: 'crabes', nom: 'La course des crabes', emoji: '🦀', duree: 15,
      regle: 'Alterne gauche, droite, gauche, droite… pour faire courir ton crabe ! Deux fois le même bouton et tu glisses.',
      controles: 'Deux boutons, en alternance',
      ui: function () { return { boutons: [{ id: 'G', label: '◀' }, { id: 'D', label: '▶' }], mode: 'manette', disposition: 'ligne' }; },
      creer: function (ps, env) {
        var ARRIVEE = 30;
        var lanes = ps.map(function (p, i) { return 230 + i * (560 / Math.max(1, ps.length - 1 || 1)); });
        if (ps.length === 1) lanes = [500];
        var etats = ps.map(function (p, i) { return { p: p, pos: 0, aff: 0, dernier: '', glisse: 0, ordre: 0, y: lanes[i] }; });
        var arrives = 0;
        var inst = {
          fini: false,
          message: function (p, m) {
            if (m.t !== 'bouton' || !m.appui) return;
            var e = etats.filter(function (x) { return x.p === p; })[0];
            if (!e || e.ordre || e.glisse > 0) return;
            if (m.b === e.dernier) { e.glisse = 0.45; env.son.buzz(); e.dernier = ''; return; }
            e.dernier = m.b; e.pos++;
            if (e.pos >= ARRIVEE) { e.ordre = ++arrives; env.son.gain(); env.particules.gerbe(1450, e.y, 30, { couleurs: [e.p.couleur, '#fff', '#ffd166'] }); }
            if (arrives === etats.length) inst.fini = true;
          },
          maj: function (dt) {
            etats.forEach(function (e) { e.glisse = Math.max(0, e.glisse - dt); e.aff += (e.pos - e.aff) * Math.min(1, dt * 14); });
          },
          dessiner: function (c) {
            fondDegrade(c, '#90e0ef', '#caf0f8');
            c.fillStyle = '#0096c7'; c.fillRect(0, 0, 1600, 140);
            c.fillStyle = 'rgba(255,255,255,.6)';
            for (var w = 0; w < 16; w++) { c.beginPath(); c.arc(w * 110 + (F.t * 40) % 110, 140, 30, Math.PI, 0); c.fill(); }
            c.fillStyle = '#f6e2b3'; c.fillRect(0, 150, 1600, 750);
            // ligne d'arrivée
            for (var a = 0; a < 18; a++) { c.fillStyle = a % 2 ? '#1b1b2f' : '#fff'; c.fillRect(1440, 170 + a * 40, 24, 40); c.fillStyle = a % 2 ? '#fff' : '#1b1b2f'; c.fillRect(1464, 170 + a * 40, 24, 40); }
            etats.forEach(function (e, i) {
              c.strokeStyle = 'rgba(160,110,60,.35)'; c.lineWidth = 3; c.setLineDash([10, 14]);
              c.beginPath(); c.moveTo(120, e.y + 40); c.lineTo(1440, e.y + 40); c.stroke(); c.setLineDash([]);
              var x = 150 + (1290 * Math.min(1, e.aff / ARRIVEE));
              crabe(c, x, e.y, e.p.couleur, e.glisse > 0, F.t * 20 + i);
              F.texte(c, e.p.nom, 70, e.y, 28, '#1b1b2f', { contour: 'rgba(255,255,255,.8)', epaisseur: 5, align: 'left' });
              if (e.ordre) F.texte(c, e.ordre === 1 ? '1er !' : e.ordre + 'e', 1530, e.y, 40, '#fff', { contour: e.p.couleur, epaisseur: 8 });
            });
          },
          scores: function () {
            return etats.map(function (e) {
              return { p: e.p, score: e.ordre ? 1000 - e.ordre : e.pos, texte: e.ordre ? (e.ordre === 1 ? 'arrivé 1er' : 'arrivé ' + e.ordre + 'e') : Math.round(e.pos / ARRIVEE * 100) + ' %' };
            });
          }
        };
        return inst;
      }
    },

    // ---------------------------------------------------------------- 5. Pêche aux perles
    {
      id: 'perles', nom: 'La pêche aux perles', emoji: '🐠', duree: 20,
      regle: 'Nage et attrape un maximum de perles ! Les dorées valent 3. Évite les oursins : ils t\'étourdissent et te font perdre une perle.',
      controles: 'Croix pour nager, 💨 pour foncer',
      ui: function () { return { pad: true, boutons: [{ id: 'A', label: '💨' }] }; },
      creer: function (ps, env) {
        var etats = ps.map(function (p, i) {
          var a = i / ps.length * Math.PI * 2;
          return { p: p, x: 800 + Math.cos(a) * 250, y: 500 + Math.sin(a) * 180, dx: 0, dy: 0, n: 0, etourdi: 0, turbo: 0, recharge: 0, dir: 1 };
        });
        var perles = [], oursins = [], bulles = [], prochaine = 0;
        for (var o = 0; o < Math.min(4, 1 + ps.length); o++) oursins.push({ x: F.alea(200, 1400), y: F.alea(250, 800), vx: F.choisir([-1, 1]) * F.alea(120, 200), vy: F.choisir([-1, 1]) * F.alea(90, 160) });
        function nouvellePerle() {
          perles.push({ x: F.alea(120, 1480), y: F.alea(220, 840), or: Math.random() < 0.18, t: F.t });
        }
        for (var k = 0; k < 6; k++) nouvellePerle();
        return {
          fini: false,
          message: function (p, m) {
            var e = etats.filter(function (x) { return x.p === p; })[0];
            if (!e) return;
            if (m.t === 'dir') { e.dx = F.borne(+m.x || 0, -1, 1); e.dy = F.borne(+m.y || 0, -1, 1); }
            else if (m.t === 'bouton' && m.appui && e.recharge <= 0) { e.turbo = 0.35; e.recharge = 1.4; env.son.pop(); }
          },
          maj: function (dt) {
            prochaine -= dt;
            if (prochaine <= 0 && perles.length < 12) { nouvellePerle(); prochaine = 0.45; }
            etats.forEach(function (e) {
              e.etourdi = Math.max(0, e.etourdi - dt); e.turbo = Math.max(0, e.turbo - dt); e.recharge = Math.max(0, e.recharge - dt);
              if (e.etourdi <= 0) {
                var v = 430 * (e.turbo > 0 ? 2.6 : 1), l = Math.hypot(e.dx, e.dy) || 1;
                e.x = F.borne(e.x + e.dx / Math.max(1, l) * v * dt, 70, 1530);
                e.y = F.borne(e.y + e.dy / Math.max(1, l) * v * dt, 200, 860);
                if (e.dx) e.dir = e.dx > 0 ? 1 : -1;
              }
              for (var i = perles.length - 1; i >= 0; i--) {
                var pr = perles[i];
                if (Math.hypot(pr.x - e.x, pr.y - e.y) < 52 && e.etourdi <= 0) {
                  e.n += pr.or ? 3 : 1; perles.splice(i, 1);
                  pr.or ? env.son.gain() : env.son.pop();
                  env.particules.gerbe(pr.x, pr.y, pr.or ? 18 : 8, { couleurs: pr.or ? ['#ffd166', '#fff'] : ['#fff', '#caf0f8'], g: -200, haut: 0, vmax: 260 });
                }
              }
              oursins.forEach(function (u) {
                if (e.etourdi <= 0 && Math.hypot(u.x - e.x, u.y - e.y) < 62) {
                  e.etourdi = 1.2; env.son.buzz();
                  if (e.n > 0) { e.n--; perles.push({ x: F.borne(e.x + F.alea(-90, 90), 120, 1480), y: F.borne(e.y + F.alea(-90, 90), 220, 840), or: false, t: F.t }); }
                }
              });
            });
            oursins.forEach(function (u) {
              u.x += u.vx * dt; u.y += u.vy * dt;
              if (u.x < 60 || u.x > 1540) u.vx *= -1;
              if (u.y < 210 || u.y > 860) u.vy *= -1;
            });
            if (Math.random() < dt * 6) bulles.push({ x: F.alea(0, 1600), y: 920, r: F.alea(3, 9) });
            bulles.forEach(function (b) { b.y -= 90 * dt; b.x += Math.sin(F.t * 2 + b.r) * 0.5; });
            bulles = bulles.filter(function (b) { return b.y > 150; });
          },
          dessiner: function (c) {
            fondDegrade(c, '#00b4d8', '#03045e');
            c.fillStyle = 'rgba(255,255,255,.08)';
            for (var r = 0; r < 6; r++) { c.beginPath(); c.moveTo(200 + r * 260 + Math.sin(F.t + r) * 30, 150); c.lineTo(120 + r * 260, 900); c.lineTo(220 + r * 260, 900); c.fill(); }
            c.fillStyle = '#e9c46a'; c.beginPath(); c.moveTo(0, 900); c.quadraticCurveTo(400, 840, 800, 880); c.quadraticCurveTo(1200, 920, 1600, 860); c.lineTo(1600, 900); c.fill();
            // algues
            c.strokeStyle = '#2d6a4f'; c.lineWidth = 10; c.lineCap = 'round';
            for (var a = 0; a < 9; a++) { var ax = 80 + a * 185; c.beginPath(); c.moveTo(ax, 900); c.quadraticCurveTo(ax + Math.sin(F.t * 1.5 + a) * 30, 800, ax + Math.sin(F.t + a) * 20, 720 - (a % 3) * 30); c.stroke(); }
            c.fillStyle = 'rgba(255,255,255,.4)';
            bulles.forEach(function (b) { c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); });
            perles.forEach(function (pr) {
              var s = Math.min(1, (F.t - pr.t) * 4);
              var g = c.createRadialGradient(pr.x - 6, pr.y - 6, 2, pr.x, pr.y, 20 * s);
              g.addColorStop(0, '#fff'); g.addColorStop(1, pr.or ? '#ffb703' : '#bde0fe');
              c.fillStyle = g; c.beginPath(); c.arc(pr.x, pr.y + Math.sin(F.t * 3 + pr.x) * 4, (pr.or ? 20 : 15) * s, 0, 7); c.fill();
            });
            oursins.forEach(function (u) {
              c.save(); c.translate(u.x, u.y); c.rotate(F.t);
              c.strokeStyle = '#3c096c'; c.lineWidth = 5;
              for (var k = 0; k < 14; k++) { var an = k / 14 * Math.PI * 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * 46, Math.sin(an) * 46); c.stroke(); }
              c.fillStyle = '#5a189a'; c.beginPath(); c.arc(0, 0, 26, 0, 7); c.fill();
              c.restore();
            });
            etats.forEach(function (e, i) {
              c.save(); c.translate(e.x, e.y); c.scale(e.dir, 1);
              c.fillStyle = F.assombrir(e.p.couleur, 0.2);
              c.beginPath(); c.moveTo(-36, 0); c.lineTo(-62, -22 + Math.sin(F.t * 14) * 6); c.lineTo(-62, 22 - Math.sin(F.t * 14) * 6); c.fill();
              c.restore();
              F.pion(c, e.x, e.y, 36, e.p.couleur, null, { triste: e.etourdi > 0, regard: e.dir, phase: i });
              if (e.turbo > 0) env.particules.ajouter(e.x - e.dir * 40, e.y, { vx: -e.dir * 100, g: -100, vie: 0.4, taille: 6, couleur: '#fff' });
              if (e.etourdi > 0) F.texte(c, '✶ ✶', e.x, e.y - 60, 30, '#ffd166');
              F.texte(c, e.p.nom + ' · ' + e.n, e.x, e.y + 62, 26, '#fff');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.n, texte: e.n + ' perle' + (e.n > 1 ? 's' : '') }; }); }
        };
      }
    }
  ];

  function crabe(c, x, y, couleur, glisse, t) {
    c.save();
    c.translate(x, y);
    if (glisse) c.rotate(Math.sin(F.t * 40) * 0.3);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 40, 60, 12, 0, 0, 7); c.fill();
    c.strokeStyle = F.assombrir(couleur, 0.3); c.lineWidth = 7; c.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var k = Math.sin(t + i) * 8;
      c.beginPath(); c.moveTo(-30, 5 + i * 9); c.lineTo(-58, 25 + i * 8 + k); c.stroke();
      c.beginPath(); c.moveTo(30, 5 + i * 9); c.lineTo(58, 25 + i * 8 - k); c.stroke();
    }
    c.fillStyle = couleur;
    c.beginPath(); c.arc(-56, -26, 18, 0, 7); c.arc(56, -26, 18, 0, 7); c.fill();
    c.fillStyle = '#14232b'; c.beginPath(); c.moveTo(-56, -26); c.lineTo(-40, -40); c.lineTo(-38, -24); c.fill(); c.beginPath(); c.moveTo(56, -26); c.lineTo(40, -40); c.lineTo(38, -24); c.fill();
    var g = c.createRadialGradient(-10, -10, 4, 0, 0, 50);
    g.addColorStop(0, F.eclaircir(couleur, 0.5)); g.addColorStop(1, couleur);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 6, 44, 30, 0, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-12, -20); c.lineTo(-14, -36); c.moveTo(12, -20); c.lineTo(14, -36); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, -40, 9, 0, 7); c.arc(14, -40, 9, 0, 7); c.fill();
    c.fillStyle = '#14232b'; c.beginPath(); c.arc(-12, -40, 4, 0, 7); c.arc(16, -40, 4, 0, 7); c.fill();
    c.restore();
  }
})(Fiesta);
