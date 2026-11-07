/*
 * Cartes à jouer partagées (rami, poker) : paquet, noms, dessin sur la télé, envoi au téléphone.
 * Une carte = { id, r: 1..13 (1 = as), s: 0..3 (♠ ♥ ♦ ♣), j: joker }.
 */
(function (F) {
  'use strict';
  var SYMB = ['♠', '♥', '♦', '♣'], RANGS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
  var NOMS = ['', 'as', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valet', 'dame', 'roi'];

  var C = F.Cartes = {
    SYMB: SYMB, RANGS: RANGS, NOMS: NOMS,
    paquet: function (nbJeux, nbJokers) {
      var l = [], id = 0;
      for (var n = 0; n < nbJeux; n++) for (var s = 0; s < 4; s++) for (var r = 1; r <= 13; r++) l.push({ id: id++, r: r, s: s });
      for (var k = 0; k < (nbJokers || 0); k++) l.push({ id: id++, r: 0, s: -1, j: true });
      return F.melanger(l);
    },
    rouge: function (k) { return k.s === 1 || k.s === 2; },
    texte: function (k) { return k.j ? 'Joker' : RANGS[k.r] + SYMB[k.s]; },
    versTel: function (k, marque) { return { id: k.id, r: k.j ? '' : RANGS[k.r], s: k.j ? '' : SYMB[k.s], rouge: C.rouge(k), j: !!k.j, marque: !!marque }; },
    // Tri : par couleur puis valeur, ou par valeur puis couleur (jokers à la fin).
    trier: function (main, mode) {
      return main.slice().sort(function (a, b) {
        if (a.j !== b.j) return a.j ? 1 : -1;
        if (mode === 'valeur') return a.r - b.r || a.s - b.s;
        return a.s - b.s || a.r - b.r;
      });
    },

    // Dessin d'une carte de largeur w (hauteur 1,4 × w) centrée en (x, y).
    dessiner: function (c, x, y, w, k, o) {
      o = o || {};
      var h = w * 1.4, rr = w * 0.12;
      c.save();
      c.translate(x, y);
      if (o.rot) c.rotate(o.rot);
      if (o.ombre !== false) { c.fillStyle = 'rgba(0,0,0,.3)'; F.rr(c, -w / 2 + 3, -h / 2 + 5, w, h, rr); c.fill(); }
      if (!k || o.dos) {
        c.fillStyle = '#fff'; F.rr(c, -w / 2, -h / 2, w, h, rr); c.fill();
        var g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#3a0ca3'); g.addColorStop(1, '#7209b7');
        c.fillStyle = g; F.rr(c, -w / 2 + w * 0.07, -h / 2 + w * 0.07, w * 0.86, h - w * 0.14, rr * 0.7); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = Math.max(1, w * 0.03);
        for (var i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(-w / 2, i * w * 0.2); c.lineTo(w / 2, i * w * 0.2 + w * 0.6); c.stroke(); }
        F.texte(c, '✦', 0, 0, w * 0.4, '#ffd166', { contour: false });
        c.restore(); return;
      }
      c.fillStyle = k.j ? '#fff3b0' : '#fffdf7'; F.rr(c, -w / 2, -h / 2, w, h, rr); c.fill();
      if (o.sel) { c.lineWidth = w * 0.08; c.strokeStyle = o.sel; F.rr(c, -w / 2, -h / 2, w, h, rr); c.stroke(); }
      else { c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.2)'; F.rr(c, -w / 2, -h / 2, w, h, rr); c.stroke(); }
      if (k.j) {
        F.etoile(c, 0, -h * 0.06, w * 0.3, 0);
        F.texte(c, 'JOKER', 0, h * 0.3, w * 0.2, '#7209b7', { contour: false });
        c.restore(); return;
      }
      var col = C.rouge(k) ? '#d00000' : '#1b1b2f';
      F.texte(c, RANGS[k.r], -w * 0.27, -h * 0.33, w * 0.32, col, { contour: false });
      F.texte(c, SYMB[k.s], -w * 0.27, -h * 0.12, w * 0.24, col, { contour: false });
      F.texte(c, SYMB[k.s], w * 0.1, h * 0.14, w * 0.62, col, { contour: false });
      c.restore();
    }
  };
})(Fiesta);
