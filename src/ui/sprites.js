// Planches de sprites des personnages (2 images × 3 vues de 32 × 48) :
//   - personnage préfait : le PNG généré par `npm run sprites` ;
//   - perso créé par un joueur ('p-…') : dessiné ici, dans le navigateur, à partir du look
//     encodé dans son identifiant (src/poupee/code.js). Même dessin que `npm run sprites`.

import { compose } from '../poupee/grid.js';
import { characterFromLook, renderSheet } from '../poupee/index.js';
import { decodeLook } from '../poupee/code.js';
import { isCustomId } from '../game/index.js';

const cache = new Map();

/** Un canvas avec la planche d'un look. */
export function sheetCanvas(look) {
  const { width, height, rgba } = compose(renderSheet(characterFromLook('perso', look)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return canvas;
}

/** L'adresse de la planche d'un personnage, ou null si son look est illisible. */
export function sheetUrl(data, id) {
  if (!isCustomId(id)) return data.characters.some((c) => c.id === id) ? `assets/images/personnages/${id}-sheet.png` : null;
  if (!cache.has(id)) {
    const look = data.creation ? decodeLook(id.slice(2), data.creation.palettes) : null;
    cache.set(id, look ? sheetCanvas(look).toDataURL('image/png') : null);
  }
  return cache.get(id);
}

/** Nom et force à afficher pour l'identifiant d'un autre joueur (classement). */
export function characterLabel(data, id) {
  if (isCustomId(id)) return { name: 'Perso maison', strength: 'créé par le joueur' };
  const c = data.characters.find((o) => o.id === id);
  return c ? { name: c.name, strength: c.strength } : null;
}
