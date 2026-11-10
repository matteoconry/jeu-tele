/* Manette sur le téléphone : profil, menu (catalogue + réglages), pad en jeu. */
(function () {
  'use strict';
  var VERSION = 11; // doit être égal à VERSION dans js/console.js

  function $(id) { return document.getElementById(id); }
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var params = new URLSearchParams(location.search);
  var salle = (params.get('salle') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Identifiant stable de ce téléphone : s'il se reconnecte, il retrouve sa place.
  var idTel = lire('jeutele-idtel');
  if (!idTel) { idTel = 'tel-' + Math.random().toString(36).slice(2, 10); ecrire('jeutele-idtel', idTel); }

  var profil = { nom: lire('jeutele-nom') || '', couleur: lire('jeutele-couleur') || '' };
  var couleurs = ['#ff6b35', '#4ecdc4', '#ffd166', '#c77dff', '#80ed99', '#ff8fab'];
  var moi = null;            // {numero, nom, couleur} donné par la télé
  var dernierEcran = null;   // dernier écran demandé par la télé
  var surProfil = !profil.nom; // la première fois, on demande le pseudo
  var onglet = 'jeux';

  // ---------- Écrans ----------
  function montrer(id) {
    ['ecranProfil', 'ecranMenu', 'ecranJeu'].forEach(function (e) { $(e).className = 'ecran' + (e === id ? ' visible' : ''); });
  }
  function message(t, bouton) {
    $('msgTexte').textContent = t || '';
    $('msgBouton').style.display = bouton === false ? 'none' : '';
    $('message').style.display = t ? 'flex' : 'none';
  }
  $('msgBouton').onclick = function () { location.reload(); };
  function etat(t) { $('etat').textContent = t; }

  function afficher() {
    if (surProfil) { remplirProfil(); montrer('ecranProfil'); return; }
    if (!dernierEcran) { montrer(null); return; }
    if (dernierEcran.ecran === 'jeu') { remplirJeu(dernierEcran); montrer('ecranJeu'); }
    else { remplirMenu(dernierEcran); montrer('ecranMenu'); }
  }

  // ---------- Profil ----------
  var profilOuvert = false;
  function remplirProfil() {
    // Le champ n'est rempli qu'à l'ouverture de l'écran, pour ne pas effacer ce qu'on est en train de taper.
    if (!profilOuvert) { $('champNom').value = profil.nom || (moi ? moi.nom : ''); profilOuvert = true; }
    var h = '';
    var actuelle = profil.couleur || (moi && moi.couleur) || couleurs[0];
    couleurs.forEach(function (c) {
      h += '<button class="couleur' + (c === actuelle ? ' choisie' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
    });
    $('choixCouleurs').innerHTML = h;
  }
  $('choixCouleurs').addEventListener('click', function (e) {
    var c = e.target.getAttribute('data-c');
    if (!c) return;
    profil.couleur = c;
    document.documentElement.style.setProperty('--couleur', c);
    remplirProfil();
  });
  $('okProfil').onclick = function () {
    profil.nom = $('champNom').value.trim().slice(0, 14);
    if (!profil.couleur) profil.couleur = (moi && moi.couleur) || couleurs[0];
    ecrire('jeutele-nom', profil.nom);
    ecrire('jeutele-couleur', profil.couleur);
    $('champNom').blur();
    envoyer({ t: 'profil', nom: profil.nom, couleur: profil.couleur });
    surProfil = false;
    profilOuvert = false;
    afficher();
  };

  // ---------- Menu ----------
  document.querySelectorAll('#onglets button').forEach(function (b) {
    b.onclick = function () {
      var o = b.getAttribute('data-onglet');
      if (o === 'moi') { surProfil = true; profilOuvert = false; afficher(); return; }
      onglet = o;
      afficher();
    };
  });

  function remplirMenu(e) {
    document.querySelectorAll('#onglets button').forEach(function (b) {
      b.className = b.getAttribute('data-onglet') === onglet ? 'actif' : '';
    });
    $('ongletJeux').className = 'onglet' + (onglet === 'jeux' ? ' visible' : '');
    $('ongletParams').className = 'onglet' + (onglet === 'params' ? ' visible' : '');

    var h = '';
    (e.jeux || []).forEach(function (g) {
      h += '<button class="carteJeu' + (g.jouable ? '' : ' indispo') + '" data-jeu="' + echapper(g.id) + '">' +
        '<span class="emoji">' + g.emoji + '</span><span><div class="titre">' + echapper(g.nom) + '</div>' +
        '<div class="desc">' + echapper(g.description) + '</div>' +
        (g.raison ? '<div class="raison">' + echapper(g.raison) + '</div>' : '') + '</span></button>';
    });
    $('ongletJeux').innerHTML = h;

    h = '';
    var d = e.descrParams || {};
    for (var k in d) {
      h += '<div class="reglage"><div class="nom">' + echapper(d[k].nom) + '</div><div class="valeurs">';
      d[k].valeurs.forEach(function (v) {
        var txt = v === true ? 'Oui' : (v === false ? 'Non' : String(v));
        h += '<button class="' + (e.params[k] === v ? 'actif' : '') + '" data-cle="' + k + '" data-val=\'' +
          JSON.stringify(v) + '\'>' + txt + '</button>';
      });
      h += '</div></div>';
    }
    $('ongletParams').innerHTML = h;

    h = '';
    (e.joueurs || []).forEach(function (j) { h += '<span style="background:' + j.couleur + '">' + echapper(j.nom) + '</span>'; });
    $('presents').innerHTML = h ? 'Connectés : ' + h : '';
  }
  $('ongletJeux').addEventListener('click', function (e) {
    var el = e.target.closest('[data-jeu]');
    if (el) { envoyer({ t: 'choisir', id: el.getAttribute('data-jeu') }); vibrer(30); }
  });
  $('ongletParams').addEventListener('click', function (e) {
    var el = e.target.closest('[data-cle]');
    if (el) { envoyer({ t: 'param', cle: el.getAttribute('data-cle'), valeur: JSON.parse(el.getAttribute('data-val')) }); vibrer(20); }
  });

  // ---------- Jeu ----------
  // Deux modes : la manette classique (croix + boutons), ou un écran « perso » envoyé par le jeu
  // ({t:'ui', ui:{titre, texte, emoji, boutons, mode, disposition, pad, stats, cle}}).
  var boutonsActuels = '';
  var dernierUI = null;

  function remplirJeu(e) {
    var ui = e.perso ? dernierUI : null;
    var stats = ui && ui.stats;
    $('nomJeu').innerHTML = stats && stats.texte ? '<b>' + echapper(stats.texte) + '</b>' : stats
      ? '<b>🪙 ' + stats.pieces + '</b> &nbsp; <b>⭐ ' + stats.etoiles + '</b>' + (stats.rang ? ' &nbsp; ' + echapper(stats.rang) : '')
      : echapper((e.jeu.emoji || '') + ' ' + e.jeu.nom);

    var avecPad = !e.perso || (ui && ui.pad);
    $('zone').style.display = avecPad ? '' : 'none';
    $('perso').style.display = avecPad ? 'none' : '';

    if (avecPad) {
      if (window.Volant) Volant.arreter();
      var ids = ui && ui.boutons ? ui.boutons.map(function (b) { return b.id; }) : (e.boutons || ['A']);
      var labels = ui && ui.boutons ? ui.boutons.map(function (b) { return b.label; }) : ids;
      var liste = ids.join(',') + '|' + labels.join(',');
      if (liste !== boutonsActuels) {
        boutonsActuels = liste;
        $('boutons').innerHTML = ids.map(function (b, i) {
          return '<div class="bouton' + (i ? ' b2' : '') + '" data-b="' + echapper(b) + '">' + echapper(labels[i]) + '</div>';
        }).join('');
        $('boutons').querySelectorAll('.bouton').forEach(brancherBouton);
      }
      return;
    }
    remplirPerso(ui);
  }

  var persoRendu; // undefined = rien d'affiché encore
  function remplirPerso(ui) {
    if (persoRendu === ui) return; // déjà affiché (évite de casser un appui en cours)
    persoRendu = ui;
    // Volant pour les jeux de course (js/volant.js).
    if (ui && ui.volant && window.Volant) { $('perso').style.background = ui.fond || ''; Volant.afficher($('perso'), ui, envoyer, vibrer); return; }
    if (window.Volant) Volant.arreter();
    $('perso').style.justifyContent = ui && (ui.bac || ui.bascules) ? 'flex-start' : '';
    if (!ui) { $('perso').innerHTML = '<div class="perso-texte">Prépare-toi…</div>'; return; }
    var h = '';
    if (ui.emoji) h += '<div class="perso-emoji">' + ui.emoji + '</div>';
    if (ui.titre) h += '<div class="perso-titre">' + echapper(ui.titre) + '</div>';
    if (ui.texte) h += '<div class="perso-texte">' + echapper(ui.texte) + '</div>';
    // Cartes (main d'un jeu de cartes) : touchables si ui.cartes.choix
    var cartes = ui.cartes, choisies = {};
    // Petit bac : une case de saisie par catégorie (le jeu gère ses propres boutons).
    if (ui.bac) { $('perso').innerHTML = h; $('perso').style.background = ui.fond || ''; remplirBac(ui); return; }
    // Liste de réponses à accepter / refuser (vote du petit bac). Touchées = refusées, envoyées dans sel.
    if (ui.bascules) {
      var groupe = null;
      h += '<div class="bascules">';
      ui.bascules.forEach(function (x) {
        if (x.groupe !== groupe) { groupe = x.groupe; h += '<div class="bascule-groupe">' + echapper(groupe) + '</div>'; }
        h += '<button class="bascule" data-c="' + echapper(x.id) + '"><span class="mot">' + echapper(x.texte) + '</span>' +
          '<span class="qui" style="color:' + (x.couleur || '#fff') + '">' + echapper(x.sous || '') + '</span><span class="avis">👍</span></button>';
      });
      if (!ui.bascules.length) h += '<div class="perso-texte">Rien à vérifier cette fois.</div>';
      h += '</div>';
    }
    if (cartes && cartes.liste) {
      h += '<div class="perso-cartes' + (cartes.grandes ? ' grandes' : '') + (cartes.choix ? ' choix' : '') + '">';
      cartes.liste.forEach(function (k) {
        h += '<div class="carte' + (k.rouge ? ' rouge' : '') + (k.j ? ' joker' : '') + (k.marque ? ' marque' : '') + '" data-c="' + echapper(k.id) + '">' +
          (k.j ? '<b>★</b><i>JOKER</i>' : '<b>' + echapper(k.r) + '</b><i>' + echapper(k.s) + '</i>') + '</div>';
      });
      h += '</div>';
    }
    if (ui.dessin) {
      h += '<canvas class="perso-dessin"></canvas><div class="perso-palette">' +
        (ui.dessin.couleurs || ['#1b1b2f', '#e63946', '#fb8500', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#ff70a6', '#8d5524', '#ffffff']).map(function (c) {
          return '<button class="pastille-c" data-c="' + c + '" style="background:' + c + '"></button>';
        }).join('') + '<button class="outil" data-o="gros">●</button><button class="outil" data-o="annuler">↶</button><button class="outil" data-o="effacer">🗑</button></div>';
    }
    if (ui.boutons && ui.boutons.length) {
      h += '<div class="perso-boutons ' + (ui.disposition || 'colonne') + '">';
      ui.boutons.forEach(function (b) {
        h += '<button class="perso-bouton" data-id="' + echapper(b.id) + '"' + (b.desactive ? ' disabled' : '') +
          (b.selMin !== undefined ? ' data-min="' + b.selMin + '"' : '') + (b.selMax !== undefined ? ' data-max="' + b.selMax + '"' : '') +
          (b.couleur ? ' style="background:' + b.couleur + '"' : '') + '>' + echapper(b.label) +
          (b.sous ? '<small>' + echapper(b.sous) + '</small>' : '') + '</button>';
      });
      h += '</div>';
    }
    $('perso').innerHTML = h;
    $('perso').style.background = ui.fond || '';
    if (ui.vibrer) vibrer(ui.vibrer);

    function majSelection() {
      var n = Object.keys(choisies).length;
      $('perso').querySelectorAll('.perso-bouton').forEach(function (x) {
        if (x.className.indexOf('choisi') !== -1) return;
        var mi = x.getAttribute('data-min'), ma = x.getAttribute('data-max');
        if (mi === null && ma === null) return;
        x.disabled = (mi !== null && n < +mi) || (ma !== null && n > +ma);
      });
    }
    if (ui.dessin) brancherDessin(ui);
    if (cartes && cartes.choix) {
      $('perso').querySelectorAll('.carte').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-c');
          if (choisies[id]) { delete choisies[id]; el.className = el.className.replace(' sel', ''); }
          else { choisies[id] = true; el.className += ' sel'; }
          vibrer(10);
          majSelection();
        });
      });
    }
    if (ui.bascules) {
      $('perso').querySelectorAll('.bascule').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-c');
          if (choisies[id]) delete choisies[id]; else choisies[id] = true;
          el.classList.toggle('refuse', !!choisies[id]);
          el.querySelector('.avis').textContent = choisies[id] ? '👎' : '👍';
          vibrer(15);
        });
      });
    }
    majSelection();

    $('perso').querySelectorAll('.perso-bouton').forEach(function (el) {
      var id = el.getAttribute('data-id');
      if (ui.mode === 'manette') {
        el.setAttribute('data-b', id);
        brancherBouton(el);
      } else {
        el.addEventListener('click', function () {
          if (el.disabled) return;
          envoyer({ t: 'choix', id: id, cle: ui.cle, sel: Object.keys(choisies) });
          vibrer(30);
          $('perso').querySelectorAll('.perso-bouton').forEach(function (x) {
            x.disabled = true;
            if (x === el) x.className += ' choisi';
          });
        });
      }
    });
  }

  // ---------- Petit bac ----------
  // ui.bac = {lettre, manche, categories:[…], reponses:[…], seche, bandeau:{texte, reste}}
  // Envoie {t:'mot', i, mot} à chaque frappe, {t:'stop'} quand tout est rempli, {t:'seche', oui}.
  function sansAccents(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  var bandeauBac = null; // {cle, texte, fin}
  function remplirBac(ui) {
    var b = ui.bac, lettre = b.lettre.toLowerCase(), seche = !!b.seche;
    var h = '<div class="bac-tete"><div class="bac-lettre">' + echapper(b.lettre) + '</div><div class="bac-info"><b>' +
      echapper(b.manche || '') + '</b><span>Un mot qui commence par ' + echapper(b.lettre) + ' dans chaque case</span></div></div>' +
      '<div class="bac-bandeau"></div><div class="bac-liste">';
    b.categories.forEach(function (cat, i) {
      h += '<label class="bac-ligne"><span class="bac-cat">' + echapper(cat) + '</span><span class="bac-champ">' +
        '<input data-i="' + i + '" maxlength="30" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="next" value="' +
        echapper((b.reponses && b.reponses[i]) || '') + '"><span class="bac-ok"></span></span></label>';
    });
    h += '</div><button class="perso-bouton bac-stop" disabled>✋ STOP !</button>' +
      '<button class="bac-seche">' + (seche ? '✍️ Je reprends' : '🏳️ Je sèche') + '</button>';
    var zone = document.createElement('div');
    zone.className = 'bac';
    zone.innerHTML = h;
    $('perso').appendChild(zone);
    var champs = zone.querySelectorAll('input'), stop = zone.querySelector('.bac-stop');
    function bon(v) { var n = sansAccents(v); return n.length >= 2 && n.charAt(0) === lettre; }
    function maj() {
      var tous = true;
      champs.forEach(function (c) {
        var v = c.value.trim(), ok = bon(v);
        c.parentNode.querySelector('.bac-ok').textContent = !v ? '' : ok ? '✅' : '❌';
        c.parentNode.className = 'bac-champ' + (v && !ok ? ' faux' : '') + (ok ? ' bon' : '');
        if (!ok) tous = false;
      });
      stop.disabled = !tous;
    }
    champs.forEach(function (c, i) {
      c.addEventListener('input', function () { envoyer({ t: 'mot', cle: ui.cle, i: i, mot: c.value.slice(0, 30) }); maj(); });
      c.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (champs[i + 1]) champs[i + 1].focus(); else c.blur();
      });
    });
    stop.addEventListener('click', function () {
      if (stop.disabled) return;
      champs.forEach(function (c) { envoyer({ t: 'mot', cle: ui.cle, i: +c.getAttribute('data-i'), mot: c.value.slice(0, 30) }); c.blur(); });
      envoyer({ t: 'stop', cle: ui.cle });
      stop.disabled = true;
      vibrer(120);
    });
    zone.querySelector('.bac-seche').addEventListener('click', function () {
      seche = !seche;
      this.textContent = seche ? '✍️ Je reprends' : '🏳️ Je sèche';
      envoyer({ t: 'seche', cle: ui.cle, oui: seche });
      vibrer(20);
    });
    if (b.bandeau) bandeauBac = { cle: ui.cle, texte: b.bandeau.texte, fin: Date.now() + b.bandeau.reste * 1000 };
    majBandeauBac();
    maj();
  }
  function majBandeauBac() {
    var el = $('perso').querySelector('.bac-bandeau');
    if (!el) return;
    var b = bandeauBac, ok = b && dernierUI && b.cle === dernierUI.cle;
    el.style.display = ok ? '' : 'none';
    if (ok) el.textContent = b.texte + ' · ' + Math.max(0, Math.ceil((b.fin - Date.now()) / 1000)) + ' s';
  }
  setInterval(majBandeauBac, 250);

  // Zone de dessin : chaque trait est envoyé à la télé en coordonnées 0..1.
  function brancherDessin(ui) {
    var cv = $('perso').querySelector('.perso-dessin'), cx = cv.getContext('2d');
    var cote = Math.min($('perso').clientWidth - 36, window.innerHeight * 0.5, 520);
    var r = window.devicePixelRatio || 1;
    cv.style.width = cv.style.height = cote + 'px';
    cv.width = cv.height = Math.round(cote * r);
    var traits = [], courant = null, couleur = '#1b1b2f', epais = 0.012;
    function redessiner() {
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      traits.forEach(tracer);
    }
    function tracer(t) {
      cx.strokeStyle = t.c; cx.lineWidth = t.w * cv.width; cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.beginPath();
      t.p.forEach(function (q, i) { var x = q[0] * cv.width, y = q[1] * cv.height; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); });
      if (t.p.length === 1) cx.lineTo(t.p[0][0] * cv.width + 0.1, t.p[0][1] * cv.height);
      cx.stroke();
    }
    function point(e) {
      var b = cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e;
      return [Math.round(F_borne((s.clientX - b.left) / b.width) * 1000) / 1000, Math.round(F_borne((s.clientY - b.top) / b.height) * 1000) / 1000];
    }
    function F_borne(v) { return Math.max(0, Math.min(1, v)); }
    function debut(e) { e.preventDefault(); courant = { c: couleur, w: epais, p: [point(e)] }; traits.push(courant); tracer(courant); }
    function bouge(e) { if (!courant) return; e.preventDefault(); var q = point(e), d = courant.p[courant.p.length - 1]; if (Math.abs(q[0] - d[0]) + Math.abs(q[1] - d[1]) < 0.004) return; courant.p.push(q); redessinerDernier(); }
    function redessinerDernier() { var n = courant.p.length; tracer({ c: courant.c, w: courant.w, p: courant.p.slice(Math.max(0, n - 2)) }); }
    function fin(e) { if (!courant) return; if (e) e.preventDefault(); envoyer({ t: 'trait', cle: ui.cle, trait: courant }); courant = null; }
    cv.addEventListener('touchstart', debut, { passive: false });
    cv.addEventListener('touchmove', bouge, { passive: false });
    cv.addEventListener('touchend', fin, { passive: false });
    cv.addEventListener('mousedown', debut);
    cv.addEventListener('mousemove', bouge);
    window.onmouseup = function () { fin(); };
    $('perso').querySelectorAll('.pastille-c').forEach(function (b) {
      b.onclick = function () { couleur = b.getAttribute('data-c'); $('perso').querySelectorAll('.pastille-c').forEach(function (x) { x.classList.toggle('active', x === b); }); };
    });
    $('perso').querySelectorAll('.outil').forEach(function (b) {
      b.onclick = function () {
        var o = b.getAttribute('data-o');
        if (o === 'gros') { epais = epais === 0.012 ? 0.03 : epais === 0.03 ? 0.006 : 0.012; b.textContent = epais === 0.03 ? '⬤' : epais === 0.006 ? '·' : '●'; }
        else if (o === 'annuler') { traits.pop(); redessiner(); envoyer({ t: 'annuler', cle: ui.cle }); }
        else if (o === 'effacer') { traits = []; redessiner(); envoyer({ t: 'effacer', cle: ui.cle }); }
      };
    });
    var premiere = $('perso').querySelector('.pastille-c'); if (premiere) premiere.classList.add('active');
    redessiner();
  }

  $('boutonMenu').onclick = function () {
    if (dernierEcran && dernierEcran.perso && !confirm('Quitter la partie et revenir au menu ?')) return;
    envoyer({ t: 'menu' });
  };

  function brancherBouton(el) {
    var b = el.getAttribute('data-b');
    function appui(e) { e.preventDefault(); el.className = el.className.replace(' actif', '') + ' actif'; envoyer({ t: 'bouton', b: b, appui: true }); vibrer(25); }
    function relache(e) { e.preventDefault(); el.className = el.className.replace(' actif', ''); envoyer({ t: 'bouton', b: b, appui: false }); }
    el.addEventListener('touchstart', appui, { passive: false });
    el.addEventListener('touchend', relache, { passive: false });
    el.addEventListener('touchcancel', relache, { passive: false });
    el.addEventListener('mousedown', appui);
    el.addEventListener('mouseup', relache);
  }

  // Croix directionnelle (multi-touch, on peut glisser d'une flèche à l'autre, diagonales possibles).
  var DIRS = { h: [0, -1], b: [0, 1], g: [-1, 0], d: [1, 0] };
  var pad = $('pad');
  var doigts = {};
  var derniereDir = '0,0';

  function flecheSous(x, y) {
    var r = pad.getBoundingClientRect();
    var cx = (x - r.left) / r.width - 0.5, cy = (y - r.top) / r.height - 0.5;
    if (Math.abs(cx) > 0.6 || Math.abs(cy) > 0.6) return null;
    if (Math.abs(cx) < 0.12 && Math.abs(cy) < 0.12) return null;
    var res = [];
    if (cy < -0.12) res.push('h'); else if (cy > 0.12) res.push('b');
    if (cx < -0.12) res.push('g'); else if (cx > 0.12) res.push('d');
    if (res.length === 2 && Math.abs(Math.abs(cx) - Math.abs(cy)) > 0.15) {
      res = [Math.abs(cx) > Math.abs(cy) ? res[1] : res[0]];
    }
    return res.join('');
  }
  function majDirection() {
    var x = 0, y = 0, actifs = {};
    for (var k in doigts) {
      var f = doigts[k];
      if (!f) continue;
      for (var i = 0; i < f.length; i++) { var d = DIRS[f.charAt(i)]; x += d[0]; y += d[1]; actifs[f.charAt(i)] = true; }
    }
    x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
    ['h', 'b', 'g', 'd'].forEach(function (id) { $(id).className = 'dir' + (actifs[id] ? ' actif' : ''); });
    var cle = x + ',' + y;
    if (cle !== derniereDir) { derniereDir = cle; envoyer({ t: 'dir', x: x, y: y }); }
  }
  function surPad(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (e.type === 'touchend' || e.type === 'touchcancel') delete doigts[t.identifier];
      else doigts[t.identifier] = flecheSous(t.clientX, t.clientY);
    }
    majDirection();
  }
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (ev) { pad.addEventListener(ev, surPad, { passive: false }); });
  var sourisBas = false;
  pad.addEventListener('mousedown', function (e) { sourisBas = true; doigts.souris = flecheSous(e.clientX, e.clientY); majDirection(); });
  window.addEventListener('mousemove', function (e) { if (sourisBas) { doigts.souris = flecheSous(e.clientX, e.clientY); majDirection(); } });
  window.addEventListener('mouseup', function () { if (sourisBas) { sourisBas = false; delete doigts.souris; majDirection(); } });
  function lacherTout() { doigts = {}; majDirection(); }

  // Renvoi régulier de la direction (au cas où un message se perdrait pendant une reconnexion).
  setInterval(function () {
    if (derniereDir !== '0,0') { var p = derniereDir.split(','); envoyer({ t: 'dir', x: +p[0], y: +p[1] }); }
  }, 500);

  function vibrer(ms) { if (navigator.vibrate) navigator.vibrate(ms); }
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // ---------- Connexion ----------
  if (!salle) {
    var saisie = prompt('Code de la salle affiché sur la télé :');
    if (saisie) location.search = '?salle=' + encodeURIComponent(saisie.trim().toUpperCase());
    else message('Aucune salle. Scanne le QR code affiché sur la télé.');
    return;
  }

  var peer = null, conn = null, essais = 0, minuterieReco = null, refuse = false, dernierPing = null;

  function envoyer(m) { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } }

  function connecter() {
    clearTimeout(minuterieReco);
    if (!peer || peer.destroyed) {
      peer = new Peer(window.PEER_OPTS || { debug: 1 });
      peer.on('open', ouvrirConnexion);
      peer.on('disconnected', function () { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', function (err) {
        console.error(err);
        if (err.type === 'peer-unavailable') {
          etat('Télé introuvable');
          message('La télé (salle ' + salle + ') ne répond pas. Vérifie que la page est ouverte sur la télé, puis réessaie.');
        } else if (err.type === 'browser-incompatible') {
          message('Ce navigateur ne gère pas WebRTC.', false);
        } else {
          etat('Erreur : ' + err.type);
          programmerReco();
        }
      });
    } else if (peer.open) {
      ouvrirConnexion();
    }
  }

  function ouvrirConnexion() {
    if (conn && conn.open) return;
    etat('Connexion à la télé…');
    conn = peer.connect('jeutele-mc-' + salle, {
      reliable: true,
      metadata: { idTel: idTel, nom: profil.nom, couleur: profil.couleur }
    });
    var c = conn;
    c.on('open', function () { essais = 0; etat('Connecté'); message(''); });
    c.on('data', function (m) {
      if (!m || c !== conn) return;
      if (m.t === 'bienvenue') {
        // La télé a une autre version : on recharge la page (une seule fois par version) pour prendre le nouveau code.
        if (m.version && m.version !== VERSION && lire('jeutele-recharge') !== String(m.version)) {
          ecrire('jeutele-recharge', String(m.version));
          location.reload();
          return;
        }
        moi = m;
        message('');
        if (m.couleurs) couleurs = m.couleurs;
        $('monNom').textContent = m.nom;
        document.documentElement.style.setProperty('--couleur', m.couleur);
        if (profil.nom && m.couleur !== profil.couleur) { profil.couleur = m.couleur; ecrire('jeutele-couleur', m.couleur); }
        vibrer(80);
        afficher();
      } else if (m.t === 'ui') {
        dernierUI = m.ui;
        if (dernierEcran && dernierEcran.ecran === 'jeu') afficher();
      } else if (m.t === 'ecran') {
        if (dernierEcran && dernierEcran.ecran === 'jeu' && m.ecran !== 'jeu') lacherTout();
        if (m.ecran !== 'jeu') { dernierUI = null; persoRendu = undefined; if (window.Volant) Volant.arreter(); }
        dernierEcran = m;
        afficher();
      } else if (m.t === 'plein') {
        refuse = true;
        message('La partie est complète (' + m.max + ' joueurs max). On peut augmenter la limite dans les réglages. Nouvel essai dans quelques secondes…');
        // On réessaie : une place peut se libérer (téléphone parti, limite augmentée).
        clearTimeout(minuterieReco);
        minuterieReco = setTimeout(function () { refuse = false; essais = 0; connecter(); }, 5000);
      } else if (m.t === 'bandeau') {
        bandeauBac = { cle: m.cle, texte: m.texte, fin: Date.now() + (m.reste || 0) * 1000 };
        majBandeauBac();
        vibrer(200);
      } else if (m.t === 'pong') {
        dernierPing = performance.now() - m.ts;
        etat('Connecté · ' + Math.round(dernierPing) + ' ms');
      }
    });
    c.on('close', function () { if (c === conn) { etat('Déconnecté, reconnexion…'); programmerReco(); } });
    c.on('error', function () { if (c === conn) programmerReco(); });
  }

  function programmerReco() {
    clearTimeout(minuterieReco);
    if (refuse) return;
    essais++;
    if (essais > 8) { message('Connexion perdue avec la télé.'); return; }
    minuterieReco = setTimeout(connecter, Math.min(8000, 1000 * essais));
  }

  // Latence mesurée toutes les 2 s, et renvoyée à la télé pour l'afficher.
  setInterval(function () { envoyer({ t: 'ping', ts: performance.now(), dernier: dernierPing }); }, 2000);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !(conn && conn.open) && !refuse) { essais = 0; connecter(); }
  });

  afficher();
  connecter();
})();
