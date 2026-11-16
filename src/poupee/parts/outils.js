// Outils communs aux pièces de la poupée de papier (vues de 32 × 48).
// Pur JavaScript, sans Node : le même code tourne dans `npm run sprites` et dans l'atelier (navigateur).

import { darken } from '../grid.js';

export { darken };

/** Miroir horizontal d'une colonne. */
export const M = (x) => 31 - x;

/** Rectangle + son reflet de l'autre côté (vues de face et de dos). */
export function sym(g, x0, y0, x1, y1, color) {
  g.rect(x0, y0, x1, y1, color);
  g.rect(M(x1), y0, M(x0), y1, color);
}

/** Mélange deux couleurs '#rrggbb' (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const v = Math.round(((na >> shift) & 255) * (1 - t) + ((nb >> shift) & 255) * t);
    return v.toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export const lighten = (hex, amount) => mix(hex, '#ffffff', amount);

/** Luminosité perçue, de 0 (noir) à 1 (blanc). */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Une teinte plus claire (ou plus sombre si la couleur est déjà très claire), pour les reflets. */
export function highlight(hex, amount = 0.18) {
  return luminance(hex) > 0.8 ? darken(hex, amount) : lighten(hex, amount);
}

/** Repeint en motif les pixels d'une couleur donnée (boucles, tresses, denim...). */
export function texture(g, color, paint) {
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      if (g.get(x, y) !== color) continue;
      const c = paint(x, y);
      if (c) g.set(x, y, c);
    }
  }
}

/**
 * Morphologies : colonnes du torse (vue de face, côté gauche), des jambes,
 * et leurs bornes en vue de profil.
 */
export const BODIES = {
  mince: { torso: 10, leg: 10, sideTorso: [13, 19], sideLeg: [13, 19] },
  moyen: { torso: 9, leg: 10, sideTorso: [12, 20], sideLeg: [13, 19] },
  large: { torso: 8, leg: 9, sideTorso: [11, 21], sideLeg: [12, 20] },
};
