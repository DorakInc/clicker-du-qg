// La poupée de papier (src/poupee/) et les fiches personnages (scripts/personnages.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STATS } from '../src/game/index.js';
import { PARTS, DEFAULT_LOOK, VIEWS, validateLook, characterFromLook, renderSheet } from '../src/poupee/index.js';
import { slugify, validateCharacter, upsertCharacter, formatCharacters } from '../scripts/personnages.js';

const pixels = (g) => g.px.flat().filter(Boolean).length;
const signature = (look) => renderSheet(characterFromLook('t', look)).flat().map((g) => g.px.flat().join()).join('|');

test('le look de base est valide et se dessine dans les 3 vues', () => {
  assert.deepEqual(validateLook(DEFAULT_LOOK), []);
  const sheet = renderSheet(characterFromLook('t', DEFAULT_LOOK));
  assert.equal(sheet.length, VIEWS.length);
  for (const row of sheet) {
    assert.equal(row.length, 2);
    for (const g of row) assert.ok(pixels(g) > 300, 'la vue est presque vide');
  }
});

test('chaque pièce de chaque catégorie change le dessin', () => {
  const base = signature(DEFAULT_LOOK);
  const variants = {
    body: (v) => ({ body: v }),
    hair: (v) => ({ hair: { ...DEFAULT_LOOK.hair, style: v } }),
    beard: (v) => ({ beard: v }),
    glasses: (v) => ({ glasses: v }),
    hat: (v) => ({ hat: { style: v, color: '#c94d4d' } }),
    top: (v) => ({ top: { ...DEFAULT_LOOK.top, style: v } }),
    bottom: (v) => ({ bottom: { ...DEFAULT_LOOK.bottom, style: v } }),
    shoes: (v) => ({ shoes: { ...DEFAULT_LOOK.shoes, style: v } }),
    accessories: (v) => ({ accessories: [v] }),
  };
  for (const [part, make] of Object.entries(variants)) {
    for (const value of Object.keys(PARTS[part])) {
      const look = { ...DEFAULT_LOOK, ...make(value) };
      assert.deepEqual(validateLook(look), [], `${part}=${value}`);
      const sameAsBase = [DEFAULT_LOOK.body, DEFAULT_LOOK.hair.style, DEFAULT_LOOK.top.style, DEFAULT_LOOK.bottom.style, DEFAULT_LOOK.shoes.style].includes(value);
      if (!sameAsBase) assert.notEqual(signature(look), base, `${part}=${value} ne change rien au dessin`);
    }
  }
});

test('validateLook signale les pièces et couleurs inconnues', () => {
  const errors = validateLook({ ...DEFAULT_LOOK, body: 'geant', skin: 'rose', hair: { style: 'mohawk', color: '#123' }, accessories: ['cape'] });
  assert.equal(errors.length, 5, errors.join('\n'));
  assert.ok(validateLook(null).length > 0);
});

test('validateCharacter', () => {
  const ok = { id: 'lea', name: 'Léa', strength: 'Zen', description: 'Calme.', effects: [{ stat: 'cannabisDecay', multiply: 0.6 }], look: DEFAULT_LOOK };
  assert.deepEqual(validateCharacter(ok, STATS), []);
  assert.ok(validateCharacter({ ...ok, id: 'Léa !' }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, name: ' ' }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, effects: [] }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, effects: [{ stat: 'magie', multiply: 2 }] }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, effects: [{ stat: 'bps', multiply: 50 }] }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, effects: [{ stat: 'bps', multiply: 1.2 }, { stat: 'bps', multiply: 1.1 }] }, STATS).length > 0);
  assert.ok(validateCharacter({ ...ok, look: { ...DEFAULT_LOOK, top: null } }, STATS).length > 0);
  const { look, ...handDrawn } = ok;
  assert.deepEqual(validateCharacter(handDrawn, STATS), [], 'le look est facultatif');
});

test('slugify', () => {
  assert.equal(slugify('Émile Côté'), 'emile-cote');
  assert.equal(slugify('  DJ L\'Ours !! '), 'dj-l-ours');
});

test('upsertCharacter ajoute à la fin ou remplace sur place', () => {
  const list = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(upsertCharacter(list, { id: 'c' }).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(upsertCharacter(list, { id: 'a', name: 'x' }), [{ id: 'a', name: 'x' }, { id: 'b' }]);
});

test('formatCharacters garde le style de data/characters.json', () => {
  const text = fs.readFileSync(new URL('../data/characters.json', import.meta.url), 'utf8');
  assert.equal(formatCharacters(JSON.parse(text)), text, 'npm run atelier réécrirait le fichier autrement');
  const withLook = formatCharacters([{ id: 'lea', effects: [{ stat: 'bps', multiply: 1.4 }], look: DEFAULT_LOOK }]);
  assert.deepEqual(JSON.parse(withLook), [{ id: 'lea', effects: [{ stat: 'bps', multiply: 1.4 }], look: DEFAULT_LOOK }]);
  assert.match(withLook, /\n {6}"hair": \{ "style": "courte", "color": "#3a2a20" \},\n/);
});
