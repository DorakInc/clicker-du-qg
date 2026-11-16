// Règles du classement en ligne, sans navigateur ni réseau (testées par `npm test`).
// Les mêmes règles sont vérifiées côté serveur : supabase/migrations/*.sql.

import { beatsPerSecond, getModifiers, incomePerSecond } from '../game/index.js';

/** Lettres (accents compris), chiffres, espace, point, tiret, soulignement ; 2 à 16 caractères. */
export const PSEUDO_PATTERN = /^[A-Za-z0-9À-ÖØ-öø-ÿ _.-]{2,16}$/;
export const CODE_PATTERN = /^[0-9]{4}$/;

export function cleanPseudo(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ');
}

/** Message d'erreur pour un pseudo, ou null s'il est valide. */
export function pseudoError(text) {
  const pseudo = cleanPseudo(text);
  if (pseudo.length < 2) return 'Ton pseudo doit avoir au moins 2 caractères.';
  if (pseudo.length > 16) return 'Ton pseudo peut avoir 16 caractères au maximum.';
  if (!PSEUDO_PATTERN.test(pseudo)) return 'Lettres, chiffres, espaces, point, tiret et soulignement seulement.';
  return null;
}

export function codeError(code) {
  return CODE_PATTERN.test(String(code ?? '')) ? null : 'Le code secret fait exactement 4 chiffres.';
}

/** Ce qu'on envoie au classement à partir de l'état de la partie. */
export function scoreFromState(state) {
  const finite = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
  return {
    character: state.characterId,
    totalEarned: finite(state.totalEarned),
    tierIndex: Math.max(0, Math.floor(state.tierIndex ?? 0)),
    fans: finite(state.fans),
    territories: Object.values(state.conquered ?? {}).filter(Boolean).length,
  };
}

/** Rang (1 = premier) d'un score parmi des lignes déjà triées par argent gagné décroissant. */
export function rankIn(rows, totalEarned) {
  return 1 + rows.filter((row) => row.totalEarned > totalEarned).length;
}

/** Une ligne du classement telle que renvoyée par le serveur → format du jeu. */
export function toRow(raw) {
  return {
    pseudo: raw.pseudo,
    character: raw.character_id,
    totalEarned: Number(raw.total_earned) || 0,
    tierIndex: Number(raw.tier_index) || 0,
    fans: Number(raw.fans) || 0,
    territories: Number(raw.territories) || 0,
    updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
  };
}

// ---- Partie en cours (onglet « Temps réel » et page « Carrière de l'artiste ») ----
// Stats publiques envoyées avec la sauvegarde en ligne (save_game, p_stats). Jamais la
// sauvegarde elle-même ni le code : seulement ces chiffres, lisibles par tout le monde.
// Personnage, argent total gagné et palier viennent déjà des autres paramètres de save_game.
// Règles identiques au SQL : supabase/migrations/20261116120000_temps_reel.sql (_live_stats_ok).

export const LIVE_NUMBERS = ['money', 'income', 'fans', 'bps', 'total_beats', 'total_grams', 'played_seconds'];
export const LIVE_BOOLEANS = ['greenhouse', 'fail_out'];
const ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const MAX_NUMBER = 1e300;
const MAX_PETS = 32;
const MAX_STATS_BYTES = 4096;

/** Les stats publiques de la partie en cours, calculées comme dans la barre du haut. */
export function liveFromState(state, data) {
  const finite = (n) => (Number.isFinite(n) && n > 0 ? Math.min(n, MAX_NUMBER) : 0);
  const mods = getModifiers(state, data);
  const pets = {};
  for (const [id, level] of Object.entries(state.pets ?? {})) {
    const n = Math.min(9999, Math.floor(Number(level) || 0));
    if (n > 0 && ID_PATTERN.test(id)) pets[id] = n;
  }
  return {
    money: finite(state.money),
    income: finite(incomePerSecond(state, data, mods)),
    fans: finite(state.fans),
    bps: finite(beatsPerSecond(state, data, mods)),
    total_beats: finite(state.totalBeats),
    territories: Math.min(999, Object.values(state.conquered ?? {}).filter(Boolean).length),
    greenhouse: Boolean(state.greenhouseUnlocked),
    total_grams: finite(state.totalGrams),
    pets,
    companion: pets[state.companion] ? state.companion : '',
    fail_out: Boolean(state.failOut),
    played_seconds: finite(state.time),
  };
}

