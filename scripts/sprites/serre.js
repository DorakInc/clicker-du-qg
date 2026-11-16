// La serre en pixel art : une serre vitrée la nuit, sous la Lune, avec des
// lampes horticoles mauves et deux rangées de bacs. Les plants sont des
// sprites séparés (3 stades de pousse) que le jeu place dans les bacs.
//   fond  : 160 × 100      plante : 3 images de 16 × 24 (pousse, croissance, en fleur)

export const SERRE_W = 160;
export const SERRE_H = 100;
export const PLANT_W = 16;
export const PLANT_H = 24;

const C = {
  sky: '#1d1838', sky2: '#2a2350', glass: '#332d5e', reflect: '#4c4784',
  frame: '#8c93a3', frameDark: '#5d6372', star: '#f6f0c8', moon: '#f6f0c8', moonShade: '#d9d2a6',
  led: '#ff5fd2', ledCase: '#3a2b4f', glow: '#5a3f78', glow2: '#4a3768',
  wood: '#8a5a3b', woodDark: '#6e4630', woodLight: '#a8714c',
  soil: '#3b2a20', soilLight: '#4f3a2c',
  floor: '#4a3a30', floorLine: '#3b2e26',
  can: '#3fae8c', canDark: '#2d8a6d', hose: '#3fae4c',
  sign: '#e9dcc0', signInk: '#2f6b3a',
  fan: '#c9ced8', fanDark: '#7d8494',
};

function sky(g) {
  for (let y = 0; y < 72; y += 1) g.rect(0, y, SERRE_W - 1, y, y < 30 ? C.sky : C.sky2);
  for (const [x, y] of [[12, 6], [30, 14], [52, 4], [70, 20], [88, 9], [104, 26], [140, 30], [150, 8], [22, 30], [64, 34]]) {
    g.set(x, y, C.star);
  }
}

function moon(g) {
  g.disc(128, 14, 9, C.moon);
  g.disc(124, 11, 2, C.moonShade);
  g.disc(132, 18, 1.5, C.moonShade);
  g.disc(130, 9, 1, C.moonShade);
}

function glassHouse(g) {
  // Vitres : un voile un peu plus clair que le ciel, avec des reflets en diagonale.
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < SERRE_W; x += 1) {
      if ((x + y) % 23 === 0 || (x + y) % 23 === 1) g.set(x, y, C.reflect);
    }
  }
  for (let x = 0; x < SERRE_W; x += 20) g.rect(x, 0, x + 1, 71, C.frame);
  g.rect(SERRE_W - 2, 0, SERRE_W - 1, 71, C.frame);
  for (const y of [0, 22, 46]) g.rect(0, y, SERRE_W - 1, y + 1, C.frame);
  g.rect(0, 70, SERRE_W - 1, 71, C.frameDark);
}

function lights(g) {
  // Lampes horticoles suspendues et leur lumière mauve.
  for (const x0 of [8, 58, 108]) {
    g.rect(x0 + 18, 2, x0 + 18, 9, C.frameDark);
    for (let y = 12; y < 46; y += 1) {
      const spread = Math.floor((y - 12) / 2);
      for (let x = x0 - spread; x <= x0 + 36 + spread; x += 1) {
        if (x % 2 === 0 && y % 2 === 0) g.set(x, y, y < 28 ? C.glow : C.glow2);
      }
    }
    g.rect(x0, 10, x0 + 36, 11, C.ledCase);
    g.rect(x0 + 1, 12, x0 + 35, 12, C.led);
  }
}

function tables(g) {
  // Rangée du fond : table de bois.
  g.rect(4, 48, 155, 51, C.wood);
  g.rect(4, 48, 155, 48, C.woodLight);
  g.rect(4, 51, 155, 51, C.woodDark);
  for (const x of [6, 52, 104, 152]) g.rect(x, 52, x + 1, 71, C.woodDark);
  // Rangée de devant : un long bac de terre.
  g.rect(2, 80, 113, 88, C.wood);
  g.rect(2, 80, 113, 81, C.soil);
  g.rect(2, 81, 113, 81, C.soilLight);
  for (let x = 2; x <= 113; x += 14) g.rect(x, 82, x, 88, C.woodDark);
  g.rect(2, 88, 113, 88, C.woodDark);
}

