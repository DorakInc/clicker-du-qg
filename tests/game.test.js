import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { loadData, run } from './helpers.js';

const data = loadData();
const fresh = (character = 'xavier') => g.createState(data, character, 0);
const types = (events) => events.map((e) => e.type);

test('format des grands nombres', () => {
  assert.equal(g.formatNumber(0), '0');
  assert.equal(g.formatNumber(7.25), '7.3');
  assert.equal(g.formatNumber(999), '999');
  assert.equal(g.formatNumber(1500), '1.5K');
  assert.equal(g.formatNumber(1_234_567), '1.2M');
  assert.equal(g.formatNumber(999_999), '1M');
  assert.equal(g.formatNumber(250e9), '250B');
  assert.equal(g.formatMoney(2000), '2K $');
  assert.equal(g.formatDuration(3 * 3600 + 25 * 60), '3 h 25 min');
});

test('un clic rapporte la valeur d\'un beat et donne des fans', () => {
  const s = fresh('emile');
  const expected = g.beatsPerClick(s, data) * g.beatValue(s, data);
  const [event] = g.click(s, data);
  assert.equal(event.type, 'click');
  assert.ok(Math.abs(s.money - (data.balance.startMoney + expected)) < 1e-9);
  assert.ok(s.fans > 0);
});

test('les forces des personnages s\'appliquent', () => {
  assert.ok(g.beatValue(fresh('xavier'), data) > g.beatValue(fresh('nathan'), data));
  assert.ok(g.beatsPerClick(fresh('emile'), data) > g.beatsPerClick(fresh('xavier'), data));
  assert.equal(g.getModifiers(fresh('nathan'), data).fanGain, 1.3);
});

test('acheter un producteur coûte de plus en plus cher et produit en continu', () => {
  const s = fresh();
  s.money = 1000;
  const def = data.producers[0];
  const first = g.producerCost(def, 0);
  assert.deepEqual(types(g.buyProducer(s, data, def.id)), ['buyProducer']);
  assert.ok(g.producerCost(def, 1) > first);
  const before = s.money;
  g.tick(s, data, 10);
  assert.ok(s.money > before);
});

test('impossible d\'acheter sans argent ou avant le palier requis', () => {
  const s = fresh();
  s.money = 0;
  assert.deepEqual(g.buyProducer(s, data, data.producers[0].id), []);
  s.money = 1e12;
  const locked = data.producers.find((p) => p.requiresTier > 0);
  assert.deepEqual(g.buyProducer(s, data, locked.id), []);
});

test('un upgrade s\'achète une seule fois et applique son effet', () => {
  const s = fresh();
  s.money = 1000;
  const before = g.beatsPerClick(s, data);
  assert.deepEqual(types(g.buyUpgrade(s, data, 'casque')), ['buyUpgrade']);
  assert.equal(g.beatsPerClick(s, data), before * 2);
  assert.deepEqual(g.buyUpgrade(s, data, 'casque'), []);
});

test('le cannabis augmente la qualité, coûte de plus en plus cher et s\'estompe', () => {
  const s = fresh();
  s.money = 1e6;
  const priceBefore = g.cannabisPrice(s, data);
  const qualityBefore = g.quality(s, data);
  assert.deepEqual(types(g.buyCannabis(s, data)), ['cannabisBuy']);
  assert.ok(g.quality(s, data) > qualityBefore);
  assert.ok(g.cannabisPrice(s, data) > priceBefore, 'la tolérance fait monter le prix');

  const events = run(g.tick, s, data, 120);
  assert.equal(s.high, 0);
  assert.ok(types(events).includes('cannabisEmpty'));
});

test('trop de cannabis ralentit la production', () => {
  const s = fresh();
  s.money = 1e9;
  s.producers[data.producers[0].id] = 10;
  const normal = g.beatsPerSecond(s, data);
  const events = [];
  for (let i = 0; i < 3; i += 1) events.push(...g.buyCannabis(s, data));
  assert.ok(types(events).includes('overdose'));
  assert.ok(g.isOverdosed(s, data));
  assert.ok(g.beatsPerSecond(s, data) < normal);
});

test('fail out quand les fans s\'effondrent, puis on remonte la pente', () => {
  const s = fresh();
  s.producers[data.producers[0].id] = 10;
  s.fansReference = 1000;
  s.fans = 400;
  const bpsBefore = g.beatsPerSecond(s, data);

  assert.deepEqual(types(g.tick(s, data, 0.1)).filter((t) => t.startsWith('fail')), ['failStart']);
  assert.ok(s.failOut);
  assert.ok(g.beatsPerSecond(s, data) < bpsBefore, 'la production ralentit');

  const events = run(g.tick, s, data, 120);
  assert.ok(types(events).includes('failEnd'), 'le fail out finit par se terminer');
  assert.equal(s.failOut, false);
});

test('pas de fail out en tout début de partie', () => {
  const s = fresh();
  s.fansReference = 10;
  s.fans = 1;
  g.tick(s, data, 1);
  assert.equal(s.failOut, false);
});

test('les paliers de carrière se débloquent avec le record de fans', () => {
  const s = fresh();
  s.fans = data.tiers[2].fansRequired * 1.1;
  const events = g.tick(s, data, 0.01);
  assert.equal(s.tierIndex, 2);
  assert.equal(types(events).filter((t) => t === 'tierUp').length, 2);
});

test('alerte « à sec » une seule fois, réarmée par un achat de cannabis', () => {
  const s = fresh();
  s.fansReference = 1000;
  s.fans = 1000;
  s.money = 0;
  assert.ok(types(g.tick(s, data, 1)).includes('broke'));
  assert.ok(!types(run(g.tick, s, data, 10)).includes('broke'));
  s.money = 1e6;
  g.buyCannabis(s, data);
  s.money = 0;
  assert.ok(types(run(g.tick, s, data, 60)).includes('broke'));
});

test('sauvegarde : aller-retour et sauvegardes invalides', () => {
  const s = fresh('nathan');
  s.money = 1234;
  s.upgrades.casque = true;
  s.producers['clavier-midi'] = 3;
  const loaded = g.deserialize(g.serialize(s), data);
  assert.deepEqual(loaded, s);

  assert.equal(g.deserialize('pas du json', data), null);
  assert.equal(g.deserialize(JSON.stringify({ ...s, version: 999 }), data), null);
  assert.equal(g.deserialize(JSON.stringify({ ...s, characterId: 'inconnu' }), data), null);

  const old = JSON.parse(g.serialize(s));
  delete old.tolerance;
  old.money = 'abc';
  const repaired = g.deserialize(JSON.stringify(old), data);
  assert.equal(repaired.tolerance, 0);
  assert.equal(repaired.money, data.balance.startMoney);
});

test('progression hors ligne : gains plafonnés, fans figés', () => {
  const s = fresh();
  s.producers['clavier-midi'] = 5;
  s.fans = 500;
  const hour = 3600 * 1000;
  const oneHour = g.applyOffline({ ...s, producers: { ...s.producers } }, data, hour);
  const capped = g.applyOffline(s, data, 100 * hour);
  assert.ok(oneHour.earned > 0);
  assert.equal(capped.seconds, data.balance.offline.maxHours * 3600);
  assert.equal(s.fans, 500);
  assert.equal(g.applyOffline(s, data, s.lastSeen + 1000), null, 'courte absence ignorée');
});
