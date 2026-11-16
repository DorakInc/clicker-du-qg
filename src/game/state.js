// L'état complet d'une partie. Tout ce qui est ici est sauvegardé.

export const SAVE_VERSION = 1;

export function createState(data, characterId, now = Date.now()) {
  return {
    version: SAVE_VERSION,
    characterId,
    money: data.balance.startMoney,
    totalEarned: 0,
    totalBeats: 0,
    fans: 0,
    peakFans: 0, // record absolu, sert aux paliers de carrière
    fansReference: 0, // niveau de fans « normal » auquel on compare pour le fail out
    high: 0, // niveau de cannabis actif, de 0 à balance.cannabis.maxHigh
    tolerance: 0, // fait monter le prix du cannabis, redescend avec le temps
    producers: {}, // { idProducteur: nombre possédé }
    upgrades: {}, // { idUpgrade: true }
    tierIndex: 0,
    failOut: false,
    broke: false,
    time: 0, // secondes jouées
    lastSeen: now,
  };
}
