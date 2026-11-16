// La serre : un deuxième clicker, débloqué à un palier de carrière.
//   - L'équipement s'achète en argent ($) et fait pousser des grammes.
//   - Cliquer « Récolter » donne des grammes tout de suite.
//   - Les grammes servent à rouler des joints maison (au lieu d'acheter du
//     cannabis) et à développer des variétés qui boostent tout l'empire.
//     Chaque variété a des niveaux sans fin, de plus en plus chers.
// Données : data/greenhouse.json.

import { getModifiers } from './modifiers.js';
import { consumeCannabis, producerCost } from './economy.js';

export function isGreenhouseUnlocked(state) {
  return state.greenhouseUnlocked;
}

export function equipmentCost(def, owned) {
  return producerCost(def, owned);
}

export function gramsPerSecond(state, data, mods = getModifiers(state, data)) {
  if (!state.greenhouseUnlocked) return 0;
  let total = 0;
  for (const def of data.greenhouse.equipment) total += (state.equipment[def.id] ?? 0) * def.gramsPerSecond;
  return total * mods.grow;
}

/** Une récolte à la main donne une base fixe plus une part de la production automatique. */
export function gramsPerClick(state, data, mods = getModifiers(state, data)) {
  const gh = data.greenhouse;
  return (gh.clickGrams + gramsPerSecond(state, data, mods) * gh.clickShareOfGrowth) * mods.harvest;
}

export function jointCost(state, data, mods = getModifiers(state, data)) {
  const c = data.balance.cannabis;
  return Math.ceil(data.greenhouse.jointGrams * c.toleranceGrowth ** state.tolerance * mods.cannabisPrice);
}

export function addGrams(state, grams) {
  state.grams += grams;
  state.totalGrams += grams;
}

// ---- Actions -----------------------------------------------------------

export function harvest(state, data) {
  if (!state.greenhouseUnlocked) return [];
  const grams = gramsPerClick(state, data);
  addGrams(state, grams);
  return [{ type: 'harvest', grams }];
}

export function rollJoint(state, data) {
  if (!state.greenhouseUnlocked) return [];
  const cost = jointCost(state, data);
  if (state.grams < cost) return [];
  state.grams -= cost;
  return consumeCannabis(state, data, { type: 'jointHomegrown', grams: cost });
}

export function buyEquipment(state, data, id) {
  const def = data.greenhouse.equipment.find((e) => e.id === id);
  if (!def || !state.greenhouseUnlocked) return [];
  const owned = state.equipment[id] ?? 0;
  const cost = equipmentCost(def, owned);
  if (state.money < cost) return [];
  state.money -= cost;
  state.equipment[id] = owned + 1;
  return [{ type: 'buyEquipment', id, name: def.name, count: owned + 1 }];
}

export function strainCost(def, level) {
  return Math.ceil(def.cost * def.costGrowth ** level);
}

export function buyStrain(state, data, id) {
  const def = data.greenhouse.strains.find((s) => s.id === id);
  if (!def || !state.greenhouseUnlocked) return [];
  const level = state.strains[id] ?? 0;
  const cost = strainCost(def, level);
  if (state.grams < cost) return [];
  state.grams -= cost;
  state.strains[id] = level + 1;
  return [{ type: 'buyStrain', id, name: def.name, level: level + 1 }];
}

/** Appelé à chaque tick : déblocage et pousse. */
export function tickGreenhouse(state, data, dt, mods) {
  const events = [];
  if (!state.greenhouseUnlocked && state.tierIndex >= data.greenhouse.unlockTier) {
    state.greenhouseUnlocked = true;
    events.push({ type: 'greenhouseUnlock' });
  }
  addGrams(state, gramsPerSecond(state, data, mods) * dt);
  return events;
}
