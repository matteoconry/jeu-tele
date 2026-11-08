/*
 * Fiesta Royale — le plateau : le royaume, les cases, le décor, la caméra.
 * Monde virtuel de 1600 × 900. Le décor fixe (prairie, chemin, cases, puis modèles 3D Kenney) est pré-dessiné une fois.
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
  // Boucle principale de 28 cases + raccourci de 9 cases (de la case 7 à la case 21) devant le château.
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

  // Contour du domaine (forme organique) : sert à placer la forêt autour du plateau
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

  // ---------- Décor : le Royaume (modèles 3D libres de Kenney, voir CREDITS.md) ----------
  var CHATEAU = { x: 800, y: 330 };
  F.CHATEAU = CHATEAU;
  F.MODELES_PLATEAU = ['arene/wall', 'arene/wall-gate', 'arene/wall-corner', 'arene/column', 'arene/statue', 'arene/banner', 'arene/tree',
    'arene/floor-detail', 'arene/trophy', 'ville/building-small-a', 'ville/building-small-b', 'ville/building-small-c', 'ville/building-small-d',
    'ville/building-garage', 'ville/grass-trees', 'ville/grass-trees-tall', 'ville/pavement-fountain', 'plateforme/flag', 'plateforme/grass'];
  var decor3d = false;
  F.decor3dPret = function () { return decor3d; };
  F.prechargerPlateau = function () {
    if (!window.Kenney3D || decor3d) return Promise.resolve();
    return Kenney3D.charger(F.MODELES_PLATEAU).then(function () { decor3d = true; }).catch(function (e) { console.warn('Décor 3D indisponible', e); });
  };

  // les objets 3D du plateau, placés pour ne jamais cacher une case
  function objetsDecor(cases) {
    var rnd = F.graine(42), objets = [];
    // une case est cachée si un objet est juste devant elle (plus bas à l'écran) et assez haut pour la recouvrir
    function cache(x, y, larg, haut) {
      for (var q = 0; q < cases.length; q++) {
        var cs = cases[q];
        if (Math.abs(cs.x - x) < larg / 2 + 34 && cs.y > y - haut - 34 && cs.y < y + 36) return true;
      }
      return false;
    }
    function libre(x, y, rayon) {
      for (var o = 0; o < objets.length; o++) if (Math.hypot(objets[o].x - x, objets[o].y - y) < rayon + (objets[o].r || 20)) return false;
      return true;
    }
    function poser(o, larg, haut) {
      if (cache(o.x, o.y, larg, haut) || !libre(o.x, o.y, larg / 2)) return false;
      o.r = larg / 2; objets.push(o); return true;
    }
    // le château au centre : remparts, tours, bannières, statue
    var C = CHATEAU, E = 44;
    objets.push({ nom: 'arene/floor-detail', x: C.x, y: C.y, echelle: 230, r: 0 });
    for (var k = -2; k <= 2; k++) {
      objets.push({ nom: k === 0 ? 'arene/wall-gate' : 'arene/wall', x: C.x + k * E, y: C.y + 70, echelle: E, r: 30 });
    }
    [-1, 1].forEach(function (s) {
      objets.push({ nom: 'arene/wall', x: C.x + s * 2.5 * E, y: C.y + 70 - 0.5 * E * 0.82 - 4, echelle: E, rot: Math.PI / 2, r: 30 });
      objets.push({ nom: 'arene/column', x: C.x + s * 2.6 * E, y: C.y + 74, echelle: E * 1.5, r: 30 });
      objets.push({ nom: 'arene/banner', x: C.x + s * 1.5 * E, y: C.y + 52, echelle: E * 1.2, r: 0 });
    });
    objets.push({ nom: 'arene/statue', x: C.x, y: C.y + 10, echelle: E * 1.3, r: 40 });
    // bosquets et maisons du village, à l'intérieur de la boucle
    var village = [[470, 300], [560, 250], [1040, 250], [1130, 300], [420, 650], [1180, 650], [600, 700], [1000, 700]];
    village.forEach(function (v, i) {
      var nom = 'ville/' + ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage', 'pavement-fountain'][i % 6];
      poser({ nom: nom, x: v[0] + (rnd() - 0.5) * 30, y: v[1] + (rnd() - 0.5) * 20, echelle: 95, rot: [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rnd() * 4)] }, 70, 110);
    });
    // la forêt tout autour (là où il y avait la mer)
    for (var p = 0; p < 1400 && objets.length < 240; p++) {
      var ang = rnd() * Math.PI * 2, dist = 0.25 + rnd() * 1.25, rp = rayonIle(ang, dist);
      var x = CX + rp.x, y = CY + rp.y;
      if (x < -200 || x > 1800 || y < -180 || y > 1100) continue;
      if (Math.abs(x - C.x) < 170 && Math.abs(y - C.y) < 130) continue;
      var t = 42 + rnd() * 22, haut = t * 1.92 * 0.6;
      poser({ nom: 'arene/tree', x: x, y: y, echelle: t, rot: rnd() * 6 }, t * 0.66, haut + 10);
    }
    // drapeaux au départ
    var d0 = cases[0];
    poser({ nom: 'plateforme/flag', x: d0.x - 46, y: d0.y - 6, echelle: 40 }, 20, 40);
    objets.sort(function (u, v) { return u.y - v.y; });
    return objets;
  }

  // ---------- Décor pré-dessiné ----------
  F.dessinerDecor = function (cases, echelle) {
    var M = F.MARGE_DECOR;
    var Wd = LW + 2 * M, Hd = LH + 2 * M;
    var cv = document.createElement('canvas');
    cv.width = Math.round(Wd * echelle);
    cv.height = Math.round(Hd * echelle);
    var c = cv.getContext('2d');
    var en3d = decor3d && window.Kenney3D && Kenney3D.pret();
    cv.sans3d = !en3d;
    c.save();
    c.scale(echelle, echelle);
    c.translate(M, M);
    var rnd = F.graine(42);
    // prairie
    var gh = c.createRadialGradient(CX, CY - 60, 80, CX, CY, 900);
    gh.addColorStop(0, '#9ad98a'); gh.addColorStop(0.55, '#79c26f'); gh.addColorStop(1, '#4f9a55');
    c.fillStyle = gh; c.fillRect(-M, -M, Wd, Hd);
    for (var j = 0; j < 40; j++) {
      var a = rnd() * Math.PI * 2, d = rnd() * 1.3, r = rayonIle(a, d);
      c.fillStyle = rnd() < 0.5 ? 'rgba(45,106,79,.18)' : 'rgba(220,255,200,.18)';
      c.beginPath(); c.ellipse(CX + r.x, CY + r.y, 40 + rnd() * 70, 24 + rnd() * 36, rnd() * 3, 0, 7); c.fill();
    }
    // cour pavée du château
    c.fillStyle = 'rgba(120,110,100,.35)';
    c.beginPath(); c.ellipse(CHATEAU.x, CHATEAU.y + 40, 170, 95, 0, 0, 7); c.fill();
    // chemin pavé entre les cases
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
    traits(36, 'rgba(60,50,40,.28)', 6);
    traits(32, '#cfc6b8');
    c.setLineDash([10, 9]);
    traits(26, '#e3dccf');
    c.setLineDash([]);
    // cases
    cases.forEach(function (cs) { F.dessinerCase(c, cs); });
    var e = cases[7];
    fleche(c, e.x + 30, e.y - 52, -Math.PI / 2.4);
    fleche(c, e.x + 52, e.y + 22, 0.35);
    c.restore();
    // objets 3D par-dessus (arbres, maisons, château)
    if (en3d) {
      try {
        var img = Kenney3D.vueOblique(objetsDecor(cases), { x0: -M, y0: -M, largeur: Wd, hauteur: Hd, echelle: echelle });
        c.drawImage(img, 0, 0);
      } catch (err) { console.warn('Décor 3D :', err); cv.sans3d = true; }
    }
    return cv;
  };

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

  // ---------- Fond hors du plateau (forêt sombre) ----------
  F.dessinerMer = function (c, W, H) {
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2f6b3a'); g.addColorStop(1, '#1f4d2b');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  };
  F.dessinerEcume = function () {};

  // Le château : torches qui brillent, et éclairs quand l'orage gronde
  F.dessinerVolcanVivant = function (c, colere) {
    var C = CHATEAU;
    [-1, 1].forEach(function (s) {
      var x = C.x + s * 114, y = C.y - 10, l = 0.6 + 0.4 * Math.sin(F.t * 9 + s);
      var g = c.createRadialGradient(x, y, 2, x, y, 26);
      g.addColorStop(0, 'rgba(255,200,90,' + (0.75 * l) + ')'); g.addColorStop(1, 'rgba(255,140,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill();
    });
    if (colere) {
      var f = Math.random();
      if (f < 0.35) { c.fillStyle = 'rgba(255,255,255,' + (0.25 * f / 0.35) + ')'; c.fillRect(-400, -400, 2400, 1700); }
      c.strokeStyle = 'rgba(255,240,150,.95)'; c.lineWidth = 6; c.lineJoin = 'round';
      c.beginPath(); var x = C.x + (Math.random() - 0.5) * 200, y = C.y - 260; c.moveTo(x, y);
      for (var i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 50; y += 40; c.lineTo(x, y); }
      c.stroke();
    }
  };

  F.LW = LW; F.LH = LH;
  F.MARGE_DECOR = 220;
})(Fiesta);