function floor(g) {
  g.rect(0, 72, SERRE_W - 1, SERRE_H - 1, C.floor);
  for (let y = 75; y < SERRE_H; y += 6) g.rect(0, y, SERRE_W - 1, y, C.floorLine);
}

function props(g) {
  // Arrosoir, tuyau d'arrosage, ventilateur, pancarte avec une feuille.
  g.rect(120, 92, 129, 97, C.can);
  g.rect(120, 92, 129, 92, C.canDark);
  g.rect(130, 90, 131, 93, C.can);
  g.rect(132, 89, 134, 89, C.can);
  g.rect(118, 93, 119, 95, C.canDark);
  for (let x = 136; x <= 158; x += 1) g.set(x, 96 + Math.round(Math.sin(x / 2) * 1.5), C.hose);

  g.disc(146, 58, 6, C.fan);
  g.disc(146, 58, 4, C.fanDark);
  g.rect(145, 54, 147, 62, C.fan);
  g.rect(142, 57, 150, 59, C.fan);
  g.rect(145, 64, 147, 71, C.fanDark);

  g.rect(136, 27, 154, 39, C.sign);
  g.rect(136, 27, 154, 27, C.woodDark);
  leaf(g, 145, 36, 4, C.signInk);
}

/** Feuille de cannabis : 5 folioles en éventail, (cx, cy) = base de la feuille. */
export function leaf(g, cx, cy, size, color) {
  for (let i = 1; i <= size; i += 1) g.set(cx, cy - i, color); // centre
  for (let i = 1; i < size; i += 1) { g.set(cx - i, cy - i, color); g.set(cx + i, cy - i, color); }
  for (let i = 1; i < size - 1; i += 1) { g.set(cx - i - 1, cy - Math.floor(i / 2), color); g.set(cx + i + 1, cy - Math.floor(i / 2), color); }
  g.set(cx, cy, color);
}

export function drawSerre(g) {
  sky(g);
  glassHouse(g);
  lights(g);
  moon(g);
  floor(g);
  tables(g);
  props(g);
}

// ---- Plants -----------------------------------------------------------

const P = {
  pot: '#b5653d', potDark: '#8f4b2b', potLight: '#cf8257', soil: '#3b2a20',
  stem: '#3f7d3a', leaf: '#5fb14f', leafDark: '#3f8a3a', leafLight: '#8fd46a',
  bud: '#a8d96a', hair: '#e98a4b', purple: '#b07be0',
};

function pot(g) {
  g.rect(3, 19, 12, 20, P.potLight);
  g.rect(4, 21, 11, 23, P.pot);
  g.rect(4, 23, 11, 23, P.potDark);
  g.rect(4, 19, 11, 19, P.soil);
}

/** stage : 0 = pousse, 1 = croissance, 2 = en fleur. */
export function drawPlant(g, stage) {
  pot(g);
  if (stage === 0) {
    g.rect(7, 15, 8, 18, P.stem);
    leaf(g, 5, 16, 2, P.leaf);
    leaf(g, 10, 16, 2, P.leaf);
    return;
  }
  const top = stage === 1 ? 7 : 2;
  g.rect(7, top, 8, 18, P.stem);
  leaf(g, 4, 17, 3, P.leafDark);
  leaf(g, 11, 17, 3, P.leafDark);
  leaf(g, 4, 12, stage === 1 ? 3 : 4, P.leaf);
  leaf(g, 11, 12, stage === 1 ? 3 : 4, P.leaf);
  leaf(g, 7, top + 4, 3, P.leafLight);
  if (stage === 2) {
    // Têtes en fleur, avec des pistils orange et des reflets mauves.
    g.rect(6, 1, 9, 6, P.bud);
    g.rect(2, 7, 4, 9, P.bud);
    g.rect(11, 7, 13, 9, P.bud);
    for (const [x, y] of [[6, 2], [9, 3], [7, 5], [3, 8], [12, 7]]) g.set(x, y, P.hair);
    for (const [x, y] of [[8, 1], [6, 4], [13, 9], [2, 9]]) g.set(x, y, P.purple);
  }
}
