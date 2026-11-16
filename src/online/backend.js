// Accès au serveur du classement. Deux versions avec la même interface :
//   createSupabaseBackend(config) : le vrai serveur (supabase/migrations/*_classement.sql)
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
//   saveGame({ pseudo, code }, { save, revision, totalEarned, tierIndex, character })
//                                  → { status: 'ok' | 'conflict' | ..., revision }

import { CODE_PATTERN, PSEUDO_PATTERN, cleanPseudo, rankIn, toRow } from './rules.js';

// Version fixe (publiée en octobre 2026), chargée seulement quand le classement est configuré.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const COLUMNS = 'pseudo,character_id,total_earned,tier_index,fans,territories,updated_at';

export function createSupabaseBackend(config) {
  let clientPromise = null;
  const client = () => {
    clientPromise ??= import(SUPABASE_JS).then(({ createClient }) => createClient(config.supabaseUrl, config.supabaseKey, {
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
    saveGame: ({ pseudo, code }, game) => rpc('save_game', {
      p_pseudo: pseudo,
      p_code: code,
      p_save: game.save,
      p_revision: game.revision,
      p_total_earned: game.totalEarned,
      p_tier_index: game.tierIndex,
      p_character: game.character,
    }),
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
    subscribe(onChange, onLive) {
      let closed = false;
      let channel = null;
      let c = null;
      client().then((ready) => {
        if (closed) return;
        c = ready;
        channel = c.channel('classement')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => onChange())
          .subscribe((status) => onLive?.(status === 'SUBSCRIBED'));
      }, () => onLive?.(false));
      return () => {
        closed = true;
        if (c && channel) c.removeChannel(channel);
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

const DEMO_KEY = 'clicker-du-qg/demo-serveur';

/**
 * Mêmes règles que le SQL (blocage après 5 mauvais codes, record conservé, révisions), sans réseau.
 * `storage` (facultatif) garde le faux serveur d'un rechargement à l'autre, pour essayer
 * « reprendre ma partie » en démo.
 */
export function createMemoryBackend({ rivals = RIVALS, latencyMs = 250, live = true, storage = null } = {}) {
  const players = new Map(); // clé minuscule → { pseudo, code, fails, lockedUntil }
  const scores = new Map(); // clé minuscule → ligne brute
  const saves = new Map(); // clé minuscule → { data, revision, total_earned, tier_index, character_id, updated_at }
  const persist = () => storage?.set(DEMO_KEY, JSON.stringify({ players: [...players], scores: [...scores], saves: [...saves] }));
  const listeners = new Set();
  const wait = () => new Promise((resolve) => setTimeout(resolve, latencyMs));
  const changed = () => {
    persist();
    for (const fn of listeners) fn();
  };
  const sorted = () => [...scores.values()].map(toRow).sort((a, b) => b.totalEarned - a.totalEarned);

  let restored = null;
  try { restored = JSON.parse(storage?.get(DEMO_KEY) ?? 'null'); } catch { restored = null; }
  if (restored) {
    for (const [key, value] of restored.players) players.set(key, value);
    for (const [key, value] of restored.scores) scores.set(key, value);
    for (const [key, value] of restored.saves) saves.set(key, value);
  }
  for (const [pseudo, character, total, tier] of restored ? [] : rivals) {
    players.set(pseudo.toLowerCase(), { pseudo, code: '0000', fails: 0, lockedUntil: 0 });
    scores.set(pseudo.toLowerCase(), {
      pseudo, character_id: character, total_earned: total, tier_index: tier, fans: total / 30, territories: 1,
      updated_at: new Date().toISOString(),
    });
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
      const raw = scores.get(rivals[Math.floor(Math.random() * rivals.length)][0].toLowerCase());
      raw.total_earned *= 1.05 + Math.random() * 0.4;
      raw.updated_at = new Date().toISOString();
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
      saves.set(key, {
        data: structuredClone(game.save), revision, total_earned: game.totalEarned,
        tier_index: game.tierIndex, character_id: game.character, updated_at: new Date().toISOString(),
      });
      persist();
      return { status: 'ok', revision };
    },
    async mine(pseudo) {
      await wait();
      const raw = scores.get(cleanPseudo(pseudo).toLowerCase());
      if (!raw) return null;
      const row = toRow(raw);
      return { row, rank: rankIn(sorted(), row.totalEarned) };
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
