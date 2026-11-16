// Les objets de la serre (équipement, variétés, déco) en pixel art isométrique.
// Même procédé que le studio (scripts/sprites/objets-iso.js) : chaque objet
// donne son type (sol ou mur) et ses vues. `npm run sprites` les écrit dans
// assets/images/serre/<id>-iso.png ; le "decor" de data/greenhouse.json pointe
// vers ces fichiers avec le champ "sprite".

import { darken } from './grid.js';
import { IsoSprite, WallSprite, lighten, line } from './iso.js';

const C = {
  black: '#1e1e22', dark: '#2c2c32', steel: '#3a3a42', grey: '#6b6f78', silver: '#c9ccd3',
  white: '#f2f0ea', whiteShade: '#d6d2c8',
  terracotta: '#c0623b', soil: '#3b2a20', soilLight: '#5a4030',
  wood: '#8a5a3b', woodLight: '#a8714c', straw: '#e3c16f', strawDark: '#b8913f',
  pink: '#ff5fd2', pinkLight: '#ffb3ec', purple: '#7a3fb0',
  glass: '#9fd0e8', glassLight: '#e4f6ff', water: '#5b9cff',
  green: '#3fae8c', greenDark: '#2d8a6d', red: '#d83a3a', cream: '#e9dcc0',
};

/**
 * Une feuille de cannabis en éventail : des doigts qui partent d'un même point
 * (cx, cy), le plus long au milieu. `dir` : -1 vers la gauche, 1 vers la droite.
 */
function fanLeaf(g, cx, cy, len, dir, color) {
  // Angles des doigts (en degrés, 0 = à plat vers l'extérieur, 90 = vers le haut) et longueur relative.
  for (const [deg, k] of [[-25, 0.55], [10, 0.85], [45, 1], [80, 0.8], [110, 0.5]]) {
    const a = (deg * Math.PI) / 180;
    line(g, cx, cy, cx + dir * Math.cos(a) * len * k, cy - Math.sin(a) * len * k, color);
  }
}

/**
 * Un plant de cannabis, dessiné à partir de la base de sa tige (x, y) dans
 * l'image : une paire de feuilles en éventail à chaque nœud, plus petites vers
 * le haut, et la tête (le bourgeon) au sommet. Les feuilles de droite sont dans l'ombre.
 */
function weed(g, x0, y0, h, colors, { spread = 1, nodes, bud = 1 } = {}) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  const { leaf, shade = darken(leaf, 0.3), stem = darken(leaf, 0.45), top, topLight = lighten(top, 0.35) } = colors;
  const count = nodes ?? Math.max(2, Math.floor(h / 7));
  const step = (h - 5) / count;
  line(g, x, y, x, y - h + 2, stem);
  for (let n = 0; n < count; n += 1) {
    const ny = Math.round(y - 3 - n * step);
    const len = Math.max(2.5, (count - n + 1) * 1.6 * spread);
    // Les nœuds alternent un peu : la feuille de gauche un pixel plus haut, puis celle de droite.
    for (const dir of [-1, 1]) {
      const lift = (n + (dir > 0 ? 1 : 0)) % 2;
      const cx = x + dir * Math.max(1, Math.round(len * 0.35));
      const cy = ny - lift;
      line(g, x, ny, cx, cy, stem); // le pétiole
      fanLeaf(g, cx, cy, len, dir, dir < 0 ? leaf : shade);
    }
  }
  // La tête : un bourgeon allongé, plus clair à gauche.
  g.ellipse(x, y - h, 1.3 * bud, 2.6 * bud, top);
  g.set(x - 1, y - h, topLight);
  // Petits bourgeons aux nœuds du haut.
  const ny = Math.round(y - 3 - (count - 1) * step);
  g.set(x - 1, ny - 2, top);
  g.set(x + 1, ny - 3, darken(top, 0.2));
}

/** Un pot rond au milieu de la tuile ; retourne la base de la tige (sur la terre). */
function pot(s, color, { r = 0.24, h = 8, soil = C.soil, rim = true } = {}) {
  s.cylinder(0.5, 0.5, 0, h, r, color);
  if (rim) s.cylinder(0.5, 0.5, h - 2, h, r + 0.03, lighten(color, 0.1));
  s.flatDisc(0.5, 0.5, h, r * 0.8, soil);
  return s.p(0.5, 0.5, h);
}

