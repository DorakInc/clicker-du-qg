// Classement en ligne : règles du client et faux serveur (mêmes règles que le SQL).
// Le vrai serveur se teste avec supabase/README.md (section « Vérifier »).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanLiveStats, codeError, compareLive, describeResult, isConfigured, isFreshGame, isMissingOnServer, isPlayingNow, keyProblem,
  liveFromState, pseudoError, rankIn, scoreFromState, summarize, toLiveRow,
} from '../src/online/rules.js';
import { createMemoryBackend, createSupabaseBackend } from '../src/online/backend.js';
import { createLeaderboard } from '../src/online/leaderboard.js';
import { createState, incomePerSecond } from '../src/game/index.js';
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

// ---- Temps réel : stats publiques de la partie en cours ----------------------

// Colonnes publiques de live_stats (supabase/migrations/20261116120000_temps_reel.sql).
const PUBLIC_LIVE_FIELDS = [
  'pseudo', 'character_id', 'money', 'income', 'total_earned', 'tier_index', 'fans', 'bps', 'total_beats', 'territories',
  'greenhouse', 'total_grams', 'pets', 'companion', 'fail_out', 'played_seconds', 'updated_at',
].sort();

function advancedState() {
  const state = createState(data, 'nathan');
  Object.assign(state, {
    money: 1234, totalEarned: 98765, fans: 4321, totalBeats: 5000, totalGrams: 77, greenhouseUnlocked: true, time: 3600, failOut: true,
  });
  state.producers = { [data.producers[0].id]: 3 };
  state.conquered.montreal = true;
  state.pets = { minou: 2, pitou: 0 };
  state.companion = 'minou';
  return state;
}

test('stats publiques calculées depuis la partie (comme la barre du haut)', () => {
  const state = advancedState();
  const stats = liveFromState(state, data);
  assert.equal(stats.income, incomePerSecond(state, data), '$/s identique au HUD');
  assert.ok(stats.bps > 0, 'beats/s des producteurs');
  assert.deepEqual(stats.pets, { minou: 2 }, 'seulement les animaux adoptés');
  assert.equal(stats.companion, 'minou');
  assert.deepEqual([stats.money, stats.fans, stats.territories, stats.greenhouse, stats.fail_out], [1234, 4321, 2, true, true]);
  assert.ok(cleanLiveStats(stats), 'acceptées par les règles du serveur');
  assert.ok(JSON.stringify(stats).length < 1000, 'petites : pas la sauvegarde complète');
  for (const secret of ['producers', 'upgrades', 'events', 'code', 'save', 'high', 'tolerance']) {
    assert.ok(!(secret in stats), `rien de la sauvegarde : ${secret}`);
  }

  state.money = Number.NaN;
  state.companion = 'pitou'; // pas adopté (niveau 0)
  const odd = liveFromState(state, data);
  assert.equal(odd.money, 0, 'jamais de NaN envoyé');
  assert.equal(odd.companion, '', 'compagnon non adopté : aucun');
});

test('stats publiques : mêmes règles que le SQL (_live_stats_ok)', () => {
  // Mêmes cas que ceux vérifiés sur PostgreSQL (voir supabase/README.md, « Vérifier »).
  const cases = [
    [{}, true], [{ money: '5' }, false], [{ money: null }, false], [{ money: 1e301 }, false], [{ money: -1 }, false],
    [{ money: Number.NaN }, false], [{ money: Infinity }, false], [{ territories: 1.5 }, false], [{ territories: 1000 }, false],
    [{ greenhouse: 1 }, false], [{ companion: 'Minou' }, false], [{ companion: '' }, true], [{ pets: [] }, false],
    [{ pets: { minou: 1.5 } }, false], [{ pets: { MINOU: 1 } }, false], [{ pets: { minou: 10000 } }, false],
    [{ pets: { minou: null } }, false], [[], false], [5, false], [null, false],
    [{ pets: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`animal-${i}`, 1])) }, false],
  ];
  for (const [stats, ok] of cases) assert.equal(Boolean(cleanLiveStats(stats)), ok, JSON.stringify(stats));
  const clean = cleanLiveStats({ money: 5, inconnu: 'ignoré' });
  assert.equal(clean.money, 5);
  assert.equal(clean.income, 0, 'champ absent : valeur par défaut');
  assert.ok(!('inconnu' in clean), 'clé inconnue ignorée');
});

test('temps réel (faux serveur) : publié seulement avec une sauvegarde acceptée', async () => {
  const server = createMemoryBackend({ rivals: [['Rival', 'emile', 500, 1]], latencyMs: 0, live: false });
  await server.join('Testeur', '1234');
  const me = { pseudo: 'Testeur', code: '1234' };
  const game = (revision, stats) => ({ save: { version: 1 }, revision, totalEarned: 800, tierIndex: 2, character: 'xavier', stats });

  assert.deepEqual(await server.saveGame(me, game(0, { money: 10, income: 1e6 })), { status: 'ok', revision: 1, stats: 'ok' });
  let top = await server.liveTop(10);
  assert.equal(top[0].pseudo, 'Testeur', 'trié par $/s');
  assert.deepEqual([top[0].money, top[0].totalEarned, top[0].tierIndex, top[0].character], [10, 800, 2, 'xavier']);

  assert.deepEqual(await server.saveGame(me, game(1, { money: -5 })), { status: 'ok', revision: 2, stats: 'invalid' }, 'stats invalides : sauvegarde quand même');
  assert.equal((await server.liveTop(10))[0].money, 10, 'stats invalides ignorées');
  assert.equal((await server.saveGame(me, game(1, { money: 999 }))).status, 'conflict');
  assert.equal((await server.saveGame({ ...me, code: '0000' }, game(2, { money: 999 }))).status, 'wrong_code');
  assert.equal((await server.liveTop(10))[0].money, 10, 'appareil en retard ou mauvais code : rien publié');

  // Ce que tout le monde peut lire : ni code, ni sauvegarde.
  const raw = JSON.parse(JSON.stringify(await server.liveTop(10)));
  for (const row of raw) {
    assert.ok(!('code' in row) && !('save' in row) && !('data' in row) && !('revision' in row), 'rien de privé dans « Temps réel »');
  }

  const career = await server.career('testeur');
  assert.equal(career.live.pseudo, 'Testeur');
  assert.equal(career.liveRank, 1);
  assert.equal(career.record, null, 'pas encore de score au classement');
  const rival = await server.career('Rival');
  assert.equal(rival.recordRank, 1);
  assert.equal(rival.live, null, 'rival sans partie en ligne');
});

