// Les animaux de compagnie : on en adopte un (en $), puis on lui donne des
// gâteries pour monter son niveau d'amitié. Chaque niveau applique encore une
// fois ses effets (inspiration = qualité des beats, zen qui dure, ventes).
// Tous les animaux adoptés vivent au QG et donnent leur bonus ; un seul,
// le « compagnon », se tient à côté du personnage.
// Données : data/pets.json.

import { isUnlocked } from './economy.js';

/** Prix du prochain niveau : niveau 0 → adoption, ensuite une gâterie. */
export function petCost(def, level) {
  return Math.ceil(def.cost * def.costGrowth ** level);
}

export function petLevel(state, id) {
  return state.pets?.[id] ?? 0;
}

/** Adopter (niveau 0) ou donner une gâterie (niveau 1 et plus). */
export function buyPet(state, data, id) {
  const def = data.pets?.find((p) => p.id === id);
  if (!def || !isUnlocked(def, state)) return [];
  const level = petLevel(state, id);
  const cost = petCost(def, level);
  if (state.money < cost) return [];
  state.money -= cost;
  state.pets[id] = level + 1;
  if (level === 0) {
    // Le nouvel animal vient se coller à toi.
    state.companion = id;
    return [{ type: 'adoptPet', id, name: def.name }];
  }
  return [{ type: 'treatPet', id, name: def.name, level: level + 1 }];
}

/** Choisir l'animal qui se tient à côté du personnage (il doit être adopté). */
export function setCompanion(state, data, id) {
  const def = data.pets?.find((p) => p.id === id);
  if (!def || petLevel(state, id) === 0 || state.companion === id) return [];
  state.companion = id;
  return [{ type: 'companion', id, name: def.name }];
}