// ---- Les variétés : un plant par variété, chacun dans son pot ----

function strain({ potColor, potOpts, plant, colors, after }) {
  return () => {
    const s = new IsoSprite(1, 1, plant.h + 12);
    const base = pot(s, potColor, potOpts);
    weed(s.g, base.x, base.y, plant.h, colors, plant);
    after?.(s, base);
    return s;
  };
}

const kushDuSousSol = strain({
  potColor: C.terracotta,
  plant: { h: 22 },
  colors: { leaf: '#3fa34d', top: '#cde8b0' },
});

const mauveLaveuse = strain({
  potColor: '#f5f5f2',
  plant: { h: 22 },
  colors: { leaf: '#4f9a5a', shade: '#5a3a7a', top: '#c48ef0' },
  after(s) {
    s.dot(0.3, 0.74, 4, '#7fb6e8'); // une goutte d'assouplissant
    s.dot(0.36, 0.74, 3, '#7fb6e8');
  },
});

/** OG Panier de linge : le plant pousse dans le panier à linge en plastique bleu. */
function ogPanierLinge() {
  const s = new IsoSprite(1, 1, 36);
  const blue = '#6fa8dc';
  s.box(0.14, 0.14, 0.86, 0.86, 0, 10, blue);
  // Les trous du panier.
  for (let u = 0.24; u < 0.8; u += 0.14) s.front(0.86, u, u + 0.06, 3, 6, darken(blue, 0.35));
  for (let v = 0.24; v < 0.8; v += 0.14) s.side(0.86, v, v + 0.06, 3, 6, darken(blue, 0.5));
  s.top(10, 0.2, 0.2, 0.8, 0.8, C.soil);
  // Une chaussette qui dépasse.
  s.front(0.86, 0.62, 0.72, 8, 13, '#f2f0ea');
  s.front(0.86, 0.62, 0.72, 11, 12, C.red);
  const base = s.p(0.5, 0.5, 10);
  weed(s.g, base.x, base.y, 21, { leaf: '#6fbf4a', top: '#e6e0a0' });
  return s;
}

const sativaVoisin = strain({
  potColor: C.dark,
  potOpts: { r: 0.2, h: 7 },
  plant: { h: 32, spread: 0.7, nodes: 6 },
  colors: { leaf: '#7bd389', top: '#e8f0b0' },
});

const indicaDivan = strain({
  potColor: '#6b4f8a',
  potOpts: { r: 0.3, h: 6 },
  plant: { h: 17, spread: 1.45, nodes: 3, bud: 1.2 },
  colors: { leaf: '#2f6a2f', top: '#a8c890' },
});

const hazeCosmique = strain({
  potColor: '#24345f',
  plant: { h: 24 },
  colors: { leaf: '#3fb6c8', top: '#d8f8ff' },
  after(s, base) {
    // Des étincelles autour du plant et sur le pot.
    for (const [dx, dy] of [[-9, -18], [8, -22], [-6, -27], [10, -11], [-11, -8]]) s.g.set(Math.round(base.x + dx), Math.round(base.y + dy), '#fff3a3');
    s.dot(0.3, 0.74, 4, '#fff3a3');
    s.dot(0.6, 0.74, 6, '#fff3a3');
  },
});

const lunaire1 = strain({
  potColor: '#8f8a80',
  plant: { h: 22 },
  colors: { leaf: '#b8c4a0', shade: '#7f8a72', top: '#f6f0c8' },
  after(s) {
    // Le pot en roche lunaire : des cratères.
    s.dot(0.32, 0.74, 3, '#6b675f');
    s.dot(0.5, 0.74, 5, '#6b675f');
    s.dot(0.74, 0.62, 2, '#5a564f');
  },
});

const nebuleuse = strain({
  potColor: C.black,
  plant: { h: 24 },
  colors: { leaf: '#9a4fc8', shade: '#5a2f80', top: '#ff8ee8' },
  after(s, base) {
    s.dot(0.3, 0.74, 5, C.pink);
    s.dot(0.5, 0.74, 3, C.pink);
    s.dot(0.66, 0.7, 6, C.pinkLight);
    for (const [dx, dy] of [[-8, -20], [9, -16], [-3, -30]]) s.g.set(Math.round(base.x + dx), Math.round(base.y + dy), C.pinkLight);
  },
});

