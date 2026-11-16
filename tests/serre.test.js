// La serre isométrique (serreRoom, src/game/studio.js) et le "decor" de data/greenhouse.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOMS, STATS, SURFACES, createState, deserialize, getModifiers, serialize, serreRoom, syncStudio } from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();
const decor = data.greenhouse.decor;
const DECO = decor.items.filter((d) => d.source === 'deco').map((d) => d.id);

function newState() {
  return createState(data, data.characters[0].id, 0);
}

function openState() {
  const state = newState();
  state.greenhouseUnlocked = true;
  return state;
}

/** Une serre au complet : tout l'équipement acheté plusieurs fois, toutes les variétés. */
function fullState() {
  const state = openState();
  for (const e of data.greenhouse.equipment) state.equipment[e.id] = 25;
  for (const s of data.greenhouse.strains) state.strains[s.id] = 3;
  return state;
}

// ---- Données ----

test('greenhouse.json/decor : objets valides et liés à l\'équipement et aux variétés', () => {
  const { room, items } = decor;
  assert.ok(Number.isInteger(room.width) && room.width >= 4, 'room.width');
  assert.ok(Number.isInteger(room.depth) && room.depth >= 4, 'room.depth');
  const ids = items.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants en double');
  for (const d of items) {
    const where = `greenhouse.json/decor/${d.id}`;
    assert.match(d.id, /^[a-z0-9-]+$/, `${where} : id`);
    assert.ok(ROOMS.serre.sources.includes(d.source), `${where} : source (permises : ${ROOMS.serre.sources.join(', ')})`);
    assert.ok(SURFACES.includes(d.surface), `${where} : surface`);
    assert.ok([1, 2, 4].includes(d.rotations), `${where} : rotations vaut 1, 2 ou 4`);
    assert.ok(d.footprint.every((n) => Number.isInteger(n) && n >= 1), `${where} : footprint en tuiles entières`);
    if (d.surface === 'mur') assert.equal(d.footprint[1], 1, `${where} : un objet mural a une profondeur de 1`);
    assert.match(d.color, /^#[0-9a-f]{6}$/i, `${where} : color`);
    assert.ok(d.height > 0, `${where} : height`);
    if (d.sprite !== undefined) {
      assert.ok(fs.existsSync(new URL(`../assets/images/${d.sprite}`, import.meta.url)), `${where} : assets/images/${d.sprite} n'existe pas`);
    }
    const list = { equipment: data.greenhouse.equipment, strain: data.greenhouse.strains }[d.source];
    if (list) assert.ok(list.some((x) => x.id === d.id), `${where} : aucun ${d.source} avec cet id`);
    else assert.equal(typeof d.name, 'string', `${where} : un objet déco a besoin d'un "name"`);
  }
});

test('greenhouse.json/decor : chaque équipement et chaque variété a son objet', () => {
  for (const e of data.greenhouse.equipment) assert.ok(serreRoom.decorDef(data, e.id), `équipement ${e.id} sans objet`);
  for (const s of data.greenhouse.strains) assert.ok(serreRoom.decorDef(data, s.id), `variété ${s.id} sans objet`);
});

test('greenhouse.json/decor : combos de vibe valides', () => {
  const ids = decor.vibe.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, 'vibe : identifiants en double');
  for (const v of decor.vibe) {
    const where = `greenhouse.json/decor/vibe/${v.id}`;
    assert.ok(v.items.length === 2 && v.items[0] !== v.items[1], `${where} : deux objets différents`);
    for (const id of v.items) assert.ok(serreRoom.decorDef(data, id), `${where} : objet inconnu « ${id} »`);
    for (const e of v.effects) {
      assert.ok(STATS.includes(e.stat), `${where} : stat inconnue « ${e.stat} »`);
      assert.ok(e.multiply >= 0.85 && e.multiply <= 1.15, `${where} : ${e.multiply} sort de 0,85 à 1,15`);
    }
  }
});

test('une serre complète tient dans la pièce', () => {
  const state = fullState();
  serreRoom.sync(state, data);
  assert.equal(state.serre.stored.length, 0, `restent dans l'inventaire : ${state.serre.stored.join(', ')}`);
  assert.equal(state.serre.layout.length, decor.items.length);
});

// ---- Ouverture ----

test('serre fermée : rien à poser, même la déco', () => {
  const state = newState();
  state.equipment['pot-de-yogourt'] = 2; // impossible en vrai, mais la pièce reste fermée
  assert.deepEqual(serreRoom.inventory(state, data), []);
  assert.deepEqual(serreRoom.sync(state, data), []);
  assert.equal(serreRoom.canPlace(state, data, 'arrosoir', 3, 3, 0), false);
});

