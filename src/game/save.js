// Sauvegarde (format texte JSON) et progression hors ligne.
// Le stockage lui-même (localStorage) est géré par main.js.

import { SAVE_VERSION, createState } from './state.js';
import { getModifiers } from './modifiers.js';
import { rawBeatsPerSecond, beatValue } from './economy.js';

export const SAVE_KEY = 'clicker-du-qg/save';

export function serialize(state) {
  return JSON.stringify(state);
}

/**
 * Relit une sauvegarde. Retourne null si elle est illisible ou d'une version
 * inconnue. Les champs manquants (ajoutés dans une version plus récente du
 * jeu) reprennent leur valeur par défaut.
 */
export function deserialize(text, data) {
  let saved;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object' || saved.version !== SAVE_VERSION) return null;
  if (!data.characters.some((c) => c.id === saved.characterId)) return null;

  const state = createState(data, saved.characterId, saved.lastSeen);
  for (const key of Object.keys(state)) {
    if (key in saved && typeof saved[key] === typeof state[key]) state[key] = saved[key];
  }
  state.tierIndex = Math.min(state.tierIndex, data.tiers.length - 1);
  return state;
}

/**
 * Calcule ce que le studio a produit pendant l'absence du joueur.
 * Les producteurs tournent à efficacité réduite et à jeun ; les fans et le
 * fail out sont figés pour ne pas punir le joueur d'avoir fermé le jeu.
 */
export function applyOffline(state, data, now = Date.now()) {
  const { offline, cannabis } = data.balance;
  const elapsed = (now - state.lastSeen) / 1000;
  state.lastSeen = now;
  if (!(elapsed >= offline.minSeconds)) return null;

  const seconds = Math.min(elapsed, offline.maxHours * 3600);
  const mods = getModifiers(state, data);
  const sober = { ...state, high: 0 };
  const earned =
    rawBeatsPerSecond(state, data, mods) * beatValue(sober, data, mods) * offline.efficiency * seconds;

  state.money += earned;
  state.totalEarned += earned;
  state.high = Math.max(0, state.high - cannabis.decayPerSecond * mods.cannabisDecay * seconds);
  state.tolerance = Math.max(0, state.tolerance - cannabis.toleranceDecayPerSecond * seconds);
  return { seconds, earned };
}
