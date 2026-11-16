// Coiffures et chapeaux de la poupée de papier.
// Les formes sont des listes de lignes [y, x0, x1] par vue ; un motif (boucles, tresses)
// est appliqué ensuite sur les pixels de la couleur des cheveux.

import { M, sym, texture } from './outils.js';

// ---- Coiffures ----------------------------------------------------------------

export const HAIRS = {
  chauve: 'Chauve',
  rase: 'Rasé',
  courte: 'Courte',
  boucles: 'Boucles',
  afro: 'Afro',
  longue: 'Longue',
  tresses: 'Tresses',
  queue: 'Queue de cheval',
};

/** Boucles décalées d'une rangée à l'autre. */
function curls(g, h) {
  texture(g, h.base, (x, y) => {
    const shift = Math.floor(y / 2) % 2 === 0 ? 0 : 2;
    if (y % 2 === 0 && (x + shift) % 4 === 0) return h.light;
    if (y % 2 === 1 && (x + shift) % 4 === 2) return h.dark;
    return null;
  });
}

/** Ellipse coupée par une fenêtre (pour laisser voir le visage). */
function blob(g, cx, cy, rx, ry, color, keep = () => true) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && keep(x, y)) g.set(x, y, color);
    }
  }
}

const SHORT_TOP = {
  front: [[3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22], [7, 9, 22]],
  side: [[3, 12, 18], [4, 10, 20], [5, 10, 21], [6, 10, 21], [7, 10, 21]],
};

const DRAW_HAIR = {
  chauve() {},

  rase(g, view, h) {
    if (view === 'front') g.spans([[4, 11, 20], [5, 10, 21], [6, 10, 21], [7, 10, 21], [8, 10, 10], [8, 21, 21]], h.dark);
    else if (view === 'side') g.spans([[4, 12, 19], [5, 11, 20], [6, 11, 20], [7, 11, 19], [8, 11, 13], [9, 11, 13], [10, 11, 12]], h.dark);
    else {
      g.spans([[4, 11, 20], [5, 10, 21], [13, 11, 20]], h.dark);
      g.rect(10, 6, 21, 12, h.dark);
    }
  },

  courte(g, view, h) {
    if (view === 'front') {
      g.spans([...SHORT_TOP.front, [8, 9, 18], [8, 20, 22], [9, 10, 15], [9, 21, 21], [10, 10, 10], [10, 21, 21]], h.base);
      g.rect(13, 4, 17, 4, h.light);
      g.rect(11, 5, 13, 5, h.light);
    } else if (view === 'side') {
      g.spans([...SHORT_TOP.side, [8, 10, 13], [8, 17, 21], [9, 10, 13], [10, 10, 13], [11, 10, 12], [12, 10, 11]], h.base);
      g.rect(14, 4, 17, 4, h.light);
    } else {
      g.spans([[3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22], [14, 11, 20]], h.base);
      g.rect(10, 7, 21, 13, h.base);
      g.rect(13, 4, 17, 5, h.light);
    }
  },

  boucles(g, view, h) {
    if (view === 'front') {
      g.spans([
        [1, 12, 19], [2, 10, 21], [3, 8, 23], [4, 7, 24], [5, 7, 24], [6, 7, 24], [7, 7, 24], [8, 7, 24],
        [9, 7, 10], [9, 21, 24], [10, 8, 9], [10, 22, 23], [11, 8, 9], [11, 22, 23], [12, 8, 9], [12, 22, 23],
        [13, 8, 8], [13, 23, 23], [9, 11, 12], [9, 17, 18],
      ], h.base);
    } else if (view === 'side') {
      g.spans([
        [1, 11, 18], [2, 9, 20], [3, 8, 21], [4, 7, 21], [5, 7, 21], [6, 7, 22], [7, 7, 22], [8, 7, 22],
        [9, 7, 13], [9, 19, 22], [10, 7, 13], [10, 21, 21], [11, 8, 13], [12, 8, 13], [13, 9, 12], [14, 10, 12],
      ], h.base);
    } else {
      g.spans([
        [1, 12, 19], [2, 10, 21], [3, 8, 23], [4, 7, 24], [5, 7, 24], [6, 7, 24], [7, 7, 24], [8, 7, 24],
        [9, 7, 24], [10, 7, 24], [11, 7, 24], [12, 7, 24], [13, 8, 23], [14, 9, 22], [15, 11, 20],
      ], h.base);
    }
    curls(g, h);
  },

  afro(g, view, h) {
    if (view === 'front') blob(g, 15.5, 6.5, 9.5, 7.5, h.base, (x, y) => y < 9 || x < 11 || x > 20);
    else if (view === 'side') blob(g, 13.5, 6.5, 9, 7.5, h.base, (x, y) => y < 9 || x < 14);
    else blob(g, 15.5, 7, 9.5, 8, h.base);
    curls(g, h);
  },

  longue(g, view, h) {
    if (view === 'front') {
      g.spans([[2, 12, 19], [3, 10, 21], [4, 9, 22], [5, 9, 22], [6, 9, 22], [7, 9, 22]], h.base);
      sym(g, 7, 6, 11, 8, h.base); // mèches qui encadrent le visage
      sym(g, 7, 9, 10, 20, h.base); // jusqu'aux épaules
      sym(g, 7, 21, 9, 22, h.base);
      sym(g, 9, 8, 9, 20, h.dark);
      sym(g, 12, 4, 13, 6, h.light);
      g.clear(7, 6); g.clear(M(7), 6);
    } else if (view === 'side') {
      g.spans([[2, 12, 18], [3, 10, 20], [4, 9, 21], [5, 9, 21], [6, 9, 21], [7, 9, 21], [8, 9, 20]], h.base);
      g.rect(8, 9, 15, 19, h.base);
      g.rect(9, 20, 14, 23, h.base);
      g.rect(10, 9, 10, 21, h.dark);
      g.rect(13, 9, 13, 18, h.dark);
      g.rect(14, 4, 16, 5, h.light);
    } else {
      g.spans([[2, 12, 19], [3, 10, 21], [20, 9, 12], [20, 19, 22], [21, 9, 10], [21, 21, 22]], h.base);
      g.rect(8, 4, 23, 19, h.base);
      for (const x of [10, 13, 18, 21]) g.rect(x, 6, x, 18, h.dark);
      g.rect(12, 4, 14, 6, h.light);
    }
  },

  tresses(g, view, h) {
    const braid = (x, y0, y1) => {
      for (let y = y0; y <= y1; y += 1) g.set(x, y, y % 2 === 0 ? h.base : h.dark);
    };
    if (view === 'front') {
      g.spans([...SHORT_TOP.front, [8, 9, 10], [8, 21, 22]], h.base);
      for (let x = 11; x <= 20; x += 2) g.set(x, 6, h.dark); // raies
      for (const x of [8, 10, M(10), M(8)]) braid(x, 8, 24);
      for (const x of [7, 9, M(9), M(7)]) braid(x, 9, 22);
    } else if (view === 'side') {
      g.spans([...SHORT_TOP.side, [8, 10, 14], [9, 10, 13]], h.base);
      for (let x = 8; x <= 12; x += 1) braid(x, 8 + (x % 2), 24 - (x % 3));
    } else {
      g.spans([[3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22]], h.base);
      for (let x = 8; x <= 23; x += 1) braid(x, 7, x % 2 === 0 ? 24 : 22);
    }
  },

  queue(g, view, h) {
    if (view === 'front') {
      g.spans([...SHORT_TOP.front, [8, 9, 10], [8, 21, 22], [9, 9, 10], [9, 21, 22]], h.base);
      g.rect(12, 4, 15, 4, h.light);
    } else if (view === 'side') {
      g.spans([...SHORT_TOP.side, [8, 10, 13], [9, 10, 13], [10, 10, 12]], h.base);
      g.rect(7, 7, 10, 9, h.dark); // élastique et queue
      g.rect(7, 10, 9, 20, h.base);
      g.rect(8, 21, 8, 22, h.base);
      g.rect(8, 11, 8, 19, h.light);
    } else {
      g.spans([[3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22], [13, 11, 20]], h.base);
      g.rect(10, 7, 21, 12, h.base);
      g.rect(14, 11, 17, 12, h.dark);
      g.rect(14, 13, 17, 21, h.base);
      g.rect(15, 22, 16, 23, h.base);
      g.rect(15, 14, 15, 20, h.light);
    }
  },
};

