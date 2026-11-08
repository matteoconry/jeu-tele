/*
 * Magnats de la Ville — jeu de plateau d'achat de propriétés (2 à 4 joueurs).
 * Un anneau de 28 cases autour d'une ville : on achète des rues, on construit des immeubles,
 * on encaisse des loyers. Le dernier non ruiné (ou le plus riche à la fin) gagne.
 */
(function (F) {
  'use strict';

  var ARGENT_DEPART = 1500, BONUS_DEPART = 200, AMENDE_ILE = 50, PRIX_PORT = 200;
  var GROUPES = {
    brun: '#8d6346', ciel: '#48cae4', rose: '#ff70a6', orange: '#fb8500',
    rouge: '#e63946', jaune: '#ffd60a', vert: '#2a9d8f', marine: '#3a0ca3'
  };
  function p(nom, groupe, prix) { return { type: 'prop', nom: nom, groupe: groupe, prix: prix }; }
  function port(nom) { return { type: 'port', nom: nom, prix: PRIX_PORT }; }
  var CASES = [
    { type: 'depart', nom: 'Départ' },
    p('Ruelle des Lilas', 'brun', 60), { type: 'bouteille', nom: 'Enveloppe surprise' }, p('Impasse du Moulin', 'brun', 70),
    port('Station Beffroi'), p('Rue des Boulangers', 'ciel', 100), p('Place du Marché', 'ciel', 120),
    { type: 'ile', nom: 'Embouteillage' },
    p('Allée des Tilleuls', 'rose', 140), { type: 'taxe', nom: 'Taxe de stationnement', montant: 100 }, p('Square des Artistes', 'rose', 160),
    port('Station Université'), p('Rue du Théâtre', 'orange', 180), p('Place de l\'Horloge', 'orange', 200),
    { type: 'hamac', nom: 'Fontaine aux vœux' },
    p('Avenue des Platanes', 'rouge', 220), { type: 'bouteille', nom: 'Enveloppe surprise' }, p('Cours des Remparts', 'rouge', 240),
    port('Station Stade'), p('Quartier des Ateliers', 'jaune', 260), p('Boulevard des Lumières', 'jaune', 280),
    { type: 'vague', nom: 'Déviation' },
    p('Parc du Belvédère', 'vert', 300), p('Avenue du Musée', 'vert', 320), port('Station Hôpital'),
    { type: 'bouteille', nom: 'Enveloppe surprise' }, p('Colline des Ambassades', 'marine', 350), p('Hauts de la Couronne', 'marine', 400)
  ];

  var BOUTEILLES = [
    { texte: 'Tu gagnes au loto du quartier !', effet: 'gain', n: 150 },
    { texte: 'Tu retrouves un billet oublié dans ta veste.', effet: 'gain', n: 100 },
    { texte: 'Ta voiture passe au garage.', effet: 'perte', n: 100 },
    { texte: 'Un taxi te ramène au Départ.', effet: 'depart' },
    { texte: 'Mauvais itinéraire : tu finis coincé dans l\'embouteillage !', effet: 'ile' },
    { texte: 'C\'est ton anniversaire : chaque joueur t\'offre 30.', effet: 'anniv', n: 30 },
    { texte: 'Tu offres une tournée de cafés : donne 25 à chaque joueur.', effet: 'tournee', n: 25 },
    { texte: 'Ravalement des façades : 25 par étage construit.', effet: 'entretien', n: 25 },
    { texte: 'Tu sautes dans le tram jusqu\'à la prochaine station.', effet: 'port' },
    { texte: 'Un passant t\'indique un raccourci : avance de 3 cases.', effet: 'avance', n: 3 },
    { texte: 'Tu gagnes le concours des plus belles vitrines !', effet: 'gain', n: 50 },
    { texte: 'Amende pour stationnement gênant.', effet: 'perte', n: 50 }
  ];

  // ---------- Décor : une petite ville vue de 3/4 (modèles Kenney CC0, voir CREDITS.md) ----------
  var MODELES_VILLE = ['ville/building-small-a', 'ville/building-small-b', 'ville/building-small-c', 'ville/building-small-d',
    'ville/building-garage', 'ville/pavement-fountain', 'arene/tree'];
  var decor3d = false;
  function prechargerVille() {
    if (!window.Kenney3D) return;
    Kenney3D.charger(MODELES_VILLE).then(function () { decor3d = true; }).catch(function (e) { console.warn('Décor 3D indisponible', e); });
  }
  var RUES_Y = [262, 640], RUES_X = [430, 1170], LARGEUR_RUE = 56;
  function decorVille() {
    var cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
    var c = cv.getContext('2d');
    c.fillStyle = '#8bc34a'; c.fillRect(0, 0, 1600, 900);
    // trottoirs puis chaussées
    c.fillStyle = '#cfd4da';
    RUES_Y.forEach(function (y) { c.fillRect(0, y - LARGEUR_RUE / 2 - 10, 1600, LARGEUR_RUE + 20); });
    RUES_X.forEach(function (x) { c.fillRect(x - LARGEUR_RUE / 2 - 10, 0, LARGEUR_RUE + 20, 900); });
    c.fillRect(560, 340, 480, 222);
    c.fillStyle = '#495057';
    RUES_Y.forEach(function (y) { c.fillRect(0, y - LARGEUR_RUE / 2, 1600, LARGEUR_RUE); });
    RUES_X.forEach(function (x) { c.fillRect(x - LARGEUR_RUE / 2, 0, LARGEUR_RUE, 900); });
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.setLineDash([22, 18]);
    RUES_Y.forEach(function (y) { c.beginPath(); c.moveTo(0, y); c.lineTo(1600, y); c.stroke(); });
    RUES_X.forEach(function (x) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 900); c.stroke(); });
    c.setLineDash([]);
    // passages piétons aux carrefours
    c.fillStyle = 'rgba(255,255,255,.8)';
    RUES_X.forEach(function (x) { RUES_Y.forEach(function (y) {
      for (var k = -2; k <= 2; k++) { c.fillRect(x - LARGEUR_RUE / 2 - 14, y + k * 11 - 3, 10, 6); c.fillRect(x + LARGEUR_RUE / 2 + 4, y + k * 11 - 3, 10, 6); }
    }); });
    // place centrale pavée
    c.fillStyle = '#e9ecef'; F.rr(c, 570, 350, 460, 202, 18); c.fill();
    var en3d = decor3d && window.Kenney3D && Kenney3D.pret();
    if (en3d) {
      try {
        var objets = [], phi = 0.95, sp = Math.sin(phi), BAT = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage'];
        var COUL = [null, '#e76f51', '#3a86ff', null, '#8338ec', '#2a9d8f', null, '#ffbe0b'];
        var n = 0;
        // immeubles alignés le long des avenues, face à la rue
        RUES_Y.forEach(function (ry, k) {
          for (var x = 140; x < 1500; x += 92) {
            if (RUES_X.some(function (rx) { return Math.abs(x - rx) < 70; })) continue;
            [-1, 1].forEach(function (cote) {
              if (k === 0 && cote > 0 && x > 520 && x < 1080) return; // place centrale
              if (k === 1 && cote < 0 && x > 520 && x < 1080) return;
              var y = ry + cote * (LARGEUR_RUE / 2 + 52);
              objets.push({ nom: 'ville/' + BAT[n % BAT.length], x: x, y: y, echelle: 78, rot: cote < 0 ? 0 : Math.PI,
                couleur: COUL[n % COUL.length] || undefined, teintes: [0.5, 0.75] });
              n++;
            });
          }
        });
        // arbres le long des avenues verticales et autour de la place
        RUES_X.forEach(function (rx) {
          for (var y = 60; y < 880; y += 70) {
            if (RUES_Y.some(function (ry) { return Math.abs(y - ry) < 60; })) continue;
            objets.push({ nom: 'arene/tree', x: rx - LARGEUR_RUE / 2 - 30, y: y, echelle: 34, rot: y });
            objets.push({ nom: 'arene/tree', x: rx + LARGEUR_RUE / 2 + 30, y: y + 35, echelle: 34, rot: y * 2 });
          }
        });
        [[600, 370], [1000, 370], [600, 540], [1000, 540], [700, 360], [900, 360]].forEach(function (q, i) { objets.push({ nom: 'arene/tree', x: q[0], y: q[1], echelle: 36, rot: i }); });
        objets.push({ nom: 'ville/pavement-fountain', x: 800, y: 455, echelle: 110 });
        objets.sort(function (a, b) { return a.y - b.y; });
        var img = Kenney3D.vueOblique(objets, { x0: 0, y0: 0, largeur: 1600, hauteur: 900, echelle: 1, phi: phi });
        c.drawImage(img, 0, 0);
        void sp;
      } catch (err) { console.warn('Décor 3D :', err); en3d = false; }
    }
    if (!en3d) {
      // en attendant la 3D : des toits plats
      RUES_Y.forEach(function (ry) {
        for (var x = 140; x < 1500; x += 92) {
          if (RUES_X.some(function (rx) { return Math.abs(x - rx) < 70; })) continue;
          [-1, 1].forEach(function (cote) {
            c.fillStyle = ['#e9c46a', '#f4a261', '#90caf9', '#ced4da'][(x / 92 | 0) % 4];
            F.rr(c, x - 36, ry + cote * (LARGEUR_RUE / 2 + 52) - 34, 72, 62, 6); c.fill();
          });
        }
      });
    }
    // léger voile pour que les cases et les textes ressortent
    c.fillStyle = 'rgba(16,24,40,.18)'; c.fillRect(0, 0, 1600, 900);
    cv.sans3d = !en3d;
    return cv;
  }

  function creer(api) {
    F.viderAnims();
    prechargerVille();
    if (F.prechargerSprites) F.prechargerSprites();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var cases = CASES.map(function (c, i) {
      var o = {}; for (var k in c) o[k] = c[k];
      o.id = i; o.proprio = 0; o.niveau = 0; o.hypo = false;
      return o;
    });
    var S = {
      phase: 'titre', actif: null, des: null, journal: [], carte: null, cagnotte: 0, tour: 0, maxTours: 20,
      particules: new F.Particules(), flottants: [], t0: F.t, fin: null, pioche: F.melanger(BOUTEILLES)
    };

    // ---------- Géométrie : les cases sur une ellipse autour de la ville ----------
    // Anneau rectangulaire : 9 cases en bas (de droite à gauche), 5 à gauche, 9 en haut, 5 à droite.
    var CX = 800, CY = 450, M = 8, HB = 116, WB = (1600 - 2 * M) / 9, HS = (900 - 2 * M - 2 * HB) / 5;
    cases.forEach(function (c, i) {
      if (i < 9) { c.w = WB; c.h = HB; c.x = 1600 - M - WB * (i + 0.5); c.y = 900 - M - HB / 2; }
      else if (i < 14) { c.w = WB; c.h = HS; c.x = M + WB / 2; c.y = 900 - M - HB - HS * (i - 9 + 0.5); }
      else if (i < 23) { c.w = WB; c.h = HB; c.x = M + WB * (i - 14 + 0.5); c.y = M + HB / 2; }
      else { c.w = WB; c.h = HS; c.x = 1600 - M - WB / 2; c.y = M + HB + HS * (i - 23 + 0.5); }
      c.w -= 6; c.h -= 6;
    });

    L.stats = function (P) { return { texte: '💰 ' + P.argent + ' · 🏠 ' + proprietesDe(P).length }; };

    // ---------- Règles ----------
    function proprietesDe(P) { return cases.filter(function (c) { return c.proprio === P.num; }); }
    function groupe(g) { return cases.filter(function (c) { return c.groupe === g; }); }
    function groupeComplet(c) { return c.groupe && groupe(c.groupe).every(function (x) { return x.proprio === c.proprio && !x.hypo; }); }
    function coutVilla(c) { return Math.round(c.prix * 0.5 / 10) * 10; }
    function loyer(c) {
      if (!c.proprio || c.hypo) return 0;
      if (c.type === 'port') {
        var n = cases.filter(function (x) { return x.type === 'port' && x.proprio === c.proprio && !x.hypo; }).length;
        return 25 * Math.pow(2, n - 1);
      }
      var base = Math.round(c.prix * 0.1);
      if (c.niveau === 0) return groupeComplet(c) ? base * 2 : base;
      return Math.round(c.prix * [0, 0.5, 1.5, 3.2, 4.8][c.niveau] / 10) * 10;
    }
    function patrimoine(P) {
      var v = P.argent;
      proprietesDe(P).forEach(function (c) { v += (c.hypo ? c.prix / 2 : c.prix) + c.niveau * (c.prix ? coutVilla(c) : 0); });
      return Math.round(v);
    }
    function actifs() { return L.joueurs.filter(function (P) { return !P.faillite; }); }
    function log(txt, couleur) { S.journal.unshift({ txt: txt, couleur: couleur || '#fff', t: F.t }); if (S.journal.length > 4) S.journal.pop(); }
    function flottant(x, y, txt, col) { S.flottants.push({ x: x, y: y, txt: txt, col: col, t0: F.t }); }
    function argent(P, n) {
      P.argent += n;
      var pos = positionPion(P);
      if (n) flottant(pos.x, pos.y - 40, (n > 0 ? '+' : '−') + Math.abs(n), n > 0 ? '#80ed99' : '#ff4d6d');
    }

    // Payer : vend/hypothèque automatiquement si besoin, sinon faillite.
    async function payer(P, montant, crea) {
      if (P.argent < montant) await liquider(P, montant);
      if (P.argent < montant) {
        var reste = P.argent;
        argent(P, -reste);
        if (crea) argent(crea, reste); else S.cagnotte += reste;
        await faillite(P, crea);
        return false;
      }
      argent(P, -montant);
      if (crea) argent(crea, montant);
      return true;
    }
    async function liquider(P, montant) {
      var vendu = false;
      var avecVillas = proprietesDe(P).filter(function (c) { return c.niveau > 0; }).sort(function (a, b) { return b.niveau - a.niveau; });
      while (P.argent < montant && avecVillas.some(function (c) { return c.niveau > 0; })) {
        var c = avecVillas.filter(function (x) { return x.niveau > 0; })[0];
        c.niveau--; P.argent += Math.round(coutVilla(c) / 2); vendu = true;
      }
      var libres = proprietesDe(P).filter(function (c) { return !c.hypo && c.niveau === 0; }).sort(function (a, b) { return a.prix - b.prix; });
      for (var i = 0; i < libres.length && P.argent < montant; i++) { libres[i].hypo = true; P.argent += libres[i].prix / 2; vendu = true; }
      if (vendu) { log(P.nom + ' vend et hypothèque pour payer', '#ffd166'); await banniere('Il faut payer !', P.nom + ' vend des étages et hypothèque des rues', '#6c757d', 2); }
    }
    async function faillite(P, crea) {
      P.faillite = true;
      proprietesDe(P).forEach(function (c) {
        if (crea) { c.proprio = crea.num; c.niveau = 0; }
        else { c.proprio = 0; c.niveau = 0; c.hypo = false; }
      });
      P.ordreFaillite = L.joueurs.filter(function (x) { return x.faillite; }).length;
      F.son.perte();
      log(P.nom + ' fait faillite !', '#ff4d6d');
      L.ui(P, { emoji: '💸', titre: 'Faillite !', texte: 'Tu as tout perdu… Regarde la fin de la partie sur la télé.', fond: '#5c1a1a' });
      await banniere(P.nom + ' fait faillite !', crea ? 'Ses biens reviennent à ' + crea.nom : 'Ses biens retournent à la banque', '#d00000', 2.4);
    }

    // ---------- Effets visuels ----------
    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.8;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#3a86ff', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }
    function positionPion(P) {
      var c = cases[P.pos];
      var ici = L.joueurs.filter(function (x) { return !x.faillite && x.pos === P.pos; });
      var k = ici.indexOf(P), n = ici.length;
      return { x: c.x + (n > 1 ? (k - (n - 1) / 2) * 26 : 0), y: c.y + 6 };
    }
    function avancer(P, n) {
      var chain = Promise.resolve();
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () {
          var a = positionPion(P);
          P.pos = (P.pos + 1) % cases.length;
          var b = positionPion(P);
          P.anim = true;
          F.son.pas(i);
          var passeDepart = P.pos === 0;
          return F.anim(0.22, function (q) { P.x = F.lerp(a.x, b.x, q); P.y = F.lerp(a.y, b.y, q); P.saut = Math.sin(q * Math.PI) * 34; })
            .then(function () {
              P.saut = 0; P.anim = false;
              if (passeDepart) { argent(P, BONUS_DEPART); F.son.gain(); log(P.nom + ' passe par le Départ : +' + BONUS_DEPART, '#80ed99'); }
            });
        });
      })(i);
      return chain;
    }
    function teleporter(P, vers) {
      var a = positionPion(P);
      P.pos = vers;
      var b = positionPion(P);
      P.anim = true;
      return F.anim(0.9, function (q) { var e = F.ease.inOut(q); P.x = F.lerp(a.x, b.x, e); P.y = F.lerp(a.y, b.y, e); P.saut = Math.sin(q * Math.PI) * 180; })
        .then(function () { P.saut = 0; P.anim = false; });
    }

    async function lancerDes() {
      var a = F.entier(1, 6), b = F.entier(1, 6);
      S.des = { roule: true, a: 1, b: 1, prochain: 0 };
      F.son.roulement(0.6);
      await F.attendre(0.8);
      S.des = { roule: false, a: a, b: b, t0: F.t };
      F.son.deStop();
      await F.attendre(0.5);
      return { a: a, b: b, total: a + b, double: a === b };
    }

    // ---------- Tour d'un joueur ----------
    async function tourJoueur(P) {
      S.actif = P;
      L.uiTous({ emoji: '👀', titre: 'Tour de ' + P.nom, texte: 'Regarde le plateau sur la télé.' }, P);
      await banniere('À toi, ' + P.nom + ' !', P.argent + ' pièces en poche', P.couleur, 1.3);
      var doubles = 0;
      while (!P.faillite && !L.arrete) {
        if (P.ile > 0) { var sorti = await tourIle(P); if (!sorti) return; continue; }
        await menuAvantDes(P);
        L.ui(P, { emoji: '🎲', titre: 'Les dés roulent…', texte: '' });
        var d = await lancerDes();
        log(P.nom + ' fait ' + d.a + ' + ' + d.b + ' = ' + d.total + (d.double ? ' (double !)' : ''));
        if (d.double) doubles++;
        if (doubles === 3) {
          await banniere('Trois doubles !', P.nom + ' roule trop vite : direction l\'embouteillage', '#6c757d', 2);
          await allerIle(P);
          return;
        }
        await avancer(P, d.total);
        await caseArrivee(P, d.total);
        if (!d.double || P.faillite || P.ile > 0) return;
        await banniere('Double !', P.nom + ' rejoue', P.couleur, 1.2);
      }
    }

    async function tourIle(P) {
      P.ile++;
      var peutPayer = P.argent >= AMENDE_ILE;
      var choix = P.ile > 3 ? 'payer' : await L.demander(P, {
        emoji: '🚧', titre: 'Embouteillage', texte: 'Essai ' + (P.ile - 1) + ' sur 3. Paye ' + AMENDE_ILE + ' pour prendre un taxi, ou tente un double.',
        boutons: [{ id: 'double', label: '🎲 Tenter un double' }].concat(peutPayer ? [{ id: 'payer', label: '🚕 Taxi : ' + AMENDE_ILE, couleur: '#adb5bd' }] : [])
      }, 'double', 40);
      if (choix === 'payer') {
        var ok = await payer(P, AMENDE_ILE, null);
        if (!ok) return false;
        S.cagnotte += AMENDE_ILE;
        P.ile = 0;
        log(P.nom + ' quitte l\'embouteillage en taxi');
        return true;
      }
      var d = await lancerDes();
      if (d.double) {
        P.ile = 0;
        await banniere('Double !', P.nom + ' se faufile hors de l\'embouteillage', P.couleur, 1.4);
        await avancer(P, d.total);
        await caseArrivee(P, d.total);
        return false;
      }
      log(P.nom + ' reste coincé dans l\'embouteillage');
      if (P.ile > 3) { P.ile = 4; }
      await F.attendre(0.6);
      return false;
    }

    async function allerIle(P) {
      await teleporter(P, 7);
      P.ile = 1;
      F.son.perte();
      log(P.nom + ' est coincé dans l\'embouteillage', '#adb5bd');
    }

    function optionsConstruction(P) {
      var r = [];
      proprietesDe(P).forEach(function (c) {
        if (c.type !== 'prop' || !groupeComplet(c) || c.niveau >= 4) return;
        var min = Math.min.apply(null, groupe(c.groupe).map(function (x) { return x.niveau; }));
        if (c.niveau > min) return;
        if (P.argent < coutVilla(c)) return;
        r.push(c);
      });
      return r;
    }
    function optionsHypo(P) { return proprietesDe(P).filter(function (c) { return c.hypo && P.argent >= Math.round(c.prix * 0.55); }); }

    async function menuAvantDes(P) {
      while (!L.arrete) {
        var cons = optionsConstruction(P), hyp = optionsHypo(P);
        var boutons = [{ id: 'des', label: '🎲 LANCER LES DÉS' }];
        if (cons.length) boutons.push({ id: 'construire', label: '🏗️ Construire', sous: cons.length + ' rue(s) possible(s)', couleur: '#80ed99' });
        if (hyp.length) boutons.push({ id: 'hypo', label: '🏦 Lever une hypothèque', couleur: '#ffd166' });
        if (boutons.length === 1) {
          await L.demander(P, { emoji: '🎲', titre: 'À toi !', texte: 'Tu as ' + P.argent + ' pièces.', boutons: boutons, disposition: 'geant' }, 'des', 40);
          return;
        }
        var choix = await L.demander(P, { emoji: '🎲', titre: 'À toi !', texte: 'Tu as ' + P.argent + ' pièces.', boutons: boutons }, 'des', 40);
        if (choix === 'des') return;
        var liste = choix === 'construire' ? cons : hyp;
        var id = await L.demander(P, {
          emoji: choix === 'construire' ? '🏗️' : '🏦', titre: choix === 'construire' ? 'Construire' : 'Lever une hypothèque',
          texte: 'Tu as ' + P.argent + ' pièces.',
          boutons: liste.map(function (c) {
            var cout = choix === 'construire' ? coutVilla(c) : Math.round(c.prix * 0.55);
            var sous = choix === 'construire' ? (c.niveau === 3 ? 'Gratte-ciel' : 'Étage ' + (c.niveau + 1)) + ' · loyer ensuite ' + Math.round(c.prix * [0, 0.5, 1.5, 3.2, 4.8][c.niveau + 1] / 10) * 10 : 'La rue rapporte à nouveau des loyers';
            return { id: String(c.id), label: c.nom + ' (−' + cout + ')', sous: sous, couleur: c.groupe ? GROUPES[c.groupe] : '#adb5bd' };
          }).concat([{ id: 'retour', label: '↩ Retour', couleur: '#adb5bd' }])
        }, 'retour', 40);
        if (id === 'retour') continue;
        var c = cases[+id];
        if (choix === 'construire' && optionsConstruction(P).indexOf(c) !== -1) {
          argent(P, -coutVilla(c)); c.niveau++;
          F.son.etoile();
          S.particules.gerbe(c.x, c.y - 30, 18, { couleurs: ['#fff', GROUPES[c.groupe], '#ffd166'], haut: 300, vmax: 260 });
          log(P.nom + ' construit ' + (c.niveau === 4 ? 'un gratte-ciel' : 'un étage') + ' sur ' + c.nom, '#80ed99');
        } else if (choix === 'hypo' && c.hypo && P.argent >= Math.round(c.prix * 0.55)) {
          argent(P, -Math.round(c.prix * 0.55)); c.hypo = false; F.son.gain();
          log(P.nom + ' lève l\'hypothèque de ' + c.nom);
        }
      }
    }

    async function caseArrivee(P, totalDes) {
      var c = cases[P.pos];
      if (c.type === 'prop' || c.type === 'port') {
        if (!c.proprio) {
          S.carte = { type: 'titre', c: c, t0: F.t };
          if (P.argent < c.prix) {
            L.ui(P, { emoji: '😕', titre: c.nom, texte: 'Prix : ' + c.prix + '. Tu n\'as pas assez d\'argent.' });
            await banniere('Pas assez d\'argent', c.nom + ' coûte ' + c.prix, '#6c757d', 1.6);
          } else {
            L.uiTous({ emoji: '🤔', titre: P.nom + ' réfléchit…', texte: 'Achètera ? ' + c.nom + ' (' + c.prix + ')' }, P);
            var r = await L.demander(P, {
              emoji: c.type === 'port' ? '🚋' : '🏠', titre: c.nom, texte: 'Prix : ' + c.prix + ' · Loyer : ' + (c.type === 'port' ? '25 à 200 selon tes stations' : Math.round(c.prix * 0.1) + ' (×2 avec le groupe complet)') + '\nTu as ' + P.argent + ' pièces.',
              boutons: [{ id: 'oui', label: '✅ Acheter (−' + c.prix + ')' }, { id: 'non', label: 'Non merci', couleur: '#adb5bd' }]
            }, 'non', 40);
            if (r === 'oui') {
              argent(P, -c.prix); c.proprio = P.num;
              F.son.etoile();
              S.particules.gerbe(c.x, c.y, 24, { couleurs: [P.couleur, '#fff', '#ffd166'], haut: 300, vmax: 300 });
              log(P.nom + ' achète ' + c.nom, P.couleur);
              await banniere(P.nom + ' achète ' + c.nom + ' !', groupeComplet(c) ? 'Groupe complet : loyers doublés et constructions possibles !' : '', P.couleur, 1.8);
            } else log(P.nom + ' n\'achète pas ' + c.nom);
          }
          S.carte = null;
        } else if (c.proprio !== P.num) {
          var proprio = L.joueurs.filter(function (x) { return x.num === c.proprio; })[0];
          var l = loyer(c);
          if (l > 0 && proprio && !proprio.faillite) {
            S.carte = { type: 'titre', c: c, t0: F.t };
            F.son.perte();
            L.ui(P, { emoji: '💸', titre: 'Loyer !', texte: c.nom + ' appartient à ' + proprio.nom + ' : tu payes ' + l + '.', fond: '#5c1a1a' });
            L.ui(proprio, { emoji: '🤑', titre: 'Loyer encaissé !', texte: P.nom + ' te paye ' + l + ' pour ' + c.nom + '.', fond: '#1b4332', vibrer: 120 });
            await banniere(P.nom + ' paye ' + l + ' à ' + proprio.nom, c.nom + (c.niveau ? ' · ' + (c.niveau === 4 ? 'gratte-ciel' : c.niveau + ' étage(s)') : ''), proprio.couleur, 2);
            await payer(P, l, proprio);
            log(P.nom + ' paye ' + l + ' de loyer à ' + proprio.nom, '#ff4d6d');
            S.carte = null;
          } else if (c.hypo) log(c.nom + ' est hypothéqué : pas de loyer');
        } else {
          log(P.nom + ' est chez lui à ' + c.nom);
          await F.attendre(0.6);
        }
      } else if (c.type === 'taxe') {
        await banniere(c.nom, P.nom + ' paye ' + c.montant + ' (pour la fontaine aux vœux)', '#6c757d', 1.8);
        if (await payer(P, c.montant, null)) S.cagnotte += c.montant;
        log(P.nom + ' paye la taxe : ' + c.montant);
      } else if (c.type === 'hamac') {
        var g = S.cagnotte;
        if (g > 0) {
          argent(P, g); S.cagnotte = 0; F.son.etoile();
          S.particules.gerbe(c.x, c.y, 40, { forme: 'piece', tmin: 6, tmax: 10, haut: 400 });
          await banniere('La fontaine aux vœux !', P.nom + ' récupère ' + g + ' pièces', '#ffbe0b', 2);
          log(P.nom + ' vide la fontaine aux vœux : ' + g, '#ffd166');
        } else { await banniere('La fontaine aux vœux', 'Elle est vide pour l\'instant', '#ffbe0b', 1.5); }
      } else if (c.type === 'vague') {
        await banniere('Déviation !', P.nom + ' se retrouve dans l\'embouteillage', '#fb8500', 1.8);
        await allerIle(P);
      } else if (c.type === 'bouteille') {
        await bouteille(P);
      } else if (c.type === 'ile') {
        log(P.nom + ' regarde passer les voitures');
        await F.attendre(0.5);
      } else if (c.type === 'depart') {
        await F.attendre(0.4);
      }
      void totalDes;
    }

    async function bouteille(P) {
      if (!S.pioche.length) S.pioche = F.melanger(BOUTEILLES);
      var b = S.pioche.pop();
      S.carte = { type: 'bouteille', b: b, t0: F.t };
      F.son.surprise();
      L.ui(P, { emoji: '✉️', titre: 'Enveloppe surprise', texte: b.texte });
      await F.attendre(2.4);
      var autres = actifs().filter(function (x) { return x !== P; });
      switch (b.effet) {
        case 'gain': argent(P, b.n); F.son.gain(); break;
        case 'perte': if (await payer(P, b.n, null)) S.cagnotte += b.n; break;
        case 'depart': S.carte = null; await teleporter(P, 0); argent(P, BONUS_DEPART); F.son.gain(); break;
        case 'ile': S.carte = null; await allerIle(P); break;
        case 'anniv':
          for (var i = 0; i < autres.length; i++) await payer(autres[i], b.n, P);
          F.son.gain(); break;
        case 'tournee':
          for (var j = 0; j < autres.length && !P.faillite; j++) await payer(P, b.n, autres[j]);
          break;
        case 'entretien':
          var niv = proprietesDe(P).reduce(function (s, c) { return s + c.niveau; }, 0);
          if (niv) { if (await payer(P, niv * b.n, null)) S.cagnotte += niv * b.n; }
          break;
        case 'port':
          S.carte = null;
          var k = 1;
          while (cases[(P.pos + k) % cases.length].type !== 'port') k++;
          await avancer(P, k);
          await caseArrivee(P, 0);
          break;
        case 'avance':
          S.carte = null;
          await avancer(P, b.n);
          await caseArrivee(P, 0);
          break;
      }
      log('Enveloppe : ' + b.texte);
      S.carte = null;
      await F.attendre(0.6);
    }

    // ---------- Partie ----------
    async function partie() {
      cases.forEach(function (c) { c.proprio = 0; c.niveau = 0; c.hypo = false; });
      L.initialiser({ argent: ARGENT_DEPART, pos: 0, ile: 0, faillite: false, x: 0, y: 0, saut: 0, anim: false, affArgent: ARGENT_DEPART, ordreFaillite: 0 });
      L.joueurs.forEach(function (P) { var q = positionPion(P); P.x = q.x; P.y = q.y; });
      S.phase = 'titre'; S.journal = []; S.cagnotte = 0; S.fin = null; S.t0 = F.t;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '🏙️', titre: 'Magnats de la Ville', texte: chef.nom + ' choisit la durée de la partie…' }, chef);
      var d = await L.demander(chef, {
        emoji: '🏙️', titre: 'Magnats de la Ville', texte: 'Quelle durée ?',
        boutons: [
          { id: '12', label: '12 tours', sous: 'environ 30 min · le plus riche gagne' },
          { id: '20', label: '20 tours', sous: 'environ 50 min · le plus riche gagne' },
          { id: '0', label: 'Jusqu\'à la ruine', sous: 'le dernier non ruiné gagne' }
        ]
      }, '12', 60);
      S.maxTours = window.MAGNATS_TOURS || +d;
      S.phase = 'plateau';
      log('Chacun commence avec ' + ARGENT_DEPART + ' pièces');
      await banniere('Magnats de la Ville', 'Achète des rues, construis des immeubles, encaisse les loyers !', '#2a9d8f', 2.4);
      for (S.tour = 1; !L.arrete; S.tour++) {
        if (S.maxTours && S.tour > S.maxTours) break;
        if (S.maxTours && S.tour === S.maxTours) await banniere('Dernier tour !', '', '#d00000', 1.6);
        for (var i = 0; i < L.joueurs.length && !L.arrete; i++) {
          var P = L.joueurs[i];
          if (P.faillite) continue;
          await tourJoueur(P);
          if (actifs().length <= 1) break;
        }
        S.actif = null;
        if (actifs().length <= 1) break;
      }
      if (L.arrete) return;
      await finale();
    }

    async function finale() {
      L.joueurs.forEach(function (P) { P.valeur = P.faillite ? -1000 + P.ordreFaillite : patrimoine(P); });
      var ordre = F.classer(L.joueurs, 'valeur');
      S.phase = 'fin';
      S.fin = { ordre: ordre, t0: F.t };
      F.musique('final');
      F.son.cymbale(); F.son.fanfare();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : (P.faillite ? '💸' : '🎉'), titre: P.rang === 1 ? 'Grand magnat !' : F.texteRang(P.rang) + ' place',
          texte: P.faillite ? 'Faillite…' : 'Fortune totale : ' + P.valeur + ' pièces',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      S.particules.maj(dt);
      if (S.des && S.des.roule && F.t > S.des.prochain) { S.des.a = F.entier(1, 6); S.des.b = F.entier(1, 6); S.des.prochain = F.t + 0.07; F.son.de(); }
      L.joueurs.forEach(function (P) {
        if (!P.anim) { var q = positionPion(P); P.x += (q.x - P.x) * Math.min(1, dt * 8); P.y += (q.y - P.y) * Math.min(1, dt * 8); }
        P.affArgent += (P.argent - P.affArgent) * Math.min(1, dt * 6);
      });
      F.virtuel(c, W, H, '#03045e');
      fond(c);
      cases.forEach(function (cs) { dessinerCase(c, cs); });
      L.joueurs.filter(function (P) { return !P.faillite; }).forEach(function (P) {
        if (S.actif === P) { c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(F.t * 5)) + ')'; c.lineWidth = 3; c.beginPath(); c.ellipse(P.x, P.y + 14, 22, 8, 0, 0, 7); c.stroke(); }
        F.pion(c, P.x, P.y, 15, P.couleur, null, { saut: P.saut + (S.actif === P && !P.anim ? Math.abs(Math.sin(F.t * 4)) * 5 : 0), phase: P.num });
      });
      centre(c);
      joueurs(c);
      S.flottants = S.flottants.filter(function (f) { return F.t - f.t0 < 1.5; });
      S.flottants.forEach(function (f) {
        var q = (F.t - f.t0) / 1.5;
        c.globalAlpha = 1 - q * q;
        F.texte(c, f.txt, f.x, f.y - q * 60, 32, f.col, { contour: 'rgba(0,0,0,.7)', epaisseur: 6 });
        c.globalAlpha = 1;
      });
      S.particules.dessiner(c);
      if (S.carte) carte(c);
      banniereDessin(c);
      if (S.phase === 'titre') titre(c);
      if (S.fin) fin(c);
      c.restore();
    }

    function fond(c) {
      if (!S.decor || (S.decor.sans3d && decor3d && window.Kenney3D && Kenney3D.pret())) S.decor = decorVille();
      c.drawImage(S.decor, 0, 0, 1600, 900);
      // voitures qui circulent sur l'avenue du bas et les deux rues verticales
      var COLS = ['#e63946', '#3a86ff', '#ffbe0b', '#06d6a0', '#8338ec', '#f4f1de'];
      for (var i = 0; i < 6; i++) {
        var sens = i % 2 ? 1 : -1, v = 60 + i * 11;
        if (i < 3) {
          var x = ((i * 597 + F.t * v * sens) % 1900 + 1900) % 1900 - 150;
          voiture(c, x, RUES_Y[1] + (sens > 0 ? 12 : -12), COLS[i], sens, 0);
        } else {
          var y = ((i * 331 + F.t * v * sens) % 1100 + 1100) % 1100 - 100;
          voiture(c, RUES_X[i % 2] + (sens > 0 ? -12 : 12), y, COLS[i], sens, Math.PI / 2);
        }
      }
    }
    function voiture(c, x, y, col, sens, angle) {
      c.save(); c.translate(x, y); c.rotate(angle); c.scale(sens, 1);
      c.fillStyle = 'rgba(0,0,0,.25)'; F.rr(c, -21, -6, 44, 16, 6); c.fill();
      c.fillStyle = col; F.rr(c, -22, -10, 44, 18, 6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; F.rr(c, -4, -8, 14, 14, 3); c.fill();
      c.fillStyle = '#fff3b0'; c.fillRect(19, -8, 3, 4); c.fillRect(19, 2, 3, 4);
      c.restore();
    }

    function dessinerCase(c, cs) {
      var TW = cs.w, TH = cs.h, x = cs.x - TW / 2, y = cs.y - TH / 2;
      var proprio = cs.proprio ? L.joueurs.filter(function (P) { return P.num === cs.proprio; })[0] : null;
      c.save();
      c.fillStyle = 'rgba(0,0,0,.28)'; F.rr(c, x + 3, y + 6, TW, TH, 14); c.fill();
      var fondCase = { depart: '#80ed99', ile: '#dee2e6', hamac: '#bde0fe', vague: '#ffd6a5', bouteille: '#fff1c1', taxe: '#dee2e6', port: '#e0e1dd' }[cs.type] || '#fffdf7';
      c.fillStyle = cs.hypo ? '#adb5bd' : fondCase; F.rr(c, x, y, TW, TH, 14); c.fill();
      if (cs.type === 'prop') { c.save(); F.rr(c, x, y, TW, TH, 14); c.clip(); c.fillStyle = GROUPES[cs.groupe]; c.fillRect(x, y, TW, 26); c.restore(); }
      if (cs.type === 'port') { c.save(); F.rr(c, x, y, TW, TH, 14); c.clip(); c.fillStyle = '#1d3557'; c.fillRect(x, y, TW, 26); c.restore(); F.texte(c, 'TRAM', cs.x, y + 14, 17, '#fff', { contour: false }); }
      if (proprio) { c.lineWidth = 5; c.strokeStyle = proprio.couleur; F.rr(c, x, y, TW, TH, 14); c.stroke(); }
      // étages
      if (cs.niveau) {
        for (var v = 0; v < (cs.niveau === 4 ? 1 : cs.niveau); v++) {
          var hx = x + 14 + v * 20, hy = y + 4;
          c.fillStyle = cs.niveau === 4 ? '#ffd166' : '#fff';
          c.beginPath(); c.moveTo(hx, hy + 7); c.lineTo(hx + 7, hy); c.lineTo(hx + 14, hy + 7); c.lineTo(hx + 14, hy + 15); c.lineTo(hx, hy + 15); c.closePath(); c.fill();
          c.strokeStyle = '#1b1b2f'; c.lineWidth = 1.5; c.stroke();
        }
        if (cs.niveau === 4) F.texte(c, 'TOUR', x + 70, y + 12, 12, '#fff', { contour: false });
      }
      var nomY = cs.type === 'prop' || cs.type === 'port' ? y + 46 : y + 30;
      var lignes = F.texteMultiligne(c, cs.nom, cs.x, nomY, TW - 14, 20, '#1b1b2f', { interligne: 1.1 });
      var bas = y + TH - 15;
      if (cs.type === 'prop' || cs.type === 'port') {
        var txt = cs.hypo ? 'HYPOTHÉQUÉ' : (proprio ? 'loyer ' + loyer(cs) : String(cs.prix));
        F.texte(c, txt, cs.x, bas, 19, cs.hypo ? '#1b1b2f' : (proprio ? proprio.couleur === '#ffd166' ? '#9a6b00' : F.assombrir(proprio.couleur, 0.2) : '#495057'), { contour: false });
      } else if (cs.type === 'depart') F.texte(c, '+' + BONUS_DEPART + ' au passage', cs.x, bas, 17, '#1b4332', { contour: false });
      else if (cs.type === 'hamac') F.texte(c, 'Vœux : ' + S.cagnotte, cs.x, bas, 18, '#1d3557', { contour: false });
      else if (cs.type === 'taxe') F.texte(c, '−' + cs.montant, cs.x, bas, 19, '#d00000', { contour: false });
      else if (cs.type === 'vague') F.texte(c, '→ embouteillage', cs.x, bas, 17, '#9a3412', { contour: false });
      else if (cs.type === 'ile') F.texte(c, 'simple visite', cs.x, bas, 17, '#495057', { contour: false });
      else if (cs.type === 'bouteille') F.texte(c, 'carte surprise', cs.x, bas, 17, '#9a6b00', { contour: false });
      void lignes;
      c.restore();
    }

    function centre(c) {
      F.texte(c, 'Magnats de la Ville', CX, CY - 250, 58, '#fff', { contour: '#1d3557', epaisseur: 10 });
      if (S.maxTours && S.tour) F.texte(c, 'Tour ' + Math.min(S.tour, S.maxTours) + ' / ' + S.maxTours, CX, CY - 200, 26, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 5 });
      else if (S.tour) F.texte(c, 'Tour ' + S.tour + ' · jusqu\'à la ruine', CX, CY - 200, 26, '#fff', { contour: 'rgba(0,0,0,.6)', epaisseur: 5 });
      if (S.des) {
        var r1 = S.des.roule ? F.alea(-0.3, 0.3) : 0, r2 = S.des.roule ? F.alea(-0.3, 0.3) : 0;
        var sc = S.des.roule ? 1 : 1 + Math.max(0, 0.3 - (F.t - S.des.t0) * 2);
        F.de(c, CX - 60, CY - 95, 84 * sc, S.des.a, r1, S.actif ? S.actif.couleur : '#ff006e');
        F.de(c, CX + 60, CY - 95, 84 * sc, S.des.b, r2, S.actif ? S.actif.couleur : '#ff006e');
      }
      c.fillStyle = 'rgba(16,24,40,.72)'; F.rr(c, CX - 340, CY - 20, 680, 160, 20); c.fill();
      S.journal.forEach(function (j, i) {
        c.globalAlpha = 1 - i * 0.2;
        F.texte(c, j.txt, CX, CY + 10 + i * 36, i === 0 ? 28 : 24, j.couleur === '#ffd166' || j.couleur === '#fff' ? j.couleur : F.eclaircir(j.couleur.charAt(0) === '#' ? j.couleur : '#ffffff', 0.3), { contour: false });
        c.globalAlpha = 1;
      });
    }

    function joueurs(c) {
      var coins = [[196, 134], [1600 - 196 - 280, 134], [196, 900 - 134 - 110], [1600 - 196 - 280, 900 - 134 - 110]];
      L.joueurs.forEach(function (P, i) {
        var x = coins[i][0], y = coins[i][1], w = 280, h = 110, actif = S.actif === P;
        c.save();
        if (actif) { c.shadowColor = P.couleur; c.shadowBlur = 26 * (0.6 + 0.4 * Math.sin(F.t * 5)); }
        c.fillStyle = P.faillite ? 'rgba(60,60,60,.85)' : 'rgba(16,24,40,.85)'; F.rr(c, x, y, w, h, 20); c.fill();
        c.restore();
        if (actif) { c.lineWidth = 4; c.strokeStyle = P.couleur; F.rr(c, x, y, w, h, 20); c.stroke(); }
        F.pion(c, x + 46, y + 58, 26, P.couleur, null, { phase: i, triste: P.faillite });
        F.texte(c, P.nom, x + 86, y + 30, 28, '#fff', { align: 'left', contour: false });
        if (P.faillite) { F.texte(c, 'FAILLITE', x + 86, y + 74, 30, '#ff4d6d', { align: 'left', contour: false }); return; }
        F.texte(c, Math.round(P.affArgent) + ' pièces', x + 86, y + 66, 28, '#ffd166', { align: 'left', contour: false });
        // pastilles des groupes possédés
        var props = proprietesDe(P);
        props.slice(0, 12).forEach(function (cs, k) {
          c.fillStyle = cs.groupe ? GROUPES[cs.groupe] : '#e0e1dd';
          c.fillRect(x + 86 + k * 15, y + 88, 12, 12);
        });
        if (P.ile > 0) F.texte(c, '🚧', x + w - 30, y + 30, 22, '#fff', { contour: false });
      });
    }

    function carte(c) {
      var k = S.carte, q = F.ease.back(Math.min(1, (F.t - k.t0) * F.V / 0.4));
      c.save(); c.translate(CX, CY - 10); c.scale(q, q);
      if (k.type === 'titre') {
        var cs = k.c, col = cs.groupe ? GROUPES[cs.groupe] : '#1d3557';
        c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -186, -196, 380, 400, 24); c.fill();
        c.fillStyle = '#fffdf7'; F.rr(c, -190, -200, 380, 400, 24); c.fill();
        c.save(); F.rr(c, -190, -200, 380, 400, 24); c.clip(); c.fillStyle = col; c.fillRect(-190, -200, 380, 90); c.restore();
        F.texte(c, cs.type === 'port' ? 'STATION DE TRAM' : 'TITRE DE PROPRIÉTÉ', 0, -176, 16, '#fff', { contour: false });
        F.texteMultiligne(c, cs.nom, 0, -138, 340, 30, '#fff', { centrerV: true });
        var lignes;
        if (cs.type === 'port') lignes = [['1 station', 25], ['2 stations', 50], ['3 stations', 100], ['4 stations', 200]];
        else lignes = [['Loyer', Math.round(cs.prix * 0.1)], ['Groupe complet', Math.round(cs.prix * 0.1) * 2], ['1 étage', Math.round(cs.prix * 0.05) * 10], ['2 étages', Math.round(cs.prix * 0.15) * 10], ['3 étages', Math.round(cs.prix * 0.32) * 10], ['Gratte-ciel', Math.round(cs.prix * 0.48) * 10]];
        lignes.forEach(function (l, i) {
          F.texte(c, l[0], -160, -80 + i * 34, 22, '#495057', { align: 'left', contour: false, poids: 600 });
          F.texte(c, String(l[1]), 160, -80 + i * 34, 22, '#1b1b2f', { align: 'right', contour: false });
        });
        F.texte(c, 'Prix : ' + cs.prix + (cs.type === 'prop' ? ' · étage : ' + coutVilla(cs) : ''), 0, 170, 24, '#1b1b2f', { contour: false });
      } else {
        c.rotate(-0.03);
        c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -256, -136, 520, 280, 26); c.fill();
        var g = c.createLinearGradient(0, -140, 0, 140); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f3e3c3');
        c.fillStyle = g; F.rr(c, -260, -140, 520, 280, 26); c.fill();
        c.lineWidth = 4; c.strokeStyle = '#c9a26b'; F.rr(c, -248, -128, 496, 256, 20); c.stroke();
        F.texte(c, '✉️ Enveloppe surprise', 0, -88, 34, '#7a4a00', { contour: false });
        F.texteMultiligne(c, k.b.texte, 0, 10, 440, 30, '#1b1b2f', { centrerV: true, poids: 600 });
      }
      c.restore();
    }

    function banniereDessin(c) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0;
      if (t > b.duree) { S.banniere = null; return; }
      var e = Math.min(1, t * F.V / 0.3), s = Math.max(0, (t - (b.duree - 0.3 / F.V)) * F.V / 0.3);
      var y = 450, h = b.sous ? 150 : 110;
      c.save();
      c.globalAlpha = 1 - s;
      c.translate(800, y); c.scale(F.ease.back(e), F.ease.back(e));
      c.fillStyle = 'rgba(0,0,0,.35)'; F.rr(c, -606, -h / 2 + 8, 1220, h, 30); c.fill();
      c.fillStyle = b.couleur; F.rr(c, -610, -h / 2, 1220, h, 30); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#fff'; F.rr(c, -610, -h / 2, 1220, h, 30); c.stroke();
      F.texte(c, b.texte, 0, b.sous ? -22 : 0, 56, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 8 });
      if (b.sous) F.texte(c, b.sous, 0, 38, 28, '#fff', { contour: false });
      c.restore();
    }

    function titre(c) {
      c.fillStyle = 'rgba(16,24,40,.62)'; c.fillRect(0, 0, 1600, 900);
      var t = F.t - S.t0;
      F.texte(c, 'Magnats de la Ville', 800, 250 + Math.sin(t * 2) * 8, 120, '#ffd166', { contour: '#1d3557', epaisseur: 18 });
      F.texte(c, 'Achète des rues, construis des étages et des gratte-ciel, encaisse les loyers !', 800, 360, 34, '#fff', { contour: false });
      var n = L.joueurs.length;
      L.joueurs.forEach(function (P, k) {
        var x = 800 - (n - 1) * 130 + k * 260;
        F.pion(c, x, 540, 54, P.couleur, null, { saut: Math.abs(Math.sin(t * 3 + k)) * 22, phase: k });
        F.texte(c, P.nom, x, 640, 36, '#fff');
      });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit la durée de la partie sur son téléphone…', 800, 760, 32, '#ffd166', { contour: false });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(10,10,30,' + 0.88 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Fin de la partie !', 800, 120, 86, '#ffd166', { contour: '#1d3557', epaisseur: 14 });
      F.texte(c, f.ordre[0].nom + ' est le grand magnat de la ville !', 800, 210, 46, '#fff');
      f.ordre.forEach(function (P, k) {
        var y = 290 + k * 130, x = 280 + (1 - F.ease.back(Math.min(1, Math.max(0, q * 2 - k * 0.2)))) * -1600;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.14)';
        F.rr(c, x, y, 1040, 110, 26); c.fill();
        var col = P.rang === 1 ? '#1b1b2f' : '#fff';
        F.texte(c, F.texteRang(P.rang), x + 70, y + 55, 46, col, { contour: false });
        F.pion(c, x + 170, y + 58, 32, P.couleur, null, { phase: k, saut: P.rang === 1 ? Math.abs(Math.sin(F.t * 8)) * 12 : 0, triste: P.faillite });
        F.texte(c, P.nom, x + 230, y + 55, 46, col, { align: 'left', contour: false });
        F.texte(c, P.faillite ? 'faillite' : P.valeur + ' pièces', x + 1000, y + 55, 40, col, { align: 'right', contour: false });
      });
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
    }

    partie().catch(function (e) { console.error('Magnats :', e); });

    return {
      image: image,
      message: function (j, m) { L.recevoir(j, m); },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'magnats', vignette: 'assets/vignettes/magnats.jpg', nom: 'Magnats de la Ville', emoji: '🏙️',
    description: 'Achète des rues, construis des immeubles, encaisse les loyers. Le plus riche gagne !',
    min: 2, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
