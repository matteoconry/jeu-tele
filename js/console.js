/*
 * Console télé : salle PeerJS, joueurs, menu, catalogue, paramètres.
 * Les jeux s'ajoutent avec Console.ajouterJeu({...}) (voir jeux/test-manettes.js).
 *
 * Messages téléphone → télé :
 *   {t:'profil', nom, couleur}   {t:'choisir', id}   {t:'param', cle, valeur}   {t:'menu'}
 *   {t:'dir', x, y}   {t:'bouton', b:'A'|'B', appui:true|false}   {t:'ping', ts}
 * Messages télé → téléphone :
 *   {t:'bienvenue', numero, couleur, nom}   {t:'plein'}   {t:'pong', ts}
 *   {t:'ecran', ecran:'menu', jeux, params, joueurs}   {t:'ecran', ecran:'jeu', jeu, boutons}
 */
var Console = (function () {
  'use strict';
  // À augmenter à chaque mise en ligne qui touche la manette : un téléphone avec une autre version se recharge tout seul.
  var VERSION = 10;

  var COULEURS = ['#ff6b35', '#4ecdc4', '#ffd166', '#c77dff', '#80ed99', '#ff8fab'];
  var PREFIXE = 'jeutele-mc-';
  var LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var MAX_PLACES = 4;

  var jeux = [];          // catalogue
  var joueurs = [];       // index = numéro - 1 ; {numero, idTel, conn, nom, couleur, ping}
  var params = { maxJoueurs: 2, son: true, latence: true };
  var jeuEnCours = null;  // {def, inst}
  var selection = 0;      // jeu surligné dans le catalogue
  var peer = null, code = null, tentatives = 0, urlManette = '';

  try {
    var p = JSON.parse(localStorage.getItem('jeutele-params') || 'null');
    if (p) for (var k in params) if (k in p) params[k] = p[k];
  } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function etat(txt) { $('etat').textContent = txt; }
  function nouveauCode() {
    var c = '';
    for (var i = 0; i < 5; i++) c += LETTRES.charAt(Math.floor(Math.random() * LETTRES.length));
    return c;
  }
  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastMinuteur = null;
  function toast(txt) {
    var el = $('toast');
    el.textContent = txt;
    el.className = 'visible';
    clearTimeout(toastMinuteur);
    toastMinuteur = setTimeout(function () { el.className = ''; }, 2500);
  }

  // ---------- Son (petits bips, sans fichier) ----------
  var audio = null;
  function son(freq, duree) {
    if (!params.son) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq || 660;
      g.gain.setValueAtTime(0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (duree || 0.15));
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + (duree || 0.15));
    } catch (e) {}
  }

  // ---------- Joueurs ----------
  function connectes() {
    var r = [];
    for (var i = 0; i < joueurs.length; i++) if (joueurs[i] && joueurs[i].conn) r.push(joueurs[i]);
    return r;
  }
  function envoyer(j, m) { if (j && j.conn && j.conn.open) { try { j.conn.send(m); } catch (e) {} } }
  function diffuser(m) { for (var i = 0; i < joueurs.length; i++) envoyer(joueurs[i], m); }

  function couleurLibre(voulue, saufNumero) {
    var prises = {};
    for (var i = 0; i < joueurs.length; i++) {
      var j = joueurs[i];
      if (j && j.conn && j.numero !== saufNumero) prises[j.couleur] = true;
    }
    if (voulue && COULEURS.indexOf(voulue) !== -1 && !prises[voulue]) return voulue;
    for (var c = 0; c < COULEURS.length; c++) if (!prises[COULEURS[c]]) return COULEURS[c];
    return COULEURS[0];
  }
  function nettoyerNom(n, numero) {
    n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14);
    return n || ('Joueur ' + numero);
  }

  function accueillir(conn) {
    conn.on('open', function () {
      var meta = conn.metadata || {};
      var idTel = meta.idTel || conn.peer;
      var place = -1, i;

      for (i = 0; i < joueurs.length; i++) if (joueurs[i] && joueurs[i].idTel === idTel) place = i;
      // Même prénom qu'un joueur parti ou muet (autre navigateur sur le même téléphone, page rouverte…) : on reprend sa place.
      if (place === -1 && meta.nom) {
        var cle = cleNom(meta.nom);
        for (i = 0; i < joueurs.length; i++) {
          var x = joueurs[i];
          if (x && cleNom(x.nom) === cle && (!x.conn || Date.now() - x.vu > 3000)) { place = i; break; }
        }
      }
      if (place === -1) {
        // Une place libre parmi les places autorisées (jamais utilisée, ou joueur parti).
        for (i = 0; i < params.maxJoueurs; i++) if (!joueurs[i] || !joueurs[i].conn) { place = i; break; }
      }
      // Salle pleine : on prend la place d'un téléphone muet depuis plus de 3 s (connexion morte).
      if (place === -1) {
        for (i = 0; i < params.maxJoueurs; i++) if (joueurs[i] && Date.now() - joueurs[i].vu > 3000) { place = i; break; }
      }
      if (place === -1) {
        conn.send({ t: 'plein', max: params.maxJoueurs });
        setTimeout(function () { conn.close(); }, 800);
        return;
      }

      var ancien = joueurs[place];
      if (ancien && ancien.conn && ancien.conn !== conn) { var vieux = ancien.conn; ancien.conn = null; try { vieux.close(); } catch (e) {} }
      var numero = place + 1;
      var j = {
        numero: numero, idTel: idTel, conn: conn, ping: null, vu: Date.now(),
        nom: nettoyerNom(meta.nom || (ancien && ancien.nom), numero),
        couleur: couleurLibre(meta.couleur || (ancien && ancien.couleur), numero)
      };
      joueurs[place] = j;

      envoyer(j, { t: 'bienvenue', numero: numero, nom: j.nom, couleur: j.couleur, couleurs: COULEURS, version: VERSION });
      toast(j.nom + ' a rejoint la partie');
      son(880, 0.12);
      if (jeuEnCours) {
        envoyer(j, ecranJeu());
        if (jeuEnCours.inst.arrivee) jeuEnCours.inst.arrivee(j);
      }
      majTout();

      conn.on('data', function (m) { recevoir(j, conn, m); });
      conn.on('close', function () { depart(j, conn); });
      conn.on('error', function () { depart(j, conn); });
    });
  }

  function depart(j, conn) {
    if (j.conn !== conn) return;
    j.conn = null;
    try { conn.close(); } catch (e) {}
    toast(j.nom + ' est déconnecté');
    if (jeuEnCours && jeuEnCours.inst.depart) jeuEnCours.inst.depart(j);
    nettoyerPartis();
    majTout();
  }
  function cleNom(n) { return String(n || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  // Hors partie, un joueur déconnecté libère sa ligne (pendant une partie on le garde pour qu'il puisse revenir).
  function nettoyerPartis() {
    if (jeuEnCours) return;
    for (var i = 0; i < joueurs.length; i++) if (joueurs[i] && !joueurs[i].conn) joueurs[i] = null;
  }
  // Un téléphone envoie un ping toutes les 2 s : sans nouvelles depuis 15 s, il est parti (écran éteint, onglet fermé…).
  setInterval(function () {
    var t = Date.now();
    for (var i = 0; i < joueurs.length; i++) {
      var j = joueurs[i];
      if (j && j.conn && t - j.vu > 15000) depart(j, j.conn);
    }
  }, 1000);

  function recevoir(j, conn, m) {
    if (j.conn !== conn || !m || typeof m !== 'object') return;
    j.vu = Date.now();
    switch (m.t) {
      case 'ping':
        envoyer(j, { t: 'pong', ts: m.ts });
        if (typeof m.dernier === 'number') { j.ping = Math.round(m.dernier); majJoueursLegers(); }
        return;
      case 'profil':
        j.nom = nettoyerNom(m.nom, j.numero);
        j.couleur = couleurLibre(m.couleur, j.numero);
        envoyer(j, { t: 'bienvenue', numero: j.numero, nom: j.nom, couleur: j.couleur, couleurs: COULEURS });
        majTout();
        return;
      case 'choisir':
        lancer(m.id, j);
        return;
      case 'param':
        changerParam(m.cle, m.valeur, j);
        return;
      case 'menu':
        if (jeuEnCours) { toast(j.nom + ' revient au menu'); retourMenu(); }
        return;
    }
    if (jeuEnCours && jeuEnCours.inst.message) jeuEnCours.inst.message(j, m);
  }

  // ---------- Paramètres ----------
  var DESCR_PARAMS = {
    maxJoueurs: { nom: 'Joueurs max', valeurs: [2, 3, 4] },
    son: { nom: 'Son', valeurs: [true, false] },
    latence: { nom: 'Afficher la latence', valeurs: [true, false] }
  };
  function changerParam(cle, valeur, j) {
    var d = DESCR_PARAMS[cle];
    if (!d || d.valeurs.indexOf(valeur) === -1) return;
    params[cle] = valeur;
    try { localStorage.setItem('jeutele-params', JSON.stringify(params)); } catch (e) {}
    if (j) toast(j.nom + ' : ' + d.nom + ' → ' + texteValeur(valeur));
    majTout();
  }
  function texteValeur(v) { return v === true ? 'oui' : (v === false ? 'non' : String(v)); }

  // ---------- Catalogue et jeux ----------
  function ajouterJeu(def) {
    def.min = def.min || 1;
    def.max = def.max || MAX_PLACES;
    def.dispo = def.dispo !== false;
    jeux.push(def);
  }

  function jeuxPourTelephone() {
    var n = connectes().length;
    return jeux.map(function (d) {
      var ok = d.dispo && n >= d.min;
      return {
        id: d.id, nom: d.nom, emoji: d.emoji || '🎮', description: d.description || '', vignette: d.vignette, fond: d.fond,
        min: d.min, max: d.max, jouable: ok,
        raison: !d.dispo ? 'Bientôt' : (n < d.min ? 'Il faut ' + d.min + ' joueur' + (d.min > 1 ? 's' : '') : '')
      };
    });
  }

  function lancer(id, parQui) {
    if (jeuEnCours) return;
    var def = null;
    for (var i = 0; i < jeux.length; i++) if (jeux[i].id === id) def = jeux[i];
    if (!def) return;
    if (!def.dispo) { toast(def.nom + ' : bientôt disponible'); return; }
    if (connectes().length < def.min) { toast(def.nom + ' : il faut ' + def.min + ' joueur' + (def.min > 1 ? 's' : '')); return; }

    $('menu').className = 'cache';
    $('nomJeu').textContent = (def.emoji || '') + ' ' + def.nom;
    $('barreJeu').className = def.barre === false ? '' : 'visible';
    son(520, 0.1); setTimeout(function () { son(780, 0.18); }, 110);

    // D'abord dire aux téléphones qu'on passe en jeu, ensuite créer le jeu (qui peut déjà leur écrire).
    jeuEnCours = { def: def, inst: {} };
    diffuser(ecranJeu());
    jeuEnCours.inst = def.creer(api) || {};
    if (parQui) toast(parQui.nom + ' lance ' + def.nom);
    majTout();
  }

  function ecranJeu() {
    var d = jeuEnCours.def;
    return { t: 'ecran', ecran: 'jeu', jeu: { id: d.id, nom: d.nom, emoji: d.emoji }, boutons: d.boutons || ['A'], perso: !!d.perso };
  }

  function retourMenu() {
    if (jeuEnCours) {
      try { if (jeuEnCours.inst.fin) jeuEnCours.inst.fin(); } catch (e) { console.error(e); }
      jeuEnCours = null;
    }
    nettoyerPartis();
    $('menu').className = '';
    $('barreJeu').className = '';
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    majTout();
  }

  // API donnée à chaque jeu.
  var api = {
    joueurs: connectes,
    tousLesJoueurs: function () { return joueurs.filter(function (j) { return !!j; }); },
    envoyer: envoyer,
    diffuser: diffuser,
    son: son,
    toast: toast,
    quitter: retourMenu,
    params: function () { return params; }
  };

  // ---------- Affichage du menu ----------
  function majTout() {
    majJoueurs();
    majCatalogue();
    majParams();
    majMiniJoueurs();
    if (!jeuEnCours) diffuser({ t: 'ecran', ecran: 'menu', jeux: jeuxPourTelephone(), params: params,
      descrParams: DESCR_PARAMS, joueurs: resumeJoueurs() });
    var n = connectes().length;
    $('compteJoueurs').textContent = '(' + n + '/' + params.maxJoueurs + ')';
    if (peer && peer.open) etat(n ? '✅ ' + n + ' manette(s) connectée(s)' : '✅ Salle ouverte, scanne le QR code');
  }
  function resumeJoueurs() {
    return connectes().map(function (j) { return { numero: j.numero, nom: j.nom, couleur: j.couleur }; });
  }

  function majJoueurs() {
    var h = '';
    var places = Math.max(params.maxJoueurs, joueurs.length);
    for (var i = 0; i < places; i++) {
      var j = joueurs[i];
      if (j) {
        var info = j.conn ? (params.latence && j.ping !== null ? j.ping + ' ms' : 'connecté') : 'déconnecté';
        h += '<div class="joueur' + (j.conn ? '' : ' parti') + '"><span class="pastille" style="background:' + j.couleur + '">' +
          j.numero + '</span><span class="nom">' + echapper(j.nom) + '</span><span class="info" data-ping="' + j.numero + '">' + info + '</span></div>';
      } else if (i < params.maxJoueurs) {
        h += '<div class="joueur vide"><span class="pastille" style="background:#555">' + (i + 1) +
          '</span><span class="nom">En attente…</span></div>';
      }
    }
    $('listeJoueurs').innerHTML = h;
  }
  function majJoueursLegers() {
    // Mise à jour de la latence sans tout redessiner.
    for (var i = 0; i < joueurs.length; i++) {
      var j = joueurs[i];
      if (!j || !j.conn) continue;
      var el = document.querySelector('[data-ping="' + j.numero + '"]');
      if (el) el.textContent = params.latence && j.ping !== null ? j.ping + ' ms' : 'connecté';
    }
  }

  function majCatalogue() {
    var liste = jeuxPourTelephone();
    if (selection >= liste.length) selection = 0;
    var h = '';
    for (var i = 0; i < liste.length; i++) {
      var g = liste[i];
      var img = g.vignette ? ' style="background-image:url(' + g.vignette + ')">' : ' style="background:' + (g.fond || 'linear-gradient(135deg,#3a3f9e,#7a2e6e)') + '">' + g.emoji;
      h += '<div class="jeu' + (i === selection ? ' choisi' : '') + (g.jouable ? '' : ' indispo') + '">' +
        '<div class="image"' + img + '</div><div class="bas"><div class="titre">' + echapper(g.nom) + '</div>' +
        '<div class="joueurs">' + (g.raison ? echapper(g.raison) : (g.min === g.max ? g.min : g.min + ' à ' + g.max) + ' joueurs') + '</div></div></div>';
    }
    $('catalogue').innerHTML = h;
    var choisi = liste[selection];
    $('detail').innerHTML = choisi ? '<b>' + choisi.emoji + ' ' + echapper(choisi.nom) + '</b> · ' + echapper(choisi.description) : '';
  }

  function majParams() {
    var h = '';
    for (var k in DESCR_PARAMS) h += '<div class="param">' + DESCR_PARAMS[k].nom + ' : <b>' + texteValeur(params[k]) + '</b></div>';
    $('params').innerHTML = h;
  }

  function majMiniJoueurs() {
    var h = '';
    connectes().forEach(function (j) { h += '<span style="background:' + j.couleur + '">' + echapper(j.nom) + '</span>'; });
    $('miniJoueurs').innerHTML = h;
  }

  // ---------- Plein écran ----------
  // Le navigateur exige un geste (clic ou touche OK) : on passe en plein écran au premier appui.
  function estPleinEcran() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function pleinEcranPossible() {
    var d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen);
  }
  function passerPleinEcran() {
    var d = document.documentElement;
    try {
      var r = d.requestFullscreen ? d.requestFullscreen() : (d.webkitRequestFullscreen ? d.webkitRequestFullscreen() : null);
      if (r && r.catch) r.catch(function () { toast('Plein écran refusé : utilise le menu ☰ du navigateur'); });
    } catch (e) { toast('Plein écran : utilise le menu ☰ du navigateur'); }
  }
  function majBoutonPleinEcran() {
    $('pleinEcran').className = estPleinEcran() ? 'cache' : '';
  }
  document.addEventListener('fullscreenchange', majBoutonPleinEcran);
  document.addEventListener('webkitfullscreenchange', majBoutonPleinEcran);
  document.addEventListener('click', function () { if (!estPleinEcran() && pleinEcranPossible()) passerPleinEcran(); });

  // ---------- Télécommande Samsung / clavier ----------
  var dernierRetour = 0;
  // Flèches + OK dans le menu ; Retour (10009) ou Échap pour quitter un jeu.
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    // Premier OK sur la télécommande : plein écran (le suivant lance le jeu).
    if (k === 13 && !estPleinEcran() && pleinEcranPossible()) { e.preventDefault(); passerPleinEcran(); return; }
    if (jeuEnCours) {
      if (k === 10009 || k === 27 || k === 8) {
        e.preventDefault();
        // Double appui pour éviter de quitter une partie par erreur.
        var t = Date.now();
        if (t - dernierRetour < 2500) { dernierRetour = 0; retourMenu(); }
        else { dernierRetour = t; toast('Appuie encore sur Retour pour quitter la partie'); }
      }
      if (jeuEnCours && jeuEnCours.inst.touche) jeuEnCours.inst.touche(k);
      return;
    }
    // Dans le menu, Retour fait sortir du plein écran (on retrouve la barre du navigateur).
    if ((k === 10009 || k === 27) && estPleinEcran()) {
      e.preventDefault();
      var d = document;
      if (d.exitFullscreen) d.exitFullscreen(); else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
      return;
    }
    var n = jeux.length;
    if (!n) return;
    if (k === 37) selection = (selection + n - 1) % n;
    else if (k === 39) selection = (selection + 1) % n;
    else if (k === 38) selection = (selection + n - 5) % n;
    else if (k === 40) selection = (selection + 5) % n;
    else if (k === 13) { lancer(jeux[selection].id, null); return; }
    else return;
    e.preventDefault();
    majCatalogue();
  });

  // ---------- Salle PeerJS ----------
  function afficherQR() {
    // Chemin relatif : marche sous matteoconry.github.io/<nom-du-depot>/
    urlManette = new URL('manette.html?salle=' + code, location.href).href;
    var qr = qrcode(0, 'M');
    qr.addData(urlManette);
    qr.make();
    $('qr').innerHTML = qr.createImgTag(8, 0);
    $('miniQR').innerHTML = qr.createImgTag(3, 0);
    $('salle').textContent = code;
    $('lien').textContent = urlManette;
  }

  function ouvrirSalle() {
    afficherQR();
    peer = new Peer(PREFIXE + code, window.PEER_OPTS || { debug: 1 });

    peer.on('open', function () {
      tentatives = 0;
      try { localStorage.setItem('jeutele-salle', code); } catch (e) {}
      majTout();
    });
    peer.on('connection', accueillir);
    peer.on('disconnected', function () {
      // Le serveur PeerJS coupe parfois la ligne : on se reconnecte (les manettes déjà branchées restent connectées).
      tentatives++;
      etat('Reconnexion au serveur… (essai ' + tentatives + ')');
      setTimeout(function () { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); },
        Math.min(10000, 1500 * tentatives));
    });
    peer.on('error', function (err) {
      console.error(err);
      if (err.type === 'unavailable-id') {
        peer.destroy();
        code = nouveauCode();
        ouvrirSalle();
      } else if (err.type === 'browser-incompatible') {
        etat('❌ Ce navigateur ne gère pas WebRTC.');
      } else if (err.type !== 'peer-unavailable') {
        etat('⚠️ ' + err.type + ', nouvel essai…');
      }
    });
  }

  // ---------- Boucle d'affichage des jeux ----------
  var canvas = null, W = 0, H = 0, avant = 0;
  function redim() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function boucle(t) {
    var dt = avant ? Math.min(0.05, (t - avant) / 1000) : 0;
    avant = t;
    if (jeuEnCours && jeuEnCours.inst.image) {
      try { jeuEnCours.inst.image(canvas.getContext('2d'), W, H, dt); }
      catch (e) { console.error(e); toast('Erreur dans le jeu, retour au menu'); retourMenu(); }
    }
    requestAnimationFrame(boucle);
  }

  function demarrer() {
    canvas = $('jeu');
    if (!pleinEcranPossible()) {
      $('pleinEcran').textContent = 'Plein écran : menu ☰ du navigateur';
      $('pleinEcran').style.animation = 'none';
    }
    window.addEventListener('resize', redim);
    redim();
    requestAnimationFrame(boucle);
    try { code = localStorage.getItem('jeutele-salle'); } catch (e) {}
    if (!code) code = nouveauCode();
    majTout();
    if (typeof Peer === 'undefined') { etat('❌ PeerJS ne s\'est pas chargé (lib/peerjs.min.js).'); return; }
    ouvrirSalle();
  }

  return { demarrer: demarrer, ajouterJeu: ajouterJeu, COULEURS: COULEURS };
})();
