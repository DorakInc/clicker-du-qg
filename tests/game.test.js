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

test('la serre se débloque au palier prévu', () => {
  const s = fresh();
  assert.deepEqual(g.harvest(s, data), [], 'fermée au début');
  s.tierIndex = data.greenhouse.unlockTier;
  assert.ok(types(g.tick(s, data, 0.1)).includes('greenhouseUnlock'));
  assert.ok(s.greenhouseUnlocked);
  assert.ok(!types(g.tick(s, data, 0.1)).includes('greenhouseUnlock'), 'une seule fois');
});

test('serre : équipement en $, pousse en grammes, récolte au clic', () => {
  const s = fresh();
  s.greenhouseUnlocked = true;
  s.money = 1e9;
  const def = data.greenhouse.equipment[0];
  assert.deepEqual(types(g.buyEquipment(s, data, def.id)), ['buyEquipment']);
  assert.ok(g.equipmentCost(def, 1) > def.baseCost);
  g.tick(s, data, 10);
  assert.ok(Math.abs(s.grams - def.gramsPerSecond * 10) < 1e-9);
  const before = s.grams;
  g.harvest(s, data);
  assert.ok(s.grams > before);
});

test('serre : joint maison payé en grammes, même effet que le cannabis acheté', () => {
  const s = fresh();
  s.greenhouseUnlocked = true;
  s.grams = 5;
  assert.deepEqual(g.rollJoint(s, data), [], 'pas assez de grammes');
  s.grams = 1000;
  const money = s.money;
  assert.deepEqual(types(g.rollJoint(s, data)), ['jointHomegrown']);
  assert.equal(s.money, money);
  assert.equal(s.high, data.balance.cannabis.highPerPurchase);
  assert.equal(s.tolerance, 1);
  assert.ok(g.jointCost(s, data) > data.greenhouse.jointGrams, 'la tolérance compte aussi');
});

test('serre : les variétés montent de niveau en grammes et boostent l\'empire', () => {
  const s = fresh();
  s.greenhouseUnlocked = true;
  const strain = data.greenhouse.strains.find((x) => x.effects.some((e) => e.stat === 'beatValue'));
  s.grams = strain.cost;
  const before = g.beatValue(s, data);
  assert.deepEqual(types(g.buyStrain(s, data, strain.id)), ['buyStrain']);
  assert.equal(s.grams, 0);
  assert.equal(s.strains[strain.id], 1);
  const level1 = g.beatValue(s, data);
  assert.ok(level1 > before);
  assert.deepEqual(g.buyStrain(s, data, strain.id), [], 'le niveau 2 coûte plus cher');
  s.grams = g.strainCost(strain, 1);
  assert.ok(s.grams > strain.cost);
  g.buyStrain(s, data, strain.id);
  assert.equal(s.strains[strain.id], 2);
  assert.ok(g.beatValue(s, data) > level1);
});

test('progression hors ligne : la serre pousse aussi', () => {
  const s = fresh();
  s.greenhouseUnlocked = true;
  s.equipment['lampe-del'] = 2;
  const result = g.applyOffline(s, data, 3600 * 1000);
  assert.ok(result.grams > 0);
  assert.equal(s.grams, result.grams);
});

// ---- La carte -----------------------------------------------------------

const mapState = () => {
  const s = fresh();
  s.tierIndex = data.map.unlockTier;
  g.tick(s, data, 0.01);
  return s;
};

test('la carte se débloque au palier prévu, avec le quartier déjà conquis', () => {
  const s = fresh();
  assert.equal(s.mapUnlocked, false);
  assert.ok(g.isConquered(s, data.map.startTerritory));
  s.tierIndex = data.map.unlockTier;
  assert.ok(types(g.tick(s, data, 0.01)).includes('mapUnlock'));
  assert.ok(s.mapUnlocked);
});

test('carte : seuls les voisins d\'un territoire conquis sont ouverts', () => {
  const s = mapState();
  const t = (id) => data.map.territories.find((x) => x.id === id);
  assert.ok(g.isAvailable(s, data, t('montreal')));
  assert.ok(!g.isAvailable(s, data, t('new-york')));
  assert.deepEqual(g.startCampaign(s, data, 'new-york'), []);
  s.conquered.toronto = true;
  assert.ok(g.isAvailable(s, data, t('new-york')), 'un seul voisin suffit');
  s.conquered.tokyo = true;
  assert.ok(!g.isAvailable(s, data, t('la-lune')), 'la Lune demande tous ses voisins');
  s.conquered.lagos = true;
  assert.ok(g.isAvailable(s, data, t('la-lune')));
});

test('carte : la hype monte avec les fans et conquiert le territoire', () => {
  const s = mapState();
  s.fans = 1e12; // assez de fans pour conquérir Montréal en quelques secondes
  s.fansReference = 1e12;
  assert.deepEqual(types(g.startCampaign(s, data, 'montreal')), ['campaignStart']);
  const before = g.beatValue(s, data);
  const montreal = data.map.territories.find((x) => x.id === 'montreal');
  const seconds = Math.ceil(montreal.hype / g.hypePerSecond(s, data)) + 5;
  const events = run(g.tick, s, data, seconds);
  assert.ok(types(events).includes('territoryConquered'));
  assert.ok(g.isConquered(s, 'montreal'));
  assert.equal(s.campaign, '');
  assert.ok(g.beatValue(s, data) > before, 'le bonus du territoire s\'applique');
});

test('carte : un rival trop fort bloque la hype passive, la promo et les shows aident', () => {
  const s = mapState();
  s.conquered.montreal = true;
  const toronto = data.map.territories.find((x) => x.id === 'toronto');
  s.fans = 1000; // hype passive (racine des fans) bien plus faible que la défense du rival
  s.fansReference = 1000;
  g.startCampaign(s, data, 'toronto');
  g.tick(s, data, 10);
  assert.equal(s.hype.toronto, 0, 'le rival repousse tout');

  const firstPromo = g.promoCost(s, data, toronto);
  s.money = firstPromo;
  assert.deepEqual(types(g.runPromo(s, data)), ['promo']);
  assert.equal(s.money, 0);
  assert.ok(s.hype.toronto > 0);
  assert.equal(g.promoCost(s, data, toronto), firstPromo * data.map.promo.growth, 'chaque promo coûte plus cher');

  s.greenhouseUnlocked = true;
  s.grams = g.samplesCost(s, data, toronto);
  g.giveSamples(s, data);
  assert.equal(s.grams, 0);

  const hype = s.hype.toronto;
  g.playShow(s, data);
  assert.ok(s.hype.toronto > hype);
});

test('carte : la hype accumulée reste quand on change de campagne', () => {
  const s = mapState();
  s.conquered.montreal = true;
  s.fans = 1e6;
  g.startCampaign(s, data, 'quebec');
  g.tick(s, data, 5);
  const kept = s.hype.quebec;
  assert.ok(kept > 0);
  g.startCampaign(s, data, 'toronto');
  g.tick(s, data, 5);
  assert.equal(s.hype.quebec, kept);
});
