// Le look d'un perso créé par un joueur tient dans son identifiant : « p- » + 17 caractères.
// Chaque caractère (0-9 puis a-z) est le numéro d'une pièce de PARTS ou d'une couleur des
// palettes de data/creation.json. Le classement en ligne garde cet identifiant (32 caractères
// [a-z0-9-] permis par le serveur) : tout le monde peut redessiner l'avatar, sans rien de plus.
//
// ⚠️ Pour ne pas changer le look des persos déjà créés : on AJOUTE des pièces et des couleurs
// à la fin des listes, on n'en retire pas et on ne change pas leur ordre.

import { PARTS } from './index.js';

export const CODE_LENGTH = 17;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const keys = (part) => Object.keys(PARTS[part]);

/** Les 17 cases du code : [partie du look, liste des choix, « aucun » permis]. */
function slots(palettes) {
  return [
    ['body', keys('body')],
    ['skin', palettes.skin],
    ['hair.style', keys('hair')],
    ['hair.color', palettes.hair],
    ['beard', keys('beard'), true],
    ['glasses', keys('glasses'), true],
    ['hat.style', keys('hat'), true],
    ['hat.color', palettes.cloth],
    ['top.style', keys('top')],
    ['top.color', palettes.cloth],
    ['top.accent', palettes.cloth],
    ['bottom.style', keys('bottom')],
    ['bottom.color', palettes.cloth],
    ['shoes.style', keys('shoes')],
    ['shoes.color', palettes.cloth],
    ['shoes.accent', palettes.cloth],
  ];
}

const get = (look, path) => path.split('.').reduce((o, k) => o?.[k], look);

/** Le code d'un look, ou null si une pièce ou une couleur n'est pas dans les listes. */
export function encodeLook(look, palettes) {
  let code = '';
  for (const [path, choices, optional] of slots(palettes)) {
    let value = get(look, path);
    if (path === 'hat.color' && !look.hat) value = palettes.cloth[0];
    let index = 0; // « aucun » (barbe, lunettes, chapeau)
    if (!(optional && value == null)) {
      const i = choices.indexOf(value);
      if (i === -1) return null;
      index = i + (optional ? 1 : 0);
    }
    if (index >= DIGITS.length) return null;
    code += DIGITS[index];
  }
  let mask = 0;
  for (const a of look.accessories ?? []) {
    const i = keys('accessories').indexOf(a);
    if (i === -1) return null;
    mask |= 1 << i;
  }
  if (mask >= DIGITS.length) return null;
  return code + DIGITS[mask];
}

/** Le look d'un code, ou null s'il est abîmé. */
export function decodeLook(code, palettes) {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) return null;
  const look = { hair: {}, hat: {}, top: {}, bottom: {}, shoes: {}, accessories: [] };
  const table = slots(palettes);
  for (const [i, [path, choices, optional]] of table.entries()) {
    const n = DIGITS.indexOf(code[i]);
    if (n === -1) return null;
    let value;
    if (optional) {
      if (n > choices.length) return null;
      value = n === 0 ? null : choices[n - 1];
    } else {
      if (n >= choices.length) return null;
      value = choices[n];
    }
    const [a, b] = path.split('.');
    if (b) look[a][b] = value;
    else look[a] = value;
  }
  if (!look.hat.style) look.hat = null;
  const mask = DIGITS.indexOf(code[CODE_LENGTH - 1]);
  if (mask === -1 || mask >= 1 << keys('accessories').length) return null;
  look.accessories = keys('accessories').filter((_, i) => mask & (1 << i));
  return look;
}

/** Un look au hasard, avec les couleurs des palettes (rng remplaçable dans les tests). */
export function randomLook(palettes, rng = Math.random) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const maybe = (part, chance) => (rng() < chance ? pick(keys(part)) : null);
  const cloth = () => pick(palettes.cloth);
  const hat = maybe('hat', 0.25);
  return {
    body: pick(keys('body')),
    skin: pick(palettes.skin),
    hair: { style: pick(keys('hair')), color: pick(palettes.hair) },
    beard: maybe('beard', 0.3),
    glasses: maybe('glasses', 0.3),
    hat: hat ? { style: hat, color: cloth() } : null,
    top: { style: pick(keys('top')), color: cloth(), accent: cloth() },
    bottom: { style: pick(keys('bottom')), color: cloth() },
    shoes: { style: pick(keys('shoes')), color: cloth(), accent: cloth() },
    accessories: keys('accessories').filter(() => rng() < 0.2),
  };
}
