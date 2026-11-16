// Vêtements de la poupée : hauts, bas, chaussures et accessoires.
// Chaque pièce sait se dessiner dans les 3 vues ('front', 'side', 'back').

import { M, sym, texture } from './outils.js';

// ---- Hauts ------------------------------------------------------------------------

export const TOPS = {
  tshirt: 'T-shirt',
  debardeur: 'Débardeur',
  hoodie: 'Hoodie',
  bomber: 'Bomber',
  'demi-zip': 'Demi-zip',
  blouson: 'Blouson ouvert',
  chemise: 'Chemise',
};

/** Manches : 'longue', 'courte' ou 'aucune'. */
const SLEEVES = { tshirt: 'courte', debardeur: 'aucune' };

/** Bras de profil, avec un bord sombre pour le détacher du torse. */
function armSide(g, sleeve, t, skin) {
  const [x0, x1] = [14, 18];
  const end = { longue: 29, courte: 22, aucune: 18 }[sleeve];
  g.rect(x0, 19, x1, 29, skin.base);
  g.rect(x0, 20, x0, 28, skin.shade);
  g.rect(x1, 20, x1, 28, skin.shade);
  if (end > 18) {
    g.rect(x0, 19, x1, end, t.base);
    g.rect(x0, 20, x0, Math.min(end, 28), t.dark);
    g.rect(x1, 20, x1, Math.min(end, 28), t.dark);
  }
  if (sleeve === 'longue') g.rect(x0, 29, x1, 29, t.dark);
  g.rect(x0 + 1, 30, x1 - 1, 31, skin.base); // main
}

