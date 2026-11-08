/*
 * HexGL — course futuriste en 3D (jeu libre de Thibaut « BKcore » Despoulain, https://github.com/BKcore/HexGL).
 * Le jeu d'origine tourne dans un cadre (jeux/hexgl/course.html) au-dessus du canvas de la console,
 * et ce fichier lui transmet le volant du téléphone (js/volant.js côté téléphone).
 * Solo : le premier joueur connecté pilote, les autres regardent.
 */
Console.ajouterJeu({
  id: 'hexgl',
  nom: 'HexGL',
  emoji: '🚀',
  description: 'Course de vaisseaux futuristes en 3D. Le téléphone sert de volant : on le penche pour tourner.',
  fond: 'linear-gradient(135deg,#02131f,#0b4f7a 55%,#46c3ff)',
  min: 1,
  max: 1,
  perso: true,
  barre: false,

  creer: function (api) {
    var QUALITES = {
      q0: { q: 0, nom: 'Fluide' },
      q1: { q: 1, nom: 'Normale' },
      q3: { q: 3, nom: 'Très belle' }
    };
    var etape = 'qualite';    // qualite → difficulte → course → resultat
    var choix = { qualite: null, difficulte: 0 };
    var cadre = null, pret = false, resultat = null, pilote = null, numeroCle = 0;

    function hexTel() { try { return cadre && cadre.contentWindow && cadre.contentWindow.HexTel; } catch (e) { return null; } }
    function choisirPilote() {
      var j = api.joueurs();
      if (pilote && pilote.conn) return pilote;
      pilote = j.length ? j[0] : null;
      return pilote;
    }

    // ---------- Écrans du téléphone ----------
    function uiPilote() {
      numeroCle++;
      var cle = 'hexgl-' + numeroCle;
      if (etape === 'qualite') return {
        titre: '🚀 HexGL', cle: cle,
        texte: 'Choisis la qualité de l\'image. Sur la télé Samsung, commence par « Fluide ».',
        boutons: [
          { id: 'q0', label: '⚡ Fluide', sous: 'conseillé pour la télé' },
          { id: 'q1', label: '✨ Normale', sous: 'si la télé suit bien' },
          { id: 'q3', label: '💎 Très belle', sous: 'pour un ordinateur branché en HDMI' }
        ]
      };
      if (etape === 'difficulte') return {
        titre: 'Niveau', cle: cle,
        texte: '3 tours de piste. Attention aux murs : ils abîment le bouclier.',
        boutons: [
          { id: 'd0', label: '🟢 Tranquille', sous: 'vaisseau plus lent, bouclier solide' },
          { id: 'd1', label: '🔴 Pro', sous: 'beaucoup plus rapide' }
        ]
      };
      if (etape === 'resultat' && resultat) return {
        emoji: resultat.detruit ? '💥' : (resultat.nouveau ? '🏆' : '🏁'), cle: cle,
        titre: resultat.detruit ? 'Vaisseau détruit' : resultat.temps,
        texte: resultat.detruit ? 'Ton bouclier est tombé à zéro.' : (resultat.nouveau ? 'Nouveau record !' : 'Record : ' + resultat.record),
        boutons: [
          { id: 'rejouer', label: '↺ Rejouer' },
          { id: 'reglages', label: '⚙️ Changer les réglages' }
        ]
      };
      return { volant: true, cle: cle, texte: pret ? '' : 'Chargement de la course sur la télé…' };
    }
    function uiSpectateur(p) {
      return { emoji: '👀', titre: 'HexGL', texte: (p ? p.nom + ' pilote' : 'Course en solo') + '. Tu peux regarder la course sur la télé !' };
    }
    function majTelephones() {
      var p = choisirPilote();
      api.joueurs().forEach(function (j) {
        api.envoyer(j, { t: 'ui', ui: j === p ? uiPilote() : uiSpectateur(p) });
      });
    }

    // ---------- La course (dans un cadre) ----------
    function ouvrirCourse() {
      fermerCourse();
      pret = false; resultat = null;
      cadre = document.createElement('iframe');
      cadre.src = 'jeux/hexgl/course.html?qualite=' + choix.qualite + '&difficulte=' + choix.difficulte + '&v=' + Date.now();
      cadre.setAttribute('allow', 'autoplay; fullscreen');
      cadre.setAttribute('tabindex', '-1');
      cadre.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0;pointer-events:none;background:#000;';
      var canvas = document.getElementById('jeu');
      canvas.parentNode.insertBefore(cadre, canvas.nextSibling);
      var c = cadre;
      c.addEventListener('load', function () {
        if (c !== cadre) return;
        // La télécommande doit rester sur la console (touche Retour).
        try { window.focus(); } catch (e) {}
        var T = hexTel();
        if (!T) return;
        T.son(api.params().son);
        T.surPret = function () { pret = true; T.son(api.params().son); majTelephones(); api.son(880, 0.1); };
        T.surFin = function (r) { resultat = r; etape = 'resultat'; majTelephones(); };
        if (T.estPret()) T.surPret();
      });
      etape = 'course';
      majTelephones();
    }
    function fermerCourse() {
      if (!cadre) return;
      try { cadre.src = 'about:blank'; } catch (e) {}
      if (cadre.parentNode) cadre.parentNode.removeChild(cadre);
      cadre = null; pret = false;
    }
    function rejouer() {
      var T = hexTel();
      if (!T || !pret) return;
      resultat = null;
      etape = 'course';
      T.recommencer();
      majTelephones();
    }

    majTelephones();

    return {
      arrivee: function () { majTelephones(); },
      depart: function (j) {
        if (j === pilote) {
          var T = hexTel();
          if (T) T.commande({ v: 0, gaz: false });
          pilote = null;
        }
        majTelephones();
      },
      message: function (j, m) {
        if (j !== choisirPilote()) return;
        if (m.t === 'volant') { var T = hexTel(); if (T) T.commande(m); return; }
        if (m.t !== 'choix') return;
        if (m.id === 'recommencer' || m.id === 'rejouer') { rejouer(); return; }
        if (m.id === 'reglages') { fermerCourse(); etape = 'qualite'; majTelephones(); return; }
        if (etape === 'qualite' && QUALITES[m.id]) { choix.qualite = QUALITES[m.id].q; etape = 'difficulte'; majTelephones(); return; }
        if (etape === 'difficulte' && (m.id === 'd0' || m.id === 'd1')) { choix.difficulte = m.id === 'd1' ? 1 : 0; ouvrirCourse(); }
      },
      image: function (ctx, W, H) {
        if (cadre) return;
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#02131f'); g.addColorStop(1, '#0b4f7a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#46c3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.round(H * 0.12) + 'px sans-serif';
        ctx.fillText('HexGL', W / 2, H * 0.38);
        ctx.fillStyle = '#fff'; ctx.font = Math.round(H * 0.04) + 'px sans-serif';
        var p = choisirPilote();
        ctx.fillText(p ? p.nom + ' : choisis les réglages sur ton téléphone' : 'En attente d\'un pilote…', W / 2, H * 0.55);
        ctx.globalAlpha = 0.6; ctx.font = Math.round(H * 0.028) + 'px sans-serif';
        ctx.fillText('Jeu libre de Thibaut « BKcore » Despoulain · github.com/BKcore/HexGL', W / 2, H * 0.9);
        ctx.globalAlpha = 1;
      },
      fin: fermerCourse
    };
  }
});
