// Les objets du studio (améliorations, producteurs, déco) en pixel art isométrique.
// Chaque objet donne son type (sol ou mur), sa taille et une fonction de dessin.
// `npm run sprites` les écrit dans assets/images/qg/<id>-iso.png ; data/decor.json
// pointe vers ces fichiers avec le champ "sprite".
// Format : voir scripts/sprites/iso.js et data/README.md.

import { darken } from './grid.js';
import { IsoSprite, WallSprite, lighten, line } from './iso.js';

const C = {
  black: '#1e1e22', dark: '#2c2c32', steel: '#3a3a42', grey: '#6b6f78', silver: '#c9ccd3',
  white: '#f2f0ea', whiteShade: '#d6d2c8',
  red: '#c8312f', redLight: '#e94f37', gold: '#e8b93b', goldDark: '#b08a2a', brass: '#c9b26b',
  yellow: '#f2c14e', blue: '#3d5a99', blueDark: '#24345f', glass: '#2b3d6b', glassLight: '#7fa3d9',
  green: '#7bd389', greenDark: '#2f8f6f',
  plum: '#6b4f8a', plumLight: '#8a6aab',
  foam: '#4a3f4f', foamLight: '#62566a',
  pink: '#ff5fa2', pinkLight: '#ffb3d1', pinkCore: '#fff0f7',
  purple: '#b04dff', purpleLight: '#e3b3ff', purpleGlow: '#cfa0f0',
  wood: '#8a6a4a', booth: '#8a7a64',
};

// ---- Au sol ----

/** Support à casque : socle rond, tige, casque fermé aux coussinets rouges. */
function casque() {
  const s = new IsoSprite(1, 1, 26);
  s.flatDisc(0.5, 0.5, 0, 0.2, C.dark);
  s.cylinder(0.5, 0.5, 0, 2, 0.2, C.steel);
  s.box(0.46, 0.46, 0.54, 0.54, 2, 20, C.steel);
  const c = s.p(0.5, 0.5, 20);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  // L'arceau.
  s.g.spans([[y - 7, x - 4, x + 3], [y - 6, x - 6, x - 4], [y - 6, x + 3, x + 5], [y - 5, x - 7, x - 6], [y - 5, x + 5, x + 6]], C.black);
  s.g.spans([[y - 7, x - 2, x + 1]], C.grey);
  // Les écouteurs : coque noire, coussinet rouge vers l'intérieur.
  s.g.rect(x - 8, y - 4, x - 5, y + 3, C.black);
  s.g.rect(x + 4, y - 4, x + 7, y + 3, C.black);
  s.g.rect(x - 5, y - 3, x - 4, y + 2, C.red);
  s.g.rect(x + 3, y - 3, x + 4, y + 2, C.red);
  s.g.rect(x - 8, y - 3, x - 8, y + 1, C.steel);
  s.g.set(x + 6, y - 3, C.grey);
  return s;
}

/** Chaise gamer rouge et noire. Vue 0 : on voit l'avant ; vue 1 : le dos. */
function chaise(view) {
  const s = new IsoSprite(1, 1, 34);
  const red = C.red;
  // Pied en étoile et roulettes.
  s.flatDisc(0.5, 0.5, 0, 0.28, C.dark);
  for (const [u, v] of [[0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8], [0.28, 0.78], [0.75, 0.25]]) s.dot(u, v, 0, C.black);
  s.box(0.46, 0.46, 0.54, 0.54, 2, 10, C.grey);
  const back = () => {
    if (view === 0) {
      s.box(0.22, 0.14, 0.78, 0.3, 12, 34, red);
      s.front(0.3, 0.38, 0.62, 14, 31, C.black); // bande noire au centre du dossier
      s.front(0.3, 0.4, 0.6, 28, 31, C.dark); // coussin de nuque
    } else {
      s.box(0.22, 0.7, 0.78, 0.86, 12, 34, C.black);
      s.front(0.86, 0.26, 0.74, 14, 32, C.dark);
      s.front(0.86, 0.42, 0.58, 20, 26, red); // logo
      s.side(0.78, 0.7, 0.86, 13, 33, darken(red, 0.3));
    }
  };
  const seat = () => {
    s.box(0.2, 0.2, 0.8, 0.82, 10, 14, { top: lighten(red, 0.1), left: C.black, right: darken(C.black, 0.2) });
    s.top(14, 0.3, 0.3, 0.7, 0.75, C.black);
  };
  const arms = () => {
    s.box(0.14, 0.32, 0.22, 0.72, 14, 18, C.black);
    s.box(0.78, 0.32, 0.86, 0.72, 14, 18, C.black);
  };
  if (view === 0) { back(); seat(); arms(); } else { seat(); arms(); back(); }
  return s;
}