export function top(g, view, { p, look, body }) {
  const style = look.top.style;
  const t = p.top;
  const s = p.skin;
  const sleeve = SLEEVES[style] ?? 'longue';

  if (view === 'side') {
    const [x0, x1] = body.sideTorso;
    g.rect(x0, 19, x1, 30, t.base);
    g.rect(x0, 29, x1, 30, t.dark);
    if (style === 'hoodie') g.rect(x0 - 1, 17, x0 + 2, 22, t.dark); // capuchon dans le dos
    if (style === 'debardeur') g.rect(x0 + 2, 19, x1 - 2, 20, s.base);
    if (['bomber', 'demi-zip', 'chemise'].includes(style)) g.rect(x0 + 1, 17, x0 + 6, 18, style === 'demi-zip' ? t.dark : t.accent);
    if (style === 'blouson') {
      g.rect(x1 - 1, 20, x1, 30, t.inner);
      g.rect(x0 + 1, 17, x0 + 7, 18, t.accent);
      g.rect(x1 - 2, 19, x1 - 1, 21, t.accent);
    }
    armSide(g, sleeve, t, s);
    if (style === 'demi-zip') g.rect(16, 19, 16, 28, t.accent);
    if (style === 'bomber' || style === 'blouson') g.rect(16, 21, 16, 27, t.light);
    return;
  }

  const back = view === 'back';
  const t0 = body.torso;
  const [a0, a1] = [t0 - 3, t0 - 1];
  g.rect(t0, 19, M(t0), 30, t.base);
  g.rect(t0, 29, M(t0), 30, t.dark);
  sym(g, a0, 19, a1, 29, s.base); // bras nus
  if (sleeve === 'longue') {
    sym(g, a0, 19, a1, 29, t.base);
    sym(g, a0, 29, a1, 29, t.dark);
  } else if (sleeve === 'courte') {
    sym(g, a0, 19, a1, 22, t.base);
    sym(g, a0, 22, a1, 22, t.dark);
  }
  g.clear(a0, 19); g.clear(M(a0), 19);
  sym(g, a0, 30, a1, 31, s.base); // mains

  switch (style) {
    case 'tshirt':
      if (!back) {
        g.rect(14, 19, 17, 19, s.shade); // encolure
        g.rect(18, 21, 19, 22, t.accent); // petit logo
      }
      break;
    case 'debardeur':
      sym(g, t0, 19, t0 + 1, 20, s.base); // épaules nues
      if (!back) g.rect(13, 19, 18, 20, s.base);
      g.rect(t0, 28, M(t0), 28, t.accent);
      break;
    case 'hoodie':
      if (back) {
        g.rect(11, 17, 20, 23, t.dark); // capuchon
        g.rect(12, 18, 19, 22, t.base);
        g.rect(12, 22, 19, 22, t.dark);
      } else {
        sym(g, 11, 17, 13, 19, t.dark); // capuchon autour du cou
        g.rect(14, 20, 14, 23, t.accent); // cordons
        g.rect(17, 20, 17, 23, t.accent);
        g.rect(12, 25, 19, 27, t.dark); // poche kangourou
        g.rect(13, 25, 18, 25, t.base);
      }
      break;
    case 'bomber':
      sym(g, a0 + 1, 21, a0 + 1, 27, t.light); // bomber gonflé
      sym(g, t0 + 1, 22, t0 + 1, 27, t.light);
      if (back) {
        g.rect(11, 18, 20, 20, t.accent);
        g.rect(11, 20, 20, 20, t.accentDark);
      } else {
        g.rect(15, 20, 16, 28, t.dark); // fermeture
        sym(g, t0 + 2, 22, 13, 22, t.light); // poches de poitrine
        g.rect(11, 17, 20, 19, t.accent); // col
        sym(g, 11, 19, 12, 19, t.accentDark);
        g.rect(14, 17, 17, 17, s.shade);
      }
      break;
    case 'demi-zip':
      sym(g, a0 + 1, 19, t0 + 3, 19, t.accent); // bande sur l'épaule
      sym(g, a0, 20, a0, 28, t.accent); // et le long du bras
      g.rect(12, 17, 19, 18, t.dark); // col montant
      if (!back) {
        g.rect(15, 18, 16, 23, t.zip);
        g.set(19, 22, t.accent);
      }
      break;
    case 'blouson':
      sym(g, a0 + 1, 20, a0 + 1, 27, t.light); // reflets
      sym(g, t0 + 1, 21, t0 + 1, 26, t.light);
      if (back) {
        g.rect(11, 17, 20, 19, t.accent);
        sym(g, 11, 19, 12, 19, t.accentDark);
      } else {
        g.rect(14, 19, 17, 30, t.inner); // ouvert sur le t-shirt
        sym(g, 13, 20, 13, 30, t.dark);
        g.rect(12, 17, 19, 17, t.accent);
        g.spans([[18, 10, 14], [19, 10, 13], [20, 11, 13], [21, 12, 13]], t.accent); // revers
        g.spans([[18, 17, 21], [19, 18, 21], [20, 18, 20], [21, 18, 19]], t.accent);
        sym(g, 10, 18, 10, 19, t.accentDark);
      }
      break;
    case 'chemise':
      if (back) {
        g.rect(12, 18, 19, 18, t.accent);
      } else {
        sym(g, 12, 18, 14, 19, t.accent); // col
        g.set(14, 20, t.accent); g.set(M(14), 20, t.accent);
        g.rect(15, 20, 16, 30, t.dark); // patte
        for (let y = 21; y <= 28; y += 3) g.set(15, y, t.light); // boutons
      }
      break;
    default:
  }
}

// ---- Bas --------------------------------------------------------------------------

export const BOTTOMS = {
  jean: 'Jean',
  jogger: 'Jogger',
  cargo: 'Cargo',
  baggy: 'Baggy effiloché',
  short: 'Short',
  jupe: 'Jupe',
};

const SOCK = '#9b9a95';

/** Denim : `frayed` = délavé et effiloché (baggy), sinon un grain discret. */
function denim(g, b, y0, y1, frayed) {
  texture(g, b.base, (x, y) => {
    if (y < y0 || y > y1) return null;
    if (!frayed) return (x * 3 + y) % 7 === 0 ? b.mid : null;
    if ((x * 3 + y) % 11 === 0) return b.light;
    if ((x + y * 2) % 5 === 0) return b.mid;
    return null;
  });
}