function numberOk(value, max, whole = false) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && (!whole || Number.isInteger(value));
}

/**
 * Vérifie les stats publiques comme le serveur. Champ absent = valeur par défaut ; champ
 * présent mais invalide (texte, négatif, null...) = tout est refusé. Clés inconnues ignorées.
 * Retourne la ligne à enregistrer (noms de colonnes SQL) ou null.
 */
export function cleanLiveStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  if (JSON.stringify(stats).length > MAX_STATS_BYTES) return null;
  const has = (key) => Object.prototype.hasOwnProperty.call(stats, key) && stats[key] !== undefined;
  const row = {};
  for (const key of LIVE_NUMBERS) {
    if (has(key) && !numberOk(stats[key], MAX_NUMBER)) return null;
    row[key] = has(key) ? stats[key] : 0;
  }
  if (has('territories') && !numberOk(stats.territories, 999, true)) return null;
  row.territories = has('territories') ? stats.territories : 0;
  for (const key of LIVE_BOOLEANS) {
    if (has(key) && typeof stats[key] !== 'boolean') return null;
    row[key] = has(key) ? stats[key] : false;
  }
  if (has('companion') && (typeof stats.companion !== 'string' || !/^[a-z0-9-]{0,32}$/.test(stats.companion))) return null;
  row.companion = has('companion') ? stats.companion : '';
  row.pets = {};
  if (has('pets')) {
    const pets = stats.pets;
    if (!pets || typeof pets !== 'object' || Array.isArray(pets)) return null;
    const entries = Object.entries(pets);
    if (entries.length > MAX_PETS) return null;
    for (const [id, level] of entries) {
      if (!ID_PATTERN.test(id) || !numberOk(level, 9999, true)) return null;
      row.pets[id] = level;
    }
  }
  return row;
}

/** Une ligne de « Temps réel » telle que renvoyée par le serveur → format du jeu. */
export function toLiveRow(raw) {
  const pets = raw.pets && typeof raw.pets === 'object' ? raw.pets : {};
  return {
    pseudo: raw.pseudo,
    character: raw.character_id,
    money: Number(raw.money) || 0,
    income: Number(raw.income) || 0,
    totalEarned: Number(raw.total_earned) || 0,
    tierIndex: Number(raw.tier_index) || 0,
    fans: Number(raw.fans) || 0,
    bps: Number(raw.bps) || 0,
    totalBeats: Number(raw.total_beats) || 0,
    territories: Number(raw.territories) || 0,
    greenhouse: Boolean(raw.greenhouse),
    totalGrams: Number(raw.total_grams) || 0,
    pets: Object.fromEntries(Object.entries(pets).map(([id, level]) => [id, Number(level) || 0]).filter(([, level]) => level > 0)),
    companion: raw.companion ?? '',
    failOut: Boolean(raw.fail_out),
    playedSeconds: Number(raw.played_seconds) || 0,
    updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
  };
}

/** Classement « Temps réel » : revenu par seconde, puis le plus ancien à égalité (comme le SQL). */
export function compareLive(a, b) {
  return b.income - a.income || (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0);
}

/** Rang (1 = premier) d'un revenu parmi les parties en cours. */
export function liveRankIn(rows, income) {
  return 1 + rows.filter((row) => row.income > income).length;
}