/** Deux moniteurs de studio sur pieds, cône jaune. */
function moniteurs() {
  const s = new IsoSprite(2, 1, 32);
  for (const c of [0.5, 1.5]) {
    s.box(c - 0.06, 0.44, c + 0.06, 0.56, 0, 8, C.steel);
    s.box(c - 0.32, 0.26, c + 0.32, 0.74, 8, 30, C.black);
    const woofer = s.p(c, 0.74, 15);
    s.g.ellipse(woofer.x, woofer.y, 4.2, 4.5, C.dark);
    s.g.ellipse(woofer.x, woofer.y, 3, 3.2, C.gold);
    s.g.ellipse(woofer.x, woofer.y, 1.2, 1.2, C.goldDark);
    const tweeter = s.p(c, 0.74, 25);
    s.g.ellipse(tweeter.x, tweeter.y, 1.8, 1.8, C.steel);
    s.g.set(Math.floor(tweeter.x), Math.floor(tweeter.y), C.silver);
    s.dot(c + 0.2, 0.74, 10, C.green); // voyant allumé
  }
  return s;
}

/** Le divan du QG : dossier, accoudoirs, deux coussins et un coussin jaune. */
function canape() {
  const s = new IsoSprite(2, 1, 22);
  const main = C.plum;
  for (const [u, v] of [[0.12, 0.88], [1.88, 0.88], [1.88, 0.16]]) s.dot(u, v, 0, C.black);
  s.box(0.05, 0.12, 1.95, 0.42, 2, 20, main);
  s.box(0.05, 0.12, 0.3, 0.95, 2, 14, main);
  s.box(0.3, 0.42, 1.7, 0.95, 2, 9, darken(main, 0.1));
  s.box(0.3, 0.42, 1.0, 0.95, 9, 12, C.plumLight);
  s.box(1.0, 0.42, 1.7, 0.95, 9, 12, C.plumLight);
  s.box(1.7, 0.12, 1.95, 0.95, 2, 14, main);
  s.box(0.36, 0.44, 0.62, 0.58, 12, 19, C.yellow);
  return s;
}

/** Vaporisateur de table : socle conique argenté, voyant, ballon. */
function vaporisateur() {
  const s = new IsoSprite(1, 1, 30);
  s.cylinder(0.5, 0.5, 0, 4, 0.26, C.silver);
  s.cylinder(0.5, 0.5, 4, 9, 0.2, C.silver);
  s.cylinder(0.5, 0.5, 9, 12, 0.12, C.grey);
  s.dot(0.5, 0.82, 5, '#ff5d5d');
  const c = s.p(0.5, 0.5, 21);
  s.g.ellipse(c.x, c.y, 5, 8, '#dfeee0');
  s.g.ellipse(c.x - 1.5, c.y - 2, 2, 3.5, '#f7fff7');
  s.g.ellipse(c.x + 2, c.y + 3, 2.5, 3, '#c6dcc8');
  s.g.rect(Math.round(c.x) - 1, Math.round(c.y) + 7, Math.round(c.x), Math.round(c.y) + 9, C.grey);
  return s;
}

