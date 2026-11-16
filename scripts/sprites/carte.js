// La carte du monde en pixel art (160 × 100), la nuit : océan bleu nuit,
// continents stylisés, la Lune en haut à droite. Les marqueurs des
// territoires sont ajoutés par le jeu par-dessus (data/map.json donne x, y).

import { Grid } from './grid.js';

export const CARTE_W = 160;
export const CARTE_H = 100;

const C = {
  ocean: '#16284a', wave: '#1f3760', deep: '#122140',
  land: '#6f9a5c', landLight: '#86b36e', landDark: '#557a46', sand: '#d6c08a',
  snow: '#e8eef2', mountain: '#7c6a54',
  moon: '#f6f0c8', moonShade: '#d9d2a6', star: '#f6f0c8',
};

function ocean(g) {
  g.rect(0, 0, CARTE_W - 1, CARTE_H - 1, C.ocean);
  for (let y = 2; y < CARTE_H; y += 5) {
    for (let x = (y * 7) % 11; x < CARTE_W; x += 11) {
      g.rect(x, y, x + 2, y, C.wave);
    }
  }
  for (const [x, y, rx, ry] of [[60, 80, 14, 6], [110, 70, 10, 5], [10, 70, 8, 6]]) g.ellipse(x, y, rx, ry, C.deep);
  for (const [x, y] of [[8, 4], [26, 8], [70, 5], [96, 3], [118, 8], [134, 4], [100, 12], [60, 10]]) g.set(x, y, C.star);
}

function continents(land) {
  const L = C.land;
  // Amérique du Nord (avec le Québec et l'Ontario un peu gonflés, évidemment).
  land.ellipse(32, 26, 22, 12, L);
  land.ellipse(26, 16, 16, 7, L);
  land.ellipse(48, 22, 9, 8, L);
  land.ellipse(38, 40, 13, 7, L);
  land.ellipse(22, 38, 8, 6, L);
  land.ellipse(44, 50, 4, 4, L);
  land.ellipse(13, 12, 7, 5, L);
  land.ellipse(48, 8, 6, 4, L); // Groenland-ish
  // Amérique du Sud.
  land.ellipse(56, 66, 8, 9, L);
  land.ellipse(54, 80, 5, 9, L);
  // Europe et Royaume-Uni.
  land.ellipse(85, 25, 10, 7, L);
  land.ellipse(80, 31, 6, 4, L);
  land.ellipse(92, 18, 5, 5, L);
  land.ellipse(73, 24, 2, 3, L);
  // Afrique.
  land.ellipse(84, 50, 11, 10, L);
  land.ellipse(88, 64, 7, 10, L);
  // Asie.
  land.ellipse(118, 26, 24, 12, L);
  land.ellipse(130, 40, 11, 7, L);
  land.ellipse(105, 38, 6, 6, L);
  land.ellipse(140, 20, 10, 6, L);
  land.ellipse(139, 37, 1.5, 2.5, L); // Corée
  land.ellipse(146, 33, 2, 5, L); // Japon
  // Australie.
  land.ellipse(138, 70, 9, 6, L);
}

function relief(land) {
  // Un peu de texture : collines claires, forêts sombres, neige au nord.
  for (let y = 0; y < CARTE_H; y += 1) {
    for (let x = 0; x < CARTE_W; x += 1) {
      if (land.get(x, y) !== C.land) continue;
      if (y < 12) land.set(x, y, C.snow);
      else if ((x * 5 + y * 3) % 13 === 0) land.set(x, y, C.landLight);
      else if ((x * 3 + y * 7) % 17 === 0) land.set(x, y, C.landDark);
    }
  }
  for (const [x, y] of [[20, 30], [21, 31], [112, 30], [113, 31], [114, 30], [125, 34]]) land.set(x, y, C.mountain);
}

function moon(g) {
  g.disc(150, 10, 8, C.moon);
  g.disc(147, 7, 1.5, C.moonShade);
  g.disc(153, 13, 2, C.moonShade);
  g.disc(152, 6, 1, C.moonShade);
}

export function drawCarte(g) {
  ocean(g);
  const land = new Grid(CARTE_W, CARTE_H);
  continents(land);
  relief(land);
  land.outline(0); // agrandit chaque continent d'un pixel ; ce bord devient la plage
  for (let y = 0; y < CARTE_H; y += 1) {
    for (let x = 0; x < CARTE_W; x += 1) {
      const c = land.get(x, y);
      if (!c) continue;
      const isEdge = [land.get(x + 1, y), land.get(x - 1, y), land.get(x, y + 1), land.get(x, y - 1)].some((n) => !n);
      g.set(x, y, isEdge ? C.sand : c);
    }
  }
  moon(g);
}
