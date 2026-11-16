// Les trois personnages en pixel art, dessinés d'après les photos de référence
// (T-pose dans le garage). Chaque vue fait 32 × 48 pixels.
//   face  : de face        profil : tourné vers la droite        dos : de dos
// Les coordonnées vont de x = 0 (gauche) à 31, y = 0 (haut) à 47.

const M = (x) => 31 - x; // miroir horizontal

/** Rectangle + son reflet de l'autre côté (vues de face et de dos). */
function sym(g, x0, y0, x1, y1, color) {
  g.rect(x0, y0, x1, y1, color);
  g.rect(M(x1), y0, M(x0), y1, color);
}

const SKIN = { base: '#f1c6a4', shade: '#d9a582', eye: '#2b1d1a', mouth: '#c47f69' };

// ---- Parties communes ----------------------------------------------------

function headFront(g) {
  g.spans([[5, 11, 20], [16, 11, 20]], SKIN.base);
  g.rect(10, 6, 21, 15, SKIN.base);
  sym(g, 9, 10, 9, 12, SKIN.shade); // oreilles
  g.rect(14, 17, 17, 18, SKIN.shade); // cou
}

function faceFront(g, brow) {
  sym(g, 13, 11, 13, 12, SKIN.eye);
  sym(g, 12, 9, 14, 9, brow);
  g.rect(15, 14, 16, 14, SKIN.mouth);
}

function headSide(g, brow) {
  g.spans([[5, 12, 19], [16, 12, 19]], SKIN.base);
  g.rect(11, 6, 20, 15, SKIN.base);
  g.set(21, 12, SKIN.base); // nez
  g.set(21, 13, SKIN.shade);
  g.rect(14, 10, 15, 12, SKIN.shade); // oreille
  g.rect(18, 11, 18, 12, SKIN.eye);
  g.rect(17, 9, 19, 9, brow);
  g.set(19, 14, SKIN.mouth);
  g.rect(14, 17, 17, 18, SKIN.shade); // cou
}

function headBack(g) {
  g.spans([[5, 11, 20], [16, 11, 20]], SKIN.shade);
  g.rect(10, 6, 21, 15, SKIN.shade);
  sym(g, 9, 10, 9, 12, SKIN.shade);
  g.rect(14, 16, 17, 18, SKIN.shade);
}

/** Bras de profil, avec un bord sombre pour le détacher du torse. */
function armSide(g, x0, x1, color, edge) {
  g.rect(x0, 19, x1, 29, color);
  g.rect(x0, 20, x0, 28, edge);
  g.rect(x1, 20, x1, 28, edge);
  g.rect(x0 + 1, 30, x1 - 1, 31, SKIN.base); // main
}

/** Texture de cheveux bouclés : petites boucles claires et sombres. */
function curls(g, hair, light, dark) {
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      if (g.get(x, y) !== hair) continue;
      // boucles décalées d'une rangée à l'autre
      const shift = Math.floor(y / 2) % 2 === 0 ? 0 : 2;
      if (y % 2 === 0 && (x + shift) % 4 === 0) g.set(x, y, light);
      else if (y % 2 === 1 && (x + shift) % 4 === 2) g.set(x, y, dark);
    }
  }
}

/** Denim effiloché : rayures diagonales claires, bas déchiré. */
function frayedDenim(g, x0, x1, y0, y1, p) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (g.get(x, y) !== p.denim) continue;
      if ((x * 3 + y) % 11 === 0) g.set(x, y, p.denimLight);
      else if ((x + y * 2) % 5 === 0) g.set(x, y, p.denimMid);
    }
  }
  for (let x = x0; x <= x1; x += 2) g.clear(x, y1); // franges
}

// ---- Nathan : cheveux bouclés, demi-zip kaki à bandes beige, jogger noir ---

const nathanP = {
  hair: '#a07a52', hairLight: '#c99f70', hairDark: '#76533a',
  top: '#5f6751', topDark: '#4a5140', stripe: '#cdbf9f', zip: '#3b4033',
  pants: '#1f1f24', pantsLight: '#36363e', cuff: '#18181c', sock: '#9b9a95',
  shoe: '#1b1b1f', sole: '#2e2e34',
};

function nathanLegs(g, p) {
  g.rect(10, 31, 21, 41, p.pants);
  for (let y = 35; y <= 42; y += 1) { g.clear(15, y); g.clear(16, y); }
  sym(g, 10, 32, 10, 40, p.pantsLight);
  sym(g, 10, 41, 14, 41, p.cuff);
  sym(g, 10, 42, 14, 42, p.sock);
  sym(g, 9, 43, 14, 45, p.shoe);
  sym(g, 9, 45, 14, 45, p.sole);
  g.clear(9, 43); g.clear(M(9), 43);
}

