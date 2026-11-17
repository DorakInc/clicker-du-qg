// Battle de beat : données, mises, partition, jugement des frappes, gains et pertes, sauvegarde.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abandonBattle, advanceRun, battleBlock, battlePayout, battleRivals, battleStakes, battleTarget, createChart,
  createRun, createState, deserialize, finishBattle, rivalLevel, runAccuracy, runDone, serialize, startBattle, tapRun, tick,
} from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();
const fixed = (value) => () => value; // hasard contrôlé

/** Une partie où la carte est ouverte et Toronto (rival MC Condo) est à portée. */
function onMap(overrides = {}) {
  const state = createState(data, 'xavier');
  Object.assign(state, {
    tierIndex: data.map.unlockTier, mapUnlocked: true, money: 10000, totalEarned: 50000, fans: 5000, peakFans: 5000, time: 1000,
  }, overrides);
  state.conquered.montreal = true;
  return state;
}

/** Joue toute la partition : `hit(note)` dit à quel décalage frapper (null = laisser passer). */
function play(chart, hit) {
  const run = createRun(chart);
  for (const note of chart.notes) {
    const offset = hit(note);
    if (offset !== null) tapRun(run, data, note.lane, note.t + offset);
  }
  advanceRun(run, data, chart.duration);
  return run;
}

test('battle.json : réglages valides', () => {
  const b = data.battle;
  assert.ok(b.bpm > 0 && b.beats > 0 && b.leadInBeats >= 0, 'battle.json : bpm, beats, leadInBeats');
  assert.ok(Number.isInteger(b.lanes) && b.lanes >= 2, 'battle.json : au moins 2 pistes');
  assert.ok(b.windows.perfect > 0 && b.windows.good > b.windows.perfect, 'battle.json : 0 < perfect < good');
  assert.ok(b.windows.good < 30 / b.bpm, 'battle.json : la fenêtre « good » doit rester sous un demi-contretemps');
  assert.ok(b.points.perfect === 1 && b.points.good > 0 && b.points.good < 1, 'battle.json : points');
  assert.ok(b.stakes.length > 0 && b.stakes.every((s) => s > 0 && s <= 0.5), 'battle.json : mises entre 0 et 50 % du cash');
  assert.ok(b.cooldownSeconds >= 0 && typeof b.allowDuringFailOut === 'boolean', 'battle.json : cooldownSeconds, allowDuringFailOut');
  assert.ok(b.payout.atTarget > 1 && b.payout.perfect >= b.payout.atTarget, 'battle.json : payout');
  for (const [key, { easiest, hardest }] of Object.entries(b.difficulty)) {
    assert.ok(easiest >= 0 && hardest <= 1 && easiest <= hardest, `battle.json : difficulty.${key}`);
  }
  assert.ok(b.difficulty.target.hardest < 1, 'battle.json : le rival le plus fort doit rester battable');
  // Une battle dure environ 20 s.
  const seconds = (b.leadInBeats + b.beats) * 60 / b.bpm;
  assert.ok(seconds >= 12 && seconds <= 30, `battle.json : une battle dure ${seconds.toFixed(1)} s`);
});

test('les rivaux : plus de défense, plus dur à battre', () => {
  assert.equal(rivalLevel(data, 'toronto'), 0, 'MC Condo est le plus faible');
  assert.equal(rivalLevel(data, 'la-lune'), 1, 'les extraterrestres sont les plus forts');
  assert.ok(battleTarget(data, 'toronto') < battleTarget(data, 'new-york'));
  assert.ok(battleTarget(data, 'new-york') < battleTarget(data, 'la-lune'));
});

test('on ne défie que les rivaux des territoires ouverts', () => {
  const state = onMap();
  assert.deepEqual(battleRivals(state, data).map((t) => t.id), ['toronto']);
  assert.equal(battleBlock(state, data, 'toronto'), '');
  assert.equal(battleBlock(state, data, 'quebec'), 'rival', 'Québec n\'a pas de rival');
  assert.equal(battleBlock(state, data, 'new-york'), 'rival', 'New York n\'est pas encore ouvert');
  assert.deepEqual(battleRivals(onMap({ mapUnlocked: false }), data), [], 'carte fermée');
  state.conquered.toronto = true;
  assert.equal(battleBlock(state, data, 'toronto'), 'rival', 'territoire déjà conquis');
});

test('pas de battle pendant un événement, sans cash ou pendant une autre battle', () => {
  const waiting = onMap();
  waiting.events.pending = 'police';
  assert.equal(battleBlock(waiting, data, 'toronto'), 'event');
  assert.equal(battleBlock(onMap({ money: 50 }), data, 'toronto'), 'money');
  const state = onMap();
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  assert.equal(battleBlock(state, data, 'toronto'), 'busy');
});