/** Micro à lampes sur pied : trépied, perche, micro doré dans sa suspension, filtre anti-pop. */
function microPro() {
  const s = new IsoSprite(1, 1, 42);
  const hub = s.p(0.5, 0.5, 8);
  for (const [u, v] of [[0.15, 0.6], [0.75, 0.82], [0.7, 0.2]]) {
    const foot = s.p(u, v, 0);
    line(s.g, hub.x, hub.y, foot.x, foot.y, C.black);
  }
  s.box(0.47, 0.47, 0.53, 0.53, 8, 30, C.steel);
  const m = s.p(0.5, 0.5, 34);
  const x = Math.round(m.x);
  const y = Math.round(m.y);
  // Suspension.
  s.g.rect(x - 4, y - 3, x - 4, y + 4, C.dark);
  s.g.rect(x + 3, y - 3, x + 3, y + 4, C.dark);
  s.g.rect(x - 4, y + 4, x + 3, y + 4, C.dark);
  // Corps du micro.
  s.g.rect(x - 2, y - 6, x + 1, y + 5, C.brass);
  s.g.rect(x - 2, y - 6, x + 1, y - 2, C.silver);
  for (let yy = y - 6; yy <= y - 2; yy += 2) s.g.rect(x - 2, yy, x + 1, yy, C.grey);
  s.g.rect(x + 1, y - 1, x + 1, y + 5, C.goldDark);
  s.g.set(x - 1, y + 1, C.white);
  // Filtre anti-pop, devant à gauche.
  s.g.ellipse(x - 8, y - 2, 3, 5, C.dark);
  s.g.ellipse(x - 8, y - 2, 2, 4, C.steel);
  line(s.g, x - 6, y + 3, x - 2, y + 6, C.dark);
  return s;
}

/** Cabine d'enregistrement : porte vitrée, fenêtre de côté, lumière « ON AIR ». */
function cabine() {
  const s = new IsoSprite(2, 2, 62);
  const wall = C.booth;
  s.box(0.06, 0.06, 1.94, 1.94, 0, 56, wall);
  s.top(56, 0.18, 0.18, 1.82, 1.82, darken(wall, 0.12));
  // Plinthe et coins.
  s.front(1.94, 0.06, 1.94, 0, 3, darken(wall, 0.35));
  s.side(1.94, 0.06, 1.94, 0, 3, darken(wall, 0.5));
  // Porte avec hublot et poignée.
  s.front(1.94, 0.35, 1.05, 3, 46, darken(wall, 0.2));
  s.front(1.94, 0.4, 1.0, 5, 44, lighten(wall, 0.08));
  s.front(1.94, 0.5, 0.9, 28, 40, C.glass);
  for (let u = 0.52; u < 0.88; u += 0.08) s.front(1.94, u, u + 0.04, 29, 39, C.foam);
  s.front(1.94, 0.52, 0.6, 37, 39, C.glassLight);
  s.dot(0.95, 1.94, 22, C.gold);
  s.dot(0.95, 1.94, 23, C.gold);
  // Lumière ON AIR au-dessus de la porte.
  s.front(1.94, 1.25, 1.75, 44, 51, C.dark);
  s.front(1.94, 1.29, 1.71, 45, 50, C.redLight);
  s.front(1.94, 1.37, 1.63, 47, 48, '#ffd6cc');
  // Fenêtre sur la face de droite.
  s.side(1.94, 0.45, 1.55, 20, 42, darken(wall, 0.45));
  s.side(1.94, 0.5, 1.5, 22, 40, C.blueDark);
  s.side(1.94, 0.6, 0.7, 24, 38, C.glass);
  s.side(1.94, 1.1, 1.15, 26, 36, C.glass);
  return s;
}

/** Console analogique : pieds, pont des vumètres, tranches avec boutons et faders. */
function consoleAnalogique() {
  const s = new IsoSprite(2, 1, 26);
  const body = C.blue;
  for (const [u, v] of [[0.12, 0.88], [1.88, 0.88], [1.88, 0.2], [0.12, 0.2]]) s.box(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, 10, C.dark);
  s.box(0.04, 0.12, 1.96, 0.95, 10, 15, body);
  s.box(0.04, 0.12, 1.96, 0.38, 15, 22, darken(body, 0.35));
  // Vumètres sur le pont.
  for (let i = 0; i < 6; i += 1) {
    const u = 0.2 + i * 0.28;
    s.front(0.38, u, u + 0.18, 16, 20, C.black);
    s.front(0.38, u + 0.02, u + 0.06, 17, 19, C.green);
    s.front(0.38, u + 0.07, u + 0.11, 17, 19, i % 3 === 2 ? C.redLight : C.yellow);
  }
  // Tranches : boutons de couleur, puis un fader.
  const knobs = [C.redLight, C.yellow, C.blueDark, C.white];
  for (let i = 0; i < 12; i += 1) {
    const u = 0.14 + i * 0.15;
    knobs.forEach((k, j) => s.dot(u, 0.44 + j * 0.08, 15, k));
    s.top(15, u - 0.01, 0.76, u + 0.03, 0.92, C.black);
    s.dot(u, 0.8 + (i % 3) * 0.03, 15, C.white);
  }
  return s;
}

