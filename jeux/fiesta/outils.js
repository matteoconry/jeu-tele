/*
 * Fiesta des Îles — outils communs : horloge, animations, dessin, particules, sons et musique.
 * Tout est dessiné et synthétisé dans le navigateur (aucune image ni fichier son à charger).
 */
var Fiesta = window.Fiesta || {};
(function (F) {
  'use strict';

  // Vitesse globale (les tests automatiques l'accélèrent, en jeu elle vaut 1).
  F.V = window.FIESTA_VITESSE || 1;
  F.POLICE = '"Fredoka", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
  F.t = 0; // horloge du jeu en secondes

  // ---------- Hasard ----------
  F.alea = function (a, b) { return a + Math.random() * (b - a); };
  F.entier = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  F.choisir = function (liste) { return liste[Math.floor(Math.random() * liste.length)]; };
  F.melanger = function (liste) {
    var l = liste.slice();
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = l[i]; l[i] = l[j]; l[j] = x; }
    return l;
  };
  // Générateur pseudo-aléatoire reproductible (pour le décor).
  F.graine = function (s) {
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  };

  // ---------- Courbes d'animation ----------
  F.ease = {
    lin: function (p) { return p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    back: function (p) { var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    rebond: function (p) {
      var n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    }
  };
  F.lerp = function (a, b, p) { return a + (b - a) * p; };
  F.borne = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  // ---------- Animations et attentes (avancent avec l'horloge du jeu) ----------
  var anims = [];
  var attentes = [];
  F.anim = function (duree, fn) {
    return new Promise(function (ok) {
      anims.push({ debut: F.t, duree: Math.max(0.001, duree / F.V), fn: fn, ok: ok });
    });
  };
  F.attendre = function (sec) {
    return new Promise(function (ok) { attentes.push({ fin: F.t + sec / F.V, ok: ok }); });
  };
  F.majAnims = function (dt) {
    F.t += dt;
    for (var i = anims.length - 1; i >= 0; i--) {
      var a = anims[i];
      var p = Math.min(1, (F.t - a.debut) / a.duree);
      try { a.fn(p); } catch (e) { console.error(e); }
      if (p >= 1) { anims.splice(i, 1); a.ok(); }
    }
    for (var j = attentes.length - 1; j >= 0; j--) {
      if (F.t >= attentes[j].fin) { var w = attentes[j]; attentes.splice(j, 1); w.ok(); }
    }
  };
  F.viderAnims = function () { anims = []; attentes = []; };

  // ---------- Dessin ----------
  F.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  F.texte = function (c, txt, x, y, taille, couleur, opts) {
    opts = opts || {};
    c.font = (opts.poids || 700) + ' ' + Math.round(taille) + 'px ' + F.POLICE;
    c.textAlign = opts.align || 'center';
    c.textBaseline = opts.base || 'middle';
    if (opts.contour !== false) {
      c.lineJoin = 'round';
      c.lineWidth = opts.epaisseur || Math.max(2, taille * 0.16);
      c.strokeStyle = opts.contour || 'rgba(0,0,0,.55)';
      c.strokeText(txt, x, y);
    }
    c.fillStyle = couleur || '#fff';
    c.fillText(txt, x, y);
  };

  // Étoile de mer (la récompense principale).
  F.etoile = function (c, x, y, r, rot, alpha) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    c.globalAlpha *= (alpha === undefined ? 1 : alpha);
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.48 : r;
      if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    var g = c.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#ffb347'); g.addColorStop(1, '#ff6f61');
    c.fillStyle = g;
    c.lineJoin = 'round';
    c.lineWidth = r * 0.14;
    c.strokeStyle = '#b8432f';
    c.stroke();
    c.fill();
    // petits points sur les branches
    c.fillStyle = 'rgba(255,255,255,.7)';
    for (var k = 0; k < 5; k++) {
      var b = -Math.PI / 2 + k * 2 * Math.PI / 5;
      c.beginPath(); c.arc(Math.cos(b) * r * 0.55, Math.sin(b) * r * 0.55, r * 0.07, 0, 7); c.fill();
    }
    c.restore();
  };

  // Coquillage (la monnaie).
  F.coquillage = function (c, x, y, r) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(-r * 0.25, r * 0.8);
    c.lineTo(-r, -r * 0.05);
    c.quadraticCurveTo(-r * 0.9, -r * 0.95, 0, -r);
    c.quadraticCurveTo(r * 0.9, -r * 0.95, r, -r * 0.05);
    c.lineTo(r * 0.25, r * 0.8);
    c.closePath();
    var g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#fff7e6'); g.addColorStop(1, '#f7b9a3');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = r * 0.12;
    c.strokeStyle = '#c97b63';
    c.stroke();
    c.lineWidth = r * 0.08;
    for (var i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(i * 0.08 * r, r * 0.7); c.lineTo(i * 0.42 * r, -r * 0.82); c.stroke();
    }
    c.restore();
  };

  // Pion : un petit galet vivant avec des yeux.
  F.pion = function (c, x, y, r, couleur, lettre, opts) {
    opts = opts || {};
    var saut = opts.saut || 0, ecrase = opts.ecrase || 0;
    c.save();
    // ombre
    c.fillStyle = 'rgba(0,0,0,' + (0.28 - Math.min(0.18, saut / (r * 8))) + ')';
    c.beginPath(); c.ellipse(x, y + r * 0.85, r * (1 - Math.min(0.4, saut / (r * 6))), r * 0.32, 0, 0, 7); c.fill();
    c.translate(x, y - saut);
    c.scale(1 + ecrase * 0.18, 1 - ecrase * 0.18);
    // corps
    var g = c.createRadialGradient(-r * 0.35, -r * 0.55, r * 0.1, 0, 0, r * 1.25);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, couleur); g.addColorStop(1, F.assombrir(couleur, 0.45));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, r, r * 1.08, 0, 0, 7); c.fill();
    c.lineWidth = r * 0.12; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    // yeux
    var regard = opts.regard || 0;
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-r * 0.32, -r * 0.18, r * 0.2, r * 0.26, 0, 0, 7); c.ellipse(r * 0.32, -r * 0.18, r * 0.2, r * 0.26, 0, 0, 7); c.fill();
    c.fillStyle = '#1b1b2f';
    var cligne = (Math.sin(F.t * 1.3 + (opts.phase || 0)) > 0.985);
    if (cligne) {
      c.fillRect(-r * 0.48, -r * 0.18, r * 0.3, r * 0.06); c.fillRect(r * 0.18, -r * 0.18, r * 0.3, r * 0.06);
    } else {
      c.beginPath(); c.arc(-r * 0.3 + regard * r * 0.08, -r * 0.14, r * 0.11, 0, 7); c.arc(r * 0.34 + regard * r * 0.08, -r * 0.14, r * 0.11, 0, 7); c.fill();
    }
    // bouche
    c.strokeStyle = '#1b1b2f'; c.lineWidth = r * 0.08; c.lineCap = 'round';
    c.beginPath();
    if (opts.triste) c.arc(0, r * 0.42, r * 0.2, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(0, r * 0.2, r * 0.22, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    // joues
    c.fillStyle = 'rgba(255,120,140,.45)';
    c.beginPath(); c.arc(-r * 0.58, r * 0.15, r * 0.13, 0, 7); c.arc(r * 0.58, r * 0.15, r * 0.13, 0, 7); c.fill();
    c.restore();
    if (lettre) F.texte(c, lettre, x, y - saut - r * 1.55, r * 0.7, '#fff', { contour: 'rgba(0,0,0,.6)' });
  };

  F.assombrir = function (hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * (1 - f)) + ',' + Math.round(g * (1 - f)) + ',' + Math.round(b * (1 - f)) + ')';
  };
  F.eclaircir = function (hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r + (255 - r) * f) + ',' + Math.round(g + (255 - g) * f) + ',' + Math.round(b + (255 - b) * f) + ')';
  };

  // Dé (cube arrondi avec des points, ou un chiffre au-delà de 6).
  F.de = function (c, x, y, taille, valeur, rot, couleur, chiffre) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    var t = taille;
    c.fillStyle = 'rgba(0,0,0,.25)';
    F.rr(c, -t / 2 + 6, -t / 2 + 8, t, t, t * 0.22); c.fill();
    var g = c.createLinearGradient(0, -t / 2, 0, t / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe6f3');
    c.fillStyle = g;
    F.rr(c, -t / 2, -t / 2, t, t, t * 0.22); c.fill();
    c.lineWidth = t * 0.06; c.strokeStyle = couleur || '#ff6b35'; c.stroke();
    c.fillStyle = '#1b1b2f';
    var p = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
    }[valeur];
    if (chiffre) p = null;
    if (p) {
      for (var i = 0; i < p.length; i++) { c.beginPath(); c.arc(p[i][0] * t * 0.26, p[i][1] * t * 0.26, t * 0.09, 0, 7); c.fill(); }
    } else {
      F.texte(c, String(valeur), 0, t * 0.04, t * 0.62, '#1b1b2f', { contour: false });
    }
    c.restore();
  };

  // ---------- Particules ----------
  F.Particules = function () { this.liste = []; };
  F.Particules.prototype.ajouter = function (x, y, o) {
    o = o || {};
    this.liste.push({
      x: x, y: y, vx: o.vx || 0, vy: o.vy || 0, g: o.g === undefined ? 900 : o.g, vie: o.vie || 1, age: 0,
      taille: o.taille || 8, couleur: o.couleur || '#ffd166', forme: o.forme || 'rond', rot: Math.random() * 6, vr: F.alea(-8, 8)
    });
  };
  F.Particules.prototype.gerbe = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = F.alea(0, Math.PI * 2), v = F.alea(o.vmin || 150, o.vmax || 500);
      this.ajouter(x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.haut || 250), g: o.g, vie: F.alea(0.6, o.vie || 1.4),
        taille: F.alea(o.tmin || 5, o.tmax || 11), couleur: o.couleurs ? F.choisir(o.couleurs) : o.couleur, forme: o.forme
      });
    }
  };
  F.Particules.prototype.maj = function (dt) {
    for (var i = this.liste.length - 1; i >= 0; i--) {
      var p = this.liste[i];
      p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.age >= p.vie) this.liste.splice(i, 1);
    }
  };
  F.Particules.prototype.dessiner = function (c) {
    for (var i = 0; i < this.liste.length; i++) {
      var p = this.liste[i], a = 1 - p.age / p.vie;
      c.globalAlpha = Math.max(0, a);
      if (p.forme === 'etoile') F.etoile(c, p.x, p.y, p.taille, p.rot);
      else if (p.forme === 'confetti') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.couleur;
        c.fillRect(-p.taille / 2, -p.taille / 4, p.taille, p.taille / 2); c.restore();
      } else if (p.forme === 'coquillage') F.coquillage(c, p.x, p.y, p.taille);
      else { c.fillStyle = p.couleur; c.beginPath(); c.arc(p.x, p.y, p.taille * (0.5 + a / 2), 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  };

  // ---------- Sons ----------
  var audio = null, sortie = null;
  F.sonActif = function () { return true; };
  function ac() {
    if (!F.sonActif()) return null;
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        sortie = audio.createGain();
        sortie.gain.value = 0.9;
        sortie.connect(audio.destination);
      }
      if (audio.state === 'suspended') audio.resume();
      return audio;
    } catch (e) { return null; }
  }
  function note(freq, debut, duree, type, vol, glisse) {
    var a = ac();
    if (!a) return;
    var t0 = a.currentTime + (debut || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g); g.connect(sortie);
    o.start(t0); o.stop(t0 + duree + 0.05);
  }
  function bruit(debut, duree, vol, filtre) {
    var a = ac();
    if (!a) return;
    var n = Math.floor(a.sampleRate * duree);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(); s.buffer = buf;
    var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filtre || 1200;
    var g = a.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(sortie);
    s.start(a.currentTime + (debut || 0));
  }
  var DO = 523.25;
  function demiTons(n) { return DO * Math.pow(2, n / 12); }
  F.son = {
    clic: function () { note(1200, 0, 0.05, 'square', 0.05); },
    de: function () { bruit(0, 0.05, 0.12, 2500); note(F.alea(700, 1100), 0, 0.04, 'triangle', 0.06); },
    deStop: function () { note(demiTons(7), 0, 0.12, 'triangle', 0.18); note(demiTons(12), 0.08, 0.25, 'triangle', 0.18); },
    pas: function (i) { note(demiTons([0, 2, 4, 7, 9, 12, 14, 16][i % 8]), 0, 0.12, 'sine', 0.16); bruit(0, 0.04, 0.05, 600); },
    gain: function () { [0, 4, 7, 12].forEach(function (n, i) { note(demiTons(n + 12), i * 0.07, 0.18, 'triangle', 0.14); }); },
    perte: function () { [7, 4, 0, -5].forEach(function (n, i) { note(demiTons(n), i * 0.1, 0.22, 'sawtooth', 0.06); }); },
    etoile: function () {
      [0, 4, 7, 12, 16, 19, 24].forEach(function (n, i) { note(demiTons(n + 5), i * 0.08, 0.35, 'triangle', 0.13); });
      note(demiTons(29), 0.6, 0.9, 'sine', 0.12);
    },
    surprise: function () { [0, 3, 6, 9, 12].forEach(function (n, i) { note(demiTons(n), i * 0.05, 0.12, 'square', 0.05); }); },
    tic: function () { note(1800, 0, 0.03, 'square', 0.05); },
    banniere: function () { note(demiTons(-5), 0, 0.15, 'triangle', 0.12, demiTons(7)); bruit(0, 0.2, 0.05, 3000); },
    compte: function () { note(demiTons(7), 0, 0.18, 'square', 0.08); },
    go: function () { note(demiTons(19), 0, 0.5, 'square', 0.1); note(demiTons(12), 0, 0.5, 'triangle', 0.12); },
    buzz: function () { note(110, 0, 0.35, 'sawtooth', 0.12); },
    pop: function () { note(F.alea(500, 900), 0, 0.07, 'sine', 0.12, F.alea(1000, 1600)); },
    duel: function () { [0, 0, 0, 3].forEach(function (n, i) { note(demiTons(n - 12), i * 0.14, 0.12, 'sawtooth', 0.09); }); note(demiTons(-9), 0.56, 0.5, 'sawtooth', 0.1); },
    roulement: function (duree) { for (var i = 0; i < duree * 18; i++) bruit(i / 18, 0.05, 0.05 + 0.1 * i / (duree * 18), 300); },
    cymbale: function () { bruit(0, 1.2, 0.25, 6000); note(demiTons(0), 0, 1, 'triangle', 0.12); note(demiTons(4), 0, 1, 'triangle', 0.1); note(demiTons(7), 0, 1, 'triangle', 0.1); },
    fanfare: function () {
      var m = [[0, .15], [0, .15], [0, .15], [4, .45], [2, .15], [4, .15], [7, .7]];
      var t = 0;
      m.forEach(function (x) { note(demiTons(x[0] + 7), t, x[1] + 0.1, 'square', 0.07); note(demiTons(x[0] - 5), t, x[1] + 0.1, 'triangle', 0.1); t += x[1]; });
    },
    totem: function (k) { note([392, 523.25, 659.25, 783.99][k], 0, 0.35, 'triangle', 0.2); }
  };

  // ---------- Musique (petite boucle de marimba générée) ----------
  var musique = { timer: null, pas: 0, prochain: 0, theme: null };
  var THEMES = {
    plateau: {
      tempo: 112, gamme: [0, 2, 4, 7, 9],
      basse: [0, null, 7, null, 5, null, 7, null, -3, null, 4, null, 5, null, 7, null],
      accords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]],
      melodie: [12, null, 14, 16, null, 19, 16, 14, 12, null, 9, null, 7, 9, 12, null,
        16, null, 14, 12, null, 9, 12, 14, 16, 19, null, 21, 19, 16, 14, null]
    },
    minijeu: {
      tempo: 148, gamme: [0, 3, 5, 7, 10],
      basse: [0, 0, 12, 0, 10, 0, 7, 0, 5, 5, 12, 5, 7, 7, 10, 7],
      accords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]],
      melodie: [12, 15, 17, 15, 12, null, 10, 12, 15, null, 17, 19, 17, 15, 12, null,
        19, null, 17, 15, 17, null, 12, 15, 10, 12, null, 7, 10, 12, null, null]
    },
    final: {
      tempo: 96, gamme: [0, 2, 4, 7, 9],
      basse: [0, null, null, null, 5, null, null, null, 7, null, null, null, 5, null, 7, null],
      accords: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [5, 9, 12, 16]],
      melodie: [16, null, 19, null, 21, null, 19, 16, 14, null, 16, null, 12, null, null, null,
        16, null, 19, null, 24, null, 23, 21, 19, null, 21, null, 19, null, null, null]
    }
  };
  function planifier() {
    var a = ac();
    if (!a || !musique.theme) return;
    var th = THEMES[musique.theme];
    var duree = 60 / th.tempo / 2;
    while (musique.prochain < a.currentTime + 0.25) {
      var i = musique.pas, debut = musique.prochain - a.currentTime;
      var b = th.basse[i % 16];
      if (b !== null) note(DO / 4 * Math.pow(2, b / 12), debut, duree * 1.8, 'triangle', 0.09);
      var m = th.melodie[i % 32];
      if (m !== null) note(DO / 2 * Math.pow(2, m / 12), debut, duree * 1.5, 'sine', 0.05);
      if (i % 8 === 4) {
        var ac2 = th.accords[Math.floor(i / 8) % 4];
        for (var k = 0; k < ac2.length; k++) note(DO / 2 * Math.pow(2, ac2[k] / 12), debut, duree * 1.2, 'triangle', 0.018);
      }
      if (i % 2 === 0) bruit(debut, 0.03, i % 4 === 0 ? 0.04 : 0.02, i % 4 === 0 ? 200 : 7000);
      musique.pas++;
      musique.prochain += duree;
    }
  }
  F.musique = function (theme) {
    if (musique.theme === theme) return;
    musique.theme = theme || null;
    clearInterval(musique.timer);
    musique.timer = null;
    if (!theme) return;
    var a = ac();
    if (!a) { musique.theme = null; return; }
    musique.pas = 0;
    musique.prochain = a.currentTime + 0.1;
    musique.timer = setInterval(planifier, 60);
  };
})(Fiesta);
window.Fiesta = Fiesta;