test('fail out et revanche : selon battle.json', () => {
  // Réglages stricts : pas de battle en fail out, 2 min avant la revanche.
  const strict = { ...data, battle: { ...data.battle, allowDuringFailOut: false, cooldownSeconds: 120 } };
  assert.equal(battleBlock(onMap({ failOut: true }), strict, 'toronto'), 'failOut');
  const state = onMap();
  startBattle(state, strict, 'toronto', 0, fixed(0.3));
  finishBattle(state, strict, 1);
  assert.equal(battleBlock(state, strict, 'toronto'), 'cooldown');
  state.time += 120;
  assert.equal(battleBlock(state, strict, 'toronto'), '');

  // Réglages souples (ceux du jeu pour l'instant, le temps de tester) : on relance quand on veut.
  const loose = { ...data, battle: { ...data.battle, allowDuringFailOut: true, cooldownSeconds: 0 } };
  assert.equal(battleBlock(onMap({ failOut: true }), loose, 'toronto'), '');
  const again = onMap();
  startBattle(again, loose, 'toronto', 0, fixed(0.3));
  finishBattle(again, loose, 0);
  assert.equal(battleBlock(again, loose, 'toronto'), '', 'revanche tout de suite');
});

test('la mise : une part du cash, jamais plus de la moitié', () => {
  const stakes = battleStakes(onMap({ money: 10000 }), data);
  assert.deepEqual(stakes.map((s) => s.amount), data.battle.stakes.map((s) => Math.floor(10000 * s)));
  assert.ok(stakes.every((s) => s.amount <= 5000));
});

test('la partition : une note par temps, plus de notes contre les gros rivaux, toujours dans l\'ordre', () => {
  const easy = createChart(data, 'toronto', fixed(0.99));
  assert.equal(easy.notes.length, data.battle.beats, 'pas de hasard favorable : une note par temps');
  const spb = 60 / data.battle.bpm;
  assert.ok(Math.abs(easy.notes[0].t - data.battle.leadInBeats * spb) < 1e-9, 'la première note tombe après le décompte');
  assert.ok(easy.duration > easy.notes.at(-1).t, 'la battle finit après la dernière note');

  const hard = createChart(data, 'la-lune', fixed(0.05));
  assert.ok(hard.notes.length > easy.notes.length, 'contretemps et notes doubles');
  for (let i = 1; i < hard.notes.length; i += 1) assert.ok(hard.notes[i].t >= hard.notes[i - 1].t, 'notes triées');
  for (const n of hard.notes) assert.ok(n.lane >= 0 && n.lane < data.battle.lanes, 'piste valide');
  // Deux notes au même moment ne tombent jamais sur la même piste.
  const seen = new Set(hard.notes.map((n) => `${n.t.toFixed(4)}:${n.lane}`));
  assert.equal(seen.size, hard.notes.length);
});

test('le jugement : parfait, bon, raté, et frappes dans le vide', () => {
  const chart = createChart(data, 'toronto', fixed(0.99));
  const run = createRun(chart);
  const [a, b] = chart.notes;
  assert.equal(tapRun(run, data, a.lane, a.t + 0.02).result, 'perfect');
  assert.equal(tapRun(run, data, b.lane, b.t - 0.12).result, 'good');
  assert.equal(run.combo, 2);
  assert.equal(tapRun(run, data, (b.lane + 1) % data.battle.lanes, b.t).result, 'stray', 'mauvaise piste');
  assert.equal(run.combo, 0, 'une frappe dans le vide casse le combo');
  assert.equal(tapRun(run, data, a.lane, a.t).result, 'stray', 'une note ne se frappe qu\'une fois');

  const missed = advanceRun(run, data, chart.notes[2].t + 0.3);
  assert.equal(missed.length, 1, 'la 3e note est passée sans être frappée');
  assert.equal(run.notes[2].result, 'miss');
  assert.equal(runDone(run, chart.duration - 0.01), false);
  assert.equal(runDone(run, chart.duration), true);
});

test('la précision : sans-faute = 1, rien = 0, marteler toutes les pistes ne paie pas', () => {
  const chart = createChart(data, 'new-york', fixed(0.2));
  assert.equal(runAccuracy(play(chart, () => 0), data), 1);
  assert.equal(runAccuracy(play(chart, () => null), data), 0);
  const allGood = runAccuracy(play(chart, () => 0.12), data);
  assert.ok(Math.abs(allGood - data.battle.points.good) < 1e-9);

  // Taper les 3 pistes à chaque demi-temps : toutes les notes, mais énormément de frappes dans le vide.
  const run = createRun(chart);
  const step = chart.spb / 2;
  for (let t = 0; t < chart.duration; t += step) for (let lane = 0; lane < data.battle.lanes; lane += 1) tapRun(run, data, lane, t);
  advanceRun(run, data, chart.duration);
  assert.ok(runAccuracy(run, data) < battleTarget(data, 'new-york'), 'le spam ne bat pas le rival');
});

