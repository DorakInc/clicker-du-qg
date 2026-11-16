// Avance la partie de `dt` secondes : production automatique, effet du
// cannabis qui s'estompe, fans, fail out et paliers de carrière.

import { getModifiers } from './modifiers.js';
import { beatsPerSecond, cannabisPrice, produceBeats } from './economy.js';

export function tick(state, data, dt) {
  const events = [];
  if (dt <= 0) return events;
  const { cannabis, fans, fail } = data.balance;
  let mods = getModifiers(state, data);

  state.time += dt;

  // Production automatique (calculée avant que l'effet baisse, sur ce pas de temps).
  produceBeats(state, data, beatsPerSecond(state, data, mods) * dt, mods);

  // Le cannabis s'estompe, la tolérance aussi.
  if (state.high > 0) {
    state.high = Math.max(0, state.high - cannabis.decayPerSecond * mods.cannabisDecay * dt);
    if (state.high === 0) events.push({ type: 'cannabisEmpty' });
  }
  state.tolerance = Math.max(0, state.tolerance - cannabis.toleranceDecayPerSecond * dt);

  // Une partie de l'audience décroche chaque seconde, plus vite en fail out.
  const churnRate = fans.churnPerSecond * mods.churn * (state.failOut ? fail.churnMultiplier : 1);
  state.fans *= Math.exp(-churnRate * dt);

  state.peakFans = Math.max(state.peakFans, state.fans);
  state.fansReference = Math.max(state.fansReference, state.fans);

  // Fail out : l'audience tombe sous une fraction de son niveau de référence.
  if (!state.failOut) {
    if (
      state.fansReference >= fail.minReferenceFans &&
      state.fans < state.fansReference * fail.enterRatio
    ) {
      state.failOut = true;
      events.push({ type: 'failStart' });
    }
  } else {
    // Le public oublie : la référence baisse plus vite que les fans
    // (referenceDecayPerSecond doit dépasser la perte de fans en fail out),
    // ce qui garantit qu'on finit par remonter la pente.
    state.fansReference = Math.max(
      state.fans,
      state.fansReference * Math.exp(-fail.referenceDecayPerSecond * dt),
    );
    if (state.fans >= state.fansReference * fail.exitRatio) {
      state.failOut = false;
      events.push({ type: 'failEnd' });
    }
  }

  // Paliers de carrière (débloqués une fois pour toutes par le record de fans).
  while (
    state.tierIndex + 1 < data.tiers.length &&
    state.peakFans >= data.tiers[state.tierIndex + 1].fansRequired
  ) {
    state.tierIndex += 1;
    mods = getModifiers(state, data);
    events.push({ type: 'tierUp', tierIndex: state.tierIndex, name: data.tiers[state.tierIndex].name });
  }

  // À sec : plus de cannabis actif et pas assez d'argent pour en racheter.
  // L'alerte part une seule fois, puis se réarme au prochain achat de cannabis.
  // On attend que la carrière soit lancée pour ne pas spammer le début de partie.
  if (
    !state.broke &&
    state.high === 0 &&
    state.fansReference >= fail.minReferenceFans &&
    state.money < cannabisPrice(state, data, mods)
  ) {
    state.broke = true;
    events.push({ type: 'broke' });
  }

  return events;
}
