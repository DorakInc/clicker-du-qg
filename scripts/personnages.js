// Fiches personnages (data/characters.json) : validation, ajout et mise en forme.
// Pur JavaScript, sans Node : utilisé par l'atelier (navigateur), son serveur et les tests.

import { validateLook } from '../src/poupee/index.js';

/** « Émile Côté » → « emile-cote ». */
export function slugify(name) {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const ID_PATTERN = /^[a-z0-9-]+$/;

/** Bornes d'un multiplicateur raisonnable pour un personnage de départ. */
export const MULTIPLY_RANGE = [0.3, 3];

/**
 * Liste des problèmes d'une fiche (vide si tout va bien).
 * `stats` : les statistiques permises (STATS de src/game/modifiers.js).
 */
export function validateCharacter(character, stats) {
  const errors = [];
  if (!character || typeof character !== 'object') return ['fiche vide'];
  if (!ID_PATTERN.test(character.id ?? '')) errors.push(`id « ${character.id ?? ''} » : minuscules, chiffres et tirets seulement`);
  for (const key of ['name', 'strength', 'description']) {
    if (typeof character[key] !== 'string' || !character[key].trim()) errors.push(`${key} : texte manquant`);
  }
  if (!Array.isArray(character.effects) || character.effects.length === 0) {
    errors.push('effects : au moins un pouvoir');
  } else {
    const seen = new Set();
    for (const e of character.effects) {
      if (!stats.includes(e?.stat)) errors.push(`effects : stat inconnue « ${e?.stat} »`);
      if (seen.has(e?.stat)) errors.push(`effects : « ${e.stat} » en double`);
      seen.add(e?.stat);
      const [min, max] = MULTIPLY_RANGE;
      if (typeof e?.multiply !== 'number' || !(e.multiply >= min && e.multiply <= max)) {
        errors.push(`effects/${e?.stat} : multiplicateur entre ${min} et ${max}`);
      }
    }
  }
  if (character.look !== undefined) errors.push(...validateLook(character.look));
  return errors;
}

/** Ajoute la fiche à la fin, ou remplace celle qui a le même id (même place dans la liste). */
export function upsertCharacter(list, character) {
  const index = list.findIndex((c) => c.id === character.id);
  if (index === -1) return [...list, character];
  return list.map((c, i) => (i === index ? character : c));
}

// ---- Mise en forme, dans le style du fichier ----------------------------------------
// Un personnage par bloc, une clé par ligne ; les effets et les pièces du look sur une ligne.

function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

function block(object, indent, expand = []) {
  const pad = ' '.repeat(indent + 2);
  const lines = Object.entries(object).map(([k, v]) => {
    const body = expand.includes(k) && v && typeof v === 'object' && !Array.isArray(v) ? block(v, indent + 2) : inline(v);
    return `${pad}${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${lines.join(',\n')}\n${' '.repeat(indent)}}`;
}

export function formatCharacters(list) {
  return `[\n${list.map((c) => `  ${block(c, 2, ['look'])}`).join(',\n')}\n]\n`;
}
