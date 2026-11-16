// L'éditeur de studio (src/game/studio.js) et data/decor.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STATS, SOURCES, SURFACES, areAdjacent, autoPlace, canPlace, createState, decorDef, deserialize, findSpot, footprint,
  getModifiers, inventory, moveItem, placeItem, placedEntry, rotateItem, serialize, storeItem, syncStudio, vibeEffects,
  vibeStatus,
} from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();
const DECO = data.decor.items.filter((d) => d.source === 'deco').map((d) => d.id);

function newState() {
  return createState(data, data.characters[0].id, 0);
}

/** Une partie avancée, commencée avant l'éditeur : tout est acheté, aucun plan. */
function advancedState() {
  const state = newState();
  for (const u of data.upgrades) state.upgrades[u.id] = true;
  for (const p of data.producers) state.producers[p.id] = 12;
  return state;
}

// ---- Données ----

test('decor.json : objets valides et liés aux données du jeu', () => {
  const { room, items } = data.decor;
  assert.ok(Number.isInteger(room.width) && room.width >= 4, 'room.width');
  assert.ok(Number.isInteger(room.depth) && room.depth >= 4, 'room.depth');
  const ids = items.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'decor.json : identifiants en double');
  for (const d of items) {
    const where = `decor.json/${d.id}`;
    assert.match(d.id, /^[a-z0-9-]+$/, `${where} : id`);
    assert.ok(SOURCES.includes(d.source), `${where} : source (permises : ${SOURCES.join(', ')})`);
    assert.ok(SURFACES.includes(d.surface), `${where} : surface (permises : ${SURFACES.join(', ')})`);
    assert.ok([1, 2, 4].includes(d.rotations), `${where} : rotations vaut 1, 2 ou 4`);
    assert.ok(Array.isArray(d.footprint) && d.footprint.length === 2, `${where} : footprint [largeur, profondeur]`);
    assert.ok(d.footprint.every((n) => Number.isInteger(n) && n >= 1), `${where} : footprint en tuiles entières`);
    assert.ok(d.footprint[0] <= Math.min(room.width, room.depth) && d.footprint[1] <= Math.min(room.width, room.depth), `${where} : plus grand que la pièce`);
    if (d.surface === 'mur') assert.equal(d.footprint[1], 1, `${where} : un objet mural a une profondeur de 1`);
    assert.match(d.color, /^#[0-9a-f]{6}$/i, `${where} : color (#rrggbb)`);
    assert.ok(d.height > 0, `${where} : height`);
    if (d.sprite !== undefined) {
      assert.match(d.sprite, /^[a-z0-9/-]+\.png$/, `${where} : sprite relatif à assets/images`);
      assert.ok(fs.existsSync(new URL(`../assets/images/${d.sprite}`, import.meta.url)), `${where} : assets/images/${d.sprite} n'existe pas`);
    }
    const list = { upgrade: data.upgrades, producer: data.producers, pet: data.pets }[d.source];
    if (list) assert.ok(list.some((x) => x.id === d.id), `${where} : aucun ${d.source} avec cet id`);
    else assert.equal(typeof d.name, 'string', `${where} : un objet déco a besoin d'un "name"`);
  }
});

test('decor.json : chaque amélioration a son objet', () => {
  for (const u of data.upgrades) assert.ok(decorDef(data, u.id), `upgrades.json/${u.id} n'a pas d'objet dans decor.json`);
});

test('decor.json : une partie complète tient dans la pièce', () => {
  const state = advancedState();
  syncStudio(state, data);
  assert.equal(state.studio.stored.length, 0, `restent dans l'inventaire : ${state.studio.stored.join(', ')}`);
});

// ---- Placement ----

test('nouvelle partie : seule la déco est possédée', () => {
  const state = newState();
  assert.deepEqual(inventory(state, data).map((d) => d.id), DECO);
  assert.equal(canPlace(state, data, 'canape', 3, 3, 0), false, 'pas encore acheté');
});