/** Une partie sauvegardée il y a moins de 2 min 30 : le joueur est probablement en train de jouer. */
export function isPlayingNow(updatedAt, now = Date.now()) {
  return Boolean(updatedAt) && now - updatedAt.getTime() < 150000;
}

/**
 * Le serveur n'a pas (encore) cette fonction ou cette table : la migration n'a pas été lancée.
 * PostgREST : PGRST202 (fonction), PGRST205 (table) ; PostgreSQL : 42P01 (table).
 */
export function isMissingOnServer(error) {
  return ['PGRST202', 'PGRST205', '42P01'].includes(error?.code)
    || /could not find the (function|table)|does not exist/i.test(error?.message ?? '');
}

function clock(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'plus tard' : date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

/** Texte à afficher pour une réponse du serveur ({ status, ... }). */
export function describeResult(result) {
  switch (result?.status) {
    case 'created': return `Bienvenue dans le classement, ${result.pseudo} ! Garde ton code : il sert à te reconnecter sur un autre appareil.`;
    case 'ok': return result.pseudo ? `Reconnecté sous le nom ${result.pseudo}.` : 'Score envoyé.';
    case 'kept': return 'Ton record reste en place : cette partie est moins avancée.';
    case 'wrong_code': return `Mauvais code. Encore ${result.attempts_left} essai${result.attempts_left > 1 ? 's' : ''} avant le blocage.`;
    case 'locked': return `Trop d'essais : ce pseudo est bloqué jusqu'à ${clock(result.retry_at)}.`;
    case 'invalid_pseudo': return pseudoError(result.pseudo ?? '') ?? 'Pseudo refusé.';
    case 'invalid_code': return codeError('');
    case 'unknown_player': return "Ce pseudo n'existe plus dans le classement. Inscris-toi de nouveau.";
    case 'invalid_score': return 'Score refusé par le serveur.';
    case 'too_soon': return 'Score envoyé il y a moins de 10 secondes : on réessaie bientôt.';
    case 'network': return 'Impossible de joindre le classement. On réessaie plus tard.';
    case 'conflict': return 'Une autre partie a été sauvegardée sur ce pseudo depuis un autre appareil.';
    case 'invalid_save': return 'Sauvegarde refusée par le serveur.';
    case 'cloud_missing': return "La sauvegarde en ligne n'est pas encore activée sur le serveur (supabase/README.md).";
    default: return 'Réponse inattendue du classement.';
  }
}

/** Vrai si la configuration pointe vers un projet Supabase (sinon le classement est désactivé). */
export function isConfigured(config) {
  return Boolean(config?.supabaseUrl && config?.supabaseKey);
}

/**
 * Refuse les clés secrètes : seule la clé publique (« anon » ou « publishable ») a sa place
 * dans le jeu, car tout ce qui est dans le dépôt finit dans le navigateur des joueurs.
 */
export function keyProblem(key) {
  if (!key) return null;
  if (key.startsWith('sb_secret_')) return 'clé secrète (sb_secret_…) : utiliser la clé « publishable »';
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') return 'clé « service_role » : utiliser la clé « anon »';
    } catch {
      return 'clé illisible';
    }
  }
  return null;
}

/** Résumé d'une partie pour choisir entre deux sauvegardes. */
export function summarize(save) {
  return {
    character: save?.characterId ?? save?.character_id ?? '',
    totalEarned: Number(save?.totalEarned ?? save?.total_earned) || 0,
    tierIndex: Number(save?.tierIndex ?? save?.tier_index) || 0,
    playedSeconds: Number(save?.time) || 0,
    updatedAt: save?.updated_at ? new Date(save.updated_at) : save?.lastSeen ? new Date(save.lastSeen) : null,
  };
}

/** Une partie à peine commencée : on peut la remplacer par celle en ligne sans demander. */
export function isFreshGame(state) {
  return !state || ((Number(state.totalEarned) || 0) < 100 && (Number(state.time) || 0) < 300);
}