// ---- Au mur ----

/** Deux panneaux de mousse « boîte à œufs ». */
function panneaux(wall) {
  const s = new WallSprite(2, 18, wall);
  for (const x0 of [1, 17]) {
    s.rect(x0, 1, x0 + 13, 16, darken(C.foam, 0.3));
    for (let tz = 2; tz <= 15; tz += 1) {
      for (let tx = x0 + 1; tx <= x0 + 12; tx += 1) {
        const bump = ((tx >> 1) + (tz >> 1)) % 2 === 0;
        s.set(tx, tz, bump ? C.foamLight : C.foam);
      }
    }
  }
  return s;
}

/** Bande LED violette, avec son halo sur le mur. */
function lampeLed(wall) {
  const s = new WallSprite(3, 7, wall);
  for (let tx = 0; tx < s.width; tx += 1) {
    if (tx % 2 === 0) {
      s.set(tx, 0, C.purpleGlow);
      s.set(tx, 6, C.purpleGlow);
    }
    if (tx % 4 === 1) {
      s.set(tx, 1, C.purpleGlow);
      s.set(tx, 5, C.purpleGlow);
    }
    s.set(tx, 2, C.purple);
    s.set(tx, 3, tx % 3 === 0 ? C.pinkCore : C.purpleLight);
    s.set(tx, 4, C.purple);
  }
  return s;
}

/** Néon rose « QG » sur une plaque sombre, avec un halo clair autour des tubes. */
function neons(wall) {
  const s = new WallSprite(2, 16, wall);
  const Q = ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'];
  const G = ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'];
  s.rect(2, 0, 29, 15, '#2a2033');
  s.pattern(4, 1, Q, C.pinkLight, 2);
  s.pattern(17, 1, G, C.pinkLight, 2);
  // Le tube : le pixel du bas-gauche de chaque bloc 2 × 2 est plus vif (lumière au cœur).
  for (let tx = 0; tx < s.width; tx += 1) {
    for (let tz = 0; tz < s.h; tz += 1) {
      if (s.get(tx, tz) === C.pinkLight && (tx % 2 === 0) === (tz % 2 === 1)) s.set(tx, tz, C.pink);
    }
  }
  return s;
}

// ---- Producteurs ----

/** Boîte à rythmes sur une petite table : 16 pads de couleur, comme une vieille 808. */
function boiteARythmes() {
  const s = new IsoSprite(1, 1, 26);
  for (const [u, v] of [[0.18, 0.82], [0.82, 0.82], [0.82, 0.18], [0.18, 0.18]]) s.box(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, 13, C.wood);
  s.box(0.1, 0.1, 0.9, 0.9, 13, 15, lighten(C.wood, 0.15));
  s.box(0.2, 0.22, 0.8, 0.78, 15, 18, C.steel);
  const pads = [C.redLight, '#f08a4b', C.yellow, C.white];
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) s.dot(0.28 + i * 0.14, 0.32 + j * 0.13, 18, pads[i]);
  }
  s.dot(0.74, 0.28, 18, C.green);
  return s;
}

