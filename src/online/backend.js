// Accès au serveur du classement. Deux versions avec la même interface :
//   createSupabaseBackend(config) : le vrai serveur (supabase/migrations/*.sql)
//   createMemoryBackend()         : un faux serveur en mémoire, pour essayer l'interface
//                                   sans compte Supabase (http://localhost:8000/?classement=demo)
//
// Interface :
//   join(pseudo, code)             → { status, pseudo?, ... }
//   submit({ pseudo, code }, score) → { status, rank? }
//   top(limit)                     → lignes triées (voir rules.toRow)
//   mine(pseudo)                   → { row, rank } ou null
//   subscribe(onChange, onLive)    → fonction pour se désabonner
//   loadGame({ pseudo, code })     → { status, save, revision, total_earned, tier_index, updated_at }
//   saveGame({ pseudo, code }, { save, revision, totalEarned, tierIndex, character, stats? })
//                                  → { status: 'ok' | 'conflict' | ..., revision, stats? }
//                                    stats : stats publiques de la partie en cours (rules.liveFromState),
//                                    publiées dans « Temps réel » seulement si la sauvegarde passe.
//   liveTop(limit)                 → parties en cours triées par $/s (voir rules.toLiveRow)
//   career(pseudo)                 → { record, recordRank, live, liveRank, liveMissing }
//                                    pour la page « Carrière de l'artiste »

import {
  CODE_PATTERN, PSEUDO_PATTERN, cleanLiveStats, cleanPseudo, compareLive, isMissingOnServer, liveRankIn, rankIn, toLiveRow, toRow,
} from './rules.js';

// Version fixe (publiée en octobre 2026), chargée seulement quand le classement est configuré.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const COLUMNS = 'pseudo,character_id,total_earned,tier_index,fans,territories,updated_at';
// Seulement les colonnes publiques de live_stats (jamais player_id).
const LIVE_COLUMNS = 'pseudo,character_id,money,income,total_earned,tier_index,fans,bps,total_beats,'
  + 'territories,greenhouse,total_grams,pets,companion,fail_out,played_seconds,updated_at';

