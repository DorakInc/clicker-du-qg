// La « poupée de papier » : un corps de base + des pièces interchangeables,
// choisies dans la fiche `look` d'un personnage (data/characters.json).
//
//   "look": {
//     "body": "moyen",                                   mince | moyen | large
//     "skin": "#f1c6a4",
//     "hair": { "style": "boucles", "color": "#a07a52" },
//     "beard": null,                                     moustache | bouc | barbe
//     "glasses": null,                                   rondes | carrees | soleil
//     "hat": null,                                       { "style": "casquette" | "tuque", "color": ... }
//     "top": { "style": "hoodie", "color": "#5f6751", "accent": "#cdbf9f" },
//     "bottom": { "style": "jogger", "color": "#1f1f24" },
//     "shoes": { "style": "baskets", "color": "#1b1b1f", "accent": "#e8e4dc" },
//     "accessories": ["chaine"]
//   }
//
// Même code dans `npm run sprites` (Node), dans l'atelier (outils/personnage.html) et dans
// le jeu (personnages créés par les joueurs) : ce qu'on voit est exactement la planche générée.
// Aucun accès au DOM ici : tout se teste avec `npm test`.

import { Grid, W, H } from './grid.js';
import { BODIES, darken, lighten, mix, highlight } from './parts/outils.js';
import { head, face, beard, glasses, BEARDS, GLASSES } from './parts/corps.js';
import { hair, hat, HAIRS, HATS } from './parts/cheveux.js';
import { top, bottom, shoes, accessories, TOPS, BOTTOMS, SHOES, ACCESSORIES } from './parts/vetements.js';

export const VIEWS = ['front', 'side', 'back'];
export const WAIST = 30;

/** Les pièces disponibles et leur nom affiché (l'atelier construit ses menus avec). */
export const PARTS = {
  body: { mince: 'Mince', moyen: 'Moyen', large: 'Large' },
  hair: HAIRS,
  beard: BEARDS,
  glasses: GLASSES,
  hat: HATS,
  top: TOPS,
  bottom: BOTTOMS,
  shoes: SHOES,
  accessories: ACCESSORIES,
};

export const DEFAULT_LOOK = {
  body: 'moyen',
  skin: '#f1c6a4',
  hair: { style: 'courte', color: '#3a2a20' },
  beard: null,
  glasses: null,
  hat: null,
  top: { style: 'hoodie', color: '#5b4b8a', accent: '#e8e4dc' },
  bottom: { style: 'jean', color: '#2a3558' },
  shoes: { style: 'baskets', color: '#e8e4dc', accent: '#b9b4a8' },
  accessories: [],
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Liste des problèmes d'une fiche `look` (vide si tout va bien). */
export function validateLook(look) {
  const errors = [];
  if (!look || typeof look !== 'object') return ['"look" doit être un objet'];
  const color = (value, where) => { if (!HEX.test(value ?? '')) errors.push(`${where} : couleur « ${value} » (format #rrggbb)`); };
  const style = (value, part, where) => {
    if (!(value in PARTS[part])) errors.push(`${where} : « ${value} » inconnu (permis : ${Object.keys(PARTS[part]).join(', ')})`);
  };
  style(look.body, 'body', 'look.body');
  color(look.skin, 'look.skin');
  for (const part of ['hair', 'top', 'bottom', 'shoes']) {
    if (!look[part] || typeof look[part] !== 'object') { errors.push(`look.${part} manquant`); continue; }
    style(look[part].style, part, `look.${part}.style`);
    color(look[part].color, `look.${part}.color`);
  }
  for (const part of ['top', 'shoes']) if (look[part]) color(look[part].accent, `look.${part}.accent`);
  for (const part of ['beard', 'glasses']) if (look[part] != null) style(look[part], part, `look.${part}`);
  if (look.hat != null) {
    style(look.hat.style, 'hat', 'look.hat.style');
    color(look.hat.color, 'look.hat.color');
  }
  if (look.accessories != null) {
    if (!Array.isArray(look.accessories)) errors.push('look.accessories doit être une liste');
    else for (const a of look.accessories) style(a, 'accessories', 'look.accessories');
  }
  return errors;
}

/** Toutes les teintes dérivées des couleurs de la fiche (ombres, reflets). */
function palette(look) {
  const tone = (c) => ({ base: c, dark: darken(c, 0.22), light: highlight(c, 0.2), mid: mix(c, highlight(c, 0.5), 0.3) });
  const t = look.top;
  return {
    skin: { base: look.skin, shade: darken(look.skin, 0.12), mouth: mix(look.skin, '#9a3b33', 0.45), eye: '#2b1d1a' },
    hair: { base: look.hair.color, light: lighten(look.hair.color, 0.22), dark: darken(look.hair.color, 0.3) },
    top: { ...tone(t.color), accent: t.accent, accentDark: darken(t.accent, 0.2), zip: darken(t.color, 0.38), inner: darken(t.color, 0.55) },
    bottom: tone(look.bottom.color),
    shoes: { ...tone(look.shoes.color), sole: look.shoes.accent },
    hat: look.hat ? tone(look.hat.color) : null,
  };
}

/** Dessine une vue complète de la poupée dans la grille `g` (32 × 48). */
export function drawLook(g, look, view) {
  const ctx = { look, p: palette(look), body: BODIES[look.body] ?? BODIES.moyen };
  // Un baggy tombe sur les chaussures ; les autres bas passent dessous.
  const legs = look.bottom.style === 'baggy' ? [shoes, bottom] : [bottom, shoes];
  for (const part of [...legs, head, top, face, beard, hair, hat, glasses, accessories]) part(g, view, ctx);
}

/** Un personnage au même format que ceux dessinés à la main (scripts/sprites/characters.js). */
export function characterFromLook(id, look) {
  return Object.fromEntries([['id', id], ...VIEWS.map((view) => [view, (g) => drawLook(g, look, view)])]);
}

/** Une image de la planche : vue, image 0 (repos) ou 1 (respiration), avec contour. */
export function renderFrame(character, view, frame) {
  const g = new Grid(W, H);
  character[view](g);
  if (frame === 1) g.bob(WAIST);
  g.outline();
  return g;
}

/** La planche entière : 3 lignes (face, profil, dos) × 2 images. */
export function renderSheet(character) {
  return VIEWS.map((view) => [renderFrame(character, view, 0), renderFrame(character, view, 1)]);
}