test('placer : limites de la pièce et chevauchement', () => {
  const state = newState();
  state.upgrades.canape = true; // 2 × 1
  state.upgrades['chaise-gamer'] = true;
  const { width, depth } = data.decor.room;
  assert.equal(canPlace(state, data, 'canape', width - 1, 0, 0), false, 'dépasse à droite');
  assert.equal(canPlace(state, data, 'canape', -1, 0, 0), false, 'hors de la pièce');
  assert.equal(canPlace(state, data, 'canape', 1.5, 0, 0), false, 'pas une tuile entière');
  assert.equal(canPlace(state, data, 'canape', width - 2, depth - 1, 0), true);
  assert.ok(placeItem(state, data, 'canape', 2, 2, 0));
  assert.equal(placeItem(state, data, 'canape', 5, 5, 0), false, 'déjà posé');
  assert.equal(canPlace(state, data, 'chaise-gamer', 3, 2, 0), false, 'sur le canapé');
  assert.equal(canPlace(state, data, 'chaise-gamer', 4, 2, 0), true, 'à côté du canapé');
  assert.ok(placeItem(state, data, 'chaise-gamer', 4, 2, 0));
  assert.equal(inventory(state, data).some((d) => d.id === 'canape'), false);
});

test('surface : un objet mural va au mur, pas au sol', () => {
  const state = newState();
  state.upgrades.neons = true; // mural, 2 de large
  state.upgrades['panneaux-acoustiques'] = true;
  assert.equal(canPlace(state, data, 'neons', 3, 3, 0), false, 'au milieu du sol');
  assert.equal(canPlace(state, data, 'neons', 2, 0, 0), true, 'mur de droite (y = 0)');
  assert.equal(canPlace(state, data, 'neons', 0, 2, 1), true, 'mur de gauche (x = 0)');
  assert.equal(canPlace(state, data, 'neons', 0, 2, 0), false, 'rot 0 = mur de droite seulement');
  placeItem(state, data, 'neons', 2, 0, 0);
  assert.equal(canPlace(state, data, 'panneaux-acoustiques', 3, 0, 0), false, 'chevauche les néons');
  assert.equal(canPlace(state, data, 'panneaux-acoustiques', 0, 3, 1), true, "l'autre mur est libre");
  // Le sol et le mur ne se gênent pas : un objet au sol peut se mettre sous un objet mural.
  state.upgrades.canape = true;
  assert.equal(canPlace(state, data, 'canape', 2, 0, 0), true);
});

test('rotation : la largeur et la profondeur s\'échangent', () => {
  const state = newState();
  state.upgrades.canape = true;
  const def = decorDef(data, 'canape');
  assert.deepEqual(footprint(def, 0), [2, 1]);
  assert.deepEqual(footprint(def, 1), [1, 2]);
  placeItem(state, data, 'canape', 0, 6, 0);
  assert.ok(rotateItem(state, data, 'canape'));
  assert.deepEqual(placedEntry(state, 'canape'), { id: 'canape', x: 0, y: 6, rot: 1 });
  assert.ok(rotateItem(state, data, 'canape'), 'rotations: 2 → on revient à 0');
  assert.equal(placedEntry(state, 'canape').rot, 0);
  // Contre le bord : la rotation déborderait de la pièce, elle est refusée.
  moveItem(state, data, 'canape', 0, 7, 0);
  assert.equal(rotateItem(state, data, 'canape'), false);
  assert.equal(placedEntry(state, 'canape').rot, 0);
});

test('rotation : un objet sans rotation reste tel quel ; un objet mural change de mur', () => {
  const state = newState();
  state.upgrades.vaporisateur = true;
  state.upgrades.neons = true;
  placeItem(state, data, 'vaporisateur', 3, 3, 0);
  assert.equal(rotateItem(state, data, 'vaporisateur'), false);
  placeItem(state, data, 'neons', 4, 0, 0);
  assert.ok(rotateItem(state, data, 'neons'));
  assert.deepEqual(placedEntry(state, 'neons'), { id: 'neons', x: 0, y: 4, rot: 1 });
  assert.ok(rotateItem(state, data, 'neons'));
  assert.deepEqual(placedEntry(state, 'neons'), { id: 'neons', x: 4, y: 0, rot: 0 });
});