export function bottom(g, view, { p, look, body }) {
  const style = look.bottom.style;
  const b = p.bottom;
  const s = p.skin;

  if (view === 'side') {
    const [x0, x1] = body.sideLeg;
    switch (style) {
      case 'short':
        g.rect(x0, 31, x1, 36, b.base);
        g.rect(x0 + 1, 37, x1 - 1, 42, s.base);
        g.rect(x0 + 1, 37, x1 - 1, 37, s.shade);
        break;
      case 'jupe':
        g.rect(x0, 31, x1, 34, b.base);
        g.rect(x0 - 1, 35, x1 + 1, 38, b.base);
        g.rect(x0 - 1, 38, x1 + 1, 38, b.dark);
        g.rect(x0 + 1, 39, x1 - 1, 42, s.base);
        break;
      case 'baggy':
        g.rect(x0 - 1, 31, x1 + 1, 37, b.base);
        g.rect(x0 - 2, 38, x1 + 2, 44, b.base);
        denim(g, b, 31, 44, true);
        for (let x = x0 - 2; x <= x1 + 2; x += 2) g.clear(x, 44);
        break;
      default:
        g.rect(x0, 31, x1, 42, b.base);
        if (style === 'jogger') {
          g.rect(x0, 41, x1, 41, b.dark);
          g.rect(x0, 42, x1, 42, SOCK);
        }
        if (style === 'cargo') {
          g.rect(x0 + 1, 34, x0 + 4, 37, b.light);
          g.rect(x0 + 2, 35, x0 + 3, 37, b.base);
        }
        if (style === 'jean') {
          denim(g, b, 31, 42, false);
          g.rect(x0, 42, x1, 42, b.dark);
        }
    }
    return;
  }

  const l0 = body.leg;
  const gap = (y0, y1) => { for (let y = y0; y <= y1; y += 1) { g.clear(15, y); g.clear(16, y); } };
  switch (style) {
    case 'short':
      g.rect(l0, 31, M(l0), 36, b.base);
      gap(35, 36);
      sym(g, l0 + 1, 37, 13, 42, s.base);
      sym(g, l0 + 1, 37, 13, 37, s.shade);
      sym(g, l0, 36, 14, 36, b.dark);
      break;
    case 'jupe':
      g.rect(l0, 31, M(l0), 34, b.base);
      g.rect(l0 - 1, 35, M(l0 - 1), 38, b.base);
      g.rect(l0 - 1, 38, M(l0 - 1), 38, b.dark);
      for (let x = l0 + 1; x <= M(l0 + 1); x += 3) g.rect(x, 33, x, 37, b.dark); // plis
      sym(g, l0 + 1, 39, 13, 42, s.base);
      break;
    case 'baggy':
      g.rect(l0 - 1, 31, M(l0 - 1), 37, b.base);
      g.rect(l0 - 2, 38, M(l0 - 2), 44, b.base);
      gap(34, 44);
      denim(g, b, 31, 44, true);
      for (let x = l0 - 2; x <= M(l0 - 2); x += 2) g.clear(x, 44); // franges
      break;
    default:
      g.rect(l0, 31, M(l0), 42, b.base);
      gap(35, 42);
      if (style === 'jogger') {
        sym(g, l0, 32, l0, 40, b.light);
        sym(g, l0, 41, 14, 41, b.dark);
        sym(g, l0, 42, 14, 42, SOCK);
      }
      if (style === 'cargo') {
        sym(g, l0, 34, l0 + 2, 34, b.light); // rabat de poche
        sym(g, l0, 35, l0, 38, b.light);
      }
      if (style === 'jean') {
        denim(g, b, 31, 42, false);
        sym(g, l0, 42, 14, 42, b.dark); // ourlet
        g.rect(15, 31, 16, 32, b.dark); // braguette
      }
  }
}

// ---- Chaussures -------------------------------------------------------------------

export const SHOES = { baskets: 'Baskets', bottes: 'Bottes', sabots: 'Sabots' };

