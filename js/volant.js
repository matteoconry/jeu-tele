/*
 * Manette « volant » pour les jeux de course (HexGL) : on penche le téléphone comme un volant.
 * Utilisé par js/manette.js quand l'écran perso envoyé par la télé contient ui.volant.
 *
 * Téléphone → télé : {t:'volant', v, gaz, ag, ad}
 *   v   : direction de -1 (gauche) à 1 (droite)
 *   gaz : accélérer (true/false)
 *   ag / ad : aérofrein gauche / droit (pour les virages serrés)
 * Et {t:'choix', id:'recommencer'} pour relancer la course.
 */
var Volant = (function () {
  'use strict';

  var ANGLE_MAX = 28;   // degrés d'inclinaison pour braquer à fond
  var ZONE_MORTE = 2.5; // degrés sans effet autour du centre

  var actif = false, racine = null, envoyer = null, vibrer = null;
  var mode = lire('jeutele-volant-mode') || 'pencher';      // 'pencher' ou 'boutons'
  var gazAuto = lire('jeutele-volant-gazauto') !== 'non';   // accélération automatique (oui par défaut)
  var centre = 0;                // réglage du « tout droit » (degrés)
  var angleBrut = null;          // dernière inclinaison mesurée (degrés), null = pas de capteur
  var angleLisse = 0;
  var appuis = {};               // bouton → true
  var dernierEnvoi = '', dernierEnvoiT = 0;
  var minuterie = null, verrou = null, capteurVu = false, attenteCapteur = null;

  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(sel) { return racine ? racine.querySelector(sel) : null; }

  // ---------- Capteur d'inclinaison ----------
  // On reconstruit la direction « vers le haut » à partir de beta/gamma (mêmes conventions sur Android et iPhone),
  // puis on la tourne selon l'orientation de l'écran (portrait ou paysage).
  function angleEcran() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    return typeof window.orientation === 'number' ? window.orientation : 0;
  }
  function surOrientation(e) {
    if (e.beta === null || e.gamma === null || e.beta === undefined) return;
    if (!capteurVu) { capteurVu = true; var p = $('.vl-permis'); if (p) p.parentNode.removeChild(p); }
    var b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
    var x = -Math.sin(g) * Math.cos(b), y = Math.sin(b), z = Math.cos(g) * Math.cos(b);
    var t = angleEcran() * Math.PI / 180;
    var xs = x * Math.cos(t) - y * Math.sin(t);
    var ys = x * Math.sin(t) + y * Math.cos(t);
    // Pencher à droite (sens des aiguilles d'une montre) → angle positif.
    angleBrut = Math.atan2(-xs, Math.sqrt(ys * ys + z * z)) * 180 / Math.PI;
  }
  function brancherCapteur() {
    window.removeEventListener('deviceorientation', surOrientation);
    window.addEventListener('deviceorientation', surOrientation);
  }
  function permissionNecessaire() {
    return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  }
  // iPhone : l'accès au capteur doit être demandé après un appui.
  function demanderPermission() {
    if (!permissionNecessaire()) { brancherCapteur(); return; }
    try {
      DeviceOrientationEvent.requestPermission().then(function (r) {
        if (r === 'granted') { ecrire('jeutele-volant-permis', 'oui'); brancherCapteur(); surveillerCapteur(); }
        else { passerEnBoutons('Inclinaison refusée : on joue avec les boutons.'); }
        dessiner();
      }).catch(function () { dessiner(); });
    } catch (e) {}
  }
  function surveillerCapteur() {
    clearTimeout(attenteCapteur);
    attenteCapteur = setTimeout(function () {
      if (actif && mode === 'pencher' && !capteurVu && !permissionNecessaire()) passerEnBoutons('Pas de capteur d\'inclinaison : on joue avec les boutons.');
    }, 4000);
  }
  function passerEnBoutons(txt) {
    mode = 'boutons';
    dessiner();
    if (txt) info(txt);
  }

  // Garder l'écran allumé (on ne touche pas toujours l'écran en penchant le téléphone).
  function garderAllume() {
    try {
      if (navigator.wakeLock && !verrou) navigator.wakeLock.request('screen').then(function (l) { verrou = l; l.addEventListener('release', function () { verrou = null; }); }).catch(function () {});
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (actif && !document.hidden) garderAllume(); });

  // ---------- Calcul et envoi de la commande ----------
  function direction() {
    if (mode === 'boutons') return (appuis.droite ? 1 : 0) - (appuis.gauche ? 1 : 0);
    if (angleBrut === null) return 0;
    angleLisse += (angleBrut - angleLisse) * 0.5;
    var a = angleLisse - centre;
    if (Math.abs(a) < ZONE_MORTE) return 0;
    a = (Math.abs(a) - ZONE_MORTE) * (a < 0 ? -1 : 1) / (ANGLE_MAX - ZONE_MORTE);
    return Math.max(-1, Math.min(1, a));
  }
  function tick() {
    if (!actif) return;
    var v = Math.round(direction() * 50) / 50;
    var gaz = gazAuto ? !appuis.gaz : !!appuis.gaz;
    var ag = mode === 'pencher' && !!appuis.ag, ad = mode === 'pencher' && !!appuis.ad;
    var cle = v + '|' + gaz + '|' + ag + '|' + ad, t = Date.now();
    if (cle !== dernierEnvoi || t - dernierEnvoiT > 400) {
      dernierEnvoi = cle; dernierEnvoiT = t;
      envoyer({ t: 'volant', v: v, gaz: gaz, ag: ag, ad: ad });
    }
    var roue = $('.vl-roue');
    if (roue) roue.style.transform = 'rotate(' + Math.round(v * 90) + 'deg)';
  }

  // ---------- Affichage ----------
  var STYLE = [
    '.vl { position:absolute; inset:0; display:flex; flex-direction:column; gap:10px; padding:6px 10px 12px; }',
    '.vl-haut { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; }',
    '.vl-haut button { padding:8px 12px; border-radius:10px; background:#22363f; font-size:14px; }',
    '.vl-haut button.oui { background:#2f6f5e; }',
    '.vl-roue { font-size:34px; line-height:1; transition:transform .06s linear; }',
    '.vl-info { font-size:14px; opacity:.85; text-align:center; min-height:18px; }',
    '.vl-bas { flex:1; display:flex; gap:10px; min-height:0; }',
    '.vl-b { flex:1; border-radius:22px; background:#2c4552; color:#cfe; font-size:22px; font-weight:800; display:flex; flex-direction:column;',
    '  align-items:center; justify-content:center; gap:6px; box-shadow:0 6px 0 rgba(0,0,0,.4); text-align:center; padding:6px; touch-action:none; }',
    '.vl-b small { font-size:12px; font-weight:600; opacity:.75; }',
    '.vl-b.gaz { flex:1.3; background:var(--couleur); color:#000; }',
    '.vl-b.actif { transform:translateY(4px); box-shadow:0 2px 0 rgba(0,0,0,.4); filter:brightness(1.25); }',
    '.vl-permis { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;',
    '  background:rgba(20,35,43,.97); text-align:center; padding:24px; font-size:18px; z-index:2; }',
    '.vl-permis button { font-size:20px; font-weight:800; padding:16px 26px; border-radius:14px; background:var(--couleur); color:#000; }'
  ].join('\n');

  function dessiner() {
    if (!racine) return;
    if (!document.getElementById('styleVolant')) {
      var st = document.createElement('style'); st.id = 'styleVolant'; st.textContent = STYLE; document.head.appendChild(st);
    }
    appuis = {};
    var pencher = mode === 'pencher';
    var gaz = gazAuto ? '<span>🚀 GAZ AUTO</span><small>appuie pour lever le pied</small>' : '<span>🚀 GAZ</span><small>garde appuyé</small>';
    var h = '<div class="vl">' +
      '<div class="vl-haut">' +
        '<span class="vl-roue">🛞</span>' +
        '<button data-o="mode">' + (pencher ? '📱 Pencher' : '👆 Boutons') + '</button>' +
        '<button data-o="gazauto" class="' + (gazAuto ? 'oui' : '') + '">Gaz auto : ' + (gazAuto ? 'oui' : 'non') + '</button>' +
        (pencher ? '<button data-o="centrer">⊙ Centrer</button>' : '') +
        '<button data-o="recommencer">↺ Recommencer</button>' +
      '</div>' +
      '<div class="vl-info">' + (pencher ? 'Tiens le téléphone en paysage, comme un volant, et penche-le pour tourner.' : 'Les boutons ◀ ▶ font tourner le vaisseau.') + '</div>' +
      '<div class="vl-bas">' +
        (pencher
          ? '<div class="vl-b" data-b="ag"><span>◀ Aérofrein</span><small>virage serré</small></div>'
          : '<div class="vl-b" data-b="gauche"><span style="font-size:40px">◀</span></div>') +
        '<div class="vl-b gaz" data-b="gaz">' + gaz + '</div>' +
        (pencher
          ? '<div class="vl-b" data-b="ad"><span>Aérofrein ▶</span><small>virage serré</small></div>'
          : '<div class="vl-b" data-b="droite"><span style="font-size:40px">▶</span></div>') +
      '</div>' +
      (pencher && permissionNecessaire() && !capteurVu
        ? '<div class="vl-permis"><div>Pour piloter en penchant le téléphone, il faut autoriser le capteur d\'inclinaison.</div>' +
          '<button data-o="permis">Activer l\'inclinaison</button><button data-o="mode" style="background:#22363f;color:#fff;font-size:16px">Jouer avec les boutons</button></div>'
        : '') +
      '</div>';
    racine.innerHTML = h;

    racine.querySelectorAll('[data-o]').forEach(function (el) {
      el.addEventListener('click', function () {
        var o = el.getAttribute('data-o');
        vibrer(15);
        if (o === 'mode') { mode = mode === 'pencher' ? 'boutons' : 'pencher'; ecrire('jeutele-volant-mode', mode); if (mode === 'pencher') { brancherCapteur(); surveillerCapteur(); } dessiner(); }
        else if (o === 'gazauto') { gazAuto = !gazAuto; ecrire('jeutele-volant-gazauto', gazAuto ? 'oui' : 'non'); dessiner(); }
        else if (o === 'centrer') { if (angleBrut !== null) { centre = angleLisse; info('Position « tout droit » enregistrée.'); } }
        else if (o === 'recommencer') { envoyer({ t: 'choix', id: 'recommencer' }); }
        else if (o === 'permis') { demanderPermission(); }
      });
    });
    racine.querySelectorAll('[data-b]').forEach(function (el) {
      var b = el.getAttribute('data-b');
      function appui(e) { e.preventDefault(); appuis[b] = true; el.classList.add('actif'); vibrer(20); tick(); }
      function relache(e) { e.preventDefault(); delete appuis[b]; el.classList.remove('actif'); tick(); }
      el.addEventListener('touchstart', appui, { passive: false });
      el.addEventListener('touchend', relache, { passive: false });
      el.addEventListener('touchcancel', relache, { passive: false });
      el.addEventListener('mousedown', appui);
      el.addEventListener('mouseup', relache);
      el.addEventListener('mouseleave', relache);
    });
  }
  function info(txt) { var el = $('.vl-info'); if (el) el.textContent = txt; }

  // ---------- Entrée / sortie ----------
  function afficher(el, ui, fnEnvoyer, fnVibrer) {
    racine = el; envoyer = fnEnvoyer; vibrer = fnVibrer || function () {};
    if (!actif) {
      actif = true;
      // On écoute toujours : si le capteur répond sans autorisation (Android), le message d'autorisation disparaît tout seul.
      if (mode === 'pencher') { brancherCapteur(); surveillerCapteur(); }
      garderAllume();
      clearInterval(minuterie);
      minuterie = setInterval(tick, 33);
    }
    dessiner();
    if (ui && ui.texte) info(ui.texte);
  }
  function arreter() {
    if (!actif) return;
    actif = false;
    clearInterval(minuterie);
    clearTimeout(attenteCapteur);
    window.removeEventListener('deviceorientation', surOrientation);
    appuis = {};
    if (envoyer) envoyer({ t: 'volant', v: 0, gaz: false, ag: false, ad: false });
    if (verrou) { try { verrou.release(); } catch (e) {} verrou = null; }
    racine = null;
  }

  return { afficher: afficher, arreter: arreter };
})();
