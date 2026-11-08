/*
 * Fiesta Royale — les mini-jeux (duels éclair et fins de tour).
 * Chaque mini-jeu dessine dans un espace virtuel de 1600 × 900.
 *   creer(participants, env) → { message(p, m), maj(dt), dessiner(c), fini, scores() }
 *   participants : [{ numero, nom, couleur, ... }]   env : { son, envoyerUI(p, ui), particules }
 */
(function (F) {
  'use strict';

  var COULEURS_TOTEM = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0']; // les 4 cloches
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
      id: 'coco', nom: 'Le bloc à pièces', emoji: '🪙', duree: 8,
      regle: 'Tape le plus vite possible sur le bloc pour faire tomber un maximum de pièces dans ton coffre !',
      controles: 'Tapote le gros bouton',
      ui: function () { return { boutons: [{ id: 'A', label: '🪙 TAPE !' }], mode: 'manette', disposition: 'geant' }; },
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
            e.noix.push({ x: e.lane.cx + F.alea(-60, 60), y: 400, vy: F.alea(-300, 0), r: F.alea(0, 6) });
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
            F.fondPrairie(c, { sol: 640 });
            etats.forEach(function (e) {
              var x = e.lane.cx, bond = e.secousse * 26;
              // le bloc qui saute quand on tape
              if (!F.dessinerSprite(c, 'plateforme/block-coin', x, 470 - bond, 170, { taille: 192, angle: 0.5, hauteur: 0.3 })) {
                c.fillStyle = '#ffbe0b'; F.rr(c, x - 75, 300 - bond, 150, 150, 18); c.fill();
                F.texte(c, '?', x, 375 - bond, 90, '#fff', { contour: '#b86e00', epaisseur: 10 });
              }
              e.noix.forEach(function (n) { F.coquillage(c, n.x, n.y, 22); });
              // coffre
              c.fillStyle = '#7f4f24'; F.rr(c, x - 90, 690, 180, 84, 14); c.fill();
              c.fillStyle = '#a0662f'; F.rr(c, x - 90, 690, 180, 30, 14); c.fill();
              c.fillStyle = '#ffd23f'; c.fillRect(x - 90, 716, 180, 8); F.rr(c, x - 14, 708, 28, 30, 6); c.fill();
              F.pion(c, x, 830, 34, e.p.couleur, null, { saut: e.secousse * 20, phase: e.p.numero });
              F.texte(c, String(e.n), x, 110, 96, '#fff', { contour: e.p.couleur, epaisseur: 12 });
              F.texte(c, e.p.nom, x, 190, 34, '#1b1b2f', { contour: 'rgba(255,255,255,.8)', epaisseur: 6 });
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.n, texte: e.n + ' pièce' + (e.n > 1 ? 's' : '') }; }); }
        };
      }
    },

    // ---------------------------------------------------------------- 2. Flamant réflexe
    {
      id: 'flamant', nom: 'Le drapeau réflexe', emoji: '🚩', duree: 40,
      regle: 'Attends que le héraut lève son drapeau… et tape le premier ! Si tu tapes trop tôt, tu es bloqué pour la manche. 3 manches.',
      controles: 'Un seul bouton, au bon moment',
      ui: function () { return { boutons: [{ id: 'A', label: '🚩 TAPE !' }], mode: 'manette', disposition: 'geant' }; },
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
            F.fondPrairie(c, go ? { ciel1: '#ffbe0b', ciel2: '#ffe8a3', sol: 600 } : { ciel1: '#5c4d7d', ciel2: '#e0a7b8', colline: '#6a8f5c', sol: 600 });
            // remparts du château au fond
            for (var w = 0; w < 9; w++) F.dessinerSprite(c, 'arene/wall', 400 + w * 100, 610, 110, { taille: 160, angle: 0, hauteur: 0.15 });
            // le mât et le drapeau
            var x = 800, haut = go ? 250 : 520;
            c.fillStyle = '#6c757d'; c.fillRect(x - 6, 220, 12, 400);
            c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, 214, 14, 0, 7); c.fill();
            c.save(); c.translate(x + 6, haut);
            var ond = Math.sin(F.t * (go ? 14 : 3)) * (go ? 14 : 4);
            c.fillStyle = go ? '#e63946' : '#8d99ae';
            c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(80, -14 + ond, 170, ond); c.lineTo(170, 100 + ond); c.quadraticCurveTo(80, 86 - ond, 0, 100); c.closePath(); c.fill();
            c.fillStyle = 'rgba(255,255,255,.85)'; F.etoile(c, 85, 50 + ond / 2, 26, 0);
            c.restore();
            if (!go && phase === 'attente') F.texte(c, '…', 980, 500 + Math.sin(F.t * 3) * 8, 60, '#fff');
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
      id: 'totems', nom: 'Les cloches qui chantent', emoji: '🔔', duree: 120,
      regle: 'Les cloches sonnent dans un ordre. Retiens-le et reproduis-le sur ton téléphone. Une erreur et tu es éliminé !',
      controles: '4 boutons de couleur',
      ui: function () { return { emoji: '👀', titre: 'Regarde les cloches !', texte: 'Retiens l\'ordre des couleurs.' }; },
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
          return { emoji: '👀', titre: 'Regarde les cloches !', texte: 'Retiens l\'ordre des couleurs.' };
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
            fondDegrade(c, '#1d2545', '#3b3f74');
            for (var s = 0; s < 40; s++) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(F.t * 2 + s)) + ')'; c.fillRect((s * 397) % 1600, (s * 211) % 420, 3, 3); }
            // le clocher : deux colonnes et une poutre
            F.dessinerSprite(c, 'arene/column', 110, 660, 520, { taille: 200, angle: 0.2, hauteur: 0.15 });
            F.dessinerSprite(c, 'arene/column', 1490, 660, 520, { taille: 200, angle: 0.2, hauteur: 0.15 });
            c.fillStyle = '#7f4f24'; F.rr(c, 60, 170, 1480, 40, 10); c.fill();
            c.fillStyle = '#4a5a3a'; c.fillRect(0, 640, 1600, 260);
            for (var k = 0; k < 4; k++) {
              var x = 290 + k * 340, on = allume === k;
              etats.forEach(function (e) { if (e.eclair === k && F.t - e.eclairT < 0.2) on = true; });
              var bal = on ? Math.sin(F.t * 30) * 0.18 : 0;
              if (on) { var g = c.createRadialGradient(x, 400, 20, x, 400, 240); g.addColorStop(0, COULEURS_TOTEM[k]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - 240, 160, 480, 480); }
              c.save(); c.translate(x, 210); c.rotate(bal);
              c.strokeStyle = '#3d2b1f'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 60); c.stroke();
              var col = on ? F.eclaircir(COULEURS_TOTEM[k], 0.35) : F.assombrir(COULEURS_TOTEM[k], 0.35);
              var gb = c.createLinearGradient(-120, 0, 120, 0);
              gb.addColorStop(0, F.assombrir(COULEURS_TOTEM[k], 0.5)); gb.addColorStop(0.45, col); gb.addColorStop(1, F.assombrir(COULEURS_TOTEM[k], 0.55));
              c.fillStyle = gb;
              c.beginPath(); c.moveTo(-50, 70); c.quadraticCurveTo(-60, 120, -80, 260); c.quadraticCurveTo(-125, 300, -130, 320);
              c.lineTo(130, 320); c.quadraticCurveTo(125, 300, 80, 260); c.quadraticCurveTo(60, 120, 50, 70); c.quadraticCurveTo(0, 40, -50, 70); c.fill();
              c.fillStyle = 'rgba(0,0,0,.25)'; F.rr(c, -130, 306, 260, 16, 8); c.fill();
              c.fillStyle = '#3d2b1f'; c.beginPath(); c.arc(on ? 30 : 0, 336, 22, 0, 7); c.fill();
              c.restore();
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
      id: 'crabes', nom: 'La course en sac', emoji: '🥔', duree: 15,
      regle: 'Alterne gauche, droite, gauche, droite… pour sauter dans ton sac ! Deux fois le même bouton et tu tombes.',
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
            F.fondPrairie(c, { sol: 150 });
            c.fillStyle = 'rgba(255,255,255,.12)';
            for (var bd = 0; bd < 8; bd++) c.fillRect(0, 190 + bd * 90, 1600, 45);
            // ligne d'arrivée
            for (var a = 0; a < 18; a++) { c.fillStyle = a % 2 ? '#1b1b2f' : '#fff'; c.fillRect(1440, 170 + a * 40, 24, 40); c.fillStyle = a % 2 ? '#fff' : '#1b1b2f'; c.fillRect(1464, 170 + a * 40, 24, 40); }
            etats.forEach(function (e, i) {
              c.strokeStyle = 'rgba(160,110,60,.35)'; c.lineWidth = 3; c.setLineDash([10, 14]);
              c.beginPath(); c.moveTo(120, e.y + 40); c.lineTo(1440, e.y + 40); c.stroke(); c.setLineDash([]);
              var x = 150 + (1290 * Math.min(1, e.aff / ARRIVEE));
              sac(c, x, e.y, e.p, e.glisse > 0, e.aff, i);
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
      id: 'perles', nom: 'La chasse aux pièces', emoji: '🌼', duree: 20,
      regle: 'Cours et ramasse un maximum de pièces ! Les étoiles valent 3. Évite les hérissons : ils t\'étourdissent et te font perdre une pièce.',
      controles: 'Croix pour courir, 💨 pour foncer',
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
                  env.particules.gerbe(pr.x, pr.y, pr.or ? 18 : 8, { couleurs: pr.or ? ['#ffd166', '#fff'] : ['#ffd23f', '#fff3b0'], g: -200, haut: 0, vmax: 260 });
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
          },
          dessiner: function (c) {
            F.fondPrairie(c, { sol: 170 });
            for (var fl = 0; fl < 40; fl++) {
              c.fillStyle = ['#fff', '#ffd6e0', '#fff3b0'][fl % 3];
              var fx = (fl * 397) % 1600, fy = 220 + (fl * 211) % 660;
              c.beginPath(); c.arc(fx, fy, 5, 0, 7); c.arc(fx + 8, fy + 3, 5, 0, 7); c.arc(fx + 2, fy + 8, 5, 0, 7); c.fill();
            }
            perles.forEach(function (pr) {
              var s = Math.min(1, (F.t - pr.t) * 4), y = pr.y + Math.sin(F.t * 3 + pr.x) * 4;
              if (pr.or) F.etoile(c, pr.x, y, 26 * s, Math.sin(F.t * 2 + pr.x) * 0.3);
              else F.coquillage(c, pr.x, y, 18 * s);
            });
            oursins.forEach(function (u) {
              // hérisson
              c.save(); c.translate(u.x, u.y); c.scale(u.vx > 0 ? 1 : -1, 1);
              c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 34, 50, 12, 0, 0, 7); c.fill();
              c.fillStyle = '#5c3d2e';
              for (var k = 0; k < 11; k++) { var an = Math.PI + k / 10 * Math.PI; c.beginPath(); c.moveTo(Math.cos(an) * 30, Math.sin(an) * 22 + 6); c.lineTo(Math.cos(an) * 58, Math.sin(an) * 44 + 6); c.lineTo(Math.cos(an + 0.2) * 30, Math.sin(an + 0.2) * 22 + 6); c.fill(); }
              c.fillStyle = '#7a5240'; c.beginPath(); c.ellipse(0, 10, 46, 30, 0, 0, 7); c.fill();
              c.fillStyle = '#e8c9a0'; c.beginPath(); c.ellipse(36, 16, 20, 15, 0, 0, 7); c.fill();
              c.fillStyle = '#1b1b2f'; c.beginPath(); c.arc(54, 14, 5, 0, 7); c.arc(38, 8, 4, 0, 7); c.fill();
              c.restore();
            });
            etats.forEach(function (e, i) {
              F.pion(c, e.x, e.y, 36, e.p.couleur, null, { triste: e.etourdi > 0, regard: e.dir, phase: i });
              if (e.turbo > 0) env.particules.ajouter(e.x - e.dir * 40, e.y, { vx: -e.dir * 100, g: -100, vie: 0.4, taille: 6, couleur: '#fff' });
              if (e.etourdi > 0) F.texte(c, '✶ ✶', e.x, e.y - 60, 30, '#ffd166');
              F.texte(c, e.p.nom + ' · ' + e.n, e.x, e.y + 62, 26, '#fff');
            });
          },
          scores: function () { return etats.map(function (e) { return { p: e.p, score: e.n, texte: e.n + ' pièce' + (e.n > 1 ? 's' : '') }; }); }
        };
      }
    }
  ];

  // un joueur qui saute dans un sac de toile
  function sac(c, x, y, p, tombe, avance, i) {
    var saut = Math.abs(Math.sin(avance * Math.PI)) * 34;
    c.save();
    c.translate(x, y + 30);
    if (tombe) c.rotate(Math.sin(F.t * 40) * 0.35);
    c.translate(-x, -(y + 30));
    F.pion(c, x, y - 24 - saut, 40, p.couleur, null, { phase: i, triste: tombe });
    c.fillStyle = '#c8a36a';
    c.beginPath(); c.moveTo(x - 46, y - 2 - saut); c.lineTo(x + 46, y - 2 - saut); c.lineTo(x + 52, y + 50 - saut); c.quadraticCurveTo(x, y + 62 - saut, x - 52, y + 50 - saut); c.closePath(); c.fill();
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 46, y - saut); c.lineTo(x + 46, y - saut); c.stroke();
    c.restore();
  }
})(Fiesta);
