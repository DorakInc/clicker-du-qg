// Vérifie les fichiers de data/ : utile quand les autres volets les modifient.
// Lancer `npm test` après avoir touché un JSON.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();

function checkIds(list, file) {
  const ids = list.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${file} : identifiants en double`);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, `${file} : id « ${id} » (minuscules, chiffres, tirets)`);
}

function checkEffects(effects, where) {
  assert.ok(Array.isArray(effects), `${where} : "effects" doit être une liste`);
  for (const e of effects) {
    assert.ok(STATS.includes(e.stat), `${where} : stat inconnue « ${e.stat} » (permises : ${STATS.join(', ')})`);
    assert.ok(typeof e.multiply === 'number' && e.multiply > 0, `${where} : "multiply" doit être un nombre positif`);
  }
}

test('characters.json', () => {
  checkIds(data.characters, 'characters.json');
  for (const c of data.characters) {
    for (const key of ['name', 'strength', 'description']) assert.equal(typeof c[key], 'string', `${c.id}.${key}`);
    checkEffects(c.effects, `characters.json/${c.id}`);
  }
});

test('producers.json', () => {
  checkIds(data.producers, 'producers.json');
  for (const p of data.producers) {
    assert.ok(p.baseCost > 0 && p.costGrowth > 1 && p.beatsPerSecond > 0, `producers.json/${p.id} : nombres`);
    assert.ok(p.requiresTier >= 0 && p.requiresTier < data.tiers.length, `producers.json/${p.id} : requiresTier`);
  }
});

test('upgrades.json', () => {
  checkIds(data.upgrades, 'upgrades.json');
  for (const u of data.upgrades) {
    assert.ok(u.cost > 0, `upgrades.json/${u.id} : cost`);
    assert.ok(u.requiresTier >= 0 && u.requiresTier < data.tiers.length, `upgrades.json/${u.id} : requiresTier`);
    checkEffects(u.effects, `upgrades.json/${u.id}`);
  }
});

test('tiers.json', () => {
  checkIds(data.tiers, 'tiers.json');
  assert.equal(data.tiers[0].fansRequired, 0, 'le premier palier commence à 0 fan');
  for (let i = 1; i < data.tiers.length; i += 1) {
    assert.ok(data.tiers[i].fansRequired > data.tiers[i - 1].fansRequired, `tiers.json : ordre croissant (${data.tiers[i].id})`);
  }
  for (const t of data.tiers) checkEffects(t.effects, `tiers.json/${t.id}`);
});

test('texts.json : chaque statistique a un libellé', () => {
  for (const stat of STATS) assert.equal(typeof data.texts.stats[stat], 'string', `texts.json/stats.${stat}`);
  for (const [key, list] of Object.entries(data.texts.messages)) assert.ok(Array.isArray(list), `texts.json/messages.${key}`);
});

test('sounds.json : chemins relatifs à assets/audio', () => {
  for (const [key, list] of Object.entries(data.sounds.effects)) {
    assert.ok(Array.isArray(list), `sounds.json/effects.${key}`);
    for (const file of list) assert.match(file, /^(effets|musique)\/.+\.(mp3|ogg)$/, `sounds.json : « ${file} »`);
  }
});

test('balance.json : le fail out peut toujours se terminer', () => {
  const { fans, fail } = data.balance;
  assert.ok(
    fail.referenceDecayPerSecond > fans.churnPerSecond * fail.churnMultiplier,
    'fail.referenceDecayPerSecond doit être plus grand que fans.churnPerSecond × fail.churnMultiplier',
  );
  assert.ok(fail.enterRatio < fail.exitRatio && fail.exitRatio <= 1, 'fail : enterRatio < exitRatio <= 1');
});
