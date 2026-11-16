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
