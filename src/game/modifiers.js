// Combine les effets du personnage, des upgrades achetés et du palier de carrière
// en une liste de multiplicateurs. Chaque effet de données a la forme
// { "stat": "<une des STATS>", "multiply": <nombre> }.

export const STATS = [
  'click', // beats par clic
  'bps', // beats par seconde des producteurs
  'beatValue', // argent par beat
  'fanGain', // fans gagnés par beat
  'churn', // perte naturelle de fans
  'cannabisDecay', // vitesse à laquelle l'effet du cannabis s'estompe
  'cannabisPrice', // prix du cannabis
  'cannabisPower', // gain de qualité apporté par le cannabis
];

export function getModifiers(state, data) {
  const mods = Object.fromEntries(STATS.map((stat) => [stat, 1]));
  const apply = (effects = []) => {
    for (const { stat, multiply } of effects) {
      if (stat in mods) mods[stat] *= multiply;
    }
  };

  apply(data.characters.find((c) => c.id === state.characterId)?.effects);
  for (const upgrade of data.upgrades) {
    if (state.upgrades[upgrade.id]) apply(upgrade.effects);
  }
  // Les bonus de paliers se cumulent : atteindre le palier 3 donne aussi ceux des paliers 1 et 2.
  for (let i = 0; i <= state.tierIndex && i < data.tiers.length; i += 1) {
    apply(data.tiers[i].effects);
  }
  return mods;
}