test('déplacer : on peut chevaucher sa propre place, pas celle des autres', () => {
  const state = newState();
  state.upgrades.canape = true;
  state.upgrades.casque = true;
  placeItem(state, data, 'canape', 2, 2, 0);
  placeItem(state, data, 'casque', 5, 5, 0);
  assert.ok(moveItem(state, data, 'canape', 3, 2), 'glisse d\'une case sur sa propre place');
  assert.equal(moveItem(state, data, 'canape', 4, 5), false, 'sur le casque');
  assert.deepEqual(placedEntry(state, 'canape'), { id: 'canape', x: 3, y: 2, rot: 0 });
  assert.equal(moveItem(state, data, 'cabine', 0, 0), false, 'pas posé');
});

test('ranger : l\'objet retourne dans l\'inventaire et n\'est plus reposé tout seul', () => {
  const state = newState();
  state.upgrades.canape = true;
  syncStudio(state, data);
  assert.ok(placedEntry(state, 'canape'));
  assert.ok(storeItem(state, data, 'canape'));
  assert.equal(placedEntry(state, 'canape'), null);
  assert.ok(inventory(state, data).some((d) => d.id === 'canape'));
  assert.deepEqual(syncStudio(state, data), [], 'rangé exprès : on le laisse dans le tiroir');
  assert.equal(storeItem(state, data, 'canape'), false, 'déjà rangé');
  // Le reposer le sort des objets rangés.
  assert.ok(placeItem(state, data, 'canape', 4, 4, 0));
  assert.equal(state.studio.stored.includes('canape'), false);
});

// ---- Pose automatique ----

test('autoPlace : un achat apparaît tout de suite, le long des murs du fond', () => {
  const state = newState();
  state.upgrades.canape = true;
  assert.ok(autoPlace(state, data, 'canape'));
  const entry = placedEntry(state, 'canape');
  assert.ok(Math.min(entry.x, entry.y) === 0, `contre un mur du fond : ${JSON.stringify(entry)}`);
  assert.equal(autoPlace(state, data, 'canape'), false, 'déjà posé');
});

test('autoPlace : pièce pleine → l\'objet attend dans l\'inventaire', () => {
  const state = newState();
  // On remplit le sol avec de faux objets 1 × 1.
  const { width, depth } = data.decor.room;
  const filler = { id: 'bloc', source: 'deco', name: 'Bloc', footprint: [1, 1], surface: 'sol', rotations: 1, height: 4, color: '#000000' };
  const blocks = [];
  for (let x = 0; x < width; x += 1) for (let y = 0; y < depth; y += 1) blocks.push({ ...filler, id: `bloc-${x}-${y}` });
  const full = { ...data, decor: { ...data.decor, items: [...data.decor.items, ...blocks] } };
  for (const b of blocks) assert.ok(autoPlace(state, full, b.id));
  state.upgrades.canape = true;
  assert.equal(findSpot(state, full, 'canape'), null);
  const events = syncStudio(state, full);
  assert.ok(events.some((e) => e.type === 'studioFull' && e.id === 'canape'));
  assert.ok(state.studio.stored.includes('canape'));
});

test('syncStudio : un achat récent est posé et annoncé', () => {
  const state = newState();
  syncStudio(state, data); // la déco de départ
  state.upgrades.casque = true;
  const events = syncStudio(state, data);
  assert.deepEqual(events.map((e) => [e.type, e.id]), [['studioPlaced', 'casque']]);
  assert.deepEqual(syncStudio(state, data), [], 'rien de nouveau');
});

// ---- Joueurs avancés (parties commencées avant l'éditeur) ----