/** Clavier MIDI sur un pied en X : touches blanches et noires, deux molettes. */
function clavierMidi() {
  const s = new IsoSprite(2, 1, 22);
  for (const u of [0.45, 1.55]) {
    const a = s.p(u - 0.18, 0.3, 0);
    const b = s.p(u + 0.18, 0.7, 13);
    const c = s.p(u + 0.18, 0.7, 0);
    const d = s.p(u - 0.18, 0.3, 13);
    line(s.g, a.x, a.y, b.x, b.y, C.black);
    line(s.g, c.x, c.y, d.x, d.y, C.black);
  }
  s.box(0.06, 0.25, 1.94, 0.78, 13, 17, C.black);
  s.top(17, 0.12, 0.28, 0.4, 0.74, C.dark);
  s.dot(0.2, 0.4, 17, C.grey);
  s.dot(0.3, 0.4, 17, C.grey);
  s.dot(0.25, 0.6, 17, C.green);
  // Les touches : blanches sur le devant, noires par groupes de 2 et 3.
  s.top(17, 0.44, 0.4, 1.9, 0.76, C.white);
  for (let i = 0; i < 14; i += 1) {
    const u = 0.44 + i * 0.104;
    s.top(17, u, 0.4, u + 0.012, 0.76, C.whiteShade);
    if ([0, 1, 3, 4, 5].includes(i % 7)) s.top(17, u + 0.07, 0.4, u + 0.12, 0.58, C.black);
  }
  return s;
}

/** Le bureau blanc du QG avec l'écran plein de code, le clavier et la souris. */
function logicielProd() {
  const s = new IsoSprite(2, 1, 44);
  const desk = C.white;
  for (const [u, v] of [[0.1, 0.88], [1.9, 0.88], [1.9, 0.16], [0.1, 0.16]]) s.box(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, 18, C.whiteShade);
  s.box(0.04, 0.1, 1.96, 0.94, 18, 20, desk);
  // L'écran, au fond du bureau.
  s.box(0.96, 0.24, 1.04, 0.3, 20, 25, C.dark);
  s.box(0.4, 0.18, 1.6, 0.26, 25, 42, C.black);
  s.front(0.26, 0.46, 1.54, 27, 40, C.blueDark);
  const code = ['#7fd1ff', '#ffd166', '#ff7eb6', '#9be59b', '#e8e8f0'];
  for (let row = 0; row < 6; row += 1) {
    const indent = [0, 0.1, 0.1, 0.2, 0.1, 0][row];
    const length = [0.5, 0.7, 0.4, 0.55, 0.3, 0.6][row];
    s.front(0.26, 0.54 + indent, 0.54 + indent + length, 38 - row * 2, 38 - row * 2 + 1, code[row % code.length]);
  }
  // Clavier, souris et une canette.
  s.box(0.6, 0.5, 1.3, 0.68, 20, 21, C.dark);
  s.box(1.45, 0.55, 1.55, 0.66, 20, 21, C.dark);
  s.cylinder(0.25, 0.5, 20, 26, 0.06, C.redLight);
  return s;
}

/** Ferme à beats : un rack plein de boîtes à pads, voyants allumés. */
function fermeABeats() {
  const s = new IsoSprite(1, 1, 44);
  const rack = C.black;
  s.box(0.12, 0.12, 0.88, 0.88, 0, 40, rack);
  s.top(40, 0.2, 0.2, 0.8, 0.8, C.dark);
  for (let i = 0; i < 5; i += 1) {
    const z = 3 + i * 7;
    s.front(0.88, 0.18, 0.82, z, z + 5, C.steel);
    for (let j = 0; j < 4; j += 1) s.front(0.88, 0.24 + j * 0.1, 0.3 + j * 0.1, z + 2, z + 3, [C.redLight, C.yellow, '#f08a4b', C.white][(i + j) % 4]);
    s.front(0.88, 0.7, 0.76, z + 3, z + 3, i % 2 ? C.green : C.redLight);
    s.side(0.88, 0.2, 0.8, z + 4, z + 4, darken(rack, 0.3));
  }
  s.side(0.88, 0.3, 0.38, 30, 31, C.green);
  return s;
}

// ---- Déco ----

