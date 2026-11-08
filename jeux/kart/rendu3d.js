/*
 * Turbo Karts — rendu 3D avec three.js et les modèles libres de Kenney (CC0, voir CREDITS.md).
 * La simulation reste dans kart.js (coordonnées x, y du monde) ; ce fichier ne fait que l'affichage.
 * three.js n'est chargé qu'au lancement de Turbo Karts, pour ne pas ralentir le menu.
 */
var KartRendu = (function () {
  'use strict';

  var K = 20;          // 1 unité Kenney = 20 unités du monde
  var T = 10 * K;      // une case de circuit = une tuile Kenney de 10 × 10
  var MODELES = {
    course: ['track-straight', 'track-corner', 'track-finish', 'decoration-forest', 'decoration-tents', 'decoration-empty',
      'vehicle-truck-red', 'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-motorcycle'],
    ville: ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage', 'grass-trees',
      'grass-trees-tall', 'pavement', 'pavement-fountain', 'grass'],
    plateforme: ['block-coin', 'cloud', 'flag'],
    arene: ['column', 'column-damaged', 'statue', 'tree', 'banner', 'wall', 'wall-gate', 'floor', 'floor-detail', 'bricks', 'trophy']
  };
  var pret = null;     // promesse de chargement
  var R = null;        // WebGLRenderer (partagé, voir jeux/commun/kenney3d.js)
  var glCanvas = null;
  var qualite = 0.75;  // fraction de la résolution 1600 × 900 (ajustée selon la vitesse de la télé)
  var mesures = [];

  function preparer() {
    if (pret) return pret;
    var noms = [];
    Object.keys(MODELES).forEach(function (kit) { MODELES[kit].forEach(function (n) { noms.push(kit + '/' + n); }); });
    pret = Kenney3D.charger(noms).then(function () { R = Kenney3D.renderer(); glCanvas = Kenney3D.canvas(); });
    return pret;
  }

  function copie(nom, echelle) { return Kenney3D.copie(nom, echelle); }


  var MODELE_ROBOT = { '#f6c90e': 'vehicle-truck-yellow', '#3bb273': 'vehicle-truck-green', '#9b5de5': 'vehicle-truck-purple', '#e63946': 'vehicle-truck-red', '#00b4d8': 'moto' };
  function vehicule(couleur, humain) {
    var g = new THREE.Group(), corps;
    if (!humain && MODELE_ROBOT[couleur] === 'moto') corps = copie('course/vehicle-motorcycle', K * 1.25);
    else if (!humain && MODELE_ROBOT[couleur]) corps = copie('course/' + MODELE_ROBOT[couleur], K);
    else {
      corps = Kenney3D.recolorer(copie('course/vehicle-truck-red', K), couleur);
    }
    corps.position.y = 0.3 * K;
    g.add(corps);
    // ombre douce sous le véhicule
    var ombre = new THREE.Mesh(new THREE.PlaneGeometry(1.7 * K, 3.1 * K), new THREE.MeshBasicMaterial({ map: textureOmbre(), transparent: true, depthWrite: false }));
    ombre.rotation.x = -Math.PI / 2; ombre.position.y = 0.06 * K;
    g.add(ombre);
    // bouclier
    var bouclier = new THREE.Mesh(new THREE.SphereGeometry(2.1 * K, 16, 10), new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.3, depthWrite: false }));
    bouclier.position.y = 0.7 * K; bouclier.visible = false;
    g.add(bouclier);
    g.userData = { corps: corps, bouclier: bouclier };
    return g;
  }

  var _ombre = null;
  function textureOmbre() {
    if (_ombre) return _ombre;
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    _ombre = new THREE.CanvasTexture(cv);
    return _ombre;
  }

  var _turbo = null;
  function textureTurbo() {
    if (_turbo) return _turbo;
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#ffbe0b'; c.fillRect(0, 0, 64, 128);
    c.fillStyle = '#fb5607';
    for (var v = 0; v < 3; v++) {
      var y = 14 + v * 38;
      c.beginPath(); c.moveTo(8, y + 26); c.lineTo(32, y); c.lineTo(56, y + 26); c.lineTo(46, y + 32); c.lineTo(32, y + 16); c.lineTo(18, y + 32); c.closePath(); c.fill();
    }
    _turbo = new THREE.CanvasTexture(cv);
    _turbo.encoding = THREE.sRGBEncoding;
    return _turbo;
  }

  // ---------- Circuits en tuiles ----------
  var DIRS = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] };

  // à partir d'un tracé « RRRDDLL… » : cases, tuiles et ligne centrale
  function grille(k) {
    if (k.cases) return;
    var x = k.depart[0], y = k.depart[1], cases = [];
    for (var i = 0; i < k.trace.length; i++) {
      var d = DIRS[k.trace[i]];
      cases.push({ x: x, y: y, sortie: d });
      x += d[0]; y += d[1];
    }
    if (x !== k.depart[0] || y !== k.depart[1]) console.warn('Circuit non fermé :', k.id, x, y);
    cases.forEach(function (c, i) { c.entree = cases[(i - 1 + cases.length) % cases.length].sortie; });
    var occupe = {};
    cases.forEach(function (c) { occupe[c.x + ',' + c.y] = c; });
    k.cases = cases; k.occupe = occupe;
    var maxX = 0, maxY = 0;
    cases.forEach(function (c) { maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y); });
    k.monde = (Math.max(maxX, maxY) + 2) * T;
    // ligne centrale brute (un point tous les ~5 unités)
    var brut = [];
    function centre(c) { return [(c.x + 0.5) * T, (c.y + 0.5) * T]; }
    var n = cases.length;
    for (var j = 0; j <= n; j++) {
      var c = cases[j % n], m = centre(c), e = c.entree, s = c.sortie;
      var debut = j === 0 ? 0.5 : 0, fin = j === n ? 0.5 : 1;
      if (e[0] === s[0] && e[1] === s[1]) {
        for (var t = debut; t < fin; t += 0.02) brut.push([m[0] + e[0] * T * (t - 0.5), m[1] + e[1] * T * (t - 0.5)]);
      } else {
        var px = m[0] + (-e[0] + s[0]) * T / 2, py = m[1] + (-e[1] + s[1]) * T / 2;
        var a0 = Math.atan2(m[1] - e[1] * T / 2 - py, m[0] - e[0] * T / 2 - px);
        var a1 = Math.atan2(m[1] + s[1] * T / 2 - py, m[0] + s[0] * T / 2 - px);
        var da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
        for (var u = debut; u < fin; u += 0.02) brut.push([px + Math.cos(a0 + da * u) * T / 2, py + Math.sin(a0 + da * u) * T / 2]);
      }
    }
    k.brut = brut;
  }

  // angle (rotation.y) pour qu'une tuile ouverte sur (a, b) au repos le soit sur (v1, v2)
  function angleTuile(ouvertes, v1, v2) {
    for (var q = 0; q < 4; q++) {
      var th = q * Math.PI / 2, ok = ouvertes.every(function (o) {
        var rx = Math.round(o[0] * Math.cos(th) + o[1] * Math.sin(th)), rz = Math.round(-o[0] * Math.sin(th) + o[1] * Math.cos(th));
        return (rx === v1[0] && rz === v1[1]) || (rx === v2[0] && rz === v2[1]);
      });
      if (ok) return th;
    }
    return 0;
  }

  // fusionne les maillages d'un groupe : un maillage par morceau de terrain et par texture
  function fusionner(groupe, morceau) {
    groupe.updateMatrixWorld(true);
    var paquets = {}, v = new THREE.Vector3();
    groupe.traverse(function (o) {
      if (!o.isMesh) return;
      var g = o.geometry, pos = g.attributes.position;
      if (!g.boundingSphere) g.computeBoundingSphere();
      v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      var cle = Math.floor(v.x / morceau) + ',' + Math.floor(v.z / morceau) + ',' + (o.material.map ? o.material.map.uuid : o.material.color.getHex());
      var pq = paquets[cle] || (paquets[cle] = { mat: o.material, liste: [], n: 0, ni: 0 });
      pq.liste.push(o); pq.n += pos.count; pq.ni += g.index ? g.index.count : pos.count;
    });
    var sortie = [], normale = new THREE.Matrix3();
    Object.keys(paquets).forEach(function (cle) {
      var pq = paquets[cle];
      var P = new Float32Array(pq.n * 3), N = new Float32Array(pq.n * 3), U = new Float32Array(pq.n * 2);
      var I = pq.n > 65000 ? new Uint32Array(pq.ni) : new Uint16Array(pq.ni);
      var base = 0, bi = 0;
      pq.liste.forEach(function (o) {
        var g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
        normale.getNormalMatrix(o.matrixWorld);
        for (var i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          P[(base + i) * 3] = v.x; P[(base + i) * 3 + 1] = v.y; P[(base + i) * 3 + 2] = v.z;
          if (nor) {
            v.fromBufferAttribute(nor, i).applyMatrix3(normale).normalize();
            N[(base + i) * 3] = v.x; N[(base + i) * 3 + 1] = v.y; N[(base + i) * 3 + 2] = v.z;
          }
          if (uv) { U[(base + i) * 2] = uv.getX(i); U[(base + i) * 2 + 1] = uv.getY(i); }
        }
        if (g.index) for (var j = 0; j < g.index.count; j++) I[bi++] = g.index.getX(j) + base;
        else for (var q = 0; q < pos.count; q++) I[bi++] = q + base;
        base += pos.count;
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      geo.setIndex(new THREE.BufferAttribute(I, 1));
      geo.computeBoundingSphere();
      sortie.push(new THREE.Mesh(geo, pq.mat));
    });
    return sortie;
  }

  var scenes = {};
  function aleaDe(graine) { return function () { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }; }

  function construire(k) {
    if (scenes[k.id]) return scenes[k.id];
    grille(k);
    var sc = new THREE.Scene();
    var th = k.theme;
    sc.background = new THREE.Color(th.ciel);
    sc.fog = new THREE.Fog(th.ciel, 700, 1500);
    sc.add(new THREE.HemisphereLight(0xffffff, th.solLumiere || 0x8a9a8a, 0.85));
    var soleil = new THREE.DirectionalLight(0xffffff, 0.75);
    soleil.position.set(0.4, 1, 0.6);
    sc.add(soleil);
    // sol
    var taille = k.monde + 40 * T;
    var sol = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), new THREE.MeshLambertMaterial({ color: th.sol }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(k.monde / 2, -0.5, k.monde / 2);
    sc.add(sol);
    // tout le décor fixe va dans « fixe », puis il est fusionné par morceaux (beaucoup moins d'appels de dessin)
    var fixe = new THREE.Group();
    // piste
    k.cases.forEach(function (c, i) {
      var e = c.entree, s = c.sortie, tuile;
      if (e[0] === s[0] && e[1] === s[1]) {
        tuile = copie('course/' + (i === 0 ? 'track-finish' : 'track-straight'), K);
        tuile.rotation.y = e[0] !== 0 ? Math.PI / 2 : 0;
      } else {
        tuile = copie('course/track-corner', K);
        tuile.rotation.y = angleTuile([[-1, 0], [0, 1]], [-e[0], -e[1]], s);
      }
      tuile.position.set((c.x + 0.5) * T, 0, (c.y + 0.5) * T);
      fixe.add(tuile);
    });
    // décor sur toutes les cases libres (le circuit + une bordure de 4 cases)
    var alea = aleaDe(k.graine || 5), maxC = Math.round(k.monde / T);
    for (var gx = -3; gx < maxC + 3; gx++) for (var gy = -3; gy < maxC + 3; gy++) {
      if (k.occupe[gx + ',' + gy]) continue;
      var pres = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return k.occupe[(gx + d[0]) + ',' + (gy + d[1])]; });
      th.decor(fixe, (gx + 0.5) * T, (gy + 0.5) * T, alea, pres, gx, gy);
    }
    fusionner(fixe, 2 * T).forEach(function (m) { sc.add(m); });
    // nuages (cachés pendant le survol)
    var nuages = new THREE.Group();
    sc.add(nuages);
    for (var n = 0; n < 14; n++) {
      var nu = copie('plateforme/cloud', K * (6 + alea() * 6));
      nu.scale.y *= 0.5;
      nu.position.set(alea() * k.monde * 1.6 - k.monde * 0.3, 300 + alea() * 250, alea() * k.monde * 1.6 - k.monde * 0.3);
      nuages.add(nu);
    }
    // cubes à objets
    var boites = k.boites.map(function (b) {
      var o = copie('plateforme/block-coin', K * 1.4);
      o.position.set(b.x, 0.7 * K, b.y);
      sc.add(o);
      return o;
    });
    // plaques turbo
    k.turbos.forEach(function (t) {
      var g = new THREE.Group();
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * K, 4 * K), new THREE.MeshBasicMaterial({ map: textureTurbo() }));
      pl.rotation.x = -Math.PI / 2; pl.rotation.z = Math.PI;
      g.add(pl);
      g.rotation.y = Math.PI / 2 - t.a;
      g.position.set(t.x, 0.8, t.y);
      sc.add(g);
    });
    var cams = [0, 1, 2, 3].map(function () { return new THREE.PerspectiveCamera(62, 16 / 9, 4, 1550); });
    var res = { scene: sc, nuages: nuages, boites: boites, cams: cams, vehicules: new Map(), objets: [] };
    scenes[k.id] = res;
    return res;
  }

  // ---------- Thèmes ----------
  function poser(sc, nom, x, y, z, echelle, rot) {
    var o = copie(nom, echelle);
    o.position.set(x, y, z);
    o.rotation.y = rot || 0;
    sc.add(o);
    return o;
  }
  var THEMES = {
    foret: {
      ciel: '#8fd3ff', sol: '#5bbf7f', solLumiere: 0x7aa37a,
      decor: function (sc, x, z, alea, pres, gx, gy) {
        var r = alea(), rot = Math.floor(alea() * 4) * Math.PI / 2;
        if (gy === 0 && gx >= 0 && gx <= 3) poser(sc, 'course/decoration-tents', x, 0, z, K, 0);
        else if (r < (pres ? 0.6 : 0.4)) poser(sc, 'course/decoration-forest', x, 0, z, K, rot);
        else poser(sc, 'course/decoration-empty', x, 0, z, K, rot);
      }
    },
    ville: {
      ciel: '#a8dcff', sol: '#9aa3b5', solLumiere: 0x8890a0,
      decor: function (sc, x, z, alea, pres) {
        // 4 petits lots par case
        var lots = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage', 'grass-trees', 'grass-trees-tall', 'pavement-fountain', 'pavement', 'grass'];
        for (var i = 0; i < 4; i++) {
          var lx = x + (i % 2 ? 1 : -1) * T / 4, lz = z + (i < 2 ? -1 : 1) * T / 4, r = alea();
          var nom = r < 0.62 ? lots[Math.floor(alea() * 5)] : lots[5 + Math.floor(alea() * 5)];
          if (pres && r < 0.62 && alea() < 0.5) nom = 'grass-trees';
          poser(sc, 'ville/' + nom, lx, 0, lz, T / 2, Math.floor(alea() * 4) * Math.PI / 2);
        }
      }
    },
    arene: {
      ciel: '#ffd6a5', sol: '#f2c48d', solLumiere: 0xc9a27a,
      decor: function (sc, x, z, alea, pres) {
        poser(sc, 'arene/floor-detail', x, 0, z, T, Math.floor(alea() * 4) * Math.PI / 2);
        var r = alea(), E = 2.4 * K;
        if (pres) {
          // colonnes et statues le long de la piste
          poser(sc, 'arene/' + (r < 0.7 ? 'column' : 'column-damaged'), x - T / 4, 0, z - T / 4, E * 1.6);
          poser(sc, 'arene/' + (alea() < 0.5 ? 'statue' : 'banner'), x + T / 4, 0, z + T / 4, E * 1.4, alea() * 6);
          if (alea() < 0.4) poser(sc, 'arene/tree', x + T / 4, 0, z - T / 4, E * 1.5);
        } else if (r < 0.35) {
          for (var w = -2; w <= 2; w++) poser(sc, 'arene/' + (w === 0 ? 'wall-gate' : 'wall'), x + w * E * 0.9, 0, z, E * 0.9 * 1.0, 0);
        } else if (r < 0.7) {
          for (var t = 0; t < 3; t++) poser(sc, 'arene/tree', x + (alea() - 0.5) * T * 0.7, 0, z + (alea() - 0.5) * T * 0.7, E * (1.3 + alea()));
        } else {
          poser(sc, 'arene/statue', x, 0, z, E * 2.2, alea() * 6);
          poser(sc, 'arene/bricks', x + T / 3, 0, z + T / 4, E);
        }
      }
    }
  };

  // ---------- Image ----------
  // si la télé rame, on baisse la résolution puis la distance de vue (et on remonte si tout va bien)
  var NIVEAUX = [[0.75, 1550], [0.65, 1400], [0.55, 1250], [0.5, 1100], [0.42, 950]], niveau = 0, portee = 1550;
  function ajusterQualite(dtRendu) {
    mesures.push(dtRendu);
    if (mesures.length < 40) return;
    mesures.sort(function (a, b) { return a - b; });
    var med = mesures[20];
    mesures = [];
    if (med > 24 && niveau < NIVEAUX.length - 1) niveau++;
    else if (med < 10 && niveau > 0) niveau--;
    qualite = NIVEAUX[niveau][0]; portee = NIVEAUX[niveau][1];
  }

  function synchroniser(res, S) {
    S.pilotes.forEach(function (p) {
      var v = res.vehicules.get(p);
      if (!v) { v = vehicule(p.couleur, p.humain); res.vehicules.set(p, v); res.scene.add(v); }
      v.position.set(p.x, 0, p.y);
      var spin = p.tourne > 0 ? p.tourne * 11 : 0;
      v.rotation.y = Math.PI / 2 - p.a - spin;
      v.userData.corps.rotation.z = -p.virage * 0.06 * Math.min(1, p.v / 200);
      v.userData.corps.position.y = 0.3 * K + (p.v > 10 ? Math.abs(Math.sin(p.x * 0.05 + p.y * 0.05)) * 0.6 : 0);
      v.userData.bouclier.visible = p.bouclier > 0;
    });
    res.vehicules.forEach(function (v, p) { if (S.pilotes.indexOf(p) < 0) { res.scene.remove(v); res.vehicules.delete(p); } });
    var k = S.circuit, tps = performance.now() / 1000;
    k.boites.forEach(function (b, i) {
      var o = res.boites[i];
      o.visible = b.retour <= 0;
      o.rotation.y = tps * 1.5 + i;
      o.position.y = 0.7 * K + Math.sin(tps * 3 + i) * 4;
    });
    // objets posés / lancés
    while (res.objets.length < S.objets.length) {
      var g = new THREE.Group();
      var huile = new THREE.Mesh(new THREE.CircleGeometry(1.5 * K, 16), new THREE.MeshBasicMaterial({ color: 0x1b1b2f, transparent: true, opacity: 0.85 }));
      huile.rotation.x = -Math.PI / 2; huile.position.y = 1.2;
      var reflet = new THREE.Mesh(new THREE.CircleGeometry(0.5 * K, 12), new THREE.MeshBasicMaterial({ color: 0x8338ec, transparent: true, opacity: 0.5 }));
      reflet.rotation.x = -Math.PI / 2; reflet.position.set(-0.4 * K, 1.4, -0.3 * K);
      var huileG = new THREE.Group(); huileG.add(huile); huileG.add(reflet);
      var missile = new THREE.Group();
      var corpsM = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * K, 0.35 * K, 1.6 * K, 10), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
      corpsM.rotation.x = Math.PI / 2;
      var nez = new THREE.Mesh(new THREE.ConeGeometry(0.35 * K, 0.7 * K, 10), new THREE.MeshLambertMaterial({ color: 0xf1faee }));
      nez.rotation.x = Math.PI / 2; nez.position.z = 1.15 * K;
      var feu = new THREE.Mesh(new THREE.SphereGeometry(0.3 * K, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
      feu.position.z = -0.9 * K;
      missile.add(corpsM); missile.add(nez); missile.add(feu); missile.position.y = 0.8 * K;
      g.add(huileG); g.add(missile);
      g.userData = { huile: huileG, missile: missile };
      res.scene.add(g); res.objets.push(g);
    }
    res.objets.forEach(function (g, i) {
      var o = S.objets[i];
      g.visible = !!o;
      if (!o) return;
      g.position.set(o.x, 0, o.y);
      g.userData.huile.visible = o.type === 'huile';
      g.userData.missile.visible = o.type === 'missile';
      if (o.type === 'missile') g.rotation.y = Math.PI / 2 - o.a;
    });
  }

  function placerCamera(cam, p, w, h) {
    cam.aspect = w / h;
    var D = 7.4 * K, H = 3.6 * K, ca = Math.cos(p.camA), sa = Math.sin(p.camA);
    cam.fov = 62 + (p.turbo > 0 ? 8 : 0);
    cam.updateProjectionMatrix();
    cam.position.set(p.x - ca * D, H, p.y - sa * D);
    cam.lookAt(p.x + ca * 4 * K, 0.4 * K, p.y + sa * 4 * K);
  }

  // dessine toutes les vues dans c (déjà en coordonnées virtuelles 1600 × 900)
  // vues : [{p, x, y, w, h}] ; renvoie pour chaque vue la position écran des autres pilotes (étiquettes)
  function dessiner(c, S, vues) {
    var t0 = performance.now();
    var res = construire(S.circuit);
    synchroniser(res, S);
    var W = Math.round(1600 * qualite), H = Math.round(900 * qualite), e = qualite;
    if (glCanvas.width !== W || glCanvas.height !== H) R.setSize(W, H, false);
    R.setScissorTest(false); R.clear(); R.setScissorTest(true);
    var etiquettes = [], v3 = new THREE.Vector3();
    res.scene.fog.near = portee * 0.45; res.scene.fog.far = portee;
    vues.forEach(function (v, i) {
      var cam = res.cams[i];
      cam.far = portee;
      placerCamera(cam, v.p, v.w, v.h);
      var x = Math.round(v.x * e), y = Math.round((900 - v.y - v.h) * e), w = Math.round(v.w * e), h = Math.round(v.h * e);
      R.setViewport(x, y, w, h); R.setScissor(x, y, w, h);
      R.render(res.scene, cam);
      var liste = [];
      S.pilotes.forEach(function (o) {
        if (o === v.p) return;
        v3.set(o.x, 2.4 * K, o.y).project(cam);
        if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) return;
        var dist = Math.hypot(o.x - v.p.x, o.y - v.p.y);
        if (dist > 1200) return;
        liste.push({ o: o, x: v.x + (v3.x + 1) / 2 * v.w, y: v.y + (1 - v3.y) / 2 * v.h, d: dist });
      });
      etiquettes.push(liste);
    });
    c.drawImage(glCanvas, 0, 0, 1600, 900);
    ajusterQualite(performance.now() - t0);
    return etiquettes;
  }

  // vue de présentation : caméra qui tourne autour du circuit
  function survol(c, k, t) {
    var res = construire(k);
    var W = Math.round(1600 * qualite), H = Math.round(900 * qualite);
    if (glCanvas.width !== W || glCanvas.height !== H) R.setSize(W, H, false);
    var cam = res.cams[0], m = k.monde / 2, r = k.monde * 0.62;
    cam.aspect = 16 / 9; cam.fov = 50; cam.far = 6000; cam.updateProjectionMatrix();
    cam.position.set(m + Math.cos(t * 0.12) * r, k.monde * 0.42, m + Math.sin(t * 0.12) * r);
    cam.lookAt(m, 0, m);
    R.setViewport(0, 0, W, H); R.setScissor(0, 0, W, H);
    R.clear();
    res.nuages.visible = false; res.scene.fog.near = 2500; res.scene.fog.far = 5000;
    R.render(res.scene, cam);
    res.nuages.visible = true;
    c.drawImage(glCanvas, 0, 0, 1600, 900);
  }

  // petite image d'un véhicule (pour les menus, résultats et podium)
  var portraits = {};
  var scPortrait = null, camPortrait = null;
  function portrait(couleur, humain) {
    var cle = couleur + (humain ? 'h' : 'r');
    if (portraits[cle]) return portraits[cle];
    if (!scPortrait) {
      scPortrait = new THREE.Scene();
      scPortrait.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1));
      var d = new THREE.DirectionalLight(0xffffff, 0.7); d.position.set(1, 2, 1.5); scPortrait.add(d);
      camPortrait = new THREE.PerspectiveCamera(30, 1, 1, 1000);
      camPortrait.position.set(3.4 * K, 2.6 * K, 4.6 * K); camPortrait.lookAt(0, 0.6 * K, 0);
    }
    var v = vehicule(couleur, humain);
    v.rotation.y = 0.5;
    scPortrait.add(v);
    var taille = 256;
    if (glCanvas.width !== taille || glCanvas.height !== taille) R.setSize(taille, taille, false);
    R.setViewport(0, 0, taille, taille); R.setScissor(0, 0, taille, taille);
    R.setClearColor(0x000000, 0); R.clear();
    R.render(scPortrait, camPortrait);
    R.setClearColor(0x000000, 1);
    var cv = document.createElement('canvas'); cv.width = cv.height = taille;
    cv.getContext('2d').drawImage(glCanvas, 0, 0);
    scPortrait.remove(v);
    portraits[cle] = cv;
    return cv;
  }

  // mini-carte : la ligne centrale dessinée une fois
  function carte(k) {
    if (k.carte) return k.carte;
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var c = cv.getContext('2d'), e = 256 / k.monde;
    c.lineJoin = 'round'; c.lineCap = 'round';
    function chemin() { c.beginPath(); k.centre.forEach(function (p, j) { if (j) c.lineTo(p[0] * e, p[1] * e); else c.moveTo(p[0] * e, p[1] * e); }); c.closePath(); }
    chemin(); c.strokeStyle = '#fff'; c.lineWidth = 16; c.stroke();
    chemin(); c.strokeStyle = '#3d405b'; c.lineWidth = 10; c.stroke();
    var p0 = k.centre[0];
    c.fillStyle = '#ffd166'; c.beginPath(); c.arc(p0[0] * e, p0[1] * e, 6, 0, 7); c.fill();
    k.carte = cv;
    return cv;
  }

  return {
    K: K, T: T, THEMES: THEMES,
    preparer: preparer, grille: grille, construire: construire, dessiner: dessiner, survol: survol,
    portrait: portrait, carte: carte,
    estPret: function () { return !!R; },
    niveau: function (n) { if (n !== undefined) { niveau = n; qualite = NIVEAUX[n][0]; portee = NIVEAUX[n][1]; } return niveau; },
    infos: function () { return { qualite: qualite, rendu: R && R.info.render, memoire: R && R.info.memory }; }
  };
})();