test('vieille sauvegarde sans plan : tous les objets déjà possédés sont installés', () => {
  const old = advancedState();
  delete old.studio; // sauvegarde d'avant l'éditeur
  const state = deserialize(JSON.stringify(old), data);
  assert.ok(state, 'la sauvegarde est relue');
  assert.deepEqual(state.studio, { layout: [], stored: [] });

  const events = syncStudio(state, data);
  const placed = new Set(events.filter((e) => e.type === 'studioPlaced').map((e) => e.id));
  for (const u of data.upgrades) assert.ok(placed.has(u.id), `amélioration ${u.id} installée`);
  for (const d of data.decor.items.filter((x) => x.source === 'producer')) assert.ok(placed.has(d.id), `producteur ${d.id} installé`);
  for (const entry of state.studio.layout) {
    assert.ok(canPlace(state, data, entry.id, entry.x, entry.y, entry.rot), `${entry.id} bien placé`);
  }
  // Et le plan survit à l'aller-retour de la sauvegarde.
  const again = deserialize(serialize(state), data);
  assert.deepEqual(again.studio, state.studio);
});

test('un producteur ou un animal non physique n\'entre pas dans la pièce', () => {
  const state = newState();
  state.producers['ami-beatmaker'] = 3; // pas d'objet dans decor.json
  assert.deepEqual(syncStudio(state, data).map((e) => e.id), DECO);
});

// ---- Réparation d'une sauvegarde abîmée ----

test('deserialize répare un plan abîmé', () => {
  const state = newState();
  state.upgrades.canape = true;
  state.upgrades.casque = true;
  state.upgrades.neons = true;
  const saved = JSON.parse(serialize(state));
  saved.studio = {
    layout: [
      { id: 'canape', x: 2, y: 2, rot: 0 }, // correct
      { id: 'casque', x: 3, y: 2, rot: 0 }, // sur le canapé → inventaire
      { id: 'canape', x: 5, y: 5, rot: 0 }, // en double → ignoré
      { id: 'objet-inconnu', x: 0, y: 0, rot: 0 }, // inconnu → disparaît
      { id: 'cabine', x: 4, y: 4, rot: 0 }, // pas acheté → disparaît
      { id: 'neons', x: 3, y: 3, rot: 0 }, // mural au milieu du sol → inventaire
      null,
      'n importe quoi',
    ],
    stored: ['casque', 'objet-inconnu', 42],
  };
  const repaired = deserialize(JSON.stringify(saved), data);
  assert.deepEqual(repaired.studio.layout, [{ id: 'canape', x: 2, y: 2, rot: 0 }]);
  assert.deepEqual(repaired.studio.stored.sort(), ['casque', 'neons']);
});

test('deserialize : un plan qui n\'est pas un objet repart à vide', () => {
  for (const studio of [null, 'texte', 12, [1, 2]]) {
    const saved = JSON.parse(serialize(newState()));
    saved.studio = studio;
    const state = deserialize(JSON.stringify(saved), data);
    assert.ok(state, `studio = ${JSON.stringify(studio)}`);
    assert.deepEqual(state.studio, { layout: [], stored: [] });
  }
});

test('un plan complet pèse quelques centaines d\'octets', () => {
  const state = advancedState();
  syncStudio(state, data);
  assert.ok(JSON.stringify(state.studio).length < 2000);
});

// ---- Vibe du studio (bonus quand deux objets sont côte à côte) ----

test('decor.json : combos de vibe valides', () => {
  const ids = data.decor.vibe.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, 'vibe : identifiants en double');
  for (const v of data.decor.vibe) {
    const where = `decor.json/vibe/${v.id}`;
    assert.match(v.id, /^[a-z0-9-]+$/, `${where} : id`);
    assert.equal(typeof v.name, 'string', `${where} : name`);
    assert.ok(Array.isArray(v.items) && v.items.length === 2 && v.items[0] !== v.items[1], `${where} : items = deux objets différents`);
    for (const id of v.items) assert.ok(decorDef(data, id), `${where} : objet inconnu « ${id} »`);
    assert.ok(v.effects.length > 0, `${where} : effects`);
    for (const e of v.effects) {
      assert.ok(STATS.includes(e.stat), `${where} : stat inconnue « ${e.stat} »`);
      // Garde-fou d'équilibrage : la vibe est un petit plus, pas un multiplicateur d'amélioration.
      assert.ok(e.multiply >= 0.85 && e.multiply <= 1.15, `${where} : ${e.multiply} sort de 0,85 à 1,15`);
    }
  }
});