test('le gain : ×1,5 au score du rival, ×3 pour un sans-faute, rien en dessous', () => {
  const target = 0.6;
  assert.equal(battlePayout(data, 1000, 0.59, target), 0);
  assert.equal(battlePayout(data, 1000, target, target), 1000 * data.battle.payout.atTarget);
  assert.equal(battlePayout(data, 1000, 1, target), 1000 * data.battle.payout.perfect);
  assert.ok(battlePayout(data, 1000, 0.8, target) > 1500 && battlePayout(data, 1000, 0.8, target) < 3000);
});

test('une battle gagnée : la mise revient multipliée et le territoire gagne de la hype', () => {
  const state = onMap({ money: 10000 });
  const [start] = startBattle(state, data, 'toronto', 1, fixed(0.3));
  assert.equal(start.type, 'battleStart');
  assert.equal(start.rival, 'MC Condo');
  assert.equal(start.stake, 2500);
  assert.equal(state.money, 7500, 'la mise est payée au début');
  assert.ok(start.chart.notes.length >= data.battle.beats);

  const [win] = finishBattle(state, data, 1);
  assert.equal(win.type, 'battleWin');
  assert.equal(win.payout, 7500);
  assert.equal(state.money, 15000);
  assert.equal(state.totalEarned, 50000 + 5000, 'seul le profit compte comme argent gagné');
  const toronto = data.map.territories.find((t) => t.id === 'toronto');
  assert.equal(state.hype.toronto, toronto.hype * data.battle.hypeShare);
  assert.equal(state.battles.wins, 1);
  assert.equal(state.battles.best, 1);
  assert.equal(state.battles.pending, null);
  assert.deepEqual(finishBattle(state, data, 1), [], 'on ne touche pas deux fois le gain');
});

test('une battle gagnée peut finir la conquête du territoire', () => {
  const toronto = data.map.territories.find((t) => t.id === 'toronto');
  const state = onMap({ campaign: 'toronto' });
  state.hype.toronto = toronto.hype * 0.95;
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  const events = finishBattle(state, data, 0.9);
  assert.deepEqual(events.map((e) => e.type), ['battleWin', 'territoryConquered']);
  assert.equal(state.conquered.toronto, true);
  assert.equal(state.campaign, '', 'la campagne est finie');
});

test('une battle perdue : la mise est perdue, le cash ne tombe jamais à zéro', () => {
  const state = onMap({ money: 10000 });
  startBattle(state, data, 'toronto', data.battle.stakes.length - 1, fixed(0.3));
  const [lose] = finishBattle(state, data, 0.2);
  assert.equal(lose.type, 'battleLose');
  assert.equal(lose.payout, 0);
  assert.equal(state.money, 5000, 'au pire, la moitié du cash');
  assert.equal(state.battles.losses, 1);
  assert.equal(state.totalEarned, 50000, 'le total gagné ne baisse pas');
});

test('une battle laissée en plan est sauvegardée, puis comptée perdue', () => {
  const state = onMap({ money: 10000 });
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  const loaded = deserialize(serialize(state), data);
  assert.deepEqual(loaded.battles.pending, state.battles.pending);
  assert.equal(loaded.battles.last.toronto, 1000);
  const [lose] = abandonBattle(loaded, data);
  assert.equal(lose.type, 'battleLose');
  assert.equal(lose.forfeit, true);
  assert.equal(loaded.money, 9000);
  assert.deepEqual(abandonBattle(loaded, data), [], 'rien à abandonner');
});

test('sauvegarde : vieille partie sans battles, ou battles abîmées', () => {
  const old = JSON.parse(serialize(onMap()));
  delete old.battles;
  assert.deepEqual(deserialize(JSON.stringify(old), data).battles, createState(data, 'xavier').battles);

  old.battles = { pending: { territory: 'atlantide', stake: 5 }, last: { toronto: 'hier', paris: 12 }, wins: -3, losses: 2.7, best: 7 };
  const repaired = deserialize(JSON.stringify(old), data).battles;
  assert.equal(repaired.pending, null, 'territoire inconnu');
  assert.deepEqual(repaired.last, { paris: 12 });
  assert.equal(repaired.wins, 0);
  assert.equal(repaired.losses, 2);
  assert.equal(repaired.best, 1);
});

test('pas de nouvel événement BitLife en pleine battle', () => {
  const state = onMap();
  state.events.nextAt = state.time + 1;
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  tick(state, data, 5);
  assert.equal(state.events.pending, '');
  assert.ok(state.events.nextAt <= state.time, 'l\'événement attend la fin de la battle');
});
