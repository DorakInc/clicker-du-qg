// Corps de base de la poupée : tête, visage, barbe, lunettes.
// Vues : 'front' (de face), 'side' (profil tourné vers la droite), 'back' (de dos).

import { M, sym } from './outils.js';

// ---- Tête -------------------------------------------------------------------

export function head(g, view, { p }) {
  const s = p.skin;
  if (view === 'front') {
    g.spans([[5, 11, 20], [16, 11, 20]], s.base);
    g.rect(10, 6, 21, 15, s.base);
    sym(g, 9, 10, 9, 12, s.shade); // oreilles
    g.rect(14, 17, 17, 18, s.shade); // cou
  } else if (view === 'side') {
    g.spans([[5, 12, 19], [16, 12, 19]], s.base);
    g.rect(11, 6, 20, 15, s.base);
    g.set(21, 12, s.base); // nez
    g.set(21, 13, s.shade);
    g.rect(14, 10, 15, 12, s.shade); // oreille
    g.rect(14, 17, 17, 18, s.shade); // cou
  } else {
    g.spans([[5, 11, 20], [16, 11, 20]], s.shade);
    g.rect(10, 6, 21, 15, s.shade);
    sym(g, 9, 10, 9, 12, s.shade);
    g.rect(14, 16, 17, 18, s.shade);
  }
}

/** Yeux, sourcils (couleur des cheveux) et bouche. */
export function face(g, view, { p }) {
  const s = p.skin;
  const brow = p.hair.dark;
  if (view === 'front') {
    sym(g, 13, 11, 13, 12, s.eye);
    sym(g, 12, 9, 14, 9, brow);
    g.rect(15, 14, 16, 14, s.mouth);
  } else if (view === 'side') {
    g.rect(18, 11, 18, 12, s.eye);
    g.rect(17, 9, 19, 9, brow);
    g.set(19, 14, s.mouth);
  }
}

// ---- Barbe (couleur des cheveux) --------------------------------------------

export const BEARDS = { moustache: 'Moustache', bouc: 'Bouc', barbe: 'Barbe' };

export function beard(g, view, { p, look }) {
  const style = look.beard;
  if (!style || view === 'back') return;
  const c = p.hair.base;
  if (view === 'front') {
    g.rect(14, 13, 17, 13, c);
    if (style === 'bouc') g.rect(14, 15, 17, 16, c);
    if (style === 'barbe') {
      g.spans([[12, 10, 10], [12, 21, 21], [13, 10, 11], [13, 20, 21], [14, 10, 13], [14, 18, 21], [15, 10, 21], [16, 11, 20]], c);
      g.rect(15, 14, 16, 14, p.skin.mouth);
    }
  } else {
    g.rect(18, 13, 20, 13, c);
    if (style === 'bouc') g.rect(18, 15, 20, 16, c);
    if (style === 'barbe') {
      g.rect(15, 13, 20, 16, c);
      g.rect(16, 12, 16, 12, c); // favori
      g.set(19, 14, p.skin.mouth);
    }
  }
}

// ---- Lunettes ---------------------------------------------------------------

export const GLASSES = { rondes: 'Rondes', carrees: 'Carrées', soleil: 'Soleil' };

const FRAME = '#111111';
const TINT = '#2a2a33';
const SHINE = '#6a6a7a';

export function glasses(g, view, { look }) {
  const style = look.glasses;
  if (!style || view === 'back') return;
  if (view === 'front') {
    for (const x0 of [11, 17]) {
      if (style === 'rondes') {
        g.rect(x0 + 1, 10, x0 + 2, 10, FRAME);
        g.rect(x0 + 1, 13, x0 + 2, 13, FRAME);
      } else {
        g.rect(x0, 10, x0 + 3, 10, FRAME);
        g.rect(x0, 13, x0 + 3, 13, FRAME);
      }
      g.rect(x0, 11, x0, 12, FRAME);
      g.rect(x0 + 3, 11, x0 + 3, 12, FRAME);
      if (style === 'soleil') {
        g.rect(x0 + 1, 11, x0 + 2, 12, TINT);
        g.set(x0 + 1, 11, SHINE);
      }
    }
    g.rect(15, 11, 16, 11, FRAME); // pont
    g.set(10, 11, FRAME); g.set(M(10), 11, FRAME); // branches
    return;
  }
  if (style === 'rondes') {
    g.rect(18, 10, 19, 10, FRAME);
    g.rect(18, 13, 19, 13, FRAME);
  } else {
    g.rect(17, 10, 20, 10, FRAME);
    g.rect(17, 13, 20, 13, FRAME);
  }
  g.rect(17, 11, 17, 12, FRAME);
  g.rect(20, 11, 20, 12, FRAME);
  g.rect(14, 11, 16, 11, FRAME); // branche
  if (style === 'soleil') {
    g.rect(18, 11, 19, 12, TINT);
    g.set(19, 11, SHINE);
  }
}