/** `createClient` peut être remplacé (tests) ; sinon la librairie est chargée depuis jsDelivr. */
export function createSupabaseBackend(config, { createClient: injected = null } = {}) {
  let clientPromise = null;
  // Devient faux si le serveur n'a pas la migration « temps réel » : on sauvegarde alors sans p_stats.
  let liveOnServer = true;
  const library = () => (injected ? Promise.resolve({ createClient: injected }) : import(SUPABASE_JS));
  const client = () => {
    clientPromise ??= library().then(({ createClient }) => createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }));
    clientPromise.catch(() => { clientPromise = null; }); // réessayer au prochain appel si le CDN ne répond pas
    return clientPromise;
  };

  async function rpc(name, args) {
    const { data, error } = await (await client()).rpc(name, args);
    if (error) throw error;
    return data;
  }

  return {
    kind: 'supabase',
    join: (pseudo, code) => rpc('join_leaderboard', { p_pseudo: pseudo, p_code: code }),
    loadGame: ({ pseudo, code }) => rpc('load_game', { p_pseudo: pseudo, p_code: code }),
    async saveGame({ pseudo, code }, game) {
      const args = {
        p_pseudo: pseudo,
        p_code: code,
        p_save: game.save,
        p_revision: game.revision,
        p_total_earned: game.totalEarned,
        p_tier_index: game.tierIndex,
        p_character: game.character,
      };
      if (!game.stats || !liveOnServer) return rpc('save_game', args);
      try {
        return await rpc('save_game', { ...args, p_stats: game.stats });
      } catch (error) {
        if (!isMissingOnServer(error)) throw error;
        // Serveur sans 20261116120000_temps_reel.sql : save_game n'a pas encore p_stats.
        // On sauvegarde quand même, sans stats publiques (si save_game manque aussi, l'erreur remonte).
        liveOnServer = false;
        return rpc('save_game', args);
      }
    },
    submit: ({ pseudo, code }, score) => rpc('submit_score', {
      p_pseudo: pseudo,
      p_code: code,
      p_character: score.character,
      p_total_earned: score.totalEarned,
      p_tier_index: score.tierIndex,
      p_fans: score.fans,
      p_territories: score.territories,
    }),
    async top(limit) {
      const { data, error } = await (await client()).from('scores').select(COLUMNS)
        .order('total_earned', { ascending: false }).order('updated_at', { ascending: true }).limit(limit);
      if (error) throw error;
      return data.map(toRow);
    },
    async mine(pseudo) {
      const c = await client();
      const { data, error } = await c.from('scores').select(COLUMNS).eq('pseudo', pseudo).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = toRow(data);
      const { count, error: countError } = await c.from('scores').select('pseudo', { count: 'exact', head: true }).gt('total_earned', row.totalEarned);
      if (countError) throw countError;
      return { row, rank: 1 + (count ?? 0) };
    },
    async liveTop(limit) {
      const { data, error } = await (await client()).from('live_stats').select(LIVE_COLUMNS)
        .order('income', { ascending: false }).order('updated_at', { ascending: true }).limit(limit);
      if (error) throw error;
      return data.map(toLiveRow);
    },
    async career(pseudo) {
      const c = await client();
      const rankOf = async (table, column, value) => {
        const { count, error } = await c.from(table).select('pseudo', { count: 'exact', head: true }).gt(column, value);
        if (error) throw error;
        return 1 + (count ?? 0);
      };
      const [recordResult, liveResult] = await Promise.all([
        c.from('scores').select(COLUMNS).eq('pseudo', pseudo).maybeSingle(),
        c.from('live_stats').select(LIVE_COLUMNS).eq('pseudo', pseudo).maybeSingle(),
      ]);
      if (recordResult.error) throw recordResult.error;
      if (liveResult.error && !isMissingOnServer(liveResult.error)) throw liveResult.error;
      const record = recordResult.data ? toRow(recordResult.data) : null;
      const live = liveResult.data ? toLiveRow(liveResult.data) : null;
      return {
        record,
        recordRank: record ? await rankOf('scores', 'total_earned', record.totalEarned) : null,
        live,
        liveRank: live ? await rankOf('live_stats', 'income', live.income) : null,
        liveMissing: Boolean(liveResult.error),
      };
    },
    subscribe(onChange, onLive) {
      let closed = false;
      const channels = [];
      let c = null;
      client().then((ready) => {
        if (closed) return;
        c = ready;
        channels.push(c.channel('classement')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => onChange())
          .subscribe((status) => onLive?.(status === 'SUBSCRIBED')));
        // Canal à part : si la table live_stats n'existe pas encore, le classement reste « en direct ».
        channels.push(c.channel('classement-temps-reel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'live_stats' }, () => onChange())
          .subscribe());
      }, () => onLive?.(false));
      return () => {
        closed = true;
        if (c) for (const channel of channels) c.removeChannel(channel);
      };
    },
  };
}

// ---- Faux serveur (démo) ---------------------------------------------------

const RIVALS = [
  ['DJ Laveuse', 'nathan', 4.2e6, 4],
  ['Beatmaker du 3e', 'emile', 8.9e5, 3],
  ['MC Dépanneur', 'xavier', 1.3e5, 2],
  ['Lo-fi Lucie', 'nathan', 2.4e4, 2],
  ['Kick Drum Kev', 'emile', 3.1e3, 1],
  ['Sous-sol 404', 'xavier', 420, 0],
];

// Partie en cours des rivaux de la démo : [part du record déjà regagnée, minutes depuis la
// dernière sauvegarde, animaux, compagnon]. Sous-sol 404 n'a jamais sauvegardé en ligne.
const RIVAL_LIVE = {
  'DJ Laveuse': [0.35, 0.5, { minou: 4, pitou: 2, bouledogue: 1 }, 'bouledogue'],
  'Beatmaker du 3e': [1.4, 1, { minou: 2, pitou: 1 }, 'pitou'],
  'MC Dépanneur': [0.8, 60 * 26, { minou: 1 }, 'minou'],
  'Lo-fi Lucie': [2.2, 0.2, {}, ''],
  'Kick Drum Kev': [0.5, 12, {}, ''],
};

/** Une partie en cours plausible pour un rival de la démo (mêmes champs que live_stats). */
function rivalLive(pseudo, character, record, tier) {
  const [share, minutesAgo, pets, companion] = RIVAL_LIVE[pseudo] ?? [];
  if (share === undefined) return null;
  const totalEarned = record * share;
  return {
    pseudo,
    character_id: character,
    total_earned: totalEarned,
    tier_index: Math.max(0, tier - (share < 1 ? 1 : 0)),
    ...cleanLiveStats({
      money: totalEarned * 0.12,
      income: totalEarned / 1500,
      fans: totalEarned / 35,
      bps: totalEarned / 9000,
      total_beats: totalEarned / 2.5,
      territories: tier >= 4 ? 3 : 1,
      greenhouse: tier >= 3,
      total_grams: tier >= 3 ? totalEarned / 4000 : 0,
      pets,
      companion,
      fail_out: pseudo === 'Kick Drum Kev',
      played_seconds: 600 + totalEarned / 60,
    }),
    updated_at: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  };
}