// ---- L'équipement ----

/** Pots de yogourt recyclés : quatre pots sur un plateau, chacun avec sa pousse. */
function potDeYogourt() {
  const s = new IsoSprite(1, 1, 22);
  s.box(0.08, 0.08, 0.92, 0.92, 0, 2, '#9c968c');
  const labels = ['#ff7eb6', '#7fb6e8', '#f2c14e', '#9be59b'];
  [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([u, v], i) => {
    s.cylinder(u, v, 2, 9, 0.12, C.white);
    s.cylinder(u, v, 4, 6, 0.12, labels[i]);
    s.flatDisc(u, v, 9, 0.09, C.soil);
    const b = s.p(u, v, 9);
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    // Une pousse : la tige et deux cotylédons.
    s.g.rect(x, y - 4, x, y - 1, '#2f8f3a');
    s.g.rect(x - 2, y - 5, x - 1, y - 4, '#6fcf5a');
    s.g.rect(x + 1, y - 5, x + 2, y - 4, '#4fa83f');
  });
  return s;
}

/** Tente de culture : la toile noire, le devant ouvert sur l'intérieur argenté, un plant sous la lumière mauve. */
function tenteCulture() {
  const s = new IsoSprite(2, 2, 60);
  const fabric = C.dark;
  s.box(0.08, 0.08, 1.92, 1.92, 0, 52, fabric);
  s.top(52, 0.2, 0.2, 1.8, 1.8, darken(fabric, 0.25));
  // Le conduit d'aération sur le toit.
  s.cylinder(1, 1, 52, 58, 0.16, C.silver);
  // Les coutures.
  for (const z of [17, 35]) s.front(1.92, 0.08, 1.92, z, z, darken(fabric, 0.35));
  s.side(1.92, 0.08, 1.92, 26, 26, darken(fabric, 0.5));
  // Le devant ouvert : l'intérieur réfléchissant, la lumière, le plant.
  s.front(1.92, 0.36, 1.36, 3, 44, '#e4e0ec');
  s.front(1.92, 0.42, 1.3, 3, 42, '#c9c2d6');
  s.front(1.92, 0.5, 1.22, 38, 40, C.pink);
  s.front(1.92, 0.46, 1.26, 30, 37, '#e3b3f0');
  const base = s.p(0.86, 1.92, 4);
  weed(s.g, base.x, base.y, 28, { leaf: '#3fa34d', top: '#d8c0f0' }, { spread: 0.9 });
  // Le rabat roulé et la fermeture éclair.
  s.front(1.92, 1.36, 1.5, 3, 44, darken(fabric, 0.2));
  s.front(1.92, 0.3, 0.36, 3, 44, C.grey);
  s.front(1.92, 0.36, 1.36, 44, 45, C.grey);
  return s;
}

/** Système hydroponique : un réservoir bleu, une table blanche, deux tuyaux avec des plants. */
function hydroponie() {
  const s = new IsoSprite(2, 1, 44);
  for (const [u, v] of [[0.12, 0.86], [1.88, 0.86], [1.88, 0.16], [0.12, 0.16]]) s.box(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, 12, C.grey);
  s.box(0.5, 0.3, 1.5, 0.8, 0, 8, '#3d7ac0'); // le réservoir
  s.front(0.8, 0.6, 0.7, 2, 6, C.water);
  s.box(0.04, 0.1, 1.96, 0.92, 12, 14, C.white);
  // Les deux tuyaux en PVC.
  for (const v of [0.28, 0.72]) s.box(0.08, v - 0.1, 1.92, v + 0.1, 14, 18, C.whiteShade);
  // Les plants dans leurs paniers, plus petits derrière.
  for (const v of [0.28, 0.72]) {
    for (const u of [0.35, 1.0, 1.65]) {
      s.flatDisc(u, v, 18, 0.07, C.black);
      const b = s.p(u, v, 18);
      weed(s.g, b.x, b.y, v < 0.5 ? 12 : 14, { leaf: '#4fbf5a', top: '#d0f0b0' }, { spread: 0.55, nodes: 2 });
    }
  }
  // La pompe qui fait des bulles.
  s.dot(1.45, 0.8, 4, C.glassLight);
  s.dot(1.4, 0.8, 6, C.glassLight);
  return s;
}