/** Le poêle à bois sur son muret de pierre, le feu derrière la vitre, le tuyau qui monte. */
function poeleABois() {
  const s = new IsoSprite(1, 1, 46);
  const stone = '#9c968c';
  s.box(0.04, 0.04, 0.96, 0.96, 0, 4, stone);
  for (const [u, v] of [[0.2, 0.96], [0.5, 0.96], [0.8, 0.96]]) s.front(0.96, u - 0.08, u + 0.06, 1, 2, darken(stone, 0.25));
  for (const v of [0.25, 0.6]) s.side(0.96, v - 0.08, v + 0.08, 1, 2, darken(stone, 0.4));
  s.box(0.2, 0.2, 0.8, 0.8, 4, 22, C.black);
  s.front(0.8, 0.3, 0.7, 7, 18, C.dark);
  s.front(0.8, 0.34, 0.66, 8, 17, '#3b1c14');
  s.front(0.8, 0.38, 0.62, 8, 12, '#e94f37');
  s.front(0.8, 0.42, 0.58, 9, 14, '#f08a4b');
  s.front(0.8, 0.46, 0.54, 9, 11, C.yellow);
  s.cylinder(0.5, 0.5, 22, 46, 0.09, C.dark);
  return s;
}

/** Laveuse-sécheuse à hublot. */
function laveuse() {
  const s = new IsoSprite(1, 1, 30);
  s.box(0.1, 0.1, 0.9, 0.9, 0, 26, C.white);
  s.front(0.9, 0.14, 0.86, 21, 25, C.whiteShade);
  s.dot(0.25, 0.9, 23, C.grey);
  s.dot(0.7, 0.9, 23, C.green);
  const door = s.p(0.5, 0.9, 11);
  s.g.ellipse(door.x, door.y, 6.5, 7, C.grey);
  s.g.ellipse(door.x, door.y, 5, 5.5, C.glass);
  s.g.ellipse(door.x, door.y + 1.5, 4, 3, '#3d5a99');
  s.g.ellipse(door.x - 2, door.y - 2, 1.2, 1.5, C.glassLight);
  return s;
}

// ---- Cadres et affiches (au mur) ----

const FONT = {
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
};

function text(s, tx, tz, word, color) {
  [...word].forEach((ch, i) => s.pattern(tx + i * 4, tz, FONT[ch], color));
}

/** Cadre : bordure, fond, puis le contenu. */
function frame(wall, len, h, border, inside) {
  const s = new WallSprite(len, h, wall);
  s.rect(1, 0, s.width - 2, h - 1, border);
  s.rect(2, 1, s.width - 3, h - 2, inside);
  return s;
}

/** Label indé : le contrat signé, encadré, avec le sceau rouge. */
function labelInde(wall) {
  const s = frame(wall, 1, 16, C.wood, C.white);
  for (let tz = 11; tz >= 6; tz -= 2) s.rect(4, tz, 11, tz, C.whiteShade);
  s.rect(4, 13, 9, 13, C.dark);
  s.rect(8, 3, 11, 3, C.blueDark); // la signature
  s.rect(9, 4, 10, 4, C.blueDark);
  s.rect(3, 2, 5, 4, C.red);
  return s;
}

/** Tournée mondiale : l'affiche orange avec la planète et les dates. */
function tourneeMondiale(wall) {
  const s = frame(wall, 2, 20, C.black, '#f08a4b');
  // La planète.
  for (let tx = 4; tx <= 13; tx += 1) {
    for (let tz = 6; tz <= 15; tz += 1) {
      const dx = tx - 8.5;
      const dz = tz - 10.5;
      if (dx * dx + dz * dz > 22) continue;
      const land = (tx * 7 + tz * 3) % 5 < 2 || (tx > 8 && tz > 11);
      s.set(tx, tz, land ? C.greenDark : '#5b8cff');
    }
  }
  text(s, 15, 12, 'TOUR', '#241a2e');
  for (let i = 0; i < 3; i += 1) s.rect(16, 8 - i * 2, 27 - (i % 2) * 3, 8 - i * 2, '#7a3a1c');
  s.rect(3, 2, 28, 3, '#241a2e');
  return s;
}

