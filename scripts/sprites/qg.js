// Le QG (le sous-sol) en pixel art, d'après les photos : plafond couvert de
// vinyles, bureau blanc avec l'écran et les haut-parleurs, lumière annulaire,
// laveuse-sécheuse derrière un rideau, tapis en peau de vache.
// Image de 160 × 100 pixels ; le personnage (32 × 48) se tient sur le tapis.

export const QG_W = 160;
export const QG_H = 100;

const C = {
  ceiling: '#e9e1d0', ceilingShade: '#cfc5af',
  wall: '#b3a274', wallTop: '#a69466', wallGlow: '#c4b483', baseboard: '#3b2f2a',
  floor: '#d8ccb0', floorShade: '#c9bc9e', floorDark: '#b9ab8b',
  vinyl: '#18181b', groove: '#34343a',
  labels: ['#e94f37', '#f2c14e', '#5b8cff', '#8fb996', '#ff7eb6', '#f08a4b'],
  white: '#f2f0ea', whiteShade: '#d6d2c8', black: '#1e1e22', dark: '#2c2c32',
  screen: '#24345f', code: ['#7fd1ff', '#ffd166', '#ff7eb6', '#9be59b', '#e8e8f0'],
  ring: '#fff6d6', curtain: '#6b6f78', curtainShade: '#555963',
  night: '#1d2647', moon: '#f6f0c8', poster: '#f1ece0', posterRed: '#c8312f',
  hide: '#f4efe6', spot: '#7a4e33', spotDark: '#5c3a26',
  lava: '#ff5fa2', lavaGlow: '#ffb3d1', gold: '#e8b93b', frame: '#4a3a2c',
  basket: '#f5f5f2', basketShade: '#cfcfca', clothes: ['#2f8f6f', '#e6dccb', '#3d5a99'],
  detergent: '#3a6fd8',
};

function ceiling(g) {
  g.rect(0, 0, QG_W - 1, 11, C.ceiling);
  g.rect(0, 11, QG_W - 1, 11, C.ceilingShade);
  // Les vinyles collés au plafond, vus en perspective (ellipses aplaties).
  let i = 0;
  for (let x = 7; x < QG_W; x += 13) {
    const y = i % 2 === 0 ? 3 : 7;
    g.ellipse(x, y, 5.5, 2.6, C.vinyl);
    g.ellipse(x, y, 3.5, 1.6, C.groove);
    g.ellipse(x, y, 1.6, 0.9, C.labels[i % C.labels.length]);
    i += 1;
  }
}

function wall(g) {
  g.rect(0, 12, QG_W - 1, 67, C.wall);
  g.rect(0, 12, QG_W - 1, 14, C.wallTop);
  g.rect(0, 66, QG_W - 1, 67, C.baseboard);

  // Petite fenêtre de sous-sol : il fait nuit, évidemment.
  g.rect(97, 14, 113, 24, C.ceiling);
  g.rect(98, 15, 112, 23, C.night);
  g.disc(109, 18, 2, C.moon);
  for (const [x, y] of [[100, 17], [103, 21], [106, 16], [101, 22]]) g.set(x, y, C.moon);
  g.rect(105, 15, 105, 23, C.ceiling);

  // Affiche (sans marque) et disque d'or encadré.
  g.rect(66, 18, 84, 41, C.poster);
  g.rect(68, 20, 82, 22, C.posterRed);
  g.rect(68, 24, 78, 24, C.posterRed);
  for (let y = 27; y <= 39; y += 2) for (let x = 68; x <= 82; x += 3) g.rect(x, y, x + 1, y, C.whiteShade);
  g.rect(88, 28, 96, 38, C.frame);
  g.rect(89, 29, 95, 37, C.white);
  g.disc(92, 33, 3, C.gold);
  g.set(92, 33, C.frame);

  // Lumière annulaire : halo sur le mur, anneau, pied.
  g.disc(60, 25, 10, C.wallGlow);
  g.disc(60, 25, 6, C.ring);
  g.disc(60, 25, 4, C.wallGlow);
  g.rect(60, 31, 60, 72, C.dark);
  g.rect(57, 72, 63, 72, C.dark);
}