/** L'ami botaniste : son tabouret, son chapeau de paille, son carnet et sa loupe. */
function amiBotaniste() {
  const s = new IsoSprite(1, 1, 34);
  for (const [u, v] of [[0.28, 0.72], [0.72, 0.72], [0.72, 0.28], [0.28, 0.28]]) s.box(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, 14, C.wood);
  s.box(0.2, 0.2, 0.8, 0.8, 14, 17, C.woodLight);
  // Le chapeau de paille : le bord, puis la calotte et son ruban vert.
  const h = s.p(0.5, 0.42, 17);
  s.g.ellipse(h.x, h.y - 1, 9, 4, C.strawDark);
  s.g.ellipse(h.x, h.y - 2, 8.5, 3.5, C.straw);
  s.g.rect(Math.round(h.x) - 4, Math.round(h.y) - 8, Math.round(h.x) + 4, Math.round(h.y) - 3, C.straw);
  s.g.rect(Math.round(h.x) + 2, Math.round(h.y) - 8, Math.round(h.x) + 4, Math.round(h.y) - 3, C.strawDark);
  s.g.rect(Math.round(h.x) - 4, Math.round(h.y) - 4, Math.round(h.x) + 4, Math.round(h.y) - 3, '#2f8f3a');
  // Le carnet et la loupe, devant.
  s.box(0.5, 0.58, 0.76, 0.78, 17, 18, '#2f6b3a');
  s.top(18, 0.53, 0.6, 0.74, 0.76, C.cream);
  const m = s.p(0.32, 0.7, 19);
  s.g.ellipse(m.x, m.y, 2.5, 1.6, C.grey);
  s.g.ellipse(m.x, m.y, 1.5, 0.8, C.glassLight);
  line(s.g, m.x + 2, m.y + 1, m.x + 4, m.y + 3, C.wood);
  return s;
}

/** Serre automatisée : le robot jardinier, son œil vert et son bras arroseur. */
function serreAuto() {
  const s = new IsoSprite(1, 1, 40);
  const body = '#9fb4c8';
  s.cylinder(0.5, 0.5, 0, 4, 0.3, C.dark); // les roues
  s.box(0.24, 0.24, 0.76, 0.76, 4, 24, body);
  s.front(0.76, 0.32, 0.68, 8, 18, darken(body, 0.15));
  s.front(0.76, 0.38, 0.5, 14, 16, C.green); // l'écran
  s.front(0.76, 0.54, 0.62, 10, 11, C.red);
  // La tête en dôme, l'œil.
  s.cylinder(0.5, 0.5, 24, 28, 0.2, lighten(body, 0.15));
  const head = s.p(0.5, 0.5, 30);
  s.g.ellipse(head.x, head.y, 4.5, 3, lighten(body, 0.3));
  s.dot(0.5, 0.7, 27, '#7bff8a');
  s.dot(0.56, 0.7, 27, '#7bff8a');
  // L'antenne.
  s.g.rect(Math.round(head.x), Math.round(head.y) - 6, Math.round(head.x), Math.round(head.y) - 2, C.grey);
  s.g.set(Math.round(head.x), Math.round(head.y) - 7, C.red);
  // Le bras et la buse, qui arrose devant à gauche.
  const shoulder = s.p(0.24, 0.6, 20);
  const nozzle = s.p(0.0, 0.95, 16);
  line(s.g, shoulder.x, shoulder.y, nozzle.x + 2, nozzle.y, C.steel);
  s.g.rect(Math.round(nozzle.x) + 1, Math.round(nozzle.y) - 1, Math.round(nozzle.x) + 2, Math.round(nozzle.y), C.silver);
  for (const [dx, dy] of [[0, 3], [-1, 6], [1, 8], [0, 11]]) s.g.set(Math.round(nozzle.x) + 1 + dx, Math.round(nozzle.y) + dy, C.water);
  return s;
}