test('serre ouverte : la déco s\'installe, puis chaque achat', () => {
  const state = openState();
  const first = serreRoom.sync(state, data);
  assert.deepEqual(first.map((e) => e.id), DECO);
  assert.ok(first.every((e) => e.type === 'serrePlaced' && e.room === 'serre'));
  state.equipment['tente-culture'] = 1;
  assert.deepEqual(serreRoom.sync(state, data).map((e) => [e.type, e.id]), [['serrePlaced', 'tente-culture']]);
  state.equipment['tente-culture'] = 7; // racheter ne pose pas un deuxième exemplaire
  state.strains['kush-du-sous-sol'] = 1;
  assert.deepEqual(serreRoom.sync(state, data).map((e) => e.id), ['kush-du-sous-sol']);
});

test('les deux pièces sont indépendantes', () => {
  const state = openState();
  state.upgrades.canape = true;
  serreRoom.sync(state, data);
  assert.equal(state.serre.layout.some((e) => e.id === 'canape'), false, 'le canapé n\'entre pas dans la serre');
  syncStudio(state, data);
  assert.equal(state.studio.layout.some((e) => e.id === 'arrosoir'), false, 'l\'arrosoir n\'entre pas au studio');
  // Même place (x, y) dans les deux pièces : aucun conflit.
  const a = state.serre.layout[0];
  assert.ok(serreRoom.moveItem(state, data, a.id, 5, 5, 0));
  assert.ok(state.studio.layout.length > 0);
});

// ---- Vibe ----

test('vibe de la serre : le combo entre dans les multiplicateurs, et disparaît si on range', () => {
  const state = openState();
  state.equipment['pot-de-yogourt'] = 1;
  assert.ok(serreRoom.placeItem(state, data, 'pot-de-yogourt', 3, 3, 0));
  assert.ok(serreRoom.placeItem(state, data, 'arrosoir', 4, 3, 0));
  const combo = serreRoom.vibeStatus(state, data).find((s) => s.vibe.id === 'coin-semis');
  assert.ok(combo.active && combo.owned);
  const withVibe = getModifiers(state, data).harvest;
  serreRoom.storeItem(state, data, 'arrosoir');
  const without = getModifiers(state, data).harvest;
  assert.ok(Math.abs(withVibe / without - 1.1) < 1e-9, `${withVibe} / ${without}`);
});

test('vibe de la serre : un objet mural touche ce qui est posé contre son mur', () => {
  const state = openState();
  state.equipment['lampe-del'] = 1;
  state.equipment['tente-culture'] = 1;
  serreRoom.placeItem(state, data, 'lampe-del', 2, 0, 0);
  serreRoom.placeItem(state, data, 'tente-culture', 3, 0, 0);
  assert.ok(serreRoom.areAdjacent(state, data, 'lampe-del', 'tente-culture'));
  assert.ok(getModifiers(state, data).grow > 1);
});

// ---- Sauvegarde ----

test('vieille sauvegarde sans plan de serre : tout ce qui est possédé s\'installe', () => {
  const old = fullState();
  delete old.serre;
  const state = deserialize(JSON.stringify(old), data);
  assert.ok(state);
  assert.deepEqual(state.serre, { layout: [], stored: [] });
  const placed = new Set(serreRoom.sync(state, data).map((e) => e.id));
  for (const e of data.greenhouse.equipment) assert.ok(placed.has(e.id), `${e.id} installé`);
  const again = deserialize(serialize(state), data);
  assert.deepEqual(again.serre, state.serre);
});

test('deserialize répare un plan de serre abîmé', () => {
  const state = openState();
  state.equipment['tente-culture'] = 1;
  const saved = JSON.parse(serialize(state));
  saved.serre = {
    layout: [
      { id: 'tente-culture', x: 2, y: 2, rot: 0 }, // correct (2 × 2)
      { id: 'arrosoir', x: 3, y: 3, rot: 0 }, // dans la tente → inventaire
      { id: 'canape', x: 6, y: 6, rot: 0 }, // un objet du studio → disparaît
      { id: 'ferme-lunaire', x: 5, y: 5, rot: 0 }, // pas achetée → disparaît
    ],
    stored: 'pas une liste',
  };
  const repaired = deserialize(JSON.stringify(saved), data);
  assert.deepEqual(repaired.serre.layout, [{ id: 'tente-culture', x: 2, y: 2, rot: 0 }]);
  assert.deepEqual(repaired.serre.stored, ['arrosoir']);
});
