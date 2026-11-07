/*
 * Turbo Karts — course de karts en fausse 3D (sol projeté), écran partagé de 1 à 4 joueurs.
 * Les karts de l'ordinateur complètent la grille jusqu'à 6 pilotes.
 * Pilotage au téléphone : ◀ ▶ pour tourner (l'accélération est automatique), 🎁 pour utiliser l'objet.
 * Objets : turbo, flaque d'huile, missile à tête chercheuse, bouclier. Plaques turbo sur la piste.
 */
(function (F) {
  'use strict';

  var MONDE = 3072, TEX = 1536, ECH = TEX / MONDE; // 2 unités du monde par pixel de texture
  var VMAX = 270, ACCEL = 170, VHORS = 120, VTURBO = 410, TOURS = 3, NB_PILOTES = 6;
  var LARGEUR = 78; // demi-largeur de la route
  var OBJETS = {
    turbo: { emoji: '⚡', nom: 'Turbo' },
    huile: { emoji: '🛢️', nom: 'Flaque d\'huile' },
    missile: { emoji: '🚀', nom: 'Missile' },
    bouclier: { emoji: '🛡️', nom: 'Bouclier' }
  };
  var ROBOTS = [
    { nom: 'Zip', couleur: '#adb5bd' }, { nom: 'Bolt', couleur: '#8d99ae' }, { nom: 'Nova', couleur: '#c77dff' },
    { nom: 'Rocco', couleur: '#e76f51' }, { nom: 'Yuki', couleur: '#90e0ef' }, { nom: 'Pixel', couleur: '#b5e48c' }
  ];

  // ---------- Circuits ----------
  var CIRCUITS = [
    {
      id: 'neon', nom: 'Ville Néon', emoji: '🌃',
      pts: [[600, 2500], [600, 1500], [800, 800], [1400, 560], [1900, 900], [1750, 1450], [2250, 1650], [2550, 1150], [2650, 600], [2850, 900], [2800, 2000], [2400, 2550], [1700, 2350], [1200, 2650]],
      sol: '#120c2a', sol2: '#1d1640', route: '#2b2d42', bord: ['#ff006e', '#00f5d4'], ligne: '#ffd166',
      ciel: ['#0b0420', '#3c096c', '#7b2cbf'], brouillard: '#3c096c', decor: ['immeuble', 'lampadaire', 'immeuble', 'neon']
    },
    {
      id: 'neige', nom: 'Montagne Enneigée', emoji: '🏔️',
      pts: [[500, 2600], [450, 1700], [700, 1100], [500, 500], [1100, 350], [1450, 900], [1900, 650], [2600, 500], [2700, 1200], [2200, 1500], [2650, 2000], [2500, 2650], [1800, 2400], [1300, 2750]],
      sol: '#e9f5ff', sol2: '#cfe3f3', route: '#5c677d', bord: ['#e63946', '#ffffff'], ligne: '#ffffff',
      ciel: ['#4ea8de', '#90e0ef', '#e0fbfc'], brouillard: '#e0fbfc', decor: ['sapin', 'sapin', 'rocher', 'bonhomme']
    },
    {
      id: 'canyon', nom: 'Canyon Rouge', emoji: '🏜️',
      pts: [[700, 2700], [450, 2100], [700, 1600], [450, 1000], [800, 450], [1400, 650], [1600, 1300], [2100, 1000], [2300, 400], [2750, 700], [2650, 1500], [2850, 2200], [2300, 2700], [1700, 2300], [1300, 2800]],
      sol: '#d08c60', sol2: '#c1734a', route: '#5a4a42', bord: ['#fb8500', '#fff3b0'], ligne: '#ffd166',
      ciel: ['#9d4edd', '#f48c06', '#ffba08'], brouillard: '#f8b26a', decor: ['cactus', 'rocherRouge', 'cactus', 'mesa']
    }
  ];

  // Catmull-Rom fermée -> points réguliers (environ tous les 8 unités)
  function preparerCircuit(k) {
    if (k.centre) return;
    var P = k.pts, n = P.length, brut = [];
    for (var i = 0; i < n; i++) {
      var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (var t = 0; t < 1; t += 0.02) {
        var t2 = t * t, t3 = t2 * t;
        brut.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    var c = [brut[0]], acc = 0;
    for (var j = 1; j < brut.length; j++) {
      var d = Math.hypot(brut[j][0] - brut[j - 1][0], brut[j][1] - brut[j - 1][1]);
      acc += d;
      if (acc >= 8) { c.push(brut[j]); acc = 0; }
    }
    k.centre = c;
    k.longueur = c.length * 8;
    // direction en chaque point
    k.dir = c.map(function (p, i) { var q = c[(i + 1) % c.length]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    // boîtes à objets (rangées de 4) et plaques turbo
    var N = c.length;
    k.boites = [];
    [0.18, 0.45, 0.72].forEach(function (f) {
      var i = Math.floor(N * f), a = k.dir[i];
      for (var m = -1.5; m <= 1.5; m++) k.boites.push({ x: c[i][0] - Math.sin(a) * m * 34, y: c[i][1] + Math.cos(a) * m * 34, retour: 0 });
    });
    k.turbos = [0.3, 0.6, 0.88].map(function (f) { var i = Math.floor(N * f); return { i: i, x: c[i][0], y: c[i][1], a: k.dir[i] }; });
    // décor le long de la route, jamais sur la piste
    var graine = 7;
    function alea() { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }
    k.decor = [];
    for (var s = 0; s < N; s += 3) {
      if (alea() > 0.5) continue;
      var cote = alea() < 0.5 ? -1 : 1, off = LARGEUR + 60 + alea() * 260, a2 = k.dir[s];
      var x = c[s][0] - Math.sin(a2) * off * cote, y = c[s][1] + Math.cos(a2) * off * cote;
      if (x < 40 || y < 40 || x > MONDE - 40 || y > MONDE - 40) continue;
      if (distanceRoute(k, x, y) < LARGEUR + 50) continue;
      k.decor.push({ x: x, y: y, v: alea(), sorte: k.decorNoms[Math.floor(alea() * k.decorNoms.length)] });
    }
  }
  CIRCUITS.forEach(function (k) { k.decorNoms = k.decor; k.decor = null; });

  function distanceRoute(k, x, y, depart) {
    var c = k.centre, best = 1e9;
    for (var i = 0; i < c.length; i += 2) { var dx = c[i][0] - x, dy = c[i][1] - y, d = dx * dx + dy * dy; if (d < best) best = d; }
    void depart;
    return Math.sqrt(best);
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

  // ---------- Textures ----------
  function texture(k) {
    if (k.tex) return;
    var cv = document.createElement('canvas'); cv.width = TEX; cv.height = TEX;
    var c = cv.getContext('2d');
    c.fillStyle = k.sol; c.fillRect(0, 0, TEX, TEX);
    // taches et motifs du sol
    var graine = 3;
    function alea() { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }
    c.fillStyle = k.sol2;
    for (var i = 0; i < 900; i++) { c.beginPath(); c.arc(alea() * TEX, alea() * TEX, 4 + alea() * 26, 0, 7); c.fill(); }
    if (k.id === 'neon') {
      c.strokeStyle = 'rgba(123,44,191,.35)'; c.lineWidth = 2;
      for (var g = 0; g < TEX; g += 48) { c.beginPath(); c.moveTo(g, 0); c.lineTo(g, TEX); c.stroke(); c.beginPath(); c.moveTo(0, g); c.lineTo(TEX, g); c.stroke(); }
    }
    var pts = k.centre;
    function chemin() { c.beginPath(); pts.forEach(function (p, j) { if (j) c.lineTo(p[0] * ECH, p[1] * ECH); else c.moveTo(p[0] * ECH, p[1] * ECH); }); c.closePath(); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    // bas-côté
    chemin(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = (LARGEUR * 2 + 40) * ECH; c.stroke();
    // bordures rayées
    chemin(); c.strokeStyle = k.bord[0]; c.lineWidth = (LARGEUR * 2 + 16) * ECH; c.stroke();
    chemin(); c.strokeStyle = k.bord[1]; c.lineWidth = (LARGEUR * 2 + 16) * ECH; c.setLineDash([14, 14]); c.stroke(); c.setLineDash([]);
    // route
    chemin(); c.strokeStyle = k.route; c.lineWidth = LARGEUR * 2 * ECH; c.stroke();
    // grain de la route
    c.save(); chemin(); c.lineWidth = LARGEUR * 2 * ECH; c.strokeStyle = 'rgba(255,255,255,.04)'; c.setLineDash([2, 5]); c.stroke(); c.restore();
    // ligne centrale
    chemin(); c.strokeStyle = k.ligne; c.globalAlpha = 0.7; c.lineWidth = 3; c.setLineDash([18, 22]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    // ligne de départ en damier
    var p0 = pts[0], a = k.dir[0];
    c.save(); c.translate(p0[0] * ECH, p0[1] * ECH); c.rotate(a);
    for (var r = 0; r < 2; r++) for (var q = -8; q < 8; q++) { c.fillStyle = (q + r) % 2 ? '#fff' : '#111'; c.fillRect(r * 6 - 6, q * LARGEUR * ECH / 8, 6, LARGEUR * ECH / 8); }
    c.restore();
    // plaques turbo : chevrons
    k.turbos.forEach(function (t) {
      c.save(); c.translate(t.x * ECH, t.y * ECH); c.rotate(t.a);
      c.fillStyle = '#ffbe0b'; F.rr(c, -22, -16, 44, 32, 6); c.fill();
      c.fillStyle = '#fb5607';
      for (var v = -1; v <= 1; v++) { c.beginPath(); c.moveTo(-14 + v * 12, -11); c.lineTo(-4 + v * 12, 0); c.lineTo(-14 + v * 12, 11); c.lineTo(-9 + v * 12, 11); c.lineTo(1 + v * 12, 0); c.lineTo(-9 + v * 12, -11); c.closePath(); c.fill(); }
      c.restore();
    });
    var d = c.getImageData(0, 0, TEX, TEX);
    k.tex = new Uint32Array(d.data.buffer);
    var s = k.sol.replace('#', '');
    var rr = parseInt(s.substr(0, 2), 16), gg = parseInt(s.substr(2, 2), 16), bb = parseInt(s.substr(4, 2), 16);
    k.texDehors = (255 << 24) | (bb << 16) | (gg << 8) | rr;
    k.carte = cv; // pour la mini-carte
    // bande d'horizon (répétée selon l'angle de la caméra)
    var h = document.createElement('canvas'); h.width = 2048; h.height = 220;
    var hc = h.getContext('2d');
    graine = 11;
    if (k.id === 'neon') {
      for (var b = 0; b < 2048; b += 40 + alea() * 50) {
        var bh = 60 + alea() * 150, bw = 30 + alea() * 50;
        hc.fillStyle = '#10002b'; hc.fillRect(b, 220 - bh, bw, bh);
        for (var wy = 220 - bh + 8; wy < 214; wy += 12) for (var wx = b + 5; wx < b + bw - 6; wx += 10) if (alea() < 0.45) { hc.fillStyle = alea() < 0.5 ? '#ffd166' : '#4cc9f0'; hc.fillRect(wx, wy, 4, 5); }
      }
    } else if (k.id === 'neige') {
      for (var m = 0; m < 2; m++) {
        hc.fillStyle = m ? '#adb5bd' : '#dee2e6'; hc.beginPath(); hc.moveTo(0, 220);
        for (var mx = 0; mx <= 2048; mx += 64) hc.lineTo(mx, 220 - (70 + m * 30) - 90 * Math.abs(Math.sin(mx / (180 + m * 90) + m)));
        hc.lineTo(2048, 220); hc.fill();
      }
      hc.fillStyle = '#fff';
      for (var sx = 0; sx < 2048; sx += 64) { var top = 220 - 100 - 90 * Math.abs(Math.sin(sx / 270 + 1)); hc.beginPath(); hc.moveTo(sx - 20, top + 24); hc.lineTo(sx, top); hc.lineTo(sx + 20, top + 24); hc.fill(); }
    } else {
      for (var z = 0; z < 2048; z += 200 + alea() * 200) {
        var zh = 60 + alea() * 90, zw = 120 + alea() * 160;
        hc.fillStyle = '#9c4221'; hc.beginPath(); hc.moveTo(z, 220); hc.lineTo(z + 20, 220 - zh); hc.lineTo(z + zw - 20, 220 - zh); hc.lineTo(z + zw, 220); hc.fill();
        hc.fillStyle = '#c2571a'; hc.fillRect(z + 20, 220 - zh, zw - 40, 10);
      }
    }
    k.horizon = h;
  }

  // ---------- Dessin des sprites ----------
  function dessinerKart(c, x, y, s, couleur, rel, virage, o) {
    // rel : angle entre l'avant du kart et la direction de la caméra (0 = vu de dos)
    o = o || {};
    var a = Math.atan2(Math.sin(rel), Math.cos(rel)), aa = Math.abs(a);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.tourne) c.rotate(Math.sin(o.tourne * 12) * 0.25);
    // ombre
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 0, 30, 7, 0, 0, 7); c.fill();
    if (o.bouclier) { c.strokeStyle = 'rgba(76,201,240,' + (0.5 + 0.3 * Math.sin(F.t * 10)) + ')'; c.lineWidth = 4; c.beginPath(); c.arc(0, -22, 36, 0, 7); c.stroke(); }
    var fonce = F.assombrir(couleur, 0.35);
    if (aa < 0.6 || aa > 2.55) {
      var face = aa > 2.55;
      // roues
      c.fillStyle = '#111'; F.rr(c, -30, -16, 14, 16, 4); c.fill(); F.rr(c, 16, -16, 14, 16, 4); c.fill();
      // carrosserie
      c.fillStyle = fonce; F.rr(c, -26, -24, 52, 14, 6); c.fill();
      c.fillStyle = couleur; F.rr(c, -22, -32, 44, 14, 7); c.fill();
      if (!face) { c.fillStyle = '#495057'; c.fillRect(-14, -14, 8, 6); c.fillRect(6, -14, 8, 6); c.fillStyle = '#ff4d6d'; c.fillRect(-20, -22, 7, 4); c.fillRect(13, -22, 7, 4); }
      else { c.fillStyle = '#fff3b0'; c.fillRect(-20, -22, 8, 5); c.fillRect(12, -22, 8, 5); }
      // pilote
      c.fillStyle = '#212529'; c.fillRect(-8, -42, 16, 12);
      c.fillStyle = couleur; c.beginPath(); c.arc(0, -48, 11, 0, 7); c.fill();
      c.fillStyle = face ? '#1b1b2f' : F.eclaircir(couleur, 0.4); c.fillRect(-8, face ? -51 : -54, 16, face ? 6 : 3);
      // aileron
      if (!face) { c.fillStyle = fonce; c.fillRect(-24, -40, 48, 5); c.fillRect(-3, -36, 6, 6); }
      c.save(); c.rotate(virage * 0.15); c.restore();
    } else {
      var d = a > 0 ? 1 : -1;
      c.scale(d, 1);
      c.fillStyle = '#111'; c.beginPath(); c.arc(-20, -9, 9, 0, 7); c.fill(); c.beginPath(); c.arc(20, -9, 9, 0, 7); c.fill();
      c.fillStyle = '#6c757d'; c.beginPath(); c.arc(-20, -9, 4, 0, 7); c.fill(); c.beginPath(); c.arc(20, -9, 4, 0, 7); c.fill();
      c.fillStyle = couleur; c.beginPath(); c.moveTo(-34, -14); c.lineTo(30, -14); c.lineTo(36, -22); c.lineTo(10, -26); c.lineTo(-28, -26); c.closePath(); c.fill();
      c.fillStyle = fonce; c.fillRect(-36, -34, 8, 12);
      c.fillStyle = '#212529'; c.fillRect(-10, -38, 12, 12);
      c.fillStyle = couleur; c.beginPath(); c.arc(-4, -44, 10, 0, 7); c.fill();
      c.fillStyle = '#1b1b2f'; c.fillRect(0, -47, 7, 5);
    }
    if (o.turbo) {
      c.fillStyle = 'rgba(255,190,11,.9)';
      for (var f = -1; f <= 1; f += 2) { c.beginPath(); c.moveTo(f * 10 - 5, -12); c.lineTo(f * 10, -12 + 14 + Math.random() * 10); c.lineTo(f * 10 + 5, -12); c.fill(); }
    }
    c.restore();
  }

  function dessinerDecor(c, x, y, s, sorte, v) {
    c.save(); c.translate(x, y); c.scale(s, s);
    switch (sorte) {
      case 'sapin':
        c.fillStyle = '#6f4518'; c.fillRect(-6, -20, 12, 20);
        for (var i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#2d6a4f' : '#1b4332'; c.beginPath(); c.moveTo(-44 + i * 9, -16 - i * 34); c.lineTo(0, -80 - i * 34); c.lineTo(44 - i * 9, -16 - i * 34); c.fill(); }
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-14, -118); c.lineTo(0, -148); c.lineTo(14, -118); c.fill();
        break;
      case 'rocher': c.fillStyle = '#8d99ae'; c.beginPath(); c.ellipse(0, -20, 34, 24, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-6, -38, 22, 8, 0, 0, 7); c.fill(); break;
      case 'bonhomme':
        c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -18, 18, 0, 7); c.fill(); c.beginPath(); c.arc(0, -46, 13, 0, 7); c.fill();
        c.fillStyle = '#fb8500'; c.beginPath(); c.moveTo(0, -46); c.lineTo(14, -44); c.lineTo(0, -42); c.fill();
        c.fillStyle = '#e63946'; c.fillRect(-12, -36, 24, 5);
        break;
      case 'cactus':
        c.fillStyle = '#2d6a4f'; F.rr(c, -9, -90, 18, 90, 9); c.fill();
        F.rr(c, -32, -66, 12, 34, 6); c.fill(); F.rr(c, -32, -38, 30, 10, 5); c.fill();
        F.rr(c, 20, -76, 12, 30, 6); c.fill(); F.rr(c, 4, -50, 28, 10, 5); c.fill();
        break;
      case 'rocherRouge': c.fillStyle = '#9c4221'; c.beginPath(); c.moveTo(-40, 0); c.lineTo(-30, -50); c.lineTo(10, -62); c.lineTo(40, 0); c.fill(); c.fillStyle = '#c2571a'; c.beginPath(); c.moveTo(-30, -50); c.lineTo(10, -62); c.lineTo(16, -44); c.lineTo(-24, -36); c.fill(); break;
      case 'mesa': c.fillStyle = '#7f3b1a'; c.fillRect(-60, -110, 120, 110); c.fillStyle = '#c2571a'; c.fillRect(-60, -110, 120, 16); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-60, -70, 120, 8); break;
      case 'immeuble':
        var h = 140 + v * 160;
        c.fillStyle = '#240046'; c.fillRect(-40, -h, 80, h);
        for (var wy = -h + 12; wy < -10; wy += 20) for (var wx = -30; wx < 30; wx += 16) { c.fillStyle = (Math.floor(wx * 7 + wy * 3 + v * 100) % 3) ? '#ffd166' : '#3c096c'; c.fillRect(wx, wy, 8, 10); }
        c.fillStyle = '#ff006e'; c.fillRect(-40, -h, 80, 5);
        break;
      case 'lampadaire':
        c.fillStyle = '#495057'; c.fillRect(-3, -110, 6, 110); c.fillRect(-3, -110, 26, 5);
        c.fillStyle = 'rgba(0,245,212,.35)'; c.beginPath(); c.arc(20, -102, 18, 0, 7); c.fill();
        c.fillStyle = '#00f5d4'; c.beginPath(); c.arc(20, -102, 6, 0, 7); c.fill();
        break;
      case 'neon':
        c.fillStyle = '#495057'; c.fillRect(-4, -60, 8, 60);
        c.fillStyle = '#10002b'; F.rr(c, -54, -120, 108, 60, 10); c.fill();
        c.strokeStyle = v < 0.5 ? '#ff006e' : '#00f5d4'; c.lineWidth = 5; F.rr(c, -50, -116, 100, 52, 8); c.stroke();
        F.texte(c, v < 0.5 ? 'TURBO' : 'KARTS', 0, -90, 22, c.strokeStyle, { contour: false });
        break;
    }
    c.restore();
  }

  function dessinerBoite(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    var b = Math.sin(F.t * 3) * 4;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 16, 5, 0, 0, 7); c.fill();
    c.translate(0, -26 + b); c.rotate(F.t * 1.5 % (Math.PI * 2) * 0 + Math.sin(F.t * 2) * 0.2);
    var g = c.createLinearGradient(-16, -16, 16, 16); g.addColorStop(0, '#4cc9f0'); g.addColorStop(0.5, '#f72585'); g.addColorStop(1, '#ffd166');
    c.fillStyle = g; c.globalAlpha = 0.85; F.rr(c, -16, -16, 32, 32, 7); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#fff'; c.lineWidth = 3; F.rr(c, -16, -16, 32, 32, 7); c.stroke();
    F.texte(c, '?', 0, 1, 24, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 4 });
    c.restore();
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
      preparerCircuit(k); texture(k);
      S.circuit = k; S.objets = []; S.resultats = null; S.arrivees = 0;
      k.boites.forEach(function (b) { b.retour = 0; });
      var a0 = k.dir[0], c0 = k.centre[0];
      var grille = F.melanger(S.pilotes.slice());
      grille.forEach(function (p, i) {
        var rang = Math.floor(i / 2), cote = i % 2 ? 1 : -1;
        var arr = 50 + rang * 70 + (i % 2) * 30;
        p.x = c0[0] - Math.cos(a0) * arr - Math.sin(a0) * cote * 34;
        p.y = c0[1] - Math.sin(a0) * arr + Math.cos(a0) * cote * 34;
        p.a = a0; p.v = 0; p.tour = 0; p.idx = plusProche(k, p.x, p.y, k.centre.length - 1).i; p.avance = 0; p.mi = false;
        p.objet = null; p.turbo = 0; p.tourne = 0; p.bouclier = 0; p.fini = false; p.temps = 0; p.place = i + 1; p.hors = 0; p.virage = 0;
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
        var hors = pr.d > LARGEUR + 6;
        var vmax = hors ? VHORS : VMAX;
        if (!p.humain) vmax *= p.niveau * (p.place > 3 ? 1.04 : 1);
        if (p.turbo > 0) { p.turbo -= dt; vmax = VTURBO; }
        if (p.bouclier > 0) p.bouclier -= dt;
        if (!enCourse && S.phase !== 'resultats' && !p.fini) vmax = 0;
        if (p.fini && S.phase === 'resultats') vmax = 0;
        if (p.tourne > 0) vmax = 40;
        if (p.v < vmax) p.v = Math.min(vmax, p.v + (p.turbo > 0 ? ACCEL * 3 : ACCEL) * dt);
        else p.v = Math.max(vmax, p.v - 260 * dt);
        p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
        p.x = F.borne(p.x, 20, MONDE - 20); p.y = F.borne(p.y, 20, MONDE - 20);
        // perdu loin de la piste : retour sur la route
        p.hors = hors && pr.d > LARGEUR + 260 ? p.hors + dt : 0;
        if (p.hors > 3) { var c = k.centre[pr.i]; p.x = c[0]; p.y = c[1]; p.a = k.dir[pr.i]; p.v = 0; p.hors = 0; }
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
        k.turbos.forEach(function (t) { if (Math.hypot(t.x - p.x, t.y - p.y) < 26) { if (p.turbo < 0.8) { p.turbo = 0.9; if (p.humain) F.son.go(); } } });
        // boîtes
        k.boites.forEach(function (b) {
          if (b.retour > 0) return;
          if (Math.hypot(b.x - p.x, b.y - p.y) < 28) { b.retour = 3; if (!p.objet) donnerObjet(p); S.particules.gerbe(b.x, b.y, 10, { couleurs: ['#4cc9f0', '#f72585', '#ffd166'], haut: 120, vmax: 200, vie: 0.6 }); }
        });
        p.camA += Math.atan2(Math.sin(p.a - p.camA), Math.cos(p.a - p.camA)) * Math.min(1, dt * 6);
      });
      k.boites.forEach(function (b) { if (b.retour > 0) b.retour -= dt; });
      // chocs entre karts
      for (var i = 0; i < S.pilotes.length; i++) for (var j = i + 1; j < S.pilotes.length; j++) {
        var a = S.pilotes[i], b = S.pilotes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 26 && d > 0.01) { var push = (26 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
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
          if (Math.hypot(p.x - o.x, p.y - o.y) < (o.type === 'huile' ? 26 : 24)) { toucher(p); return false; }
        }
        return true;
      });
      // places
      classement().forEach(function (p, i) { p.place = i + 1; });
      S.particules.maj(dt);
    }

    // ---------- Rendu fausse 3D ----------
    function sol(id, w, h) {
      var cle = id + ':' + w + 'x' + h;
      if (!S.sols[cle]) {
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'), img = cx.createImageData(w, h);
        S.sols[cle] = { cv: cv, cx: cx, img: img, px: new Uint32Array(img.data.buffer) };
      }
      return S.sols[cle];
    }

    // vue d'un pilote dans le rectangle (vx, vy, vw, vh) du monde virtuel 1600 × 900
    function vue(c, p, vx, vy, vw, vh) {
      var k = S.circuit;
      var Q = 3, w = Math.round(vw / Q), h = Math.round(vh / Q);
      var hz = Math.round(h * 0.36);
      var gh = h - hz;
      var buf = sol(k.id, w, gh);
      var H = 45, CAMD = 150, KS = 0.45, f = Math.min(w * 0.85, 0.72 * gh * CAMD / H);
      var ca = Math.cos(p.camA), sa = Math.sin(p.camA);
      var camx = p.x - ca * CAMD, camy = p.y - sa * CAMD;
      var tex = k.tex, dehors = k.texDehors, px = buf.px;
      for (var y = 0; y < gh; y++) {
        var z = H * f / (y + 0.5); // distance au sol pour cette ligne
        var ech = z / f;
        var bx = camx + ca * z, by = camy + sa * z; // centre de la ligne
        var dx = -sa * ech, dy = ca * ech;           // pas pour un pixel vers la droite
        var wx = bx - dx * w / 2, wy = by - dy * w / 2;
        var o = y * w;
        for (var x = 0; x < w; x++) {
          var tx = (wx * ECH) | 0, ty = (wy * ECH) | 0;
          px[o + x] = (tx >= 0 && ty >= 0 && tx < TEX && ty < TEX) ? tex[ty * TEX + tx] : dehors;
          wx += dx; wy += dy;
        }
      }
      buf.cx.putImageData(buf.img, 0, 0);
      c.save();
      c.beginPath(); c.rect(vx, vy, vw, vh); c.clip();
      // ciel
      var hzV = vy + hz * Q;
      var g = c.createLinearGradient(0, vy, 0, hzV);
      g.addColorStop(0, k.ciel[0]); g.addColorStop(0.6, k.ciel[1]); g.addColorStop(1, k.ciel[2]);
      c.fillStyle = g; c.fillRect(vx, vy, vw, hzV - vy + 2);
      // bande d'horizon qui défile avec l'angle
      var bh = k.horizon, bw = vw * 2.2, off = ((-p.camA / (Math.PI * 2)) * bw) % bw; if (off > 0) off -= bw;
      var hh = Math.min(vh * 0.32, bw * bh.height / bh.width * 1.2);
      for (var r = off; r < vw; r += bw) c.drawImage(bh, vx + r, hzV - hh + 2, bw, hh);
      // sol
      c.imageSmoothingEnabled = true;
      c.drawImage(buf.cv, vx, hzV, vw, gh * Q);
      // brume à l'horizon
      var b = c.createLinearGradient(0, hzV, 0, hzV + vh * 0.16);
      b.addColorStop(0, k.brouillard); b.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.85; c.fillStyle = b; c.fillRect(vx, hzV, vw, vh * 0.16); c.globalAlpha = 1;
      // sprites
      var sprites = [];
      function proj(ox, oy) {
        var ddx = ox - camx, ddy = oy - camy;
        var fwd = ddx * ca + ddy * sa, cote = -ddx * sa + ddy * ca;
        if (fwd < 95 || fwd > 2200) return null;
        var sx = w / 2 + cote * f / fwd;
        if (sx < -w * 0.6 || sx > w * 1.6) return null;
        return { x: vx + sx * Q, y: hzV + (H * f / fwd) * Q, s: (f / fwd) * Q, d: fwd };
      }
      k.decor.forEach(function (d) { var q = proj(d.x, d.y); if (q) sprites.push({ q: q, t: 'decor', o: d }); });
      k.boites.forEach(function (bo) { if (bo.retour > 0) return; var q = proj(bo.x, bo.y); if (q) sprites.push({ q: q, t: 'boite' }); });
      S.objets.forEach(function (o) { var q = proj(o.x, o.y); if (q) sprites.push({ q: q, t: o.type, o: o }); });
      S.pilotes.forEach(function (o) { if (o === p) return; var q = proj(o.x, o.y); if (q) sprites.push({ q: q, t: 'kart', o: o }); });
      sprites.sort(function (a, b2) { return b2.q.d - a.q.d; });
      sprites.forEach(function (sp) {
        var q = sp.q, s = q.s;
        if (sp.t === 'decor') dessinerDecor(c, q.x, q.y, s, sp.o.sorte, sp.o.v);
        else if (sp.t === 'boite') dessinerBoite(c, q.x, q.y, s * 0.7);
        else if (sp.t === 'huile') { s *= 0.6; c.fillStyle = 'rgba(20,20,20,.85)'; c.beginPath(); c.ellipse(q.x, q.y, 30 * s, 9 * s, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(131,56,236,.5)'; c.beginPath(); c.ellipse(q.x - 6 * s, q.y - 2 * s, 12 * s, 3 * s, 0, 0, 7); c.fill(); }
        else if (sp.t === 'missile') { s *= 0.6; c.save(); c.translate(q.x, q.y - 16 * s); c.scale(s, s); c.fillStyle = '#e63946'; F.rr(c, -9, -9, 18, 18, 9); c.fill(); c.fillStyle = '#ffbe0b'; c.beginPath(); c.arc(0, 0, 4 + Math.random() * 2, 0, 7); c.fill(); c.restore(); }
        else if (sp.t === 'kart') {
          var o = sp.o;
          dessinerKart(c, q.x, q.y, s * KS, o.couleur, o.a - p.camA, o.virage, { tourne: o.tourne > 0 ? o.tourne : 0, bouclier: o.bouclier > 0, turbo: o.turbo > 0 });
          if (s * KS > 0.3) F.texte(c, o.nom, q.x, q.y - 70 * s * KS, Math.max(14, 22 * s * KS), '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 4 });
        }
      });
      // le kart du joueur, vu de dos
      var kx = vx + vw / 2, ky = hzV + (H * f / CAMD) * Q + (p.v > 10 ? Math.sin(F.t * 30) * 1.2 : 0);
      var ks = (f / CAMD) * Q * KS;
      dessinerKart(c, kx, ky, ks, p.couleur, (p.a - p.camA) + p.virage * 0.25, p.virage, { tourne: p.tourne > 0 ? p.tourne : 0, bouclier: p.bouclier > 0, turbo: p.turbo > 0 });
      // effets de vitesse
      if (p.turbo > 0) {
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3;
        for (var l = 0; l < 14; l++) { var ang = (l / 14) * Math.PI * 2 + F.t * 3, r1 = vh * 0.35, r2 = vh * (0.5 + Math.random() * 0.2); c.beginPath(); c.moveTo(kx + Math.cos(ang) * r1 * 1.6, vy + vh * 0.5 + Math.sin(ang) * r1); c.lineTo(kx + Math.cos(ang) * r2 * 1.6, vy + vh * 0.5 + Math.sin(ang) * r2); c.stroke(); }
      }
      hud(c, p, vx, vy, vw, vh);
      c.restore();
      // cadre
      c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeRect(vx, vy, vw, vh);
    }

    function hud(c, p, vx, vy, vw, vh) {
      var u = Math.min(vw / 800, vh / 450);
      // position
      F.texte(c, F.texteRang(p.place), vx + 70 * u, vy + vh - 60 * u, 76 * u, p.place === 1 ? '#ffd166' : '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: 10 * u });
      F.texte(c, '/' + S.pilotes.length, vx + 140 * u, vy + vh - 44 * u, 32 * u, '#fff', { contour: 'rgba(0,0,0,.7)', epaisseur: 6 * u });
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
      c.drawImage(k.carte, x, y, taille, taille);
      c.globalAlpha = 1;
      var e = taille / MONDE;
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
        humains.forEach(function (p, i) { var r = rects[i]; vue(c, p, r[0], r[1], r[2], r[3]); });
        if (n === 3) { c.fillStyle = '#10002b'; c.fillRect(800, 450, 800, 450); F.texte(c, S.circuit.emoji + ' ' + S.circuit.nom, 1200, 520, 40, '#fff', { contour: false }); }
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
      c.fillStyle = 'rgba(10,0,30,' + 0.85 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Arrivée : ' + S.circuit.nom, 800, 90, 64, '#ffd166', { contour: '#000', epaisseur: 10 });
      r.ordre.forEach(function (p, i) {
        var y = 160 + i * 112, x = 260 + (1 - F.ease.back(Math.min(1, Math.max(0, q * 2 - i * 0.15)))) * -1600;
        c.fillStyle = p.humain ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'; F.rr(c, x, y, 1080, 96, 24); c.fill();
        if (p.humain) { c.strokeStyle = p.couleur; c.lineWidth = 4; F.rr(c, x, y, 1080, 96, 24); c.stroke(); }
        F.texte(c, F.texteRang(i + 1), x + 60, y + 48, 44, i === 0 ? '#ffd166' : '#fff', { contour: false });
        dessinerKart(c, x + 170, y + 80, 0.9, p.couleur, 1.57, 0);
        F.texte(c, p.nom + (p.humain ? '' : ' 🤖'), x + 240, y + 48, 40, '#fff', { align: 'left', contour: false });
        F.texte(c, '+' + p.gain + ' pts', x + 860, y + 48, 36, '#80ed99', { align: 'right', contour: false });
        F.texte(c, p.pts + ' au total', x + 1050, y + 48, 30, '#ffd166', { align: 'right', contour: false });
      });
    }

    function titre(c) {
      var g = c.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, '#10002b'); g.addColorStop(1, '#7b2cbf');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      // route en perspective
      c.fillStyle = '#2b2d42'; c.beginPath(); c.moveTo(700, 420); c.lineTo(900, 420); c.lineTo(1500, 900); c.lineTo(100, 900); c.fill();
      c.strokeStyle = '#ffd166'; c.lineWidth = 8; c.setLineDash([40, 40]); c.lineDashOffset = -F.t * 300;
      c.beginPath(); c.moveTo(800, 420); c.lineTo(800, 900); c.stroke(); c.setLineDash([]);
      var t = F.t - S.t0;
      F.texte(c, 'TURBO KARTS', 800, 200 + Math.sin(t * 2) * 8, 150, '#ffd166', { contour: '#ff006e', epaisseur: 18 });
      F.texte(c, 'Course de karts · écran partagé · objets et turbos', 800, 310, 36, '#fff', { contour: false });
      L.joueurs.forEach(function (P, i) { dessinerKart(c, 800 + (i - (L.joueurs.length - 1) / 2) * 220, 760 + Math.sin(t * 6 + i) * 4, 2.2, P.couleur, 0, Math.sin(t * 2 + i)); });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit la course sur son téléphone…', 800, 520, 32, '#fff', { contour: 'rgba(0,0,0,.5)', epaisseur: 6 });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      var g = c.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, '#10002b'); g.addColorStop(1, '#3c096c');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      F.texte(c, (S.nbCourses > 1 ? 'Grand Prix : ' : '') + f.ordre[0].nom + ' gagne !', 800, 110, 76, '#ffd166', { contour: '#ff006e', epaisseur: 12 });
      // podium
      var pod = [[800, 520, 1], [480, 600, 2], [1120, 650, 3]];
      pod.forEach(function (pp) {
        var p = f.ordre[pp[2] - 1];
        if (!p) return;
        c.fillStyle = ['#ffd166', '#dee2e6', '#cd7f32'][pp[2] - 1]; F.rr(c, pp[0] - 150, pp[1], 300, 900 - pp[1], 16); c.fill();
        F.texte(c, String(pp[2]), pp[0], pp[1] + 70, 90, '#1b1b2f', { contour: false });
        dessinerKart(c, pp[0], pp[1] - 4 - (pp[2] === 1 ? Math.abs(Math.sin(F.t * 6)) * 20 : 0), 2.8, p.couleur, 0, 0);
        F.texte(c, p.nom, pp[0], pp[1] - 240, 40, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 6 });
        F.texte(c, p.pts + ' pts', pp[0], pp[1] - 195, 30, '#ffd166', { contour: false });
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
    description: 'Course de karts en 3D, écran partagé, objets et turbos. Grand Prix sur 3 circuits !',
    min: 1, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