export function hair(g, view, { p, look }) {
  DRAW_HAIR[look.hair.style]?.(g, view, p.hair);
}

// ---- Chapeaux -----------------------------------------------------------------

export const HATS = { casquette: 'Casquette', tuque: 'Tuque' };

export function hat(g, view, { p, look }) {
  if (!look.hat) return;
  const c = p.hat;
  if (look.hat.style === 'casquette') {
    const crown = view === 'side' ? SHORT_TOP.side : SHORT_TOP.front;
    g.spans(crown, c.base);
    if (view === 'front') {
      g.rect(9, 8, 22, 8, c.dark); // visière vue de face
      g.rect(12, 4, 14, 4, c.light);
    } else if (view === 'side') {
      g.rect(15, 8, 25, 8, c.dark); // visière vers l'avant
      g.rect(14, 4, 16, 4, c.light);
    } else {
      g.rect(9, 8, 22, 8, c.base);
      g.rect(14, 8, 17, 8, c.dark); // la sangle
    }
    return;
  }
  // Tuque : bonnet à revers et pompon.
  const front = view !== 'side';
  g.spans(front
    ? [[2, 12, 19], [3, 10, 21], [4, 9, 22], [5, 9, 22], [6, 9, 22]]
    : [[2, 12, 18], [3, 10, 20], [4, 10, 21], [5, 10, 21], [6, 10, 21]], c.base);
  const [x0, x1] = front ? [9, 22] : [10, 21];
  g.rect(x0, 7, x1, 8, c.dark);
  for (let x = x0 + 1; x <= x1; x += 2) g.set(x, 7, c.base); // côtes du revers
  g.rect(front ? 14 : 13, 0, front ? 17 : 16, 1, c.light);
}
