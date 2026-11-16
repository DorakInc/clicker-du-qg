// Petits sprites des effets visuels (voir docs/animations/) :
//   piece.png    6 × 6   une pièce, pour l'argent qui vole vers « le cash »
//   note.png     6 × 8   une note de musique, pour le gros beat
//   drapeau.png  7 × 9   le drapeau planté sur un territoire conquis
// Couleurs reprises de src/ui/style.css (--ink, --lamp, --weed, --pink).

const INK = '#241a2e';
const LAMP = '#ffd166';
const LAMP_DARK = '#e0a93a';
const LAMP_LIGHT = '#fff3c4';
const WEED = '#7bd389';
const WEED_LIGHT = '#c9f2d0';
const PINK = '#ff7eb6';
const PINK_DARK = '#e85f9c';

/** Dessine un motif texte : chaque caractère est une couleur (espace ou point = vide). */
function paint(g, rows, palette) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => g.set(x, y, palette[ch])));
}

export const COIN = { w: 6, h: 6 };
export function drawCoin(g) {
  paint(g, [
    '.XXXX.',
    'XHLLLX',
    'XLDLLX',
    'XLDLLX',
    'XLLLDX',
    '.XXXX.',
  ], { X: INK, L: LAMP, D: LAMP_DARK, H: LAMP_LIGHT });
}

export const NOTE = { w: 6, h: 8 };
export function drawNote(g) {
  paint(g, [
    '...XX.',
    '...XGX',
    '...X.X',
    '...X..',
    '.XXX..',
    'XHGX..',
    'XGGX..',
    '.XX...',
  ], { X: INK, G: WEED, H: WEED_LIGHT });
}

export const FLAG = { w: 7, h: 9 };
export function drawFlag(g) {
  paint(g, [
    'XXXXXX.',
    'XPPPPPX',
    'XPPPPX.',
    'XPDPPPX',
    'XXXXXX.',
    'X......',
    'X......',
    'X......',
    'XX.....',
  ], { X: INK, P: PINK, D: PINK_DARK });
}

// Icône du jeu (écran d'accueil du téléphone) : le vinyle du QG sur fond prune, 32 × 32.
export const ICON = { w: 32, h: 32 };
export function drawIcon(g) {
  g.rect(0, 0, 31, 31, '#1b1426');
  g.rect(1, 1, 30, 30, '#2a1f3a');
  g.disc(15.5, 15.5, 13.5, INK);
  g.disc(15.5, 15.5, 12.5, '#121214');
  for (const r of [11, 9]) {
    for (let a = 0; a < 360; a += 4) {
      const x = Math.round(15.5 + r * Math.cos((a * Math.PI) / 180));
      const y = Math.round(15.5 + r * Math.sin((a * Math.PI) / 180));
      g.set(x, y, '#2c2c33');
    }
  }
  for (let i = 0; i < 6; i += 1) g.set(21 + i, 6 + i, '#4a4a52'); // reflet
  g.disc(15.5, 15.5, 5.5, INK);
  g.disc(15.5, 15.5, 4.5, '#ff8a5b');
  g.rect(15, 15, 16, 16, INK);
  g.rect(13, 12, 14, 12, LAMP_LIGHT);
}
