/*
 * Dino Sprint — course sans fin à plusieurs (1 à 4 joueurs).
 * Chaque joueur a son couloir, les obstacles sont les mêmes pour tout le monde.
 * Saute les rochers, baisse-toi sous les perroquets, attrape les œufs dorés. 3 vies chacun.
 */
(function (F) {
  'use strict';

  var BASE = 450;          // hauteur de référence d'un couloir
  var SOL = 385;           // hauteur du sol dans un couloir
  var DINO_X = 230;
  var GRAVITE = 2700, SAUT = 1000;
  var V0 = 520, VMAX = 1300, ACCEL = 13;

  var TYPES = {
    rocher: { w: 56, h: 48 },
    gros: { w: 74, h: 82 },
    double: { w: 122, h: 50 },
    epines: { w: 64, h: 66 },
    oiseau: { w: 74, h: 40, air: 78 },
    oeuf: { w: 40, h: 50, bonus: true }
  };

  function creer(api) {
    F.viderAnims();
    if (F.prechargerSprites) F.prechargerSprites();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', t0: F.t, x: 0, v: V0, obstacles: [], prochain: 900, particules: new F.Particules(), compte: null, record: 0, fin: null, temps: 0 };
    try { S.record = +localStorage.getItem('jeutele-dino-record') || 0; } catch (e) {}

    L.stats = function (P) { return { texte: '🦖 ' + score(P) + ' pts · ' + '❤️'.repeat(Math.max(0, P.vies)) }; };
    function score(P) { return Math.floor(P.distance / 40) + P.oeufs * 25; }

    function uiCourse() {
      return { boutons: [{ id: 'bas', label: '⬇ BAISSE', couleur: '#adb5bd' }, { id: 'saut', label: '⬆ SAUTE' }], mode: 'manette', disposition: 'ligne' };
    }

    async function partie() {
      L.initialiser({ y: 0, vy: 0, sol: true, bas: false, tient: false, tTient: 0, vies: 3, invincible: 0, mort: false, distance: 0, oeufs: 0, pas: 0, tMort: 0 });
      S.phase = 'titre'; S.t0 = F.t; S.x = 0; S.v = V0; S.obstacles = []; S.prochain = 1100; S.fin = null; S.temps = 0;
      F.musique('plateau');
      await Promise.all(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: '🦖', titre: 'Dino Sprint', texte: 'Saute les rochers ⬆, baisse-toi sous les perroquets ⬇, attrape les œufs dorés. Garde le doigt sur SAUTE pour sauter plus haut. 3 vies !',
          boutons: [{ id: 'pret', label: '✋ Je suis prêt !' }]
        }, 'pret', 25).then(function () { P.pret = true; });
      }));
      S.phase = 'compte';
      F.musique(null);
      L.uiTous({ emoji: '⏳', titre: 'Attention…', texte: 'Ça commence !' });
      for (var n = 3; n >= 1; n--) { S.compte = n; S.compteT = F.t; F.son.compte(); await F.attendre(0.8); }
      L.joueurs.forEach(function (P) { L.ui(P, uiCourse()); });
      S.compte = 'GO !'; S.compteT = F.t; F.son.go();
      F.musique('minijeu');
      S.phase = 'course';
      while (!L.arrete && L.joueurs.some(function (P) { return !P.mort; })) await F.attendre(0.1);
      if (L.arrete) return;
      F.musique(null);
      F.son.cymbale();
      S.phase = 'fin';
      var ordre = F.classer(L.joueurs.map(function (P) { P.score = score(P); return P; }), 'score');
      var meilleur = ordre[0].score, nouveauRecord = meilleur > S.record;
      if (nouveauRecord) { S.record = meilleur; try { localStorage.setItem('jeutele-dino-record', String(meilleur)); } catch (e) {} }
      S.fin = { ordre: ordre, t0: F.t, record: nouveauRecord };
      await F.attendre(1.2);
      F.son.fanfare();
      F.musique('final');
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '🦖', titre: (ordre.length > 1 ? F.texteRang(P.rang) + ' · ' : '') + P.score + ' points',
          texte: Math.floor(P.distance / 40) + ' m parcourus · ' + P.oeufs + ' œuf(s) doré(s)' + (nouveauRecord && P.rang === 1 ? ' · NOUVEAU RECORD !' : ''),
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Simulation ----------
    function apparition() {
      var tempsCourse = S.temps;
      var choix = ['rocher', 'rocher', 'gros', 'epines'];
      if (tempsCourse > 8) choix.push('double');
      if (tempsCourse > 14) choix.push('oiseau', 'oiseau');
      var type = F.choisir(choix);
      var o = { type: type, x: S.x + 1600 / echelle() + 100, pris: {} };
      // perroquet haut : il faut se baisser ; perroquet bas : il faut sauter
      if (TYPES[type].air) o.air = TYPES[type].air + (Math.random() < 0.35 ? -48 : 0);
      S.obstacles.push(o);
      if (Math.random() < 0.35) S.obstacles.push({ type: 'oeuf', x: o.x + F.alea(180, 320), air: Math.random() < 0.5 ? 150 : 40, pris: {} });
      S.prochain = o.x + S.v * F.alea(0.75, 1.5) + 240;
    }
    function echelle() { return (900 / Math.max(1, L.joueurs.length)) / BASE; }

    function majCourse(dt) {
      S.temps += dt;
      S.v = Math.min(VMAX, S.v + ACCEL * dt);
      S.x += S.v * dt;
      if (S.x + 1600 / echelle() > S.prochain) apparition();
      S.obstacles = S.obstacles.filter(function (o) { return o.x > S.x - 300; });
      L.joueurs.forEach(function (P, i) {
        if (P.mort) { P.tMort += dt; return; }
        P.distance += S.v * dt;
        P.invincible = Math.max(0, P.invincible - dt);
        // saut
        if (!P.sol) {
          var g = GRAVITE * (P.tient && P.vy < 0 && P.tTient < 0.24 ? 0.42 : 1) * (P.bas ? 2.2 : 1);
          P.tTient += dt;
          P.vy += g * dt; P.y += P.vy * dt;
          if (P.y >= 0) { P.y = 0; P.vy = 0; P.sol = true; S.particules.gerbe(DINO_X, ligneSol(i), 5, { couleur: '#c9a26b', haut: 120, vmax: 160, g: 800, vie: 0.5 }); }
        }
        P.pas += dt * S.v / 60;
        // collisions
        var hb = boiteDino(P);
        S.obstacles.forEach(function (o) {
          if (o.pris[P.num]) return;
          var t = TYPES[o.type], ox = o.x - S.x + DINO_X;
          var bas = -(o.air || 0), haut = bas - t.h;
          var touche = ox - t.w / 2 < hb.x2 && ox + t.w / 2 > hb.x1 && bas > hb.y2 && haut < hb.y1;
          if (!touche) return;
          o.pris[P.num] = true;
          if (t.bonus) {
            P.oeufs++; F.son.gain();
            S.particules.gerbe(DINO_X + 30, ligneSol(i) - 80 * echelle(), 14, { couleurs: ['#ffd166', '#fff'], haut: 200, vmax: 300 });
            return;
          }
          if (P.invincible > 0) return;
          P.vies--; P.invincible = 1.6;
          F.son.buzz();
          S.particules.gerbe(DINO_X + 30, ligneSol(i) - 50 * echelle(), 16, { couleurs: [P.couleur, '#fff', '#ff4d6d'], haut: 300, vmax: 400 });
          if (P.vies <= 0) {
            P.mort = true; P.tMort = 0;
            F.son.perte();
            L.ui(P, { emoji: '💥', titre: 'Éliminé !', texte: score(P) + ' points · regarde les autres sur la télé', fond: '#5c1a1a', vibrer: [200, 80, 200] });
          } else L.ui(P, uiCourse());
        });
      });
    }
    function boiteDino(P) {
      // coordonnées relatives : x autour de DINO_X, y négatif vers le haut depuis le sol
      var w = P.bas && P.sol ? 92 : 64, h = P.bas && P.sol ? 52 : 92;
      return { x1: DINO_X - w / 2 + 6, x2: DINO_X + w / 2 - 6, y1: P.y, y2: P.y - h + 6 };
    }
    // Attention : en y, « y1 » est le bas (0 au sol) et « y2 » le haut (négatif).
    function ligneSol(i) { return (i * BASE + SOL) * echelle(); }

    // ---------- Dessin ----------
    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      var dts = Math.min(0.05, dt) * F.V;
      if (S.phase === 'course') majCourse(dts);
      else if (S.phase === 'titre' || S.phase === 'compte') { S.x += 160 * dts; }
      S.particules.maj(dts);

      F.virtuel(c, W, H, '#1d3557');
      var n = Math.max(1, L.joueurs.length), k = echelle();
      L.joueurs.forEach(function (P, i) { couloir(c, P, i, k); });
      S.particules.dessiner(c);
      // HUD
      if (S.phase === 'course') {
        c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, 640, 14, 320, 50, 25); c.fill();
        F.texte(c, 'Vitesse ×' + (S.v / V0).toFixed(1), 800, 40, 30, '#fff', { contour: false });
      }
      if (S.phase === 'titre') titre(c);
      if (S.compte && F.t - S.compteT < 0.8 / F.V) {
        var p = (F.t - S.compteT) * F.V / 0.8;
        c.globalAlpha = 1 - p;
        F.texte(c, String(S.compte), 800, 450, 260 * (0.6 + 0.6 * F.ease.out(p)), '#ffd166', { contour: '#d00000', epaisseur: 22 });
        c.globalAlpha = 1;
      }
      if (S.fin) resultats(c);
      c.restore();
      void n;
    }

    // Décor d'un couloir (ciel, volcans au loin, collines, forêt en 3D Kenney), largeur w en unités de couloir
    function decor(c, w, i) {
      var g = c.createLinearGradient(0, 0, 0, SOL);
      g.addColorStop(0, '#5fb8ff'); g.addColorStop(0.7, '#bfe6ff'); g.addColorStop(1, '#e6f7ff');
      c.fillStyle = g; c.fillRect(0, 0, w, SOL);
      c.fillStyle = 'rgba(255,250,220,.9)'; c.beginPath(); c.arc(w * 0.72, 110, 60, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,250,220,.25)'; c.beginPath(); c.arc(w * 0.72, 110, 90, 0, 7); c.fill();
      // nuages
      c.fillStyle = 'rgba(255,255,255,.9)';
      var tour = w + 400;
      for (var n = 0; n < 5; n++) {
        var nx = ((n * 397 + i * 151 - S.x * 0.05) % tour + tour) % tour - 200, ny = 50 + (n * 53) % 110;
        c.beginPath(); c.arc(nx, ny, 24, 0, 7); c.arc(nx + 30, ny - 10, 30, 0, 7); c.arc(nx + 62, ny, 22, 0, 7); c.fill();
        c.fillRect(nx, ny, 62, 22);
      }
      // volcans au loin (ils fument un peu)
      var d = (S.x * 0.06 + i * 300) % 900;
      for (var v = -1; v < w / 900 + 1; v++) {
        var vx = v * 900 - d;
        c.fillStyle = '#9a8cb8';
        c.beginPath(); c.moveTo(vx, SOL - 40); c.lineTo(vx + 250, 150); c.lineTo(vx + 310, 150); c.lineTo(vx + 560, SOL - 40); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)';
        for (var f = 0; f < 3; f++) { var fy = 130 - f * 26 - (F.t * 10 % 26); c.beginPath(); c.arc(vx + 280 + f * 14, fy, 14 + f * 5, 0, 7); c.fill(); }
      }
      // collines
      var dc = S.x * 0.15 + i * 200;
      c.fillStyle = '#8fd17a';
      c.beginPath(); c.moveTo(0, SOL);
      for (var x = 0; x <= w + 40; x += 40) c.lineTo(x, SOL - 70 - 26 * Math.sin((x + dc) / 190) - 14 * Math.sin((x + dc) / 70));
      c.lineTo(w + 40, SOL); c.fill();
      // forêt (modèles 3D Kenney, en parallaxe)
      var pas = 150, dt = S.x * 0.35 + i * 77, debut = Math.floor(dt / pas) - 1;
      for (var t = debut; t < debut + w / pas + 3; t++) {
        var tx = t * pas - dt + ((t * 53) % 60), h = 120 + ((t * 37) % 3) * 30;
        if (!F.dessinerSprite(c, 'arene/tree', tx, SOL + 4 - ((t * 7) % 2) * 14, h, { taille: 160, angle: 0.4, hauteur: 0.25 })) {
          c.fillStyle = '#4f9a55'; c.beginPath(); c.moveTo(tx - h * 0.25, SOL); c.lineTo(tx, SOL - h); c.lineTo(tx + h * 0.25, SOL); c.fill();
        }
      }
    }

    function couloir(c, P, i, k) {
      c.save();
      c.translate(0, i * BASE * k);
      c.scale(k, k);
      decor(c, 1600 / k, i);
      // sol et herbes (parallaxe)
      c.fillStyle = '#5cb85c'; c.fillRect(0, SOL, 1600 / k, 16);
      c.fillStyle = '#b07a4f'; c.fillRect(0, SOL + 16, 1600 / k, BASE - SOL - 16);
      c.fillStyle = 'rgba(0,0,0,.12)';
      for (var t = 0; t < 30; t++) { var tx = ((t * 137 - S.x) % (1600 / k + 200) + (1600 / k + 200)) % (1600 / k + 200) - 100; c.fillRect(tx, SOL + 26 + (t % 3) * 14, 18, 5); }
      c.strokeStyle = '#386641'; c.lineWidth = 4; c.lineCap = 'round';
      for (var f = 0; f < 18; f++) {
        var fx = ((f * 223 - S.x * 0.6) % (1600 / k + 300) + (1600 / k + 300)) % (1600 / k + 300) - 150;
        c.beginPath(); c.moveTo(fx, SOL); c.quadraticCurveTo(fx - 8, SOL - 20, fx - 16, SOL - 28); c.moveTo(fx, SOL); c.quadraticCurveTo(fx + 8, SOL - 22, fx + 14, SOL - 30); c.stroke();
      }
      if (i > 0) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, 1600 / k, 6); }
      // obstacles
      S.obstacles.forEach(function (o) {
        if (o.pris[P.num] && TYPES[o.type].bonus) return;
        var ox = o.x - S.x + DINO_X;
        if (ox < -200 || ox > 1600 / k + 200) return;
        dessinerObstacle(c, o, ox, SOL - (o.air || 0));
      });
      // dino
      var cligne = P.invincible > 0 && Math.floor(F.t * 14) % 2 === 0;
      if (!cligne) dessinerDino(c, DINO_X, SOL + P.y, P.couleur, P);
      // infos
      F.texte(c, P.nom, 30, 40, 34, '#fff', { align: 'left' });
      F.texte(c, score(P) + ' pts', 1600 / k - 30, 40, 38, '#fff', { align: 'right' });
      for (var v = 0; v < 3; v++) coeur(c, 40 + v * 42, 90, 16, v < P.vies);
      if (P.mort) {
        c.fillStyle = 'rgba(30,30,40,.45)'; c.fillRect(0, 0, 1600 / k, BASE);
        F.texte(c, 'K.O. · ' + score(P) + ' pts', 800 / k, BASE / 2, 60, '#fff');
      }
      c.restore();
    }

    function coeur(c, x, y, r, plein) {
      c.save(); c.translate(x, y);
      c.fillStyle = plein ? '#ff4d6d' : 'rgba(0,0,0,.25)';
      c.beginPath(); c.moveTo(0, r); c.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.4, 0, -r * 0.5); c.bezierCurveTo(r * 0.6, -r * 1.4, r * 1.6, -r * 0.2, 0, r); c.fill();
      c.restore();
    }

    function dessinerObstacle(c, o, x, y) {
      var t = TYPES[o.type];
      c.save();
      if (o.type === 'rocher' || o.type === 'gros' || o.type === 'double') {
        var nb = o.type === 'double' ? 2 : 1, w = o.type === 'double' ? t.w / 2 : t.w;
        for (var i = 0; i < nb; i++) {
          var rx = x - t.w / 2 + w / 2 + i * w;
          c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(rx, y + 2, w / 2 + 4, 7, 0, 0, 7); c.fill();
          var g = c.createLinearGradient(0, y - t.h, 0, y);
          g.addColorStop(0, '#adb5bd'); g.addColorStop(1, '#6c757d');
          c.fillStyle = g;
          c.beginPath(); c.moveTo(rx - w / 2, y); c.quadraticCurveTo(rx - w / 2, y - t.h, rx - w * 0.1, y - t.h); c.quadraticCurveTo(rx + w / 2, y - t.h * 0.9, rx + w / 2, y); c.fill();
          c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(rx - w * 0.15, y - t.h * 0.7, w * 0.14, t.h * 0.1, -0.4, 0, 7); c.fill();
        }
      } else if (o.type === 'epines') {
        c.fillStyle = '#2d6a4f';
        c.beginPath(); c.arc(x - 14, y - 22, 22, 0, 7); c.arc(x + 14, y - 22, 22, 0, 7); c.arc(x, y - 42, 24, 0, 7); c.fill();
        c.fillStyle = '#d00000';
        for (var b = 0; b < 6; b++) { c.beginPath(); c.arc(x - 20 + b * 8, y - 30 - (b % 2) * 18, 5, 0, 7); c.fill(); }
        c.strokeStyle = '#1b4332'; c.lineWidth = 3;
        for (var e = 0; e < 8; e++) { var a = -Math.PI + e * Math.PI / 7; c.beginPath(); c.moveTo(x + Math.cos(a) * 30, y - 30 + Math.sin(a) * 30); c.lineTo(x + Math.cos(a) * 42, y - 30 + Math.sin(a) * 42); c.stroke(); }
      } else if (o.type === 'oiseau') {
        var ail = Math.sin(F.t * 18) * 18;
        c.fillStyle = '#e63946';
        c.beginPath(); c.ellipse(x, y - 20, 34, 18, 0, 0, 7); c.fill();
        c.fillStyle = '#3a86ff';
        c.beginPath(); c.moveTo(x - 6, y - 26); c.lineTo(x + 18, y - 44 - ail); c.lineTo(x + 26, y - 24); c.fill();
        c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(x + 30, y - 26); c.lineTo(x + 30, y - 14); c.lineTo(x + 34, y - 20); c.fill();
        c.fillStyle = '#e63946'; c.beginPath(); c.arc(x - 30, y - 26, 14, 0, 7); c.fill();
        c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(x - 42, y - 30); c.lineTo(x - 58, y - 22); c.lineTo(x - 42, y - 20); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 34, y - 30, 5, 0, 7); c.fill();
        c.fillStyle = '#000'; c.beginPath(); c.arc(x - 35, y - 30, 2.5, 0, 7); c.fill();
        c.fillStyle = '#06d6a0'; c.beginPath(); c.moveTo(x + 30, y - 22); c.lineTo(x + 56, y - 12 + ail * 0.3); c.lineTo(x + 52, y - 26); c.fill();
      } else if (o.type === 'oeuf') {
        var bo = Math.sin(F.t * 4 + o.x) * 5;
        var go = c.createRadialGradient(x - 6, y - 34 + bo, 3, x, y - 25 + bo, 30);
        go.addColorStop(0, '#fff8d6'); go.addColorStop(1, '#ffb703');
        c.fillStyle = 'rgba(255,220,120,.35)'; c.beginPath(); c.arc(x, y - 25 + bo, 34, 0, 7); c.fill();
        c.fillStyle = go; c.beginPath(); c.ellipse(x, y - 25 + bo, 19, 25, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(x - 6, y - 34 + bo, 5, 8, -0.3, 0, 7); c.fill();
      }
      c.restore();
    }

    function dessinerDino(c, x, y, couleur, P) {
      var bas = P.bas && P.sol, mort = P.mort;
      var jambe = P.sol && !mort ? Math.sin(P.pas * 2.2) : 0.6;
      c.save();
      c.translate(x, y);
      if (mort) { c.rotate(Math.min(1.4, P.tMort * 6)); c.translate(0, -Math.min(30, P.tMort * 200)); }
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 2 - P.y, 40, 8, 0, 0, 7); c.fill();
      var fonce = F.assombrir(couleur, 0.35), clair = F.eclaircir(couleur, 0.45);
      var sy = bas ? 0.62 : 1;
      // jambes
      c.strokeStyle = fonce; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, -26 * sy); c.lineTo(-10 + jambe * 12, -2); c.stroke();
      c.beginPath(); c.moveTo(12, -26 * sy); c.lineTo(12 - jambe * 12, -2); c.stroke();
      // queue
      c.fillStyle = couleur;
      c.beginPath(); c.moveTo(-26, -58 * sy); c.quadraticCurveTo(-62, -52 * sy + Math.sin(F.t * 10) * 4, -76, -30 * sy); c.quadraticCurveTo(-50, -34 * sy, -22, -30 * sy); c.fill();
      // piques du dos
      c.fillStyle = clair;
      for (var s = 0; s < 4; s++) {
        var px = -28 + s * 16, py = (-84 + Math.abs(s - 1.5) * 6) * sy;
        c.beginPath(); c.moveTo(px - 8, py + 8); c.lineTo(px, py - 10); c.lineTo(px + 8, py + 8); c.fill();
      }
      // corps
      var g = c.createRadialGradient(-6, -70 * sy, 6, 0, -52 * sy, 50);
      g.addColorStop(0, clair); g.addColorStop(1, couleur);
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, -52 * sy, 38, 32 * sy, -0.1, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(10, -42 * sy, 18, 18 * sy, 0, 0, 7); c.fill();
      // tête
      var hx = bas ? 48 : 34, hy = bas ? -44 : -94;
      c.fillStyle = couleur;
      c.beginPath(); c.ellipse(hx, hy, 30, 24, 0.1, 0, 7); c.fill();
      c.beginPath(); c.ellipse(hx + 20, hy + 8, 22, 14, 0.1, 0, 7); c.fill();
      // œil
      c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 6, hy - 6, 10, 0, 7); c.fill();
      c.fillStyle = '#1b1b2f';
      if (mort) { c.lineWidth = 3; c.strokeStyle = '#1b1b2f'; c.beginPath(); c.moveTo(hx + 1, hy - 11); c.lineTo(hx + 11, hy - 1); c.moveTo(hx + 11, hy - 11); c.lineTo(hx + 1, hy - 1); c.stroke(); }
      else { c.beginPath(); c.arc(hx + 9, hy - 6, 5, 0, 7); c.fill(); }
      // bouche et narine
      c.strokeStyle = fonce; c.lineWidth = 3;
      c.beginPath(); c.arc(hx + 22, hy + 8, 10, 0.2, 1.4); c.stroke();
      c.fillStyle = fonce; c.beginPath(); c.arc(hx + 36, hy + 2, 2.5, 0, 7); c.fill();
      // bras
      c.strokeStyle = fonce; c.lineWidth = 7;
      c.beginPath(); c.moveTo(22, -50 * sy); c.lineTo(34, -40 * sy + jambe * 4); c.stroke();
      c.restore();
    }

    function titre(c) {
      c.fillStyle = 'rgba(20,10,30,.45)'; c.fillRect(0, 0, 1600, 900);
      var t = F.t - S.t0;
      F.texte(c, 'Dino Sprint', 800, 190 + Math.sin(t * 2) * 8, 150, '#80ed99', { contour: '#1b4332', epaisseur: 20 });
      F.texte(c, 'Saute les rochers · baisse-toi sous les perroquets · attrape les œufs dorés', 800, 300, 34, '#fff', { contour: false });
      F.texte(c, 'Garde le doigt sur SAUTE pour sauter plus haut. 3 vies chacun. La vitesse augmente !', 800, 350, 30, '#ffd166', { contour: false });
      if (S.record) F.texte(c, 'Record : ' + S.record + ' points', 800, 410, 34, '#fff');
      var n = L.joueurs.length;
      L.joueurs.forEach(function (P, k) {
        var x = 800 - (n - 1) * 150 + k * 300;
        c.save(); c.translate(x, 700); c.scale(1.4, 1.4);
        dessinerDino(c, 0, 0, P.couleur, { bas: false, sol: true, pas: t * 8 + k, y: 0 });
        c.restore();
        F.texte(c, P.nom, x, 750, 38, '#fff');
        F.texte(c, P.pret ? 'Prêt !' : 'en attente…', x, 800, 28, P.pret ? '#80ed99' : '#adb5bd');
      });
    }

    function resultats(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(10,10,30,' + 0.7 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Fin de la course !', 800, 120, 90, '#80ed99', { contour: '#1b4332', epaisseur: 14 });
      if (f.record) F.texte(c, 'NOUVEAU RECORD : ' + f.ordre[0].score + ' points', 800, 210, 46, '#ffd166');
      f.ordre.forEach(function (P, k) {
        var y = 290 + k * 130, x = 280 + (1 - F.ease.back(Math.min(1, Math.max(0, q * 2 - k * 0.2)))) * -1600;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.14)';
        F.rr(c, x, y, 1040, 110, 26); c.fill();
        var col = P.rang === 1 ? '#1b1b2f' : '#fff';
        F.texte(c, F.texteRang(P.rang), x + 70, y + 55, 46, col, { contour: false });
        F.pion(c, x + 170, y + 58, 32, P.couleur, null, { phase: k, saut: P.rang === 1 ? Math.abs(Math.sin(F.t * 8)) * 12 : 0 });
        F.texte(c, P.nom, x + 230, y + 55, 46, col, { align: 'left', contour: false });
        F.texte(c, Math.floor(P.distance / 40) + ' m · ' + P.oeufs + ' œufs', x + 760, y + 55, 32, col, { align: 'right', contour: false });
        F.texte(c, P.score + ' pts', x + 1000, y + 55, 42, col, { align: 'right', contour: false });
      });
      if (q >= 1 && f.ordre[0] && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
    }

    partie().catch(function (e) { console.error('Dino :', e); });

    return {
      image: image,
      message: function (j, m) {
        if (L.recevoir(j, m)) return;
        var P = L.PDe(j);
        if (!P || P.mort || S.phase !== 'course' || m.t !== 'bouton') return;
        if (m.b === 'saut') {
          P.tient = m.appui;
          if (m.appui && P.sol) { P.sol = false; P.vy = -SAUT; P.tTient = 0; P.bas = false; F.son.pas(4); }
        } else if (m.b === 'bas') {
          P.bas = m.appui;
        }
      },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'dino', vignette: 'assets/vignettes/dino.jpg', nom: 'Dino Sprint', emoji: '🦖',
    description: 'Course de dinos : saute, baisse-toi, ramasse les œufs. Le dernier debout gagne !',
    min: 1, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
