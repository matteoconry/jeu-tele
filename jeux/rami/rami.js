/*
 * Rami 101 — 2 à 4 joueurs, 2 jeux de 52 cartes + 4 jokers.
 * Chacun pioche, pose des combinaisons (séries ou suites), puis défausse.
 * Pour « ouvrir », il faut poser au moins 101 points en un seul tour. Ensuite, on peut aussi compléter les combinaisons de la table.
 * Le premier qui n'a plus de cartes gagne la manche (−101). Les autres prennent la valeur de leur main, 202 s'ils n'ont pas ouvert.
 * Après toutes les manches, le plus petit total gagne.
 */
(function (F) {
  'use strict';
  var C = F.Cartes;
  var OUVERTURE = 101, NB_CARTES = 14;

  // ---------- Règles des combinaisons ----------
  function valSuite(k) { return k === 14 ? 11 : k >= 11 ? 10 : k; }
  function valCarte(k) { return k.j ? 25 : k.r === 1 ? 11 : k.r >= 11 ? 10 : k.r; }

  // Renvoie { ok, type, valeur, ordre } pour un groupe de cartes.
  function analyser(cartes) {
    var n = cartes.length;
    if (n < 3) return { ok: false, raison: 'Il faut au moins 3 cartes.' };
    var nat = cartes.filter(function (k) { return !k.j; }), jok = cartes.filter(function (k) { return k.j; });
    if (!nat.length) return { ok: false, raison: 'Il faut au moins une vraie carte.' };
    // Série : même valeur, couleurs toutes différentes, 3 ou 4 cartes.
    if (n <= 4 && nat.every(function (k) { return k.r === nat[0].r; })) {
      var couleurs = {}, distinctes = nat.every(function (k) { if (couleurs[k.s]) return false; couleurs[k.s] = 1; return true; });
      if (distinctes) {
        var v = nat[0].r === 1 ? 11 : nat[0].r >= 11 ? 10 : nat[0].r;
        return { ok: true, type: 'serie', valeur: v * n, ordre: nat.slice().sort(function (a, b) { return a.s - b.s; }).concat(jok) };
      }
    }
    // Suite : même couleur, valeurs qui se suivent (l'as peut être en bas ou en haut), jokers dans les trous.
    if (!nat.every(function (k) { return k.s === nat[0].s; })) return { ok: false, raison: 'Ni une série (même valeur, couleurs différentes) ni une suite (même couleur, valeurs qui se suivent).' };
    var meilleur = null;
    [false, true].forEach(function (asHaut) {
      var rangs = nat.map(function (k) { return asHaut && k.r === 1 ? 14 : k.r; });
      var vus = {};
      if (rangs.some(function (r) { if (vus[r]) return true; vus[r] = 1; return false; })) return;
      var mi = Math.min.apply(null, rangs), ma = Math.max.apply(null, rangs);
      var limBas = asHaut ? 2 : 1, limHaut = asHaut ? 14 : 13;
      if (ma - mi + 1 > n) return;
      var haut = Math.min(limHaut, mi + n - 1), bas = haut - n + 1;
      if (bas < limBas) return;
      var ordre = [], j = jok.slice(), val = 0;
      for (var r = bas; r <= haut; r++) {
        var i = rangs.indexOf(r);
        ordre.push(i !== -1 ? nat[i] : j.pop());
        val += valSuite(r);
      }
      if (!meilleur || val > meilleur.valeur) meilleur = { ok: true, type: 'suite', valeur: val, ordre: ordre };
    });
    return meilleur || { ok: false, raison: 'Ces cartes ne se suivent pas (ou il manque des jokers).' };
  }
  F.Rami = { analyser: analyser };

  function creer(api) {
    F.viderAnims();
    F.sonActif = function () { return api.params().son !== false; };
    var L = F.creerLien(api);
    var S = { phase: 'titre', talon: [], defausse: [], combis: [], actif: null, manche: 0, nbManches: 3, journal: [], t0: F.t, fin: null, bilan: null, particules: new F.Particules(), idCombi: 0 };

    L.stats = function (P) { return { texte: '🃏 ' + (P.main ? P.main.length : 0) + ' cartes · total ' + P.total + (P.ouvert ? ' · ouvert ✔' : '') }; };

    function log(txt, col) { S.journal.unshift({ txt: txt, col: col || '#fff' }); if (S.journal.length > 3) S.journal.pop(); }
    function trier(P) { P.main = C.trier(P.main, P.tri); }
    function mainTel(P) { return P.main.map(function (k) { return C.versTel(k, k.id === P.nouvelle); }); }
    function provisoires(P) { return S.combis.filter(function (m) { return m.prov === P.num; }); }
    function totalProv(P) { return provisoires(P).reduce(function (s, m) { return s + m.valeur; }, 0); }
    function piocher() {
      if (!S.talon.length) {
        var dessus = S.defausse.pop();
        S.talon = F.melanger(S.defausse);
        S.defausse = dessus ? [dessus] : [];
        if (S.talon.length) log('Le talon est vide : on remélange la défausse');
      }
      return S.talon.pop();
    }
    function banniere(texte, sous, couleur, duree) {
      duree = duree || 1.6;
      S.banniere = { texte: texte, sous: sous || '', couleur: couleur || '#2a9d8f', t0: F.t, duree: duree / F.V };
      F.son.banniere();
      return F.attendre(duree);
    }
    function uiSpectateur(P, texte) {
      L.ui(P, { titre: texte, texte: P.ouvert ? 'Tu as ouvert ✔' : 'Pas encore ouvert (il faut ' + OUVERTURE + ' points en un tour)', cartes: { liste: mainTel(P) } });
    }

    // ---------- Partie ----------
    async function partie() {
      L.initialiser({ main: [], ouvert: false, total: 0, tri: 'couleur', nouvelle: -1, points: 0 });
      S.phase = 'titre'; S.t0 = F.t; S.fin = null; S.manche = 0; S.bilan = null;
      F.musique('plateau');
      var chef = L.joueurs[0];
      L.uiTous({ emoji: '🃏', titre: 'Rami 101', texte: chef.nom + ' choisit le nombre de manches…' }, chef);
      var nb = await L.demander(chef, {
        emoji: '🃏', titre: 'Rami 101', texte: 'Combien de manches ?',
        boutons: [{ id: '1', label: '1 manche', sous: 'environ 15 min' }, { id: '3', label: '3 manches', sous: 'environ 45 min' }, { id: '5', label: '5 manches', sous: 'la grande partie' }]
      }, '3', 60);
      S.nbManches = window.RAMI_MANCHES || +nb;
      F.musique(null);
      for (S.manche = 1; S.manche <= S.nbManches && !L.arrete; S.manche++) await manche();
      if (!L.arrete) await finale();
    }

    async function manche() {
      S.talon = C.paquet(2, 4); S.defausse = []; S.combis = []; S.bilan = null;
      var premier = L.joueurs[(S.manche - 1) % L.joueurs.length];
      L.joueurs.forEach(function (P) {
        P.main = []; P.ouvert = false; P.nouvelle = -1;
        for (var i = 0; i < NB_CARTES + (P === premier ? 1 : 0); i++) P.main.push(S.talon.pop());
        trier(P);
      });
      if (window.RAMI_TEST) {
        // Tests automatiques : une main toute prête pour le premier joueur.
        var voulues = [[13, 0], [13, 1], [13, 2], [12, 0], [12, 1], [12, 2], [11, 0], [11, 1], [11, 2], [10, 0], [10, 1], [10, 2]];
        S.talon = S.talon.concat(premier.main.splice(0, voulues.length));
        voulues.forEach(function (v) {
          var i = S.talon.findIndex(function (k) { return k.r === v[0] && k.s === v[1]; });
          premier.main.push(S.talon.splice(i, 1)[0]);
        });
        trier(premier);
      }
      S.phase = 'jeu';
      L.joueurs.forEach(function (P) { uiSpectateur(P, 'Manche ' + S.manche + ' : voici ta main'); });
      await banniere('Manche ' + S.manche + ' / ' + S.nbManches, premier.nom + ' commence avec 15 cartes et défausse directement', '#2a9d8f', 2.2);
      var i = L.joueurs.indexOf(premier), premierTour = true;
      while (!L.arrete) {
        var P = L.joueurs[i];
        var gagne = await tour(P, premierTour);
        premierTour = false;
        if (L.arrete) return;
        if (gagne) { await finManche(P); return; }
        if (!S.talon.length) { await finManche(null); return; }
        i = (i + 1) % L.joueurs.length;
      }
    }

    // Renvoie true si le joueur a vidé sa main.
    async function tour(P, sansPioche) {
      S.actif = P; S.erreur = null; S.priseDefausse = null;
      L.joueurs.forEach(function (Q) { if (Q !== P) uiSpectateur(Q, 'Tour de ' + P.nom); });
      if (!sansPioche) {
        var dessus = S.defausse[S.defausse.length - 1];
        var r = await L.demander(P, {
          titre: 'À toi ! Pioche une carte', texte: dessus ? 'Dessus de la défausse : ' + C.texte(dessus) : '',
          cartes: { liste: mainTel(P) },
          boutons: [{ id: 'talon', label: '🂠 Piocher dans le talon' }].concat(dessus ? [{ id: 'defausse', label: '♻️ Prendre ' + C.texte(dessus), couleur: '#ffd166' }] : []),
          disposition: dessus ? 'grille' : 'colonne'
        }, 'talon', 60);
        if (L.arrete) return false;
        var k;
        if (r === 'defausse' && S.defausse.length) { k = S.defausse.pop(); S.priseDefausse = k.id; log(P.nom + ' prend ' + C.texte(k) + ' dans la défausse', P.couleur); }
        else { k = piocher(); log(P.nom + ' pioche une carte'); }
        if (!k) return false;
        F.son.pop();
        P.main.push(k); P.nouvelle = k.id; trier(P);
        S.anim = { t0: F.t, de: r === 'defausse' ? 'defausse' : 'talon', P: P };
      }
      // Poser / ajouter / défausser
      while (!L.arrete) {
        var ouvertureTxt = P.ouvert ? 'Tu as ouvert ✔ Tu peux aussi compléter les combinaisons de la table.' : 'Ouverture : ' + totalProv(P) + ' / ' + OUVERTURE + ' points posés ce tour-ci.';
        var boutons = [
          { id: 'poser', label: '✅ Poser', sous: 'série ou suite (3 cartes et +)', selMin: 3, couleur: '#80ed99' },
          { id: 'ajouter', label: '➕ Ajouter sur la table', selMin: 1, couleur: '#90e0ef', desactive: !P.ouvert || !S.combis.some(function (m) { return !m.prov; }) },
          { id: 'defausser', label: '🗑️ Défausser', sous: '1 carte, fin du tour', selMin: 1, selMax: 1, couleur: '#ff70a6' },
          { id: 'tri', label: P.tri === 'couleur' ? '↕ Trier par valeur' : '↕ Trier par couleur', couleur: '#adb5bd' }
        ];
        if (provisoires(P).length) boutons.push({ id: 'reprendre', label: '↩ Reprendre mes cartes posées', couleur: '#adb5bd' });
        var choix = await L.demander(P, {
          titre: S.erreur ? '⚠️ ' + S.erreur : 'Touche des cartes pour les choisir', texte: ouvertureTxt,
          cartes: { liste: mainTel(P), choix: true }, boutons: boutons, disposition: 'grille', fond: S.erreur ? '#5c1a1a' : ''
        }, 'auto', 150);
        S.erreur = null;
        if (L.arrete) return false;
        var sel = (P.sel || []).map(function (id) { return P.main.filter(function (k) { return k.id === id; })[0]; }).filter(Boolean);
        if (choix === 'tri') { P.tri = P.tri === 'couleur' ? 'valeur' : 'couleur'; trier(P); continue; }
        if (choix === 'reprendre') { reprendre(P); continue; }
        if (choix === 'poser') {
          var a = analyser(sel);
          if (!a.ok) { S.erreur = a.raison; F.son.buzz(); continue; }
          if (sel.length === P.main.length && !P.ouvert && totalProv(P) + a.valeur < OUVERTURE) { S.erreur = 'Il te faut ' + OUVERTURE + ' points pour ouvrir.'; F.son.buzz(); continue; }
          if (sel.length === P.main.length && P.ouvert) { /* finir en posant tout : autorisé */ }
          retirer(P, sel);
          S.combis.push({ id: ++S.idCombi, cartes: a.ordre, type: a.type, valeur: a.valeur, proprio: P.num, prov: P.ouvert ? 0 : P.num, t0: F.t });
          F.son.etoile();
          log(P.nom + ' pose ' + (a.type === 'serie' ? 'une série' : 'une suite') + ' (' + a.valeur + ' pts)', P.couleur);
          if (!P.ouvert && totalProv(P) >= OUVERTURE) {
            var tot = totalProv(P);
            P.ouvert = true; provisoires(P).forEach(function (m) { m.prov = 0; });
            S.particules.gerbe(800, 400, 40, { couleurs: [P.couleur, '#ffd166', '#fff'], haut: 300, vmax: 400 });
            await banniere(P.nom + ' ouvre !', tot + ' points posés', P.couleur, 1.8);
          }
          if (!P.main.length) return true;
          continue;
        }
        if (choix === 'ajouter') {
          if (!P.ouvert || !sel.length) continue;
          var possibles = S.combis.filter(function (m) { return !m.prov && analyser(m.cartes.concat(sel)).ok; });
          if (!possibles.length) { S.erreur = 'Ces cartes ne vont sur aucune combinaison de la table.'; F.son.buzz(); continue; }
          var cible = possibles[0];
          if (possibles.length > 1) {
            var id = await L.demander(P, {
              titre: 'Sur quelle combinaison ?', texte: sel.map(C.texte).join(' '),
              boutons: possibles.map(function (m) {
                var pr = L.joueurs.filter(function (Q) { return Q.num === m.proprio; })[0];
                return { id: String(m.id), label: m.cartes.map(C.texte).join(' '), sous: 'posée par ' + (pr ? pr.nom : '?'), couleur: pr ? pr.couleur : '#fff' };
              }).concat([{ id: 'retour', label: '↩ Retour', couleur: '#adb5bd' }])
            }, 'retour', 60);
            if (id === 'retour' || L.arrete) continue;
            cible = possibles.filter(function (m) { return String(m.id) === id; })[0];
            if (!cible) continue;
          }
          var b = analyser(cible.cartes.concat(sel));
          if (!b.ok) continue;
          retirer(P, sel);
          cible.cartes = b.ordre; cible.valeur = b.valeur; cible.t0 = F.t;
          F.son.etoile();
          log(P.nom + ' ajoute ' + sel.map(C.texte).join(' ') + ' sur la table', P.couleur);
          if (!P.main.length) return true;
          continue;
        }
        if (choix === 'defausser' || choix === 'auto') {
          var k = sel[0];
          if (choix === 'auto') {
            reprendre(P);
            k = P.main.filter(function (x) { return x.id === P.nouvelle; })[0] || P.main[P.main.length - 1];
            log(P.nom + ' met trop de temps : défausse automatique');
          }
          if (!k) continue;
          if (k.id === S.priseDefausse && P.main.length > 1) { S.erreur = 'Tu ne peux pas redéfausser la carte que tu viens de prendre.'; F.son.buzz(); continue; }
          if (provisoires(P).length) {
            var t = totalProv(P);
            reprendre(P);
            await banniere('Pas assez pour ouvrir', P.nom + ' n\'a posé que ' + t + ' points sur ' + OUVERTURE + ' : cartes reprises', '#6c757d', 1.8);
          }
          retirer(P, [k]);
          S.defausse.push(k);
          P.nouvelle = -1;
          F.son.pop();
          log(P.nom + ' défausse ' + C.texte(k), P.couleur);
          return !P.main.length;
        }
      }
      return false;
    }

    function retirer(P, cartes) {
      var ids = cartes.map(function (k) { return k.id; });
      P.main = P.main.filter(function (k) { return ids.indexOf(k.id) === -1; });
    }
    function reprendre(P) {
      provisoires(P).forEach(function (m) { P.main = P.main.concat(m.cartes); });
      S.combis = S.combis.filter(function (m) { return m.prov !== P.num; });
      trier(P);
    }

    async function finManche(gagnant) {
      S.actif = null;
      L.joueurs.forEach(function (P) {
        if (P === gagnant) P.points = -OUVERTURE;
        else if (!P.ouvert) P.points = OUVERTURE * 2;
        else P.points = P.main.reduce(function (s, k) { return s + valCarte(k); }, 0);
        P.total += P.points;
      });
      S.bilan = { gagnant: gagnant, t0: F.t };
      F.son.fanfare();
      if (gagnant) S.particules.gerbe(800, 300, 60, { couleurs: [gagnant.couleur, '#ffd166', '#fff'], haut: 350, vmax: 500, forme: 'confetti' });
      L.joueurs.forEach(function (P) {
        L.ui(P, { emoji: P === gagnant ? '🏆' : '🃏', titre: P === gagnant ? 'Manche gagnée !' : (gagnant ? gagnant.nom + ' a fini' : 'Plus de cartes au talon'), texte: 'Cette manche : ' + (P.points > 0 ? '+' : '') + P.points + ' · Total : ' + P.total });
      });
      await F.attendre(6);
      S.bilan = null;
    }

    async function finale() {
      // Le plus petit total gagne.
      L.joueurs.forEach(function (P) { P.score = -P.total; });
      var ordre = F.classer(L.joueurs, 'score');
      S.phase = 'fin';
      S.fin = { ordre: ordre, t0: F.t };
      F.musique('final'); F.son.cymbale();
      var choix = await Promise.race(L.joueurs.map(function (P) {
        return L.demander(P, {
          emoji: P.rang === 1 ? '🏆' : '🃏', titre: P.rang === 1 ? 'Victoire !' : F.texteRang(P.rang) + ' place', texte: 'Total : ' + P.total + ' points (le plus petit gagne)',
          boutons: [{ id: 'rejouer', label: '🔁 Rejouer' }, { id: 'menu', label: '🏠 Retour au menu', couleur: '#adb5bd' }]
        }, 'attendre', 3600);
      }));
      L.annulerTout('x');
      if (L.arrete) return;
      if (choix === 'rejouer') partie(); else api.quitter();
    }

    // ---------- Dessin ----------
    var TALON = { x: 150, y: 250 }, DEF = { x: 290, y: 250 };
    function image(c, W, H, dt) {
      if (L.arrete) return;
      F.majAnims(dt);
      L.verifier(dt);
      S.particules.maj(dt);
      F.virtuel(c, W, H, '#081c15');
      var g = c.createRadialGradient(800, 420, 100, 800, 450, 1000);
      g.addColorStop(0, '#2d6a4f'); g.addColorStop(1, '#081c15');
      c.fillStyle = g; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Rami 101', 220, 60, 56, '#ffd166', { contour: '#081c15', epaisseur: 8 });
      if (S.manche && S.phase !== 'titre') F.texte(c, 'Manche ' + Math.min(S.manche, S.nbManches) + ' / ' + S.nbManches, 220, 110, 26, '#b7e4c7', { contour: false });
      if (S.phase !== 'titre') {
        // talon + défausse
        for (var i = Math.min(6, Math.ceil(S.talon.length / 10)); i >= 0; i--) C.dessiner(c, TALON.x - i * 1.5, TALON.y - i * 2, 100, null, { ombre: i === 0 });
        F.texte(c, S.talon.length + ' cartes', TALON.x, TALON.y + 92, 22, '#b7e4c7', { contour: false });
        var d = S.defausse;
        if (d.length > 1) C.dessiner(c, DEF.x + 6, DEF.y + 4, 100, d[d.length - 2], { rot: 0.08 });
        if (d.length) C.dessiner(c, DEF.x, DEF.y, 100, d[d.length - 1]);
        else { c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 3; c.setLineDash([8, 8]); F.rr(c, DEF.x - 50, DEF.y - 70, 100, 140, 12); c.stroke(); c.setLineDash([]); }
        F.texte(c, 'défausse', DEF.x, DEF.y + 92, 22, '#b7e4c7', { contour: false });
        combis(c);
        joueurs(c);
        // journal
        S.journal.forEach(function (j, k) {
          c.globalAlpha = 1 - k * 0.3;
          F.texte(c, j.txt, 220, 420 + k * 34, k ? 22 : 25, k ? '#d8f3dc' : '#fff', { contour: false });
          c.globalAlpha = 1;
        });
        if (S.anim && F.t - S.anim.t0 < 0.6 / F.V) {
          var q = (F.t - S.anim.t0) * F.V / 0.6, A = S.anim.de === 'talon' ? TALON : DEF, B = positionJoueur(L.joueurs.indexOf(S.anim.P));
          C.dessiner(c, F.lerp(A.x, B.x, F.ease.inOut(q)), F.lerp(A.y, B.y - 40, F.ease.inOut(q)), 90, null, { dos: true, rot: q * 3 });
        }
      }
      S.particules.dessiner(c);
      if (S.bilan) bilan(c);
      banniereDessin(c);
      if (S.phase === 'titre') titre(c);
      if (S.fin) fin(c);
      c.restore();
    }

    function combis(c) {
      var zone = { x: 430, y: 40, w: 1150, h: 640 };
      var liste = S.combis;
      if (!liste.length) { F.texte(c, 'Les combinaisons posées apparaîtront ici', zone.x + zone.w / 2, zone.y + zone.h / 2, 30, 'rgba(255,255,255,.35)', { contour: false }); return; }
      // Taille des cartes adaptée au nombre de combinaisons.
      var tailles = [120, 104, 92, 80, 70, 62, 54, 46, 40, 34], w, pas, places;
      for (var t = 0; t < tailles.length; t++) {
        w = tailles[t]; pas = w * 0.55;
        places = disposer(liste, zone, w, pas);
        if (places) break;
      }
      if (!places) places = disposer(liste, zone, w, pas, true);
      liste.forEach(function (m, i) {
        var p = places[i], pr = L.joueurs.filter(function (Q) { return Q.num === m.proprio; })[0];
        var largeur = w + pas * (m.cartes.length - 1);
        c.fillStyle = m.prov ? 'rgba(255,209,102,.25)' : 'rgba(0,0,0,.18)';
        F.rr(c, p.x - 8, p.y - 8, largeur + 16, w * 1.4 + 16, 12); c.fill();
        if (m.prov) { c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.setLineDash([10, 6]); F.rr(c, p.x - 8, p.y - 8, largeur + 16, w * 1.4 + 16, 12); c.stroke(); c.setLineDash([]); }
        var nouveau = F.t - m.t0 < 0.5 / F.V, e = nouveau ? F.ease.back((F.t - m.t0) * F.V / 0.5) : 1;
        m.cartes.forEach(function (k, j) { C.dessiner(c, p.x + w / 2 + j * pas, p.y + w * 0.7 - (1 - e) * 30, w, k, { ombre: j === 0 }); });
        if (pr) { c.fillStyle = pr.couleur; F.rr(c, p.x, p.y + w * 1.4 + 3, largeur, 5, 3); c.fill(); }
      });
    }
    function disposer(liste, zone, w, pas, forcer) {
      var x = zone.x, y = zone.y, h = w * 1.4 + 26, r = [];
      for (var i = 0; i < liste.length; i++) {
        var lg = w + pas * (liste[i].cartes.length - 1) + 24;
        if (x + lg > zone.x + zone.w) { x = zone.x; y += h; }
        if (y + h > zone.y + zone.h && !forcer) return null;
        r.push({ x: x + 8, y: y + 8 });
        x += lg;
      }
      return r;
    }

    function positionJoueur(i) {
      var n = L.joueurs.length, w = Math.min(380, 1560 / n);
      return { x: 20 + w * i + w / 2, y: 790, w: w - 16 };
    }
    function joueurs(c) {
      L.joueurs.forEach(function (P, i) {
        var p = positionJoueur(i), x = p.x - p.w / 2, y = 712, actif = S.actif === P;
        c.save();
        if (actif) { c.shadowColor = P.couleur; c.shadowBlur = 24 * (0.6 + 0.4 * Math.sin(F.t * 5)); }
        c.fillStyle = 'rgba(8,28,21,.85)'; F.rr(c, x, y, p.w, 170, 20); c.fill();
        c.restore();
        if (actif) { c.lineWidth = 4; c.strokeStyle = P.couleur; F.rr(c, x, y, p.w, 170, 20); c.stroke(); }
        c.fillStyle = P.couleur; c.beginPath(); c.arc(x + 34, y + 34, 16, 0, 7); c.fill();
        F.texte(c, P.nom, x + 60, y + 34, 28, '#fff', { align: 'left', contour: false });
        F.texte(c, P.ouvert ? 'ouvert ✔' : 'pas ouvert', x + p.w - 18, y + 34, 20, P.ouvert ? '#80ed99' : '#adb5bd', { align: 'right', contour: false });
        // éventail de dos de cartes
        var n = P.main.length, lg = Math.min(p.w - 60, n * 22);
        for (var k = 0; k < n; k++) C.dessiner(c, x + 40 + (n > 1 ? k * lg / (n - 1) : 0), y + 98, 40, null, { dos: true, ombre: false, rot: (k - n / 2) * 0.015 });
        F.texte(c, n + ' cartes · total ' + P.total, x + p.w / 2, y + 150, 22, '#d8f3dc', { contour: false });
        if (actif && L.enAttente(P)) F.texte(c, '⏳', x + p.w - 30, y + 98, 30, '#fff', { contour: false });
      });
    }

    function bilan(c) {
      var b = S.bilan, q = Math.min(1, (F.t - b.t0) * F.V / 0.4);
      c.fillStyle = 'rgba(8,28,21,' + 0.8 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, b.gagnant ? b.gagnant.nom + ' gagne la manche !' : 'Plus de cartes : manche terminée', 800, 170, 64, '#ffd166', { contour: '#081c15', epaisseur: 10 });
      L.joueurs.forEach(function (P, i) {
        var y = 280 + i * 110;
        c.fillStyle = 'rgba(255,255,255,.1)'; F.rr(c, 300, y, 1000, 90, 22); c.fill();
        c.fillStyle = P.couleur; c.beginPath(); c.arc(350, y + 45, 20, 0, 7); c.fill();
        F.texte(c, P.nom, 390, y + 45, 38, '#fff', { align: 'left', contour: false });
        F.texte(c, (P.points > 0 ? '+' : '') + P.points, 1000, y + 45, 40, P.points < 0 ? '#80ed99' : '#ff8fa3', { align: 'right', contour: false });
        F.texte(c, 'total ' + P.total, 1270, y + 45, 32, '#ffd166', { align: 'right', contour: false });
      });
      F.texte(c, 'Gagnant −' + OUVERTURE + ' · pas ouvert +' + OUVERTURE * 2 + ' · sinon la valeur des cartes en main', 800, 780, 26, '#b7e4c7', { contour: false });
    }

    function banniereDessin(c) {
      var b = S.banniere;
      if (!b) return;
      var t = F.t - b.t0;
      if (t > b.duree) { S.banniere = null; return; }
      var e = Math.min(1, t * F.V / 0.3), s = Math.max(0, (t - (b.duree - 0.3 / F.V)) * F.V / 0.3), h = b.sous ? 150 : 110;
      c.save(); c.globalAlpha = 1 - s; c.translate(800, 420); c.scale(F.ease.back(e), F.ease.back(e));
      c.fillStyle = b.couleur; F.rr(c, -620, -h / 2, 1240, h, 30); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#fff'; F.rr(c, -620, -h / 2, 1240, h, 30); c.stroke();
      F.texte(c, b.texte, 0, b.sous ? -22 : 0, 58, '#fff', { contour: 'rgba(0,0,0,.4)', epaisseur: 8 });
      if (b.sous) F.texte(c, b.sous, 0, 40, 28, '#fff', { contour: false });
      c.restore();
    }

    function titre(c) {
      var t = F.t - S.t0;
      F.texte(c, 'Rami 101', 800, 240 + Math.sin(t * 2) * 8, 140, '#ffd166', { contour: '#081c15', epaisseur: 18 });
      F.texte(c, 'Pose des séries et des suites. Pour ouvrir, il faut 101 points en un seul tour !', 800, 360, 32, '#fff', { contour: false });
      [{ r: 7, s: 1 }, { r: 7, s: 0 }, { r: 7, s: 2 }, { j: true }, { r: 10, s: 3 }, { r: 11, s: 3 }, { r: 12, s: 3 }].forEach(function (k, i) {
        C.dessiner(c, 800 + (i - 3) * 120, 560 + Math.sin(t * 2 + i) * 10, 100, k, { rot: (i - 3) * 0.05 });
      });
      if (L.joueurs[0]) F.texte(c, L.joueurs[0].nom + ' choisit le nombre de manches sur son téléphone…', 800, 780, 30, '#ffd166', { contour: false });
    }

    function fin(c) {
      var f = S.fin, q = Math.min(1, (F.t - f.t0) * F.V / 0.5);
      c.fillStyle = 'rgba(8,28,21,' + 0.9 * q + ')'; c.fillRect(0, 0, 1600, 900);
      F.texte(c, 'Fin de la partie !', 800, 130, 86, '#ffd166', { contour: '#081c15', epaisseur: 14 });
      F.texte(c, f.ordre[0].nom + ' gagne avec le plus petit total', 800, 220, 42, '#fff');
      f.ordre.forEach(function (P, k) {
        var y = 300 + k * 125;
        c.fillStyle = P.rang === 1 ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.12)'; F.rr(c, 300, y, 1000, 105, 26); c.fill();
        var col = P.rang === 1 ? '#081c15' : '#fff';
        F.texte(c, F.texteRang(P.rang), 370, y + 52, 46, col, { contour: false });
        c.fillStyle = P.couleur; c.beginPath(); c.arc(470, y + 52, 24, 0, 7); c.fill();
        F.texte(c, P.nom, 520, y + 52, 46, col, { align: 'left', contour: false });
        F.texte(c, P.total + ' pts', 1260, y + 52, 42, col, { align: 'right', contour: false });
      });
      if (q >= 1 && Math.random() < 0.4) S.particules.ajouter(F.alea(0, 1600), -20, { vx: F.alea(-60, 60), vy: F.alea(60, 200), g: 120, vie: 5, taille: F.alea(10, 18), couleur: F.choisir(['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0']), forme: 'confetti' });
      S.particules.dessiner(c);
    }

    partie().catch(function (e) { console.error('Rami :', e); });
    return {
      image: image,
      message: function (j, m) { L.recevoir(j, m); },
      arrivee: function (j) { L.arrivee(j); },
      fin: function () { L.fin(); F.musique(null); F.viderAnims(); }
    };
  }

  Console.ajouterJeu({
    id: 'rami', nom: 'Rami 101', emoji: '🃏',
    description: 'Séries, suites et jokers. Ouvre avec 101 points, vide ta main le premier !',
    min: 2, max: 4, perso: true, barre: false, creer: creer
  });
})(Fiesta);