test('temps réel : ordre, joueur « en jeu », lignes du serveur', () => {
  const at = (iso) => ({ updated_at: iso });
  const rows = [
    toLiveRow({ pseudo: 'B', income: 5, ...at('2026-01-02T00:00:00Z') }),
    toLiveRow({ pseudo: 'A', income: 5, ...at('2026-01-01T00:00:00Z') }),
    toLiveRow({ pseudo: 'C', income: 50, pets: { minou: 2, pitou: 0 }, ...at('2026-01-03T00:00:00Z') }),
  ].sort(compareLive);
  assert.deepEqual(rows.map((r) => r.pseudo), ['C', 'A', 'B'], '$/s, puis le plus ancien à égalité (comme le SQL)');
  assert.deepEqual(rows[0].pets, { minou: 2 });
  const now = Date.now();
  assert.ok(isPlayingNow(new Date(now - 60000), now));
  assert.ok(!isPlayingNow(new Date(now - 10 * 60000), now));
  assert.ok(!isPlayingNow(null, now));
});

test('serveur sans la migration « temps réel » : la sauvegarde passe quand même', async () => {
  const calls = [];
  let stats = false; // le serveur connaît-il p_stats ?
  const fakeClient = {
    async rpc(name, args) {
      calls.push(Object.keys(args));
      if ('p_stats' in args && !stats) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.save_game' } };
      return { data: { status: 'ok', revision: 1 }, error: null };
    },
  };
  const backend = createSupabaseBackend({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' }, { createClient: () => fakeClient });
  const game = { save: { version: 1 }, revision: 0, totalEarned: 1, tierIndex: 0, character: 'xavier', stats: { money: 1 } };
  assert.equal((await backend.saveGame({ pseudo: 'A', code: '1234' }, game)).status, 'ok');
  assert.deepEqual(calls.map((keys) => keys.includes('p_stats')), [true, false], 'essai avec stats, puis sans');
  await backend.saveGame({ pseudo: 'A', code: '1234' }, game);
  assert.equal(calls.at(-1).includes('p_stats'), false, 'ensuite, plus de stats envoyées');

  // Autre erreur : elle remonte (pas de nouvel essai silencieux).
  stats = true;
  const failing = createSupabaseBackend({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' }, {
    createClient: () => ({ rpc: async () => ({ data: null, error: { code: '500', message: 'boom' } }) }),
  });
  await assert.rejects(failing.saveGame({ pseudo: 'A', code: '1234' }, game));
  assert.ok(isMissingOnServer({ code: 'PGRST205' }) && isMissingOnServer({ code: '42P01' }) && !isMissingOnServer({ code: '500' }));
});

function memoryStorage() {
  const map = new Map();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => { map.set(k, v); return true; }, remove: (k) => map.delete(k) };
}

test('le jeu envoie ses stats avec la sauvegarde et lit « Temps réel »', async () => {
  const config = { topSize: 10, submitEverySeconds: 60, pollSeconds: 30 };
  const backend = createMemoryBackend({ rivals: [['Rival', 'emile', 500, 1]], latencyMs: 0, live: false });
  const state = advancedState();
  const lb = createLeaderboard({
    config, storage: memoryStorage(), backend,
    getSaveText: () => JSON.stringify(state),
    getLiveStats: () => liveFromState(state, data),
  });
  lb.start(() => state);
  await lb.join('Testeur', '1234');
  await lb.refresh();
  assert.equal(lb.liveStatus, 'ok');
  const mine = lb.liveRows.find((row) => row.pseudo === 'Testeur');
  assert.ok(mine, 'ma partie apparaît dans « Temps réel »');
  assert.equal(mine.income, incomePerSecond(state, data));
  assert.equal(lb.liveMine.row.pseudo, 'Testeur');
  const career = await lb.loadCareer('Testeur');
  assert.equal(career.live.money, 1234);
  assert.equal(career.record.totalEarned, 98765, 'le record envoyé au join');
  lb.stop();

  // Serveur sans « Temps réel » : l'onglet le dit, le reste marche.
  const old = createMemoryBackend({ rivals: [['Rival', 'emile', 500, 1]], latencyMs: 0, live: false });
  const withoutLive = createLeaderboard({
    config, storage: memoryStorage(), backend: { ...old, liveTop: async () => { throw { code: 'PGRST205' }; } },
  });
  await withoutLive.refresh();
  assert.equal(withoutLive.liveStatus, 'missing');
  assert.equal(withoutLive.rows.length, 1, 'le classement record reste là');
});