function desk(g) {
  // Haut-parleurs, écran avec du « code », clavier, lampe à lave.
  for (const x0 of [9, 44]) {
    g.rect(x0, 42, x0 + 6, 51, C.black);
    g.disc(x0 + 3, 48, 2, C.dark);
    g.set(x0 + 3, 44, C.dark);
  }
  g.rect(19, 35, 41, 50, C.black);
  g.rect(20, 36, 40, 48, C.screen);
  for (let y = 37; y <= 47; y += 2) {
    const indent = (y * 7) % 5;
    const len = 6 + ((y * 13) % 11);
    g.rect(21 + indent, y, Math.min(39, 21 + indent + len), y, C.code[y % C.code.length]);
  }
  g.rect(29, 49, 31, 51, C.black);
  g.rect(21, 51, 37, 51, C.dark);
  g.rect(51, 43, 54, 51, C.lava);
  g.rect(52, 44, 53, 46, C.lavaGlow);
  g.rect(51, 41, 54, 42, C.dark);
  g.rect(51, 51, 54, 51, C.dark);

  g.rect(5, 52, 57, 54, C.white);
  g.rect(5, 54, 57, 54, C.whiteShade);
  g.rect(7, 55, 8, 74, C.whiteShade);
  g.rect(54, 55, 55, 74, C.whiteShade);

  // Chaise de bureau.
  g.rect(26, 52, 34, 61, C.black);
  g.rect(24, 61, 36, 64, C.black);
  g.rect(30, 65, 30, 71, C.dark);
  g.rect(25, 72, 35, 72, C.dark);
  g.set(25, 73, C.black); g.set(30, 73, C.black); g.set(35, 73, C.black);
}

function laundry(g) {
  // Rideau gris tiré à moitié devant la laveuse-sécheuse.
  g.rect(108, 13, 158, 13, C.whiteShade);
  g.rect(110, 14, 116, 67, C.curtain);
  for (const x of [111, 114]) g.rect(x, 14, x, 67, C.curtainShade);
  for (const x0 of [118, 138]) {
    g.rect(x0, 42, x0 + 18, 69, C.white);
    g.rect(x0, 42, x0 + 18, 45, C.whiteShade);
    g.set(x0 + 3, 43, C.dark); g.set(x0 + 15, 43, C.dark);
    g.disc(x0 + 9, 57, 6, '#9aa0a6');
    g.disc(x0 + 9, 57, 4, '#3b4a5e');
    g.set(x0 + 7, 55, '#c9d3df');
  }
  g.rect(122, 36, 126, 41, C.detergent);
  g.rect(123, 34, 124, 35, C.white);
}

function floor(g) {
  g.rect(0, 68, QG_W - 1, QG_H - 1, C.floor);
  for (const [x, y, rx, ry] of [[20, 84, 9, 2], [130, 76, 7, 1.5], [60, 96, 10, 2], [150, 94, 6, 2]]) {
    g.ellipse(x, y, rx, ry, C.floorShade);
  }
  for (const [x, y] of [[12, 92], [44, 78], [104, 97], [142, 84], [70, 74]]) g.set(x, y, C.floorDark);

  // Tapis en peau de vache.
  g.ellipse(80, 89, 32, 8, C.hide);
  g.ellipse(66, 87, 6, 3, C.spot);
  g.ellipse(91, 91, 8, 3, C.spot);
  g.ellipse(80, 85, 4, 1.5, C.spotDark);
  g.ellipse(104, 88, 3, 2, C.spotDark);
  g.ellipse(56, 91, 3, 1.5, C.spot);

  // Panier de linge qui déborde (toujours).
  g.rect(138, 80, 156, 94, C.basket);
  g.rect(138, 80, 156, 81, C.basketShade);
  for (let x = 140; x <= 154; x += 3) g.rect(x, 84, x + 1, 91, C.basketShade);
  g.ellipse(143, 79, 4, 2, C.clothes[0]);
  g.ellipse(151, 78, 4, 2.5, C.clothes[1]);
  g.ellipse(147, 77, 3, 1.5, C.clothes[2]);
}

export function drawQg(g) {
  ceiling(g);
  wall(g);
  floor(g);
  desk(g);
  laundry(g);
}