function nathanTop(g, p, { back = false } = {}) {
  g.rect(9, 19, 22, 30, p.top);
  sym(g, 6, 19, 8, 29, p.top);
  g.clear(6, 19); g.clear(M(6), 19);
  sym(g, 7, 19, 12, 19, p.stripe); // bande beige sur l'épaule
  sym(g, 6, 20, 6, 28, p.stripe); // et le long du bras
  g.rect(9, 29, 22, 30, p.topDark);
  sym(g, 6, 29, 8, 29, p.topDark);
  sym(g, 6, 30, 8, 31, SKIN.base); // mains
  g.rect(12, 17, 19, 18, p.topDark); // col montant
  if (!back) {
    g.rect(15, 18, 16, 23, p.zip); // fermeture éclair
    g.set(19, 22, p.stripe); // petit logo
  }
}

const nathan = {
  id: 'nathan',
  front(g) {
    const p = nathanP;
    nathanLegs(g, p);
    headFront(g);
    nathanTop(g, p);
    faceFront(g, p.hairDark);
    g.spans([
      [1, 12, 19], [2, 10, 21], [3, 8, 23], [4, 7, 24], [5, 7, 24], [6, 7, 24], [7, 7, 24], [8, 7, 24],
      [9, 7, 10], [9, 21, 24], [10, 8, 9], [10, 22, 23], [11, 8, 9], [11, 22, 23], [12, 8, 9], [12, 22, 23],
      [13, 8, 8], [13, 23, 23],
      [9, 11, 12], [9, 17, 18], // boucles sur le front
    ], p.hair);
    curls(g, p.hair, p.hairLight, p.hairDark);
  },
  side(g) {
    const p = nathanP;
    g.rect(13, 31, 19, 41, p.pants);
    g.rect(13, 41, 19, 41, p.cuff);
    g.rect(13, 42, 19, 42, p.sock);
    g.rect(13, 43, 21, 45, p.shoe);
    g.rect(13, 45, 21, 45, p.sole);
    g.clear(20, 43); g.clear(21, 43);
    headSide(g, p.hairDark);
    g.rect(12, 19, 20, 30, p.top);
    g.rect(12, 29, 20, 30, p.topDark);
    g.rect(13, 17, 18, 18, p.topDark);
    armSide(g, 14, 18, p.top, p.topDark);
    g.rect(16, 19, 16, 28, p.stripe);
    g.rect(14, 29, 18, 29, p.topDark);
    g.spans([
      [1, 11, 18], [2, 9, 20], [3, 8, 21], [4, 7, 21], [5, 7, 21], [6, 7, 22], [7, 7, 22], [8, 7, 22],
      [9, 7, 13], [9, 19, 22], [10, 7, 13], [10, 21, 21], [11, 8, 13], [12, 8, 13], [13, 9, 12], [14, 10, 12],
    ], p.hair);
    curls(g, p.hair, p.hairLight, p.hairDark);
  },
  back(g) {
    const p = nathanP;
    nathanLegs(g, p);
    headBack(g);
    nathanTop(g, p, { back: true });
    g.spans([
      [1, 12, 19], [2, 10, 21], [3, 8, 23], [4, 7, 24], [5, 7, 24], [6, 7, 24], [7, 7, 24], [8, 7, 24],
      [9, 7, 24], [10, 7, 24], [11, 7, 24], [12, 7, 24], [13, 8, 23], [14, 9, 22], [15, 11, 20],
    ], p.hair);
    curls(g, p.hair, p.hairLight, p.hairDark);
  },
};

// ---- Émile : cheveux courts foncés, lunettes rondes, cuir à col mouton, cargo ---

const emileP = {
  hair: '#2f221b', hairLight: '#4d382a',
  jacket: '#2b2b31', jacketLight: '#4a4a54', jacketDark: '#1c1c21', shirt: '#121214',
  collar: '#dcc9a5', collarDark: '#b9a37c',
  pants: '#232328', pantsLight: '#383840', shoe: '#1e1e23', sole: '#d8d4cb', lace: '#3d3d45',
  glasses: '#111111',
};

function emileLegs(g, p) {
  g.rect(10, 31, 21, 42, p.pants);
  for (let y = 35; y <= 42; y += 1) { g.clear(15, y); g.clear(16, y); }
  sym(g, 10, 34, 12, 34, p.pantsLight); // rabat de poche cargo
  sym(g, 10, 35, 10, 38, p.pantsLight);
  sym(g, 9, 43, 14, 45, p.shoe);
  sym(g, 11, 43, 12, 43, p.lace);
  sym(g, 9, 45, 14, 45, p.sole);
  g.clear(9, 43); g.clear(M(9), 43);
}

