// Création de personnage par le joueur : talents, signe particulier, nom, look encodé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { PARTS, validateLook } from '../src/poupee/index.js';
import { encodeLook, decodeLook, randomLook, CODE_LENGTH } from '../src/poupee/code.js';
import { scoreFromState } from '../src/online/rules.js';
import { loadData } from './helpers.js';

const data = loadData();
const C = data.creation;

/** Suite de nombres « au hasard » répétable. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const look = randomLook(C.palettes, seeded(7));
const customId = `p-${encodeLook(look, C.palettes)}`;

test('creation.json : talents, signes particuliers, palettes', () => {
  assert.ok(Number.isInteger(C.points) && C.points > 0);
  assert.ok(Number.isInteger(C.maxPerSkill) && C.maxPerSkill > 0);
  const ids = [...C.skills.map((s) => s.id), ...C.traits.list.map((t) => t.id)];
  assert.equal(new Set(ids).size, ids.length, 'identifiants en double');
  for (const s of C.skills) {
    assert.ok(g.STATS.includes(s.stat), `talent ${s.id} : stat ${s.stat}`);
    assert.ok(g.skillMultiply(s, C.maxPerSkill) > 0, `talent ${s.id} : au maximum, la stat tomberait à 0`);
    for (const key of ['name', 'icon', 'description']) assert.equal(typeof s[key], 'string', `${s.id}.${key}`);
  }
  assert.ok(C.traits.offer <= C.traits.list.length);
  for (const t of C.traits.list) {
    for (const e of t.effects) assert.ok(g.STATS.includes(e.stat) && e.multiply > 0, `signe ${t.id}`);
  }
  for (const [name, list] of Object.entries(C.palettes)) {
    assert.ok(list.length > 0 && list.length <= 36, `palette ${name} : de 1 à 36 couleurs (un caractère du code)`);
    for (const c of list) assert.match(c, /^#[0-9a-f]{6}$/i, `palette ${name}`);
  }
  for (const [part, choices] of Object.entries(PARTS)) assert.ok(Object.keys(choices).length < 36, `PARTS.${part} : 35 choix au plus`);
  for (let i = 0; i < 50; i += 1) assert.ok(g.NAME_PATTERN.test(g.randomName(C, seeded(i + 1))));
});

test('le look tient dans l\'identifiant et se relit à l\'identique', () => {
  for (let i = 1; i <= 200; i += 1) {
    const l = randomLook(C.palettes, seeded(i));
    assert.deepEqual(validateLook(l), []);
    const code = encodeLook(l, C.palettes);
    assert.equal(code.length, CODE_LENGTH);
    assert.ok(g.isCustomId(`p-${code}`));
    assert.match(`p-${code}`, /^[a-z0-9-]{1,32}$/, 'refusé par le classement en ligne');
    const back = decodeLook(code, C.palettes);
    assert.deepEqual(back, { ...l, hat: l.hat ?? null });
  }
  assert.equal(encodeLook({ ...look, skin: '#123456' }, C.palettes), null, 'couleur hors palette');
  assert.equal(decodeLook('zzzzzzzzzzzzzzzzz', C.palettes), null);
  assert.equal(decodeLook('abc', C.palettes), null);
});

test('talents : le budget, le maximum par talent, les points du signe particulier', () => {
  const build = { name: 'DJ Caribou', skills: { melodie: 5, charisme: 5 }, trait: '' };
  assert.deepEqual(g.buildErrors(build, C), []);
  assert.ok(g.buildErrors({ ...build, skills: { melodie: 6 } }, C).length > 0, 'plus que le maximum');
  assert.ok(g.buildErrors({ ...build, skills: { melodie: 5, charisme: 5, flow: 1 } }, C).length > 0, 'budget dépassé');
  assert.deepEqual(g.buildErrors({ ...build, skills: { melodie: 5, charisme: 5, flow: 2 }, trait: 'touche-a-tout' }, C), [], '+2 points');
  assert.ok(g.buildErrors({ ...build, name: 'x' }, C).length > 0, 'nom trop court');
  assert.ok(g.buildErrors({ ...build, skills: { magie: 1 } }, C).length > 0, 'talent inconnu');
});

test('effets : talents et signe particulier se combinent par stat', () => {
  const effects = g.buildEffects({ name: 'a', skills: { melodie: 5, prod: 2 }, trait: 'couche-tard' }, C);
  const of = (stat) => effects.find((e) => e.stat === stat)?.multiply;
  assert.equal(of('beatValue'), 1.25);
  assert.equal(of('bps'), Math.round(1.12 * 1.15 * 10000) / 10000);
  assert.equal(of('fanGain'), 0.92);
  assert.equal(g.buildEffects({ name: 'a', skills: { zen: 5 } }, C).find((e) => e.stat === 'cannabisDecay').multiply, 0.6);
  assert.deepEqual(g.buildEffects(g.emptyBuild(), C), []);
});

test('hasard : répartition complète, offre de signes sans doublon, relance différente', () => {
  for (let i = 1; i <= 30; i += 1) {
    const skills = g.randomSkills(C, C.points, seeded(i));
    assert.equal(g.spentPoints(skills), C.points);
    assert.ok(Object.values(skills).every((n) => n <= C.maxPerSkill));
    const offer = g.offerTraits(C, seeded(i));
    assert.equal(new Set(offer).size, C.traits.offer);
    const again = g.offerTraits(C, seeded(i + 100), offer);
    assert.ok(again.every((id) => !offer.includes(id)), 'la relance propose d\'autres signes');
  }
});

test('repairBuild : ramène au maximum, retire l\'inconnu, jamais de points en trop', () => {
  assert.deepEqual(g.repairBuild({ name: '  Lil   Néon ', skills: { melodie: 4, flow: 6, magie: 3 }, trait: 'nope' }, C),
    { name: 'Lil Néon', skills: { melodie: 4, flow: 5 }, trait: '' });
  assert.deepEqual(g.repairBuild({ name: '!', skills: { melodie: 5, flow: 5, prod: 5 } }, C), { name: g.DEFAULT_NAME, skills: {}, trait: '' });
  assert.deepEqual(g.repairBuild(null, C), g.emptyBuild());
});

test('partie avec un perso créé : bonus, nom, sauvegarde, classement', () => {
  const build = { name: 'Lil Néon', skills: { melodie: 4, flow: 5 }, trait: 'perfectionniste' };
  const state = g.createState(data, customId, 0, build);
  const plain = g.createState(data, customId, 0, g.emptyBuild());
  const ratio = (stat) => g.getModifiers(state, data)[stat] / g.getModifiers(plain, data)[stat];
  assert.ok(Math.abs(ratio('beatValue') - 1.2 * 1.15) < 1e-9);
  assert.ok(Math.abs(ratio('click') - 1.4 * 0.9) < 1e-9);
  assert.equal(g.characterOf(state, data).name, 'Lil Néon');
  assert.equal(g.characterOf(state, data).strength, 'Perfectionniste');

  const back = g.deserialize(g.serialize(state), data);
  assert.equal(back.characterId, customId);
  assert.deepEqual(back.custom, build);
  const cheated = g.deserialize(JSON.stringify({ ...state, custom: { ...build, skills: { melodie: 5, flow: 5, prod: 5 } } }), data);
  assert.deepEqual(cheated.custom.skills, {}, 'points en trop : talents remis à zéro');
  assert.equal(g.deserialize(JSON.stringify({ ...state, characterId: 'p-abc' }), data), null);
  const premade = g.deserialize(g.serialize(g.createState(data, 'xavier', 0)), data);
  assert.equal(premade.custom, null);

  assert.equal(scoreFromState(state).character, customId);
});

test('trimSkills et isBenefit', () => {
  const build = { name: 'a', skills: { melodie: 5, charisme: 5, flow: 2 }, trait: '' };
  const trimmed = g.trimSkills(build, C);
  assert.equal(g.spentPoints(trimmed), C.points);
  assert.equal(trimmed.melodie, 5);
  assert.ok(g.isBenefit({ stat: 'churn', multiply: 0.8 }));
  assert.ok(!g.isBenefit({ stat: 'churn', multiply: 1.2 }));
  assert.ok(g.isBenefit({ stat: 'bps', multiply: 1.2 }));
});