test('vibe : deux objets au sol qui se touchent (côté ou coin)', () => {
  const state = newState();
  state.upgrades.moniteurs = true; // 2 × 1
  state.upgrades['console-analogique'] = true; // 2 × 1
  placeItem(state, data, 'moniteurs', 2, 3, 0); // x 2..3, y 3
  placeItem(state, data, 'console-analogique', 2, 5, 0); // une rangée vide entre les deux
  assert.equal(areAdjacent(state, data, 'moniteurs', 'console-analogique'), false);
  assert.deepEqual(vibeEffects(state, data), []);
  moveItem(state, data, 'console-analogique', 2, 4); // collés par le côté
  assert.ok(areAdjacent(state, data, 'moniteurs', 'console-analogique'));
  moveItem(state, data, 'console-analogique', 4, 4); // par le coin
  assert.ok(areAdjacent(state, data, 'moniteurs', 'console-analogique'));
  const mix = vibeStatus(state, data).find((s) => s.vibe.id === 'poste-de-mix');
  assert.ok(mix.active && mix.owned);
  assert.ok(vibeEffects(state, data).some((e) => e.stat === 'beatValue'));
});

test('vibe : un objet mural touche ce qui est posé contre son mur', () => {
  const state = newState();
  state.upgrades.canape = true;
  state.upgrades.neons = true;
  placeItem(state, data, 'neons', 3, 0, 0); // mur de droite, x 3..4
  placeItem(state, data, 'canape', 3, 1, 0); // une rangée devant le mur
  assert.equal(areAdjacent(state, data, 'canape', 'neons'), false);
  moveItem(state, data, 'canape', 4, 0); // contre le mur, sous les néons
  assert.ok(areAdjacent(state, data, 'canape', 'neons'));
  moveItem(state, data, 'canape', 6, 0); // contre le mur, mais plus loin
  assert.equal(areAdjacent(state, data, 'canape', 'neons'), false);
  // Mur de gauche.
  rotateItem(state, data, 'neons'); // → x = 0, y = 3
  moveItem(state, data, 'canape', 0, 4, 1); // 1 × 2 contre le mur de gauche
  assert.ok(areAdjacent(state, data, 'canape', 'neons'));
});

test('vibe : deux cadres de part et d\'autre du coin se touchent', () => {
  const state = newState();
  state.producers['studio-lunaire'] = 1;
  state.producers['station-orbitale'] = 1;
  placeItem(state, data, 'studio-lunaire', 0, 0, 0); // mur de droite, dans le coin
  placeItem(state, data, 'station-orbitale', 0, 0, 1); // mur de gauche, dans le coin
  assert.ok(areAdjacent(state, data, 'studio-lunaire', 'station-orbitale'));
});

test('vibe : le bonus entre dans les multiplicateurs, et disparaît si on range', () => {
  const state = newState();
  state.upgrades.moniteurs = true;
  state.upgrades['console-analogique'] = true;
  placeItem(state, data, 'moniteurs', 2, 3, 0);
  placeItem(state, data, 'console-analogique', 2, 4, 0);
  const withVibe = getModifiers(state, data).beatValue;
  storeItem(state, data, 'console-analogique');
  const without = getModifiers(state, data).beatValue;
  assert.ok(Math.abs(withVibe / without - 1.05) < 1e-9, `${withVibe} / ${without}`);
});

test('vibe : un combo dont il manque un objet n\'est pas « possible »', () => {
  const state = newState();
  state.upgrades.moniteurs = true;
  const mix = vibeStatus(state, data).find((s) => s.vibe.id === 'poste-de-mix');
  assert.equal(mix.owned, false);
  assert.equal(mix.active, false);
});
