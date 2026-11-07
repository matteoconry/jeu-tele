/*
 * Fiesta des Îles — le plateau : l'île, les cases, le décor, la caméra.
 * Monde virtuel de 1600 × 900. Le décor fixe est pré-dessiné une fois dans une image hors écran.
 */
(function (F) {
  'use strict';

  var LW = 1600, LH = 900;
  var CX = 800, CY = 470;

  // Types de cases
  F.CASES = {
    depart: { nom: 'Départ', couleur: '#ffffff', bord: '#9aa5b1' },
    bleu: { nom: 'Bonus', couleur: '#3a86ff', bord: '#1d4fa8' },
    rouge: { nom: 'Piège', couleur: '#ef476f', bord: '#9e1f42' },
    chance: { nom: 'Surprise', couleur: '#06d6a0', bord: '#04815f' },
    duel: { nom: 'Duel', couleur: '#9b5de5', bord: '#5b2a9a' }
  };

  // ---------- Construction du chemin ----------
  // Boucle principale de 28 cases + raccourci de 9 cases (de la case 7 à la case 21) au pied du volcan.
  var BOUCLE = 'DBBRBCBBDBBRBCBBRBDBBCBRBBCB';
  var RACCOURCI = 'RCBDRBCRB';
  var LETTRE = { D: 'duel', B: 'bleu', R: 'rouge', C: 'chance' };

  F.construirePlateau = function () {
    var cases = [];
    var n = BOUCLE.length;
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + i * 2 * Math.PI / n;
      var w = 1 + 0.045 * Math.sin(3 * a + 0.6) + 0.03 * Math.sin(5 * a);
      cases.push({
        id: i, x: CX + Math.cos(a) * 545 * w, y: CY + 10 + Math.sin(a) * 292 * w,
        type: i === 0 ? 'depart' : LETTRE[BOUCLE.charAt(i)], suivantes: [(i + 1) % n]
      });
    }
    var A = cases[7], B = cases[21];
    var base = n;
    for (var k = 0; k < RACCOURCI.length; k++) {
      var p = (k + 1) / (RACCOURCI.length + 1);
      cases.push({
        id: base + k, x: F.lerp(A.x, B.x, p), y: F.lerp(A.y, B.y, p) + Math.sin(p * Math.PI) * 95 + Math.sin(p * 9) * 12,
        type: LETTRE[RACCOURCI.charAt(k)], suivantes: [k === RACCOURCI.length - 1 ? 21 : base + k + 1], raccourci: true
      });
    }
    cases[7].suivantes = [8, base]; // embranchement
    return cases;
  };

  // Rayon de l'île selon l'angle (forme organique)
  function rayonIle(a, f) {
    var w = 1 + 0.06 * Math.sin(3 * a + 1) + 0.04 * Math.sin(5 * a + 2) + 0.025 * Math.sin(8 * a);
    return { x: Math.cos(a) * 700 * w * f, y: Math.sin(a) * 395 * w * f };
  }
  function cheminIle(c, f, dx, dy) {
    c.beginPath();
    for (var i = 0; i <= 120; i++) {
      var r = rayonIle(i / 120 * Math.PI * 2, f);
      if (i === 0) c.moveTo(CX + r.x + (dx || 0), CY + r.y + (dy || 0)); else c.lineTo(CX + r.x + (dx || 0), CY + r.y + (dy || 0));
    }
    c.closePath();
  }
  F.cheminIle = cheminIle;

  // ---------- Décor pré-dessiné ----------
  F.dessinerDecor = function (cases, echelle) {
    // Marge autour du monde pour que les hauts-fonds ne soient pas coupés quand la caméra zoome.
    var M = F.MARGE_DECOR;
    var cv = document.createElement('canvas');
    cv.width = Math.round((LW + 2 * M) * echelle);
    cv.height = Math.round((LH + 2 * M) * echelle);
    var c = cv.getContext('2d');
    c.scale(echelle, echelle);
    c.translate(M, M);
    var rnd = F.graine(42);

    // Hauts-fonds turquoise autour de l'île
    c.save();
    c.filter = 'blur(18px)';
    cheminIle(c, 1.16); c.fillStyle = 'rgba(72, 202, 228, .55)'; c.fill();
    c.restore();
    cheminIle(c, 1.07); c.fillStyle = 'rgba(144, 224, 239, .55)'; c.fill();
    // Sable
    cheminIle(c, 1.0, 0, 10); c.fillStyle = '#d4a373'; c.fill();
    cheminIle(c, 1.0);
    var gs = c.createRadialGradient(CX, CY, 200, CX, CY, 720);
    gs.addColorStop(0, '#fbe7b5'); gs.addColorStop(1, '#f1d18a');
    c.fillStyle = gs; c.fill();
    // Herbe
    cheminIle(c, 0.86, 0, 6); c.fillStyle = '#4c956c'; c.fill();
    cheminIle(c, 0.86);
    var gh = c.createRadialGradient(CX, CY - 60, 50, CX, CY, 620);
    gh.addColorStop(0, '#95d5b2'); gh.addColorStop(0.6, '#74c69d'); gh.addColorStop(1, '#52b788');
    c.fillStyle = gh; c.fill();
    // Taches de jungle
    for (var j = 0; j < 26; j++) {
      var a = rnd() * Math.PI * 2, d = 0.25 + rnd() * 0.5, r = rayonIle(a, d);
      c.fillStyle = rnd() < 0.5 ? 'rgba(45,106,79,.35)' : 'rgba(183,228,199,.35)';
      c.beginPath(); c.ellipse(CX + r.x, CY + r.y, 30 + rnd() * 50, 18 + rnd() * 28, rnd() * 3, 0, 7); c.fill();
    }

    // Volcan
    dessinerVolcan(c, 800, 300);

    // Chemin de sable entre les cases
    c.lineCap = 'round'; c.lineJoin = 'round';
    function traits(largeur, couleur, decalY) {
      c.strokeStyle = couleur; c.lineWidth = largeur;
      cases.forEach(function (cs) {
        cs.suivantes.forEach(function (s) {
          var b = cases[s];
          c.beginPath(); c.moveTo(cs.x, cs.y + (decalY || 0)); c.lineTo(b.x, b.y + (decalY || 0)); c.stroke();
        });
      });
    }
    traits(34, 'rgba(120,80,40,.25)', 6);
    traits(30, '#f6e2b3');
    c.setLineDash([2, 16]);
    traits(5, 'rgba(160,110,60,.5)');
    c.setLineDash([]);

    // Palmiers et petits décors (à l'écart des cases)
    var objets = [];
    for (var p = 0; p < 140 && objets.length < 46; p++) {
      var ang = rnd() * Math.PI * 2, dist = 0.15 + rnd() * 0.8, rp = rayonIle(ang, dist);
      var x = CX + rp.x, y = CY + rp.y, libre = true;
      for (var q = 0; q < cases.length; q++) if (Math.hypot(cases[q].x - x, cases[q].y - y) < 62) { libre = false; break; }
      if (Math.hypot(x - 800, y - 300) < 170) libre = false;
      for (var o = 0; o < objets.length; o++) if (Math.hypot(objets[o].x - x, objets[o].y - y) < 46) { libre = false; break; }
      if (libre) objets.push({ x: x, y: y, type: rnd() < 0.62 ? 'palmier' : (rnd() < 0.5 ? 'buisson' : 'fleurs'), t: 0.8 + rnd() * 0.5, r: rnd() });
    }
    objets.sort(function (u, v) { return u.y - v.y; });
    objets.forEach(function (ob) {
      if (ob.type === 'palmier') F.palmier(c, ob.x, ob.y, ob.t, ob.r);
      else if (ob.type === 'buisson') buisson(c, ob.x, ob.y, ob.t);
      else fleurs(c, ob.x, ob.y, ob.r);
    });

    // Petits rochers dans l'eau
    for (var k = 0; k < 9; k++) {
      var ra = rnd() * Math.PI * 2, rr = rayonIle(ra, 1.12 + rnd() * 0.08);
      rocher(c, CX + rr.x, CY + rr.y, 10 + rnd() * 14);
    }
    // Ponton et cabane près du départ
    ponton(c, cases[0].x + 120, cases[0].y + 60);

    // Cases
    cases.forEach(function (cs) { F.dessinerCase(c, cs); });
    // Flèches de l'embranchement
    var e = cases[7];
    fleche(c, e.x + 30, e.y - 52, -Math.PI / 2.4);
    fleche(c, e.x + 52, e.y + 22, 0.35);
    return cv;
  };

  function dessinerVolcan(c, x, y) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.ellipse(x, y + 95, 200, 40, 0, 0, 7); c.fill();
    var g = c.createLinearGradient(x - 180, 0, x + 180, 0);
    g.addColorStop(0, '#7f5539'); g.addColorStop(0.55, '#9c6644'); g.addColorStop(1, '#5e3a24');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 190, y + 95);
    c.quadraticCurveTo(x - 110, y + 20, x - 52, y - 70);
    c.lineTo(x + 52, y - 70);
    c.quadraticCurveTo(x + 110, y + 20, x + 190, y + 95);
    c.closePath(); c.fill();
    // coulées de lave figées
    c.strokeStyle = 'rgba(255,120,60,.55)'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 20, y - 66); c.quadraticCurveTo(x - 40, y - 10, x - 70, y + 40); c.stroke();
    c.beginPath(); c.moveTo(x + 25, y - 66); c.quadraticCurveTo(x + 30, y - 20, x + 58, y + 20); c.stroke();
    // cratère
    c.fillStyle = '#3d2314';
    c.beginPath(); c.ellipse(x, y - 70, 54, 14, 0, 0, 7); c.fill();
    c.restore();
  }

  F.palmier = function (c, x, y, t, r) {
    t = t || 1;
    c.save();
    c.translate(x, y);
    c.scale(t, t);
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.beginPath(); c.ellipse(14, 4, 26, 8, 0, 0, 7); c.fill();
    // tronc courbé
    var pench = (r - 0.5) * 30;
    c.strokeStyle = '#8d6346'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(pench * 0.3, -40, pench, -78); c.stroke();
    c.strokeStyle = '#6f4e37'; c.lineWidth = 2;
    for (var i = 1; i < 6; i++) {
      var py = -i * 13, px = pench * Math.pow(i / 6, 1.5);
      c.beginPath(); c.moveTo(px - 4, py); c.lineTo(px + 4, py - 2); c.stroke();
    }
    // feuilles
    c.translate(pench, -80);
    for (var f = 0; f < 6; f++) {
      var a = f / 6 * Math.PI * 2 + r;
      c.save(); c.rotate(a);
      var gf = c.createLinearGradient(0, 0, 46, 0);
      gf.addColorStop(0, '#2d6a4f'); gf.addColorStop(1, '#52b788');
      c.fillStyle = gf;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(24, -16, 48, 6); c.quadraticCurveTo(24, -2, 0, 0); c.fill();
      c.restore();
    }
    c.fillStyle = '#6b4226';
    c.beginPath(); c.arc(-4, 5, 5, 0, 7); c.arc(5, 4, 5, 0, 7); c.arc(0, 9, 5, 0, 7); c.fill();
    c.restore();
  };
  function buisson(c, x, y, t) {
    c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(x, y + 8, 26 * t, 7, 0, 0, 7); c.fill();
    c.fillStyle = '#2d6a4f';
    c.beginPath(); c.arc(x - 12 * t, y, 13 * t, 0, 7); c.arc(x + 12 * t, y, 13 * t, 0, 7); c.arc(x, y - 9 * t, 15 * t, 0, 7); c.fill();
    c.fillStyle = '#40916c';
    c.beginPath(); c.arc(x - 4 * t, y - 12 * t, 8 * t, 0, 7); c.fill();
  }
  function fleurs(c, x, y, r) {
    var cols = ['#ff70a6', '#ffd670', '#ff9770', '#e9ff70'];
    for (var i = 0; i < 4; i++) {
      var fx = x + Math.cos(i * 2 + r * 6) * 14, fy = y + Math.sin(i * 2 + r * 6) * 8;
      c.fillStyle = cols[(i + Math.floor(r * 4)) % 4];
      for (var k = 0; k < 5; k++) { c.beginPath(); c.arc(fx + Math.cos(k * 1.256) * 4, fy + Math.sin(k * 1.256) * 4, 3.2, 0, 7); c.fill(); }
      c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(fx, fy, 2.4, 0, 7); c.fill();
    }
  }
  function rocher(c, x, y, r) {
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x, y + r * 0.4, r * 1.4, r * 0.45, 0, 0, 7); c.fill();
    c.fillStyle = '#6c757d'; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#adb5bd'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.22, 0, 0, 7); c.fill();
  }
  function ponton(c, x, y) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x - 6, y + 6, 130, 30);
    c.fillStyle = '#a47148'; c.fillRect(x, y, 130, 26);
    c.strokeStyle = '#7f5539'; c.lineWidth = 2;
    for (var i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x + i * 15, y); c.lineTo(x + i * 15, y + 26); c.stroke(); }
    c.fillStyle = '#6f4e37'; [0, 60, 120].forEach(function (d) { c.fillRect(x + d, y + 22, 8, 16); });
    c.restore();
  }
  function fleche(c, x, y, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#fff'; c.strokeStyle = '#1b1b2f'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-14, -7); c.lineTo(4, -7); c.lineTo(4, -15); c.lineTo(18, 0); c.lineTo(4, 15); c.lineTo(4, 7); c.lineTo(-14, 7); c.closePath();
    c.stroke(); c.fill();
    c.restore();
  }

  F.dessinerCase = function (c, cs, eclat) {
    var t = F.CASES[cs.type], x = cs.x, y = cs.y, R = 27;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.beginPath(); c.ellipse(x, y + 10, R + 3, R * 0.62, 0, 0, 7); c.fill();
    c.fillStyle = t.bord;
    c.beginPath(); c.ellipse(x, y + 6, R, R * 0.66, 0, 0, 7); c.fill();
    var g = c.createRadialGradient(x - 8, y - 8, 2, x, y, R);
    g.addColorStop(0, F.eclaircir(t.couleur, 0.45)); g.addColorStop(1, t.couleur);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, R, R * 0.66, 0, 0, 7); c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
    if (eclat) { c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,' + eclat + ')'; c.stroke(); }
    // icône
    var col = cs.type === 'depart' ? '#1b1b2f' : '#fff';
    if (cs.type === 'bleu') F.texte(c, '+3', x, y + 1, 19, col, { contour: 'rgba(0,0,0,.35)', epaisseur: 3 });
    else if (cs.type === 'rouge') F.texte(c, '−3', x, y + 1, 19, col, { contour: 'rgba(0,0,0,.35)', epaisseur: 3 });
    else if (cs.type === 'chance') F.texte(c, '?', x, y + 1, 24, col, { contour: 'rgba(0,0,0,.35)', epaisseur: 3 });
    else if (cs.type === 'depart') F.texte(c, 'GO', x, y + 1, 17, col, { contour: false });
    else if (cs.type === 'duel') {
      c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 10, y - 8); c.lineTo(x + 10, y + 8); c.moveTo(x + 10, y - 8); c.lineTo(x - 10, y + 8); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(x - 12, y + 3); c.lineTo(x - 5, y + 10); c.moveTo(x + 12, y + 3); c.lineTo(x + 5, y + 10); c.stroke();
    }
    c.restore();
  };

  // ---------- Mer animée (dessinée en direct, en coordonnées écran) ----------
  F.dessinerMer = function (c, W, H, cam) {
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0077b6'); g.addColorStop(1, '#023e8a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // reflets
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.lineWidth = Math.max(2, H / 300);
    c.lineCap = 'round';
    for (var i = 0; i < 26; i++) {
      var sx = ((i * 263) % 1000) / 1000, sy = ((i * 577) % 1000) / 1000;
      var x = (sx * W * 1.2 + F.t * 18 * (1 + (i % 3))) % (W * 1.2) - W * 0.1;
      var y = sy * H + Math.sin(F.t + i) * 6;
      var l = 20 + (i % 4) * 14;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 5, x + l, y); c.stroke();
    }
  };

  // Écume autour de l'île (en coordonnées monde)
  F.dessinerEcume = function (c) {
    var p = (Math.sin(F.t * 1.4) + 1) / 2;
    c.save();
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.3 * p) + ')';
    cheminIle(c, 1.015 + 0.02 * p); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,' + (0.18 * (1 - p)) + ')';
    c.lineWidth = 3;
    cheminIle(c, 1.05 + 0.03 * p); c.stroke();
    c.restore();
  };

  // Fumée et lueur du volcan
  F.dessinerVolcanVivant = function (c, colere) {
    var x = 800, y = 230;
    var lueur = 0.5 + 0.5 * Math.sin(F.t * 2.2);
    var g = c.createRadialGradient(x, y, 4, x, y, 60);
    g.addColorStop(0, 'rgba(255,170,60,' + (0.7 + 0.3 * lueur) + ')'); g.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, 60, 22, 0, 0, 7); c.fill();
    for (var i = 0; i < 6; i++) {
      var k = ((F.t * 0.25 + i / 6) % 1);
      c.fillStyle = 'rgba(230,230,230,' + (0.45 * (1 - k)) + ')';
      c.beginPath(); c.arc(x + Math.sin(k * 6 + i) * 20 + k * 40, y - 10 - k * 140, 12 + k * 30, 0, 7); c.fill();
    }
    if (colere) {
      c.fillStyle = 'rgba(255,100,40,.8)';
      for (var j = 0; j < 5; j++) { var u = (F.t * 1.5 + j * 0.2) % 1; c.beginPath(); c.arc(x + (j - 2) * 18 * u * 3, y - 80 * Math.sin(u * Math.PI), 6, 0, 7); c.fill(); }
    }
  };

  F.LW = LW; F.LH = LH;
  F.MARGE_DECOR = 220;
})(Fiesta);