function emileTop(g, p, { back = false } = {}) {
  g.rect(9, 19, 22, 30, p.jacket);
  sym(g, 6, 19, 8, 29, p.jacket);
  g.clear(6, 19); g.clear(M(6), 19);
  sym(g, 7, 20, 7, 27, p.jacketLight); // reflets du cuir
  sym(g, 10, 21, 10, 26, p.jacketLight);
  sym(g, 9, 29, 22, 30, p.jacketDark);
  sym(g, 6, 29, 8, 29, p.jacketDark);
  sym(g, 6, 30, 8, 31, SKIN.base);
  if (back) {
    g.rect(11, 17, 20, 19, p.collar); // col en mouton
    sym(g, 11, 19, 12, 19, p.collarDark);
    return;
  }
  g.rect(14, 19, 17, 30, p.shirt); // blouson ouvert sur le t-shirt noir
  sym(g, 13, 20, 13, 30, p.jacketDark);
  g.rect(12, 17, 19, 17, p.collar);
  g.spans([[18, 10, 14], [19, 10, 13], [20, 11, 13], [21, 12, 13]], p.collar);
  g.spans([[18, 17, 21], [19, 18, 21], [20, 18, 20], [21, 18, 19]], p.collar);
  sym(g, 10, 18, 10, 19, p.collarDark);
}

function emileGlasses(g, p) {
  // Montures rondes de 4 × 4, verres transparents de 2 × 2 (on voit l'œil).
  for (const x0 of [11, 17]) {
    g.rect(x0 + 1, 10, x0 + 2, 10, p.glasses);
    g.rect(x0 + 1, 13, x0 + 2, 13, p.glasses);
    g.rect(x0, 11, x0, 12, p.glasses);
    g.rect(x0 + 3, 11, x0 + 3, 12, p.glasses);
  }
  g.rect(15, 11, 16, 11, p.glasses); // pont
  g.set(10, 11, p.glasses); g.set(21, 11, p.glasses); // branches
}

const emile = {
  id: 'emile',
  front(g) {
    const p = emileP;
    emileLegs(g, p);
    headFront(g);
    emileTop(g, p);
    faceFront(g, p.hair);
    g.spans([
      [3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22], [7, 9, 22],
      [8, 9, 18], [8, 20, 22], [9, 10, 15], [9, 21, 21], [10, 10, 10], [10, 21, 21],
    ], p.hair);
    g.rect(13, 4, 17, 4, p.hairLight);
    g.rect(11, 5, 13, 5, p.hairLight);
    emileGlasses(g, p);
  },
  side(g) {
    const p = emileP;
    g.rect(13, 31, 19, 42, p.pants);
    g.rect(14, 34, 17, 37, p.pantsLight);
    g.rect(15, 35, 16, 37, p.pants);
    g.rect(13, 43, 21, 45, p.shoe);
    g.rect(13, 45, 21, 45, p.sole);
    g.rect(17, 43, 19, 43, p.lace);
    g.clear(20, 43); g.clear(21, 43);
    headSide(g, p.hair);
    g.rect(12, 19, 20, 30, p.jacket);
    g.rect(19, 20, 20, 30, p.shirt);
    g.rect(12, 29, 18, 30, p.jacketDark);
    g.rect(13, 17, 19, 18, p.collar);
    g.rect(18, 19, 19, 21, p.collar);
    g.rect(13, 18, 14, 18, p.collarDark);
    armSide(g, 14, 18, p.jacket, p.jacketDark);
    g.rect(16, 20, 16, 27, p.jacketLight);
    g.rect(14, 29, 18, 29, p.jacketDark);
    g.spans([
      [3, 12, 18], [4, 10, 20], [5, 10, 21], [6, 10, 21], [7, 10, 21], [8, 10, 13], [8, 17, 21],
      [9, 10, 13], [10, 10, 13], [11, 10, 12], [12, 10, 11],
    ], p.hair);
    g.rect(14, 4, 17, 4, p.hairLight);
    g.rect(18, 10, 19, 10, p.glasses);
    g.rect(18, 13, 19, 13, p.glasses);
    g.rect(17, 11, 17, 12, p.glasses);
    g.rect(20, 11, 20, 12, p.glasses);
    g.rect(14, 11, 16, 11, p.glasses);
  },
  back(g) {
    const p = emileP;
    emileLegs(g, p);
    headBack(g);
    emileTop(g, p, { back: true });
    g.spans([[3, 12, 19], [4, 10, 21], [5, 9, 22], [6, 9, 22]], p.hair);
    g.rect(10, 7, 21, 13, p.hair);
    g.rect(11, 14, 20, 14, p.hair);
    g.rect(13, 4, 17, 5, p.hairLight);
  },
};

// ---- Xavier : cheveux longs, bomber noir à capuchon bleu, denim effiloché ---

