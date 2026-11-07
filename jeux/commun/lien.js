/*
 * Lien télé ↔ téléphones partagé par les jeux (quiz, dino…).
 * Gère la liste des joueurs de la partie, les écrans envoyés aux téléphones et les questions à choix.
 * Nécessite Fiesta (jeux/fiesta/outils.js) pour l'horloge F.t et F.V.
 */
(function (F) {
  'use strict';

  F.creerLien = function (api) {
    var L = { joueurs: [], arrete: false };
    var demandes = {}, compteur = 0;

    L.initialiser = function (champs) {
      L.joueurs = api.joueurs().map(function (j) {
        var P = { num: j.numero, nom: j.nom, couleur: j.couleur };
        for (var k in champs) P[k] = typeof champs[k] === 'function' ? champs[k]() : champs[k];
        return P;
      });
      return L.joueurs;
    };
    L.jDe = function (P) {
      var l = api.tousLesJoueurs();
      for (var i = 0; i < l.length; i++) if (l[i].numero === P.num) return l[i];
      return null;
    };
    L.PDe = function (j) {
      for (var i = 0; i < L.joueurs.length; i++) if (L.joueurs[i].num === j.numero) return L.joueurs[i];
      return null;
    };
    L.connecte = function (P) { var j = L.jDe(P); return !!(j && j.conn); };

    // stats(P) facultatif : {pieces, etoiles, rang} affichés en haut du téléphone
    L.stats = null;
    L.ui = function (P, ui) {
      if (L.arrete) return;
      if (L.stats) ui.stats = L.stats(P);
      P.ui = ui;
      var j = L.jDe(P);
      if (j) api.envoyer(j, { t: 'ui', ui: ui });
    };
    L.uiTous = function (ui, sauf) {
      L.joueurs.forEach(function (P) { if (P !== sauf) L.ui(P, JSON.parse(JSON.stringify(ui))); });
    };

    L.demander = function (P, ui, defaut, delai) {
      return new Promise(function (ok) {
        var cle = 'q' + (++compteur);
        ui.cle = cle;
        demandes[P.num] = { cle: cle, ok: ok, defaut: defaut, limite: F.t + (delai || 30) / F.V, horsLigne: 0, P: P };
        L.ui(P, ui);
      });
    };
    L.enAttente = function (P) { return !!demandes[P.num]; };
    L.annuler = function (P, valeur) {
      var d = demandes[P.num];
      if (d) { delete demandes[P.num]; d.ok(valeur); }
    };
    L.annulerTout = function (valeur) { Object.keys(demandes).forEach(function (n) { var d = demandes[n]; delete demandes[n]; d.ok(valeur); }); };
    L.verifier = function (dt) {
      Object.keys(demandes).forEach(function (n) {
        var d = demandes[n];
        d.horsLigne = L.connecte(d.P) ? 0 : d.horsLigne + dt;
        if (F.t > d.limite || d.horsLigne > 1.5) { delete demandes[n]; d.ok(d.defaut); }
      });
    };
    // À appeler depuis message(j, m). Renvoie true si le message était une réponse.
    L.recevoir = function (j, m) {
      var P = L.PDe(j);
      if (!P || m.t !== 'choix') return false;
      var d = demandes[P.num];
      if (d && (!m.cle || m.cle === d.cle)) { delete demandes[P.num]; P.sel = Array.isArray(m.sel) ? m.sel.map(Number) : []; d.ok(m.id, F.t); }
      return true;
    };
    L.arrivee = function (j, uiSpectateur) {
      var P = L.PDe(j);
      if (P) { if (P.ui) L.ui(P, P.ui); }
      else api.envoyer(j, { t: 'ui', ui: uiSpectateur || { emoji: '🍿', titre: 'Partie en cours', texte: 'Regarde la télé ! Tu joueras à la prochaine partie.' } });
    };
    L.fin = function () { L.arrete = true; demandes = {}; };
    return L;
  };

  // Classement avec ex æquo : trie et ajoute P.rang
  F.classer = function (liste, cle) {
    var l = liste.slice().sort(function (a, b) { return b[cle] - a[cle]; });
    var r = 0;
    l.forEach(function (P, i) { if (i === 0 || P[cle] !== l[i - 1][cle]) r = i + 1; P.rang = r; });
    return l;
  };
  F.texteRang = function (r) { return r === 1 ? '1er' : r + 'e'; };

  // Texte sur plusieurs lignes, centré. Renvoie le nombre de lignes.
  F.texteMultiligne = function (c, texte, x, y, largeur, taille, couleur, opts) {
    opts = opts || {};
    c.font = (opts.poids || 700) + ' ' + Math.round(taille) + 'px ' + F.POLICE;
    var mots = texte.split(' '), ligne = '', lignes = [];
    mots.forEach(function (m) {
      var essai = ligne ? ligne + ' ' + m : m;
      if (c.measureText(essai).width > largeur && ligne) { lignes.push(ligne); ligne = m; } else ligne = essai;
    });
    if (ligne) lignes.push(ligne);
    var h = taille * (opts.interligne || 1.25);
    var y0 = opts.centrerV ? y - (lignes.length - 1) * h / 2 : y;
    lignes.forEach(function (l, i) { F.texte(c, l, x, y0 + i * h, taille, couleur, { contour: opts.contour === undefined ? false : opts.contour, poids: opts.poids, align: opts.align }); });
    return lignes.length;
  };

  // Mise à l'échelle d'un espace virtuel 1600 × 900 au centre de l'écran.
  F.virtuel = function (c, W, H, fond) {
    var s = Math.min(W / 1600, H / 900);
    if (fond) { c.fillStyle = fond; c.fillRect(0, 0, W, H); }
    c.save();
    c.translate((W - 1600 * s) / 2, (H - 900 * s) / 2);
    c.scale(s, s);
    return s;
  };
})(Fiesta);