export function shoes(g, view, { p, look, body }) {
  const style = look.shoes.style;
  const c = p.shoes;
  if (view === 'side') {
    const [x0, x1] = body.sideLeg;
    if (style === 'bottes') g.rect(x0, 38, x1, 42, c.base);
    if (style === 'bottes') g.rect(x0, 38, x1, 38, c.light);
    if (style === 'sabots') {
      g.rect(x0 - 1, 43, 22, 45, c.base);
      g.clear(21, 43); g.clear(22, 43);
      g.set(x0 + 2, 44, c.light); g.set(x0 + 5, 44, c.light);
    } else {
      g.rect(x0, 43, 21, 45, c.base);
      g.clear(20, 43); g.clear(21, 43);
      if (style === 'baskets') g.rect(x0 + 4, 43, x0 + 6, 43, c.light);
    }
    g.rect(style === 'sabots' ? x0 - 1 : x0, 45, style === 'sabots' ? 22 : 21, 45, c.sole);
    return;
  }
  const l0 = body.leg;
  if (style === 'bottes') {
    sym(g, l0, 38, 14, 42, c.base);
    sym(g, l0, 38, 14, 38, c.light);
  }
  const s0 = style === 'sabots' ? l0 - 2 : l0 - 1;
  sym(g, s0, 43, 14, 45, c.base);
  sym(g, s0, 45, 14, 45, c.sole);
  g.clear(s0, 43); g.clear(M(s0), 43);
  if (view === 'front' && style === 'baskets') sym(g, l0 + 1, 43, l0 + 2, 43, c.light); // lacets
  if (style === 'sabots') sym(g, s0 + 2, 44, s0 + 3, 44, c.light);
}

// ---- Accessoires ------------------------------------------------------------------

export const ACCESSORIES = { chaine: 'Chaîne en or', casque: 'Casque au cou', sac: 'Sac à dos' };

const GOLD = '#e8c547';
const GOLD_DARK = '#b8932a';
const PHONES = '#2a2a30';
const PHONES_LIGHT = '#ff7eb6';
const BAG = '#7a4b2a';
const BAG_DARK = '#57341c';

const DRAW_ACCESSORY = {
  chaine(g, view, body) {
    if (view === 'front') {
      g.spans([[19, 12, 12], [20, 13, 13], [21, 14, 14], [22, 15, 16], [21, 17, 17], [20, 18, 18], [19, 19, 19]], GOLD);
      g.rect(15, 23, 16, 23, GOLD_DARK); // pendentif
    } else if (view === 'side') {
      const x1 = body.sideTorso[1];
      g.set(x1 - 2, 19, GOLD); g.set(x1 - 1, 20, GOLD); g.set(x1 - 1, 21, GOLD_DARK);
    } else {
      g.rect(13, 18, 18, 18, GOLD);
    }
  },
  casque(g, view) {
    if (view === 'side') {
      g.rect(14, 16, 16, 19, PHONES);
      g.set(15, 17, PHONES_LIGHT);
      return;
    }
    g.rect(12, 19, 19, 19, PHONES);
    sym(g, 10, 17, 11, 19, PHONES);
    if (view === 'front') sym(g, 10, 18, 10, 18, PHONES_LIGHT);
  },
  sac(g, view, body) {
    if (view === 'front') {
      sym(g, 11, 19, 11, 28, BAG_DARK); // bretelles
    } else if (view === 'side') {
      const x0 = body.sideTorso[0];
      g.rect(x0 - 3, 20, x0, 29, BAG);
      g.rect(x0 - 3, 20, x0, 22, BAG_DARK);
      g.rect(x0 + 2, 19, x0 + 2, 25, BAG_DARK);
    } else {
      g.rect(10, 20, 21, 29, BAG);
      g.rect(10, 20, 21, 23, BAG_DARK);
      g.rect(14, 25, 17, 27, BAG_DARK); // poche
    }
  },
};

export function accessories(g, view, { look, body }) {
  for (const id of look.accessories ?? []) DRAW_ACCESSORY[id]?.(g, view, body);
}