/** Ferme lunaire : un bout de sol lunaire, un dôme de verre et sa plante qui brille, un petit drapeau. */
function fermeLunaire() {
  const s = new IsoSprite(2, 2, 50);
  const rock = '#a39f96';
  s.box(0.1, 0.1, 1.9, 1.9, 0, 4, rock);
  for (const [u, v, r] of [[0.4, 1.5, 0.14], [1.6, 0.5, 0.12], [1.5, 1.6, 0.1], [0.4, 0.4, 0.08]]) {
    s.flatDisc(u, v, 4, r, darken(rock, 0.2));
    s.flatDisc(u + 0.03, v - 0.03, 4, r * 0.6, darken(rock, 0.35));
  }
  // Le dôme : un socle métallique, le verre, puis la plante et les reflets.
  s.cylinder(1, 1, 4, 7, 0.62, C.silver);
  const c = s.p(1, 1, 7);
  s.g.ellipse(c.x, c.y - 14, 14, 17, '#4a6a8a');
  s.g.ellipse(c.x, c.y - 14, 13, 16, '#6f9ac0');
  for (let y = Math.round(c.y - 2); y <= Math.round(c.y + 1); y += 1) s.g.rect(Math.round(c.x) - 13, y, Math.round(c.x) + 13, y, C.silver);
  s.g.ellipse(c.x, c.y - 1, 9, 3, '#5a4a6a');
  weed(s.g, c.x, c.y - 1, 22, { leaf: '#7bffb0', shade: '#3fbf7a', top: '#fff3c4' }, { spread: 0.9 });
  s.g.rect(Math.round(c.x) - 9, Math.round(c.y) - 26, Math.round(c.x) - 8, Math.round(c.y) - 18, C.glassLight);
  s.g.rect(Math.round(c.x) - 7, Math.round(c.y) - 28, Math.round(c.x) - 6, Math.round(c.y) - 27, C.glassLight);
  // Le drapeau planté à côté.
  const f = s.p(1.75, 1.25, 4);
  s.g.rect(Math.round(f.x), Math.round(f.y) - 18, Math.round(f.x), Math.round(f.y), C.silver);
  s.g.rect(Math.round(f.x) + 1, Math.round(f.y) - 18, Math.round(f.x) + 6, Math.round(f.y) - 14, '#2f8f3a');
  s.g.set(Math.round(f.x) + 3, Math.round(f.y) - 16, C.white);
  return s;
}

// ---- Au mur ----

/** Lampe DEL horticole : le boîtier noir, les diodes roses et mauves, le halo. */
function lampeDel(wall) {
  const s = new WallSprite(2, 10, wall);
  for (let tx = 1; tx < s.width - 1; tx += 1) {
    s.set(tx, 9, C.grey); // la barre de fixation
    if (tx % 2 === 0) s.set(tx, 0, '#cfa0f0');
    s.set(tx, 1, tx % 3 === 0 ? C.pinkLight : '#cfa0f0');
    s.set(tx, 2, tx % 4 < 2 ? C.pink : C.purple);
    s.set(tx, 3, darken(C.purple, 0.4));
    for (let tz = 4; tz <= 7; tz += 1) s.set(tx, tz, tz === 7 ? C.steel : C.dark);
  }
  s.set(3, 5, C.green); // le voyant
  for (const tx of [5, s.width - 6]) s.set(tx, 8, C.grey);
  return s;
}

/** Ventilation silencieuse : un ventilateur rond dans son cadre gris. */
function ventilation(wall) {
  const s = new WallSprite(1, 16, wall);
  s.rect(1, 0, 14, 15, '#8c93a3');
  s.rect(2, 1, 13, 14, '#5d6372');
  for (let tx = 2; tx <= 13; tx += 1) {
    for (let tz = 1; tz <= 14; tz += 1) {
      const dx = tx - 7.5;
      const dz = tz - 7.5;
      const d2 = dx * dx + dz * dz;
      if (d2 > 36) continue;
      // Quatre pales, en croix penchée.
      const blade = Math.abs(dx - dz) < 2 || Math.abs(dx + dz) < 2;
      s.set(tx, tz, d2 < 3 ? C.silver : blade ? C.silver : C.dark);
    }
  }
  s.set(7, 7, C.grey);
  s.set(8, 8, C.grey);
  return s;
}