const xavierP = {
  hair: '#7a5536', hairLight: '#a07650', hairDark: '#5a3d27',
  jacket: '#1e1f25', jacketLight: '#363842', jacketDark: '#131419',
  hood: '#2b6cf0', hoodDark: '#1c4fc2',
  denim: '#1b2442', denimMid: '#4b5c8f', denimLight: '#aeb9da',
  clog: '#16161a', clogLight: '#2c2c33',
};

function xavierLegs(g, p) {
  sym(g, 8, 44, 14, 45, p.clog);
  sym(g, 9, 44, 10, 44, p.clogLight);
  g.rect(9, 31, 22, 37, p.denim);
  g.rect(8, 38, 23, 44, p.denim);
  for (let y = 34; y <= 44; y += 1) { g.clear(15, y); g.clear(16, y); }
  frayedDenim(g, 8, 23, 31, 44, p);
}

function xavierTop(g, p, { back = false } = {}) {
  g.rect(8, 19, 23, 30, p.jacket);
  sym(g, 5, 19, 7, 29, p.jacket);
  g.clear(5, 19); g.clear(M(5), 19);
  sym(g, 6, 21, 6, 27, p.jacketLight); // bomber gonflé
  sym(g, 9, 22, 9, 27, p.jacketLight);
  g.rect(8, 29, 23, 30, p.jacketDark);
  sym(g, 5, 29, 7, 29, p.jacketDark);
  sym(g, 5, 30, 7, 31, SKIN.base);
  if (back) return;
  g.rect(15, 20, 16, 28, p.jacketDark); // fermeture
  sym(g, 10, 22, 13, 22, p.jacketLight); // poches de poitrine
  g.rect(11, 17, 20, 19, p.hood); // capuchon bleu sous le menton
  sym(g, 11, 19, 12, 19, p.hoodDark);
  g.rect(14, 17, 17, 17, SKIN.shade);
}

const xavier = {
  id: 'xavier',
  front(g) {
    const p = xavierP;
    xavierLegs(g, p);
    headFront(g);
    xavierTop(g, p);
    faceFront(g, p.hairDark);
    g.spans([[2, 12, 19], [3, 10, 21], [4, 9, 22], [5, 9, 22], [6, 9, 22], [7, 9, 22]], p.hair);
    sym(g, 7, 6, 11, 8, p.hair); // mèches qui encadrent le visage
    sym(g, 7, 9, 10, 14, p.hair);
    sym(g, 7, 15, 10, 20, p.hair); // jusqu'aux épaules
    sym(g, 7, 21, 9, 22, p.hair);
    sym(g, 9, 8, 9, 20, p.hairDark);
    sym(g, 12, 4, 13, 6, p.hairLight);
    g.clear(7, 6); g.clear(M(7), 6);
  },
  side(g) {
    const p = xavierP;
    g.rect(12, 44, 22, 45, p.clog);
    g.rect(19, 44, 21, 44, p.clogLight);
    g.rect(12, 31, 20, 37, p.denim);
    g.rect(11, 38, 21, 44, p.denim);
    frayedDenim(g, 11, 21, 31, 44, p);
    headSide(g, p.hairDark);
    g.rect(11, 19, 21, 30, p.jacket);
    g.rect(11, 29, 21, 30, p.jacketDark);
    g.rect(10, 16, 14, 21, p.hood); // capuchon dans le dos
    g.rect(10, 20, 11, 21, p.hoodDark);
    g.rect(15, 17, 18, 18, p.hood);
    armSide(g, 13, 18, p.jacket, p.jacketDark);
    g.rect(15, 21, 15, 27, p.jacketLight);
    g.rect(13, 29, 18, 29, p.jacketDark);
    g.spans([[2, 12, 18], [3, 10, 20], [4, 9, 21], [5, 9, 21], [6, 9, 21], [7, 9, 21], [8, 9, 20]], p.hair);
    g.rect(8, 9, 15, 19, p.hair);
    g.rect(9, 20, 14, 23, p.hair);
    g.rect(10, 9, 10, 21, p.hairDark);
    g.rect(13, 9, 13, 18, p.hairDark);
    g.rect(14, 4, 16, 5, p.hairLight);
  },
  back(g) {
    const p = xavierP;
    xavierLegs(g, p);
    headBack(g);
    xavierTop(g, p, { back: true });
    g.rect(11, 18, 20, 22, p.hood); // capuchon posé dans le dos
    g.rect(11, 22, 20, 22, p.hoodDark);
    g.spans([[2, 12, 19], [3, 10, 21]], p.hair);
    g.rect(8, 4, 23, 19, p.hair);
    g.spans([[20, 9, 12], [20, 19, 22], [21, 9, 10], [21, 21, 22]], p.hair);
    for (const x of [10, 13, 18, 21]) g.rect(x, 6, x, 18, p.hairDark);
    g.rect(12, 4, 14, 6, p.hairLight);
  },
};

export const CHARACTERS = [nathan, emile, xavier];
