/*
 * Kenney3D — chargement des modèles 3D libres de Kenney (CC0, voir CREDITS.md) et rendu avec three.js.
 * Partagé par tous les jeux : un seul contexte WebGL pour toute la console (important sur la télé).
 *
 *   Kenney3D.charger(['course/track-straight', 'plateforme/character', …])  -> Promise
 *   Kenney3D.copie('arene/tree', echelle)                                   -> Object3D
 *   Kenney3D.recolorer(obj, '#ff6b35', teintes)                             -> recolore les pixels de la palette
 *   Kenney3D.image(scene, camera, w, h)                                     -> canvas 2D (copie du rendu)
 *   Kenney3D.sprite(cle, fabriquer, opts)                                   -> canvas 2D mis en cache
 *
 * three.js n'est chargé qu'au premier appel, pour ne pas ralentir le menu.
 */
var Kenney3D = (function () {
  'use strict';

  var DOSSIER = 'assets/kenney/';
  var M = {}, enCours = {}, libs = null;
  var R = null, glCanvas = null;
  var materiaux = {};

  function script(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src + '?v=' + Date.now();
      s.onload = ok; s.onerror = function () { ko(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }

  function chargerLibs() {
    if (libs) return libs;
    libs = (window.THREE ? Promise.resolve() : script('lib/three.min.js'))
      .then(function () { return THREE.GLTFLoader ? null : script('lib/three-gltf.js'); })
      .then(function () {
        glCanvas = document.createElement('canvas');
        R = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
        R.outputEncoding = THREE.sRGBEncoding;
        R.setPixelRatio(1);
        R.setScissorTest(true);
        R.autoClear = false;
      });
    return libs;
  }

  // matériaux PBR -> Lambert (bien moins lourd), un seul matériau par kit (même palette de couleurs)
  function simplifier(obj, kit) {
    obj.traverse(function (o) {
      if (!o.isMesh) return;
      var m = o.material;
      if (m.map && !materiaux[kit]) {
        m.map.encoding = THREE.sRGBEncoding;
        materiaux[kit] = new THREE.MeshLambertMaterial({ map: m.map });
      }
      o.material = m.map ? materiaux[kit] : new THREE.MeshLambertMaterial({ color: m.color });
    });
    return obj;
  }

  function charger(noms) {
    return chargerLibs().then(function () {
      var L = new THREE.GLTFLoader();
      return Promise.all(noms.map(function (nom) {
        if (M[nom]) return null;
        if (!enCours[nom]) {
          enCours[nom] = new Promise(function (ok) {
            L.load(DOSSIER + nom + '.glb', function (g) { M[nom] = simplifier(g.scene, nom.split('/')[0]); ok(); },
              null, function (e) { console.warn('Modèle manquant', nom, e); ok(); });
          });
        }
        return enCours[nom];
      }));
    });
  }

  function copie(nom, echelle) {
    var o = M[nom];
    if (!o) return new THREE.Object3D();
    o = o.clone();
    if (echelle) o.scale.setScalar(echelle);
    return o;
  }

  // ---------- Recoloration ----------
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function rgb(h, s, l) {
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    if (!s) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  function hex(c) { var x = c.replace('#', ''); return [parseInt(x.substr(0, 2), 16), parseInt(x.substr(2, 2), 16), parseInt(x.substr(4, 2), 16)]; }

  // teintes : [min, max] des teintes (0-1) à remplacer ; par défaut les rouges
  var textures = {};
  function textureRecoloree(base, couleur, teintes) {
    teintes = teintes || [0.93, 0.06];
    var cle = base.uuid + couleur + teintes.join(',');
    if (textures[cle]) return textures[cle];
    var img0 = base.image;
    var cv = document.createElement('canvas'); cv.width = img0.width; cv.height = img0.height;
    var c = cv.getContext('2d'); c.drawImage(img0, 0, 0);
    var img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
    var cible = hsl.apply(null, hex(couleur));
    function dedans(h) { return teintes[0] <= teintes[1] ? h >= teintes[0] && h <= teintes[1] : h >= teintes[0] || h <= teintes[1]; }
    for (var i = 0; i < d.length; i += 4) {
      var h = hsl(d[i], d[i + 1], d[i + 2]);
      if (h[1] < 0.3 || !dedans(h[0])) continue;
      var l = Math.max(0.18, Math.min(0.85, h[2] + (cible[2] - 0.5) * 0.7));
      var n = rgb(cible[0], Math.max(0.35, cible[1]), l);
      d[i] = n[0]; d[i + 1] = n[1]; d[i + 2] = n[2];
    }
    c.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding; t.flipY = base.flipY;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    textures[cle] = t;
    return t;
  }
  function recolorer(obj, couleur, teintes) {
    obj.traverse(function (o) {
      if (!o.isMesh || !o.material.map) return;
      var m = o.material.clone();
      m.map = textureRecoloree(o.material.map, couleur, teintes);
      o.material = m;
    });
    return obj;
  }

  // ---------- Rendu vers une image 2D ----------
  function dimension(w, h) {
    if (glCanvas.width !== w || glCanvas.height !== h) R.setSize(w, h, false);
  }
  function image(scene, camera, w, h, fond) {
    dimension(w, h);
    R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h);
    if (fond === undefined) R.setClearColor(0x000000, 0); else R.setClearColor(fond, 1);
    R.clear();
    R.render(scene, camera);
    R.setClearColor(0x000000, 1);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(glCanvas, 0, 0);
    return cv;
  }

  function lumieres(scene, force) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a9a, 0.9 * (force || 1)));
    var d = new THREE.DirectionalLight(0xffffff, 0.75 * (force || 1));
    d.position.set(0.6, 1.4, 1.2);
    scene.add(d);
    return scene;
  }

  // Petite image d'un objet, vue de 3/4 et cadrée automatiquement.
  // opts : { taille, angle (rotation y), hauteur (élévation de la caméra en radians), marge }
  var sprites = {};
  function sprite(cle, fabriquer, opts) {
    if (sprites[cle]) return sprites[cle];
    opts = opts || {};
    var sc = lumieres(new THREE.Scene());
    var obj = fabriquer();
    obj.rotation.y = opts.angle !== undefined ? opts.angle : 0.6;
    sc.add(obj);
    var boite = new THREE.Box3().setFromObject(obj), centre = boite.getCenter(new THREE.Vector3());
    var rayon = boite.getSize(new THREE.Vector3()).length() / 2;
    var w = opts.largeur || opts.taille || 256, h = opts.hauteurPx || opts.taille || 256;
    var el = opts.hauteur !== undefined ? opts.hauteur : 0.45;
    var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, rayon * 10);
    var m = rayon * (opts.marge || 1.05), ar = w / h;
    cam.left = -m * ar; cam.right = m * ar; cam.top = m; cam.bottom = -m;
    cam.position.set(centre.x, centre.y + Math.sin(el) * rayon * 4, centre.z + Math.cos(el) * rayon * 4);
    cam.lookAt(centre);
    cam.updateProjectionMatrix();
    var cv = image(sc, cam, w, h);
    sprites[cle] = cv;
    return cv;
  }

  return {
    charger: charger, copie: copie, recolorer: recolorer, image: image, sprite: sprite, lumieres: lumieres,
    modele: function (nom) { return M[nom]; },
    pret: function () { return !!R; },
    renderer: function () { return R; },
    canvas: function () { return glCanvas; },
    dimension: dimension
  };
})();
