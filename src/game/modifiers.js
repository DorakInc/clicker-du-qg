// Combine les effets du personnage (préfait ou créé), des upgrades achetés, des animaux, de la vibe du studio et du palier de carrière
// en une liste de multiplicateurs. Chaque effet de données a la forme
// { "stat": "<une des STATS>", "multiply": <nombre> }.

import { vibeEffects } from './studio.js';
import { characterOf } from './creation.js';

export const STATS = [
  'click', // beats par clic
  'bps', // beats par seconde des producteurs
  'beatValue', // argent par beat
  'fanGain', // fans gagnés par beat
  'churn', // perte naturelle de fans
  'cannabisDecay', // vitesse à laquelle l'effet du cannabis s'estompe
  'cannabisPrice', // prix du cannabis
  'cannabisPower', // gain de qualité apporté par le cannabis
  'grow', // grammes par seconde de la serre
  'harvest', // grammes par clic de récolte
  'hype', // vitesse de conquête des territoires
  'quality', // inspiration : multiplie la qualité des beats (animaux de compagnie)
];

export function getModifiers(state, data) {
  const mods = Object.fromEntries(STATS.map((stat) => [stat, 1]));
  const apply = (effects = [], times = 1) => {
    for (const { stat, multiply } of effects) {
      if (stat in mods) mods[stat] *= multiply ** times;
    }
  };

  apply(characterOf(state, data)?.effects); // préfait ou créé par le joueur (creation.js)
  for (const upgrade of data.upgrades) {
    if (state.upgrades[upgrade.id]) apply(upgrade.effects);
  }
  // Les variétés de la serre ont des niveaux : l'effet s'applique une fois par niveau.
  for (const strain of data.greenhouse?.strains ?? []) {
    apply(strain.effects, state.strains?.[strain.id] ?? 0);
  }
  // Animaux de compagnie : l'effet s'applique une fois par niveau d'amitié.
  for (const pet of data.pets ?? []) {
    apply(pet.effects, state.pets?.[pet.id] ?? 0);
  }
  // Vibe du studio : deux objets posés côte à côte (data/decor.json → vibe).
  apply(vibeEffects(state, data));
  for (const t of data.map?.territories ?? []) {
    if (state.conquered?.[t.id]) apply(t.effects);
  }
  // Les bonus de paliers se cumulent : atteindre le palier 3 donne aussi ceux des paliers 1 et 2.
  for (let i = 0; i <= state.tierIndex && i < data.tiers.length; i += 1) {
    apply(data.tiers[i].effects);
  }
  // Effets temporaires des événements (panne de courant, beat viral...).
  for (const buff of state.events?.active ?? []) {
    if (buff.until > state.time && buff.stat in mods) mods[buff.stat] *= buff.multiply;
  }
  return mods;
}
