// Classement en ligne : règles du client et faux serveur (mêmes règles que le SQL).
// Le vrai serveur se teste avec supabase/README.md (section « Vérifier »).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeError, describeResult, isConfigured, isFreshGame, keyProblem, pseudoError, rankIn, scoreFromState, summarize } from '../src/online/rules.js';
import { createMemoryBackend } from '../src/online/backend.js';
import { createState } from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();

test('pseudo et code', () => {
  assert.equal(pseudoError('Émile du QG'), null);
  assert.equal(pseudoError('  DJ   Laveuse  '), null, 'espaces en trop retirés');
  assert.match(pseudoError('x'), /2 caractères/);
  assert.match(pseudoError('a'.repeat(17)), /16 caractères/);
  assert.match(pseudoError('<script>'), /seulement/);
  assert.equal(codeError('0042'), null);
  for (const bad of ['42', '12345', '12a4', '', null]) assert.ok(codeError(bad), `code « ${bad} » refusé`);
});

test('score envoyé depuis une partie', () => {
  const state = createState(data, 'emile');
  state.totalEarned = 1234.5;
  state.tierIndex = 3;
  state.fans = 900;
  state.conquered.montreal = true;
  assert.deepEqual(scoreFromState(state), { character: 'emile', totalEarned: 1234.5, tierIndex: 3, fans: 900, territories: 2 });
  state.totalEarned = Number.NaN;
  assert.equal(scoreFromState(state).totalEarned, 0, 'jamais de NaN envoyé');
});

test('rang', () => {
  const rows = [{ totalEarned: 100 }, { totalEarned: 50 }, { totalEarned: 50 }, { totalEarned: 10 }];
  assert.equal(rankIn(rows, 1000), 1);
  assert.equal(rankIn(rows, 50), 2, 'ex aequo : même rang');
  assert.equal(rankIn(rows, 0), 5);
});

test('online.json : configuration du classement', () => {
  const { online } = data;
  for (const key of ['topSize', 'submitEverySeconds', 'pollSeconds']) assert.ok(online[key] > 0, `online.json/${key}`);
  assert.ok(online.submitEverySeconds >= 11, 'online.json : le serveur refuse plus d\'un envoi par 10 s');
  if (online.supabaseUrl) assert.match(online.supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/, 'online.json/supabaseUrl : https://<projet>.supabase.co');
  assert.equal(keyProblem(online.supabaseKey), null, `online.json/supabaseKey : ${keyProblem(online.supabaseKey)}`);
  assert.equal(isConfigured(online), Boolean(online.supabaseUrl && online.supabaseKey));
});

test('les clés secrètes sont refusées', () => {
  const jwt = (role) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`;
  assert.equal(keyProblem(jwt('anon')), null);
  assert.ok(keyProblem(jwt('service_role')));
  assert.ok(keyProblem('sb_secret_abc'));
  assert.equal(keyProblem('sb_publishable_abc'), null);
});

test('faux serveur : mêmes règles que le SQL', async () => {
  const server = createMemoryBackend({ rivals: [['Rival', 'nathan', 500, 1]], latencyMs: 0, live: false });
  assert.equal((await server.join('Testeur', '1234')).status, 'created');
  assert.equal((await server.join('testeur', '1234')).status, 'ok', 'pseudo insensible à la casse');
  assert.equal((await server.join('x', '1234')).status, 'invalid_pseudo');

  const me = { pseudo: 'Testeur', code: '1234' };
  const score = (totalEarned) => ({ character: 'xavier', totalEarned, tierIndex: 1, fans: 1, territories: 1 });
  assert.deepEqual(await server.submit(me, score(1000)), { status: 'ok', rank: 1 });
  assert.deepEqual(await server.submit(me, score(10)), { status: 'kept', rank: 1 }, 'le record est gardé');
  assert.equal((await server.top(10))[0].pseudo, 'Testeur');
  assert.deepEqual((await server.mine('Testeur')).rank, 1);

  for (let i = 0; i < 4; i += 1) assert.equal((await server.join('Testeur', '0000')).status, 'wrong_code');
  assert.equal((await server.join('Testeur', '0000')).status, 'locked', '5 mauvais codes : bloqué');
  assert.equal((await server.join('Testeur', '1234')).status, 'locked', 'même le bon code attend la fin du blocage');
  assert.equal((await server.submit({ pseudo: 'Inconnu', code: '1234' }, score(1))).status, 'unknown_player');
  for (const status of ['created', 'ok', 'kept', 'wrong_code', 'locked', 'too_soon', 'network']) {
    assert.equal(typeof describeResult({ status, pseudo: 'X', attempts_left: 2 }), 'string');
  }
});

test('sauvegarde en ligne : révisions et conflits (faux serveur, mêmes règles que le SQL)', async () => {
  const server = createMemoryBackend({ rivals: [], latencyMs: 0, live: false });
  await server.join('Testeur', '1234');
  const me = { pseudo: 'Testeur', code: '1234' };
  const game = (money, revision) => ({ save: { version: 1, money }, revision, totalEarned: money, tierIndex: 0, character: 'xavier' });

  assert.deepEqual(await server.loadGame(me), { status: 'ok', save: null, revision: 0 });
  assert.deepEqual(await server.saveGame(me, game(10, 0)), { status: 'ok', revision: 1 }, 'première sauvegarde');
  assert.deepEqual(await server.saveGame(me, game(20, 1)), { status: 'ok', revision: 2 }, 'appareil à jour');

  const late = await server.saveGame(me, game(5, 1));
  assert.equal(late.status, 'conflict', 'un appareil en retard ne peut pas écraser');
  assert.equal(late.revision, 2);
  const loaded = await server.loadGame(me);
  assert.equal(loaded.save.money, 20, 'la partie la plus récente est intacte');
  assert.equal(loaded.revision, 2);

  assert.equal((await server.saveGame(me, { ...game(1, 2), save: { money: 1 } })).status, 'invalid_save', 'sans version : refusée');
  assert.equal((await server.loadGame({ pseudo: 'Testeur', code: '9999' })).status, 'wrong_code');
  assert.equal((await server.loadGame({ pseudo: 'Inconnu', code: '1234' })).status, 'unknown_player');
  assert.equal(typeof describeResult({ status: 'conflict' }), 'string');
});

test('choisir entre deux parties', () => {
  const fresh = createState(data, 'xavier');
  assert.ok(isFreshGame(fresh), 'une partie qui commence peut être remplacée sans demander');
  assert.ok(!isFreshGame({ ...fresh, totalEarned: 5000 }), 'une partie avancée : on demande');
  assert.ok(!isFreshGame({ ...fresh, time: 900 }), 'même pauvre, 15 minutes de jeu : on demande');
  const s = summarize({ characterId: 'emile', totalEarned: 800, tierIndex: 1, time: 600 });
  assert.deepEqual([s.character, s.totalEarned, s.tierIndex, s.playedSeconds], ['emile', 800, 1, 600]);
  assert.equal(summarize({ character_id: 'nathan', total_earned: 50, tier_index: 2 }).character, 'nathan', 'résumé du serveur');
});