/** Pancarte « Défense de cueillir » : une feuille barrée de rouge sur une planchette. */
function pancarte(wall) {
  const s = new WallSprite(1, 14, wall);
  s.rect(1, 0, 14, 13, C.wood);
  s.rect(2, 1, 13, 12, C.cream);
  for (let tx = 2; tx <= 13; tx += 1) {
    for (let tz = 1; tz <= 12; tz += 1) {
      const d2 = (tx - 7.5) ** 2 + (tz - 6.5) ** 2;
      if (d2 <= 25 && d2 > 13) s.set(tx, tz, C.red);
    }
  }
  s.pattern(5, 3, ['..#..', '#.#.#', '.###.', '..#..', '..#..'], '#2f8f3a');
  for (let i = 0; i < 8; i += 1) s.set(4 + i, 10 - i, C.red);
  s.set(7, 13, C.grey); // le clou
  return s;
}

// ---- Déco au sol ----

/** Arrosoir vert : le corps, l'anse et le long bec. */
function arrosoir() {
  const s = new IsoSprite(1, 1, 18);
  s.cylinder(0.5, 0.5, 0, 9, 0.2, C.green);
  s.flatDisc(0.5, 0.5, 9, 0.12, C.greenDark);
  const top = s.p(0.5, 0.5, 9);
  const x = Math.round(top.x);
  const y = Math.round(top.y);
  // L'anse, par-dessus.
  s.g.spans([[y - 6, x - 2, x + 2], [y - 5, x - 4, x - 3], [y - 5, x + 3, x + 4], [y - 4, x - 5, x - 5], [y - 4, x + 5, x + 5]], C.greenDark);
  // Le bec vers l'avant à gauche, et sa pomme.
  const spout = s.p(0.5, 0.72, 3);
  line(s.g, spout.x, spout.y, spout.x - 9, spout.y - 7, C.green);
  line(s.g, spout.x, spout.y + 1, spout.x - 9, spout.y - 6, C.greenDark);
  s.g.rect(Math.round(spout.x) - 11, Math.round(spout.y) - 9, Math.round(spout.x) - 9, Math.round(spout.y) - 7, C.silver);
  return s;
}

/** Sac de terreau : le sac brun et son étiquette, un peu de terre renversée. */
function sacDeTerreau() {
  const s = new IsoSprite(1, 1, 18);
  const bag = C.wood;
  s.flatDisc(0.72, 0.84, 0, 0.12, C.soil);
  s.box(0.2, 0.28, 0.8, 0.72, 0, 12, bag);
  s.box(0.24, 0.32, 0.76, 0.68, 12, 14, darken(bag, 0.1));
  s.top(14, 0.3, 0.45, 0.7, 0.55, darken(bag, 0.3)); // la couture du haut
  s.front(0.72, 0.3, 0.7, 3, 9, C.cream);
  s.front(0.72, 0.45, 0.55, 4, 8, '#2f8f3a');
  s.front(0.72, 0.4, 0.6, 6, 6, '#2f8f3a');
  return s;
}

/**
 * Les objets de la serre dessinés en code. `views` : les vues mises côte à côte
 * dans l'image (au mur : mur de droite, puis mur de gauche).
 */
export const SERRE_OBJECTS = [
  // Équipement
  { id: 'pot-de-yogourt', views: [potDeYogourt] },
  { id: 'lampe-del', views: [() => lampeDel('R'), () => lampeDel('L')], wall: true },
  { id: 'tente-culture', views: [tenteCulture] },
  { id: 'hydroponie', views: [hydroponie] },
  { id: 'ventilation', views: [() => ventilation('R'), () => ventilation('L')], wall: true },
  { id: 'ami-botaniste', views: [amiBotaniste] },
  { id: 'serre-auto', views: [serreAuto] },
  { id: 'ferme-lunaire', views: [fermeLunaire] },
  // Variétés
  { id: 'kush-du-sous-sol', views: [kushDuSousSol] },
  { id: 'mauve-laveuse', views: [mauveLaveuse] },
  { id: 'og-panier-linge', views: [ogPanierLinge] },
  { id: 'sativa-voisin', views: [sativaVoisin] },
  { id: 'indica-divan', views: [indicaDivan] },
  { id: 'haze-cosmique', views: [hazeCosmique] },
  { id: 'lunaire-1', views: [lunaire1] },
  { id: 'nebuleuse', views: [nebuleuse] },
  // Déco
  { id: 'arrosoir', views: [arrosoir] },
  { id: 'sac-de-terreau', views: [sacDeTerreau] },
  { id: 'pancarte', views: [() => pancarte('R'), () => pancarte('L')], wall: true },
];
