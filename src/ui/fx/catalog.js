// Fiche technique courte de chaque animation produite (voir docs/animations/).
//   priority : 0 récompense majeure, 1 action importante, 2 clic courant, 3 ambiance
//   rule     : restart | merge | stack | queue | ignore (charte, section 5)

export const CATALOG = [
  { num: 1, id: 'click_squash', name: 'Enfoncement du vinyle', priority: 2, rule: 'restart', duration: 180 },
  { num: 5, id: 'gain_float', name: 'Nombre de gain', priority: 2, rule: 'merge', duration: 800 },
  { num: 6, id: 'click_quality', name: 'Le gros beat (zen)', priority: 2, rule: 'stack', duration: 420 },
  { num: 11, id: 'char_breathe', name: 'Respiration du personnage', priority: 3, rule: 'restart', duration: 1400 },
  { num: 22, id: 'coins_to_counter', name: 'Pièces vers « le cash »', priority: 2, rule: 'stack', duration: 850 },
  { num: 32, id: 'ui_press', name: 'Bouton papier enfoncé', priority: 1, rule: 'restart', duration: 160 },
  { num: 34, id: 'ui_refuse', name: 'Refus : il manque du cash', priority: 1, rule: 'ignore', duration: 240 },
  { num: 41, id: 'shop_buy', name: 'Achat dans la boutique', priority: 1, rule: 'restart', duration: 350 },
  { num: 45, id: 'tier_up', name: 'Nouveau palier', priority: 0, rule: 'queue', duration: 2400 },
  { num: 55, id: 'territory_conquered', name: 'Territoire conquis', priority: 0, rule: 'queue', duration: 2200 },
];

/** Événements du jeu (src/game) → animation. Les clics sont lancés directement par main.js. */
export const EVENT_FX = {
  buyProducer: 'shop_buy',
  buyUpgrade: 'shop_buy',
  buyEquipment: 'shop_buy',
  buyStrain: 'shop_buy',
  tierUp: 'tier_up',
  territoryConquered: 'territory_conquered',
};
