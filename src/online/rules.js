// Règles du classement en ligne, sans navigateur ni réseau (testées par `npm test`).
// Les mêmes règles sont vérifiées côté serveur : supabase/migrations/*_classement.sql.

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
