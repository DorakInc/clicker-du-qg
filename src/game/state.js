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
    // La serre (débloquée à un palier de carrière)
    greenhouseUnlocked: false,
    grams: 0,
    totalGrams: 0,
    equipment: {}, // { idÉquipement: nombre possédé }
    strains: {}, // { idVariété: niveau }
    // La carte (débloquée à un palier de carrière)
    mapUnlocked: false,
    conquered: { [data.map?.startTerritory ?? 'quartier']: true }, // { idTerritoire: true }
    campaign: '', // territoire en cours de conquête ('' = aucun)
    hype: {}, // { idTerritoire: hype accumulée }
    promoUses: {}, // { idTerritoire: nombre de campagnes promo }
    sampleUses: {}, // { idTerritoire: nombre de distributions d'échantillons }
    failOut: false,
    broke: false,
    time: 0, // secondes jouées
    lastSeen: now,
  };
}
