// Calculs de l'économie et actions du joueur (clic, achats).
// Aucune fonction ici ne touche à l'affichage : elles modifient l'état et
// retournent une liste d'événements ({ type, ...détails }) que l'affichage
// et l'audio peuvent écouter.

import { getModifiers } from './modifiers.js';

// ---- Lectures ----------------------------------------------------------

export function isUnlocked(def, state) {
  return state.tierIndex >= (def.requiresTier ?? 0);
}

export function producerCost(def, owned) {
  return Math.ceil(def.baseCost * def.costGrowth ** owned);
}

/** Multiplicateur de qualité des beats : 1 à jeun, plus haut avec le cannabis et l'inspiration (animaux). */
export function quality(state, data, mods = getModifiers(state, data)) {
  const c = data.balance.cannabis;
  return (1 + c.qualityPower * mods.cannabisPower * (state.high / c.maxHigh)) * mods.quality;
}

/** Trop de cannabis ralentit la production (1 = normal). */
export function overdoseFactor(state, data) {
  const { maxHigh, overdose } = data.balance.cannabis;
  if (!overdose.enabled || state.high <= overdose.threshold) return 1;
  const excess = (state.high - overdose.threshold) / (maxHigh - overdose.threshold);
  return 1 - overdose.productionPenalty * excess;
}

export function isOverdosed(state, data) {
  return overdoseFactor(state, data) < 1;
}

/** Ralentissements cumulés (surconsommation, fail out). */
export function productionFactor(state, data) {
  const fail = state.failOut ? data.balance.fail.productionMultiplier : 1;
  return overdoseFactor(state, data) * fail;
}

/** Bonus d'argent grâce à l'audience : +25 % par puissance de 10 fans (réglable). */
export function fanIncomeMultiplier(state, data) {
  return 1 + Math.log10(1 + state.fans) * data.balance.fans.incomeBonusPerDecade;
}

export function beatValue(state, data, mods = getModifiers(state, data)) {
  return (
    data.balance.baseBeatValue *
    quality(state, data, mods) *
    mods.beatValue *
    fanIncomeMultiplier(state, data)
  );
}

/** Beats par seconde des producteurs, sans ralentissement. */
export function rawBeatsPerSecond(state, data, mods = getModifiers(state, data)) {
  let total = 0;
  for (const def of data.producers) {
    total += (state.producers[def.id] ?? 0) * def.beatsPerSecond;
  }
  return total * mods.bps;
}

export function beatsPerSecond(state, data, mods = getModifiers(state, data)) {
  return rawBeatsPerSecond(state, data, mods) * productionFactor(state, data);
}

export function beatsPerClick(state, data, mods = getModifiers(state, data)) {
  return data.balance.clickBeats * mods.click * productionFactor(state, data);
}

export function incomePerSecond(state, data, mods = getModifiers(state, data)) {
  return beatsPerSecond(state, data, mods) * beatValue(state, data, mods);
}

/** Revenu « à jeun », sans ralentissement : sert à indexer le prix du cannabis. */
export function baseIncomePerSecond(state, data, mods = getModifiers(state, data)) {
  const sober = { ...state, high: 0 };
  return rawBeatsPerSecond(state, data, mods) * beatValue(sober, data, mods);
}

export function cannabisPrice(state, data, mods = getModifiers(state, data)) {
  const c = data.balance.cannabis;
  const base = c.basePrice + baseIncomePerSecond(state, data, mods) * c.priceIncomeSeconds;
  return Math.ceil(base * c.toleranceGrowth ** state.tolerance * mods.cannabisPrice);
}

// ---- Actions -----------------------------------------------------------

/** Ajoute des beats produits (clic ou producteurs) : argent et fans. */
export function produceBeats(state, data, beats, mods = getModifiers(state, data)) {
  if (beats <= 0) return 0;
  const earned = beats * beatValue(state, data, mods);
  state.money += earned;
  state.totalEarned += earned;
  state.totalBeats += beats;
  const { perBeat, qualityExponent } = data.balance.fans;
  state.fans += beats * perBeat * quality(state, data, mods) ** qualityExponent * mods.fanGain;
  return earned;
}

export function click(state, data) {
  const mods = getModifiers(state, data);
  const beats = beatsPerClick(state, data, mods);
  const earned = produceBeats(state, data, beats, mods);
  return [{ type: 'click', beats, earned, quality: quality(state, data, mods) }];
}

/** Effet d'une dose, qu'elle soit achetée ou cultivée à la serre. */
export function consumeCannabis(state, data, event) {
  const c = data.balance.cannabis;
  const wasOverdosed = isOverdosed(state, data);
  state.high = Math.min(c.maxHigh, state.high + c.highPerPurchase);
  state.tolerance += 1;
  state.broke = false;
  const events = [event];
  if (!wasOverdosed && isOverdosed(state, data)) events.push({ type: 'overdose' });
  return events;
}

export function buyCannabis(state, data) {
  const price = cannabisPrice(state, data);
  if (state.money < price) return [];
  state.money -= price;
  return consumeCannabis(state, data, { type: 'cannabisBuy', price });
}

export function buyProducer(state, data, id) {
  const def = data.producers.find((p) => p.id === id);
  if (!def || !isUnlocked(def, state)) return [];
  const owned = state.producers[id] ?? 0;
  const cost = producerCost(def, owned);
  if (state.money < cost) return [];
  state.money -= cost;
  state.producers[id] = owned + 1;
  return [{ type: 'buyProducer', id, name: def.name, count: owned + 1 }];
}

export function buyUpgrade(state, data, id) {
  const def = data.upgrades.find((u) => u.id === id);
  if (!def || state.upgrades[id] || !isUnlocked(def, state)) return [];
  if (state.money < def.cost) return [];
  state.money -= def.cost;
  state.upgrades[id] = true;
  return [{ type: 'buyUpgrade', id, name: def.name }];
}