const DEMO_KEY = 'clicker-du-qg/demo-serveur';

/**
 * Mêmes règles que le SQL (blocage après 5 mauvais codes, record conservé, révisions,
 * stats publiques de la partie en cours), sans réseau.
 * `storage` (facultatif) garde le faux serveur d'un rechargement à l'autre, pour essayer
 * « reprendre ma partie » en démo.
 */
export function createMemoryBackend({ rivals = RIVALS, latencyMs = 250, live = true, storage = null } = {}) {
  const players = new Map(); // clé minuscule → { pseudo, code, fails, lockedUntil }
  const scores = new Map(); // clé minuscule → ligne brute
  const saves = new Map(); // clé minuscule → { data, revision, total_earned, tier_index, character_id, updated_at }
  const liveStats = new Map(); // clé minuscule → ligne publique de live_stats (ni code, ni sauvegarde)
  const persist = () => storage?.set(DEMO_KEY, JSON.stringify({
    players: [...players], scores: [...scores], saves: [...saves], live: [...liveStats],
  }));
  const listeners = new Set();
  const wait = () => new Promise((resolve) => setTimeout(resolve, latencyMs));
  const changed = () => {
    persist();
    for (const fn of listeners) fn();
  };
  const sorted = () => [...scores.values()].map(toRow).sort((a, b) => b.totalEarned - a.totalEarned);
  const sortedLive = () => [...liveStats.values()].map(toLiveRow).sort(compareLive);

  let restored = null;
  try { restored = JSON.parse(storage?.get(DEMO_KEY) ?? 'null'); } catch { restored = null; }
  if (restored) {
    for (const [key, value] of restored.players) players.set(key, value);
    for (const [key, value] of restored.scores) scores.set(key, value);
    for (const [key, value] of restored.saves) saves.set(key, value);
    for (const [key, value] of restored.live ?? []) liveStats.set(key, value);
  }
  for (const [pseudo, character, total, tier] of restored ? [] : rivals) {
    players.set(pseudo.toLowerCase(), { pseudo, code: '0000', fails: 0, lockedUntil: 0 });
    scores.set(pseudo.toLowerCase(), {
      pseudo, character_id: character, total_earned: total, tier_index: tier, fans: total / 30, territories: 1,
      updated_at: new Date().toISOString(),
    });
  }
  // Partie en cours des rivaux (aussi pour une démo enregistrée avant l'onglet « Temps réel »).
  for (const [pseudo, character, total, tier] of rivals) {
    const key = pseudo.toLowerCase();
    const row = liveStats.has(key) || !scores.has(key) ? null : rivalLive(pseudo, character, total, tier);
    if (row) liveStats.set(key, row);
  }

  function check(player, code) {
    if (player.lockedUntil > Date.now()) return { status: 'locked', retry_at: new Date(player.lockedUntil).toISOString() };
    if (player.code === code) {
      player.fails = 0;
      return { status: 'ok' };
    }
    player.fails += 1;
    if (player.fails >= 5) {
      player.fails = 0;
      player.lockedUntil = Date.now() + 15 * 60 * 1000;
      return { status: 'locked', retry_at: new Date(player.lockedUntil).toISOString() };
    }
    return { status: 'wrong_code', attempts_left: 5 - player.fails };
  }

  // Les rivaux progressent tout seuls, pour voir le classement bouger « en direct ».
  let timer = null;
  if (live) {
    timer = setInterval(() => {
      const key = rivals[Math.floor(Math.random() * rivals.length)][0].toLowerCase();
      const raw = scores.get(key);
      raw.total_earned *= 1.05 + Math.random() * 0.4;
      raw.updated_at = new Date().toISOString();
      // Sa partie en cours avance aussi, s'il est en train de jouer (sauvegardée il y a moins de 2 min 30).
      const current = liveStats.get(key);
      if (current && Date.now() - Date.parse(current.updated_at) < 150000) {
        const growth = 1.02 + Math.random() * 0.15;
        for (const field of ['money', 'income', 'total_earned', 'fans', 'bps', 'total_beats']) current[field] *= growth;
        current.played_seconds += 7;
        current.updated_at = raw.updated_at;
      }
      changed();
    }, 7000);
  }

  return {
    kind: 'demo',
    async join(pseudo, code) {
      await wait();
      const name = cleanPseudo(pseudo);
      if (!PSEUDO_PATTERN.test(name)) return { status: 'invalid_pseudo', pseudo: name };
      if (!CODE_PATTERN.test(code)) return { status: 'invalid_code' };
      const key = name.toLowerCase();
      const player = players.get(key);
      if (!player) {
        players.set(key, { pseudo: name, code, fails: 0, lockedUntil: 0 });
        persist();
        return { status: 'created', pseudo: name };
      }
      const result = check(player, code);
      if (result.status !== 'ok') return result;
      return { status: 'ok', pseudo: player.pseudo, best: scores.get(key)?.total_earned ?? null };
    },
    async submit({ pseudo, code }, score) {
      await wait();
      const key = cleanPseudo(pseudo).toLowerCase();
      const player = players.get(key);
      if (!player) return { status: 'unknown_player' };
      const result = check(player, code);
      if (result.status !== 'ok') return result;
      const current = scores.get(key);
      let status = 'ok';
      if (!current || score.totalEarned >= current.total_earned) {
        scores.set(key, {
          pseudo: player.pseudo, character_id: score.character, total_earned: score.totalEarned,
          tier_index: score.tierIndex, fans: score.fans, territories: score.territories, updated_at: new Date().toISOString(),
        });
        changed();
      } else {
        status = 'kept';
      }
      return { status, rank: rankIn(sorted(), scores.get(key).total_earned) };
    },
    async top(limit) {
      await wait();
      return sorted().slice(0, limit);
    },
    async loadGame({ pseudo, code }) {
      await wait();
      const key = cleanPseudo(pseudo).toLowerCase();
      const player = players.get(key);
      if (!player) return { status: 'unknown_player' };
      const result = check(player, code);
      if (result.status !== 'ok') return result;
      const save = saves.get(key);
      if (!save) return { status: 'ok', save: null, revision: 0 };
      return { status: 'ok', save: structuredClone(save.data), ...save, data: undefined };
    },
    async saveGame({ pseudo, code }, game) {
      await wait();
      const key = cleanPseudo(pseudo).toLowerCase();
      const player = players.get(key);
      if (!player) return { status: 'unknown_player' };
      const result = check(player, code);
      if (result.status !== 'ok') return result;
      if (!game.save || typeof game.save !== 'object' || typeof game.save.version !== 'number') return { status: 'invalid_save' };
      const current = saves.get(key);
      if (current && current.revision !== game.revision) {
        return { status: 'conflict', ...current, data: undefined };
      }
      const revision = (current?.revision ?? 0) + 1;
      const updatedAt = new Date().toISOString();
      saves.set(key, {
        data: structuredClone(game.save), revision, total_earned: game.totalEarned,
        tier_index: game.tierIndex, character_id: game.character, updated_at: updatedAt,
      });
      if (game.stats == null) {
        persist();
        return { status: 'ok', revision };
      }
      // Comme le SQL : stats publiées seulement si elles sont valides ; la sauvegarde passe quand même.
      const clean = cleanLiveStats(game.stats);
      if (clean) {
        liveStats.set(key, {
          pseudo: player.pseudo, character_id: game.character ?? '', total_earned: game.totalEarned,
          tier_index: game.tierIndex ?? 0, ...clean, updated_at: updatedAt,
        });
      }
      changed();
      return { status: 'ok', revision, stats: clean ? 'ok' : 'invalid' };
    },
    async mine(pseudo) {
      await wait();
      const raw = scores.get(cleanPseudo(pseudo).toLowerCase());
      if (!raw) return null;
      const row = toRow(raw);
      return { row, rank: rankIn(sorted(), row.totalEarned) };
    },
    async liveTop(limit) {
      await wait();
      return sortedLive().slice(0, limit);
    },
    async career(pseudo) {
      await wait();
      const key = cleanPseudo(pseudo).toLowerCase();
      const record = scores.has(key) ? toRow(scores.get(key)) : null;
      const current = liveStats.has(key) ? toLiveRow(liveStats.get(key)) : null;
      return {
        record,
        recordRank: record ? rankIn(sorted(), record.totalEarned) : null,
        live: current,
        liveRank: current ? liveRankIn(sortedLive(), current.income) : null,
        liveMissing: false,
      };
    },
    subscribe(onChange, onLive) {
      listeners.add(onChange);
      setTimeout(() => onLive?.(true), latencyMs);
      return () => listeners.delete(onChange);
    },
    stop() {
      clearInterval(timer);
    },
  };
}