/** Studio lunaire : la photo de la Lune dans un cadre noir. */
function studioLunaire(wall) {
  const s = frame(wall, 1, 16, C.black, '#1d2647');
  for (let tx = 5; tx <= 11; tx += 1) {
    for (let tz = 4; tz <= 11; tz += 1) {
      const dx = tx - 8;
      const dz = tz - 7.5;
      if (dx * dx + dz * dz <= 10) s.set(tx, tz, '#f6f0c8');
    }
  }
  for (const [tx, tz] of [[7, 9], [9, 6], [6, 6], [10, 9]]) s.set(tx, tz, '#d8cf9c');
  for (const [tx, tz] of [[3, 13], [12, 3], [13, 12], [4, 2]]) s.set(tx, tz, C.white);
  return s;
}

/** Station orbitale : le disque d'or encadré. */
function stationOrbitale(wall) {
  const s = frame(wall, 1, 16, C.black, '#3a2b4f');
  for (let tx = 3; tx <= 12; tx += 1) {
    for (let tz = 3; tz <= 12; tz += 1) {
      const d2 = (tx - 7.5) ** 2 + (tz - 7.5) ** 2;
      if (d2 <= 21) s.set(tx, tz, d2 > 12 && d2 < 15 ? C.goldDark : C.gold);
      if (d2 <= 4) s.set(tx, tz, C.red);
      if (d2 <= 0.6) s.set(tx, tz, C.black);
    }
  }
  s.set(5, 10, '#fff3c4');
  s.set(6, 11, '#fff3c4');
  s.rect(5, 1, 10, 1, C.goldDark); // la plaque
  return s;
}

/** Une affiche de concert crème avec des cercles concentriques et un titre rouge. */
function affiche(wall) {
  const s = frame(wall, 1, 22, '#d6d2c8', '#f1ece0');
  for (let tx = 2; tx <= 13; tx += 1) {
    for (let tz = 5; tz <= 16; tz += 1) {
      const d = Math.round(Math.hypot(tx - 7.5, tz - 10.5));
      if (d <= 5 && d % 2 === 1) s.set(tx, tz, '#3b2f2a');
    }
  }
  s.rect(4, 2, 11, 3, C.red);
  s.rect(7, 18, 8, 19, C.red);
  return s;
}

/**
 * Les objets dessinés en code. `views` : les vues mises côte à côte dans l'image
 * (au sol : de face, puis de dos ; au mur : mur de droite, puis mur de gauche).
 */
export const ISO_OBJECTS = [
  { id: 'casque', views: [casque] },
  { id: 'panneaux-acoustiques', views: [() => panneaux('R'), () => panneaux('L')], wall: true },
  { id: 'lampe-led', views: [() => lampeLed('R'), () => lampeLed('L')], wall: true },
  { id: 'chaise-gamer', views: [() => chaise(0), () => chaise(1)] },
  { id: 'moniteurs', views: [moniteurs] },
  { id: 'canape', views: [canape] },
  { id: 'neons', views: [() => neons('R'), () => neons('L')], wall: true },
  { id: 'vaporisateur', views: [vaporisateur] },
  { id: 'micro-pro', views: [microPro] },
  { id: 'cabine', views: [cabine] },
  { id: 'console-analogique', views: [consoleAnalogique] },
  // Producteurs
  { id: 'boite-a-rythmes', views: [boiteARythmes] },
  { id: 'clavier-midi', views: [clavierMidi] },
  { id: 'logiciel-prod', views: [logicielProd] },
  { id: 'label-inde', views: [() => labelInde('R'), () => labelInde('L')], wall: true },
  { id: 'ferme-a-beats', views: [fermeABeats] },
  { id: 'tournee-mondiale', views: [() => tourneeMondiale('R'), () => tourneeMondiale('L')], wall: true },
  { id: 'studio-lunaire', views: [() => studioLunaire('R'), () => studioLunaire('L')], wall: true },
  { id: 'station-orbitale', views: [() => stationOrbitale('R'), () => stationOrbitale('L')], wall: true },
  // Déco
  { id: 'affiche', views: [() => affiche('R'), () => affiche('L')], wall: true },
  { id: 'poele-a-bois', views: [poeleABois] },
  { id: 'laveuse', views: [laveuse] },
];

/** Dessine les vues d'un objet et retourne leurs grilles. */
export function drawIsoObject(object) {
  return object.views.map((draw) => {
    const sprite = draw();
    if (!object.wall) sprite.g.outline(0.6);
    return sprite.g;
  });
}
