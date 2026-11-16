// Événements à la BitLife : données, déclenchement, choix, effets temporaires, sauvegarde.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_TYPES, STATS, createState, deserialize, getModifiers, isEligible, resolveEvent, serialize, tick, triggerEvent,
} from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();
const fixed = (value) => () => value; // hasard contrôlé

function playing(overrides = {}) {
  const state = createState(data, 'xavier');
  Object.assign(state, { tierIndex: 3, money: 10000, totalEarned: 20000, fans: 5000, peakFans: 5000, time: 1000 }, overrides);
  return state;
}

test('events.json : chaque événement est valide', () => {
  const { list } = data.events;
  const ids = list.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'events.json : identifiants en double');
  assert.ok(data.events.minGapSeconds > 0 && data.events.maxGapSeconds >= data.events.minGapSeconds, 'events.json : intervalle');
  const checkEffects = (effects, where) => {
    for (const e of effects) {
      assert.ok(EFFECT_TYPES.includes(e.type), `${where} : type d'effet inconnu « ${e.type} »`);
      if (e.type === 'buff') {
        assert.ok(STATS.includes(e.stat), `${where} : stat inconnue « ${e.stat} »`);
        assert.ok(e.seconds > 0 && e.multiply > 0, `${where} : buff sans durée ou multiplicateur`);
      }
      if (e.multiply !== undefined) assert.ok(e.multiply >= 0, `${where} : multiply négatif`);
    }
  };
  for (const e of list) {
    assert.match(e.id, /^[a-z0-9-]+$/, `events.json : id « ${e.id} »`);
    for (const key of ['icon', 'title', 'text']) assert.equal(typeof e[key], 'string', `events.json/${e.id}.${key}`);
    assert.ok(['good', 'bad', 'neutral'].includes(e.tone), `events.json/${e.id} : tone`);
    assert.ok(Boolean(e.choices) !== Boolean(e.effects), `events.json/${e.id} : soit effects, soit choices`);
    if (e.effects) checkEffects(e.effects, `events.json/${e.id}`);
    for (const [i, choice] of (e.choices ?? []).entries()) {
      assert.equal(typeof choice.label, 'string', `events.json/${e.id} : choix ${i} sans label`);
      const total = choice.outcomes.reduce((sum, o) => sum + o.chance, 0);
      assert.ok(Math.abs(total - 1) < 1e-9, `events.json/${e.id} : les chances du choix ${i} font ${total}, pas 1`);
      for (const o of choice.outcomes) checkEffects(o.effects, `events.json/${e.id}/choix ${i}`);
    }
  }
});

test('les impôts prennent la moitié du cash', () => {
  const state = playing({ money: 8000 });
  const [event] = triggerEvent(state, data, 'impots');
  assert.equal(event.type, 'event');
  assert.equal(state.money, 4000);
  assert.deepEqual(event.changes, [{ resource: 'money', delta: -4000 }]);
});

test('la police : question, puis conséquence selon le choix et le hasard', () => {
  const state = playing({ high: 60, grams: 300 });
  const [prompt] = triggerEvent(state, data, 'police');
  assert.equal(prompt.type, 'eventPrompt');
  assert.equal(state.events.pending, 'police');

  // Cacher dans la laveuse, et pas de chance (tirage au-dessus de 60 %) : saisie + amende.
  const [result] = resolveEvent(state, data, 0, fixed(0.9));
  assert.equal(result.type, 'eventResult');
  assert.equal(result.tone, 'bad');
  assert.equal(state.high, 0);
  assert.equal(state.grams, 0);
  assert.equal(state.money, 8000);
  assert.equal(state.events.pending, '', 'la question est réglée');
  assert.deepEqual(resolveEvent(state, data, 0), [], 'on ne répond pas deux fois');

  // Même question, avec de la chance cette fois : rien ne bouge.
  const lucky = playing({ high: 60, grams: 300 });
  triggerEvent(lucky, data, 'police');
  resolveEvent(lucky, data, 0, fixed(0.1));
  assert.equal(lucky.high, 60);
  assert.equal(lucky.grams, 300);
});

test('un effet temporaire change la production puis s\'arrête', () => {
  const state = playing({ producers: { 'clavier-midi': 10 } });
  const before = getModifiers(state, data).bps;
  triggerEvent(state, data, 'panne');
  assert.equal(getModifiers(state, data).bps, before * 0.25, 'panne : production × 0,25');
  const ended = [];
  for (let i = 0; i < 95; i += 1) ended.push(...tick(state, data, 1));
  assert.ok(ended.some((e) => e.type === 'eventEnd' && e.id === 'panne'), 'fin annoncée');
  assert.equal(getModifiers(state, data).bps, before, 'production revenue à la normale');
  assert.equal(state.events.active.length, 0);
});

test('rythme : premier événement après le délai, puis un toutes les quelques minutes', () => {
  const state = playing({ time: 0 });
  const seen = [];
  for (let i = 0; i < 3600; i += 1) {
    for (const e of tick(state, data, 1)) {
      if (e.type === 'event' || e.type === 'eventPrompt') seen.push({ at: state.time, e });
      if (e.type === 'eventPrompt') resolveEvent(state, data, 0);
    }
  }
  assert.ok(seen.length >= 1, 'au moins un événement en une heure');
  assert.ok(seen[0].at >= data.events.firstDelaySeconds, 'pas d\'événement avant le délai de départ');
  for (let i = 1; i < seen.length; i += 1) {
    assert.ok(seen[i].at - seen[i - 1].at >= data.events.minGapSeconds - 1, 'pas deux événements trop rapprochés');
  }
  assert.ok(seen.length <= Math.ceil(3600 / data.events.minGapSeconds), 'pas plus d\'un événement par intervalle minimum');
});

test('pas de mauvais événement pendant un fail out, ni avant le premier palier', () => {
  const impots = data.events.list.find((e) => e.id === 'impots');
  assert.ok(isEligible(impots, playing(), data));
  assert.ok(!isEligible(impots, playing({ failOut: true }), data), 'on ne frappe pas quelqu\'un à terre');
  const viral = data.events.list.find((e) => e.id === 'viral');
  assert.ok(!isEligible(viral, playing({ tierIndex: 0 }), data), 'pas d\'événement au tout début');
  const police = data.events.list.find((e) => e.id === 'police');
  assert.ok(!isEligible(police, playing({ high: 0, grams: 0 }), data), 'pas de saisie sans stash');
  const state = playing();
  state.events.last.impots = state.time - 60;
  assert.ok(!isEligible(impots, state, data), 'pas deux fois le même événement de suite');
});

test('une question en attente survit à la sauvegarde ; une vieille sauvegarde reçoit les valeurs par défaut', () => {
  const state = playing({ high: 40 });
  triggerEvent(state, data, 'police');
  const back = deserialize(serialize(state), data);
  assert.equal(back.events.pending, 'police');

  const old = JSON.parse(serialize(playing()));
  delete old.events;
  assert.deepEqual(deserialize(JSON.stringify(old), data).events, { nextAt: 0, pending: '', active: [], last: {} });
  old.events = { pending: 'evenement-supprime', active: 'pas une liste' };
  const repaired = deserialize(JSON.stringify(old), data).events;
  assert.equal(repaired.pending, '', 'événement disparu des données : question oubliée');
  assert.deepEqual(repaired.active, []);
});
