// Battle de beat : un mini-jeu de rythme d'environ 25 s (une petite chanson de 8 mesures) contre un rival de la carte.
//   - On choisit un territoire ouvert (ou en campagne) qui a un rival, et une mise :
//     une part du cash (data/battle.json → stakes, jamais plus de 50 %).
//   - Des notes tombent sur 3 pistes (caisse claire, piano, kick) au tempo du QG (86 BPM) : elles forment un vrai beat sur la grille d'accords de la chanson. Le joueur tape en rythme ;
//     chaque note est « parfaite », « bonne » ou ratée. Taper dans le vide coûte un peu.
//   - Le rival a un score à battre (sa précision), plus dur pour les gros territoires.
//     Score battu : la mise revient multipliée (× 1,5 au score du rival, jusqu'à × 3 pour
//     un sans-faute) et le territoire gagne de la hype. Sinon, la mise est perdue.
//   - Une revanche contre le même rival attend `cooldownSeconds` (temps de jeu ; 0 = tout de suite).
//   - Jamais quand un événement attend une réponse, ni pendant un fail out sauf si
//     `allowDuringFailOut` vaut true (réglage actuel, le temps de tester).
// La partie elle-même (notes, frappes) vit hors de la sauvegarde, dans un « run » :
// seule la battle en cours (`state.battles.pending`) est sauvegardée. Si le jeu est fermé
// pendant une battle, elle compte comme perdue (abandonBattle) : pas de rage quit gratuit.
// `rng` (0 ≤ x < 1) peut être remplacé dans les tests. Rien ici ne touche à l'affichage.

import { addTerritoryHype, isAvailable, isConquered } from './conquest.js';

export function emptyBattles() {
  return {
    pending: null, // battle en cours : { territory, stake, target } (mise déjà payée)
    last: {}, // { idTerritoire: state.time de la dernière battle }
    wins: 0,
    losses: 0,
    best: 0, // meilleure précision, de 0 à 1
  };
}

const territoryOf = (data, id) => data.map.territories.find((t) => t.id === id) ?? null;
const lerp = (a, b, x) => a + (b - a) * x;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Les rivaux de la carte, du plus faible au plus fort (selon leur défense). */
function rivalsByStrength(data) {
  return data.map.territories.filter((t) => t.rival).sort((a, b) => (a.defense ?? 0) - (b.defense ?? 0));
}

/** Force d'un rival, de 0 (le plus faible) à 1 (le plus fort). */
export function rivalLevel(data, id) {
  const list = rivalsByStrength(data);
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return 0;
  return list.length > 1 ? i / (list.length - 1) : 0;
}

/** Précision que le rival atteint : le score à battre. */
export function battleTarget(data, id) {
  const { easiest, hardest } = data.battle.difficulty.target;
  return lerp(easiest, hardest, rivalLevel(data, id));
}

/** Territoires où l'on peut défier un rival : ouverts ou en campagne, pas encore conquis. */
export function battleRivals(state, data) {
  if (!state.mapUnlocked) return [];
  return data.map.territories.filter((t) => t.rival && !isConquered(state, t.id) && isAvailable(state, data, t));
}

export function battleCooldownLeft(state, data, id) {
  const last = state.battles.last[id];
  if (last === undefined) return 0;
  return Math.max(0, last + data.battle.cooldownSeconds - state.time);
}

/** Les mises proposées : [{ share, amount }], arrondies à l'unité. */
export function battleStakes(state, data) {
  return data.battle.stakes.map((share) => ({ share, amount: Math.floor(state.money * Math.min(share, 0.5)) }));
}

/**
 * Pourquoi la battle est impossible ('' = possible) :
 * 'rival' (pas de rival à défier ici), 'busy' (battle en cours), 'failOut', 'event' (question en attente),
 * 'cooldown' (revanche trop tôt), 'money' (mise trop petite).
 */
export function battleBlock(state, data, id, shareIndex = 0) {
  if (!battleRivals(state, data).some((t) => t.id === id)) return 'rival';
  if (state.battles.pending) return 'busy';
  if (state.failOut && !data.battle.allowDuringFailOut) return 'failOut';
  if (state.events.pending) return 'event';
  if (battleCooldownLeft(state, data, id) > 0) return 'cooldown';
  const stake = battleStakes(state, data)[shareIndex];
  if (!stake || stake.amount < data.battle.minStake) return 'money';
  return '';
}

/** Durée d'un temps, en secondes. */
export function secondsPerBeat(data) {
  return 60 / data.battle.bpm;
}

// ---- La chanson -----------------------------------------------------------------
// Une battle est une petite chanson (data/battle.json → song) : un décompte d'une mesure,
// puis des sections de 4 mesures (couplet, refrain), un accord par mesure, et une fin sur
// l'accord de départ (cadence V7 → I). Les temps se comptent depuis la fin du décompte :
// le temps 0 est le premier temps de la première mesure.

/** Les mesures de la chanson, dans l'ordre : [{ section, chord }]. */
export function songBars(data) {
  return data.battle.song.sections.flatMap((section, i) => section.chords.map((chord) => ({ section: i, chord })));
}

/**
 * La mesure jouée au temps `beat` (compté depuis la fin du décompte, peut être négatif) :
 * { bar, section, sectionName, chord, root, notes, ending }.
 * Pendant le décompte : la première mesure ; après la dernière : l'accord de fin.
 */
export function songAt(data, beat) {
  const { song, chords } = data.battle;
  const bars = songBars(data);
  const bar = Math.floor(beat / 4);
  const ending = bar >= bars.length;
  const current = ending ? { section: song.sections.length - 1, chord: song.ending } : bars[Math.max(0, bar)];
  const def = chords[current.chord];
  return {
    bar, ending, section: current.section, sectionName: ending ? 'Fin' : song.sections[current.section].name,
    chord: current.chord, root: def.root, notes: def.notes,
  };
}

/**
 * La partition : notes { t (secondes depuis le début), lane }, triées.
 * Elle joue un vrai beat (data/battle.json → groove) : sur chaque mesure, piano au 1er temps
 * (le changement d'accord), caisse claire sur 2 et 4, kick sur 3. Contre un rival plus fort,
 * le kick double le piano au 1er temps et des contretemps s'ajoutent (kick syncopé, piano
 * qui annonce l'accord suivant), plus souvent au refrain. La dernière note tombe sur l'accord
 * de fin, le temps juste après la dernière mesure.
 */
export function createChart(data, id, rng = Math.random) {
  const config = data.battle;
  const level = rivalLevel(data, id);
  const { offbeat, doubles } = config.difficulty;
  const pOff = lerp(offbeat.easiest, offbeat.hardest, level);
  const pDouble = lerp(doubles.easiest, doubles.hardest, level);
  const spb = secondsPerBeat(data);
  const laneOf = (instrument) => config.instruments.findIndex((i) => i.id === instrument);
  const { base, doubles: doubleHits, offbeats } = config.groove;
  const sections = config.song.sections;
  const notes = [];
  const at = (beat) => (config.leadInBeats + beat) * spb;
  const downbeat = (beat) => {
    notes.push({ t: at(beat), lane: laneOf(base[0]) });
    for (const d of doubleHits) if (d.beat === 1 && rng() < pDouble) notes.push({ t: at(beat), lane: laneOf(d.lane) });
  };
  songBars(data).forEach(({ section }, bar) => {
    const intensity = sections[section].intensity ?? 1;
    const last = bar === config.beats / 4 - 1;
    for (let i = 0; i < 4; i += 1) {
      const beat = bar * 4 + i;
      if (i === 0) downbeat(beat);
      else notes.push({ t: at(beat), lane: laneOf(base[i]) });
      if (i > 0) for (const d of doubleHits) if (d.beat === i + 1 && rng() < pDouble) notes.push({ t: at(beat), lane: laneOf(d.lane) });
      // Contretemps (le « et » après le temps) ; pas après le 4e temps de la dernière mesure.
      const off = offbeats.find((o) => o.beat === i + 1);
      if (off && !(last && i === 3) && rng() < pOff * intensity) notes.push({ t: at(beat) + spb / 2, lane: laneOf(off.lane) });
    }
  });
  downbeat(config.beats); // l'accord de fin
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  const duration = (config.leadInBeats + config.beats + 2) * spb;
  return { notes, duration, spb };
}

// ---- Le run : la partie en train de se jouer (pas sauvegardée) ----------------

export function createRun(chart) {
  return {
    chart,
    notes: chart.notes.map((n) => ({ ...n, result: '' })), // result : '' | 'perfect' | 'good' | 'miss'
    strays: 0, // frappes dans le vide
    combo: 0,
    maxCombo: 0,
  };
}

/**
 * Le joueur tape la piste `lane` au temps `t` (secondes depuis le début).
 * Renvoie { result: 'perfect' | 'good' | 'stray', note } ; la note la plus proche encore libre est jugée.
 */
export function tapRun(run, data, lane, t) {
  const { perfect, good } = data.battle.windows;
  let best = null;
  for (const note of run.notes) {
    if (note.result || note.lane !== lane) continue;
    const gap = Math.abs(note.t - t);
    if (gap <= good && (!best || gap < Math.abs(best.t - t))) best = note;
  }
  if (!best) {
    run.strays += 1;
    run.combo = 0;
    return { result: 'stray', note: null };
  }
  best.result = Math.abs(best.t - t) <= perfect ? 'perfect' : 'good';
  run.combo += 1;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  return { result: best.result, note: best };
}

/** Avance le temps : les notes passées sans être frappées sont ratées. Renvoie les notes ratées. */
export function advanceRun(run, data, t) {
  const { good } = data.battle.windows;
  const missed = [];
  for (const note of run.notes) {
    if (!note.result && note.t + good < t) {
      note.result = 'miss';
      missed.push(note);
    }
  }
  if (missed.length) run.combo = 0;
  return missed;
}

export function runDone(run, t) {
  return t >= run.chart.duration;
}

/** Précision de 0 à 1 : points des notes ÷ (notes + une demi-note par frappe dans le vide). */
export function runAccuracy(run, data) {
  const { points } = data.battle;
  const total = run.notes.length + run.strays * 0.5;
  if (!total) return 0;
  const score = run.notes.reduce((sum, n) => sum + (points[n.result] ?? 0), 0);
  return clamp01(score / total);
}

/** Combien rapporte une mise selon la précision (0 = mise perdue). */
export function battlePayout(data, stake, accuracy, target) {
  if (accuracy < target) return 0;
  const { atTarget, perfect } = data.battle.payout;
  const x = target >= 1 ? 1 : (accuracy - target) / (1 - target);
  return Math.floor(stake * lerp(atTarget, perfect, clamp01(x)));
}

// ---- Actions -------------------------------------------------------------------

/** Paie la mise et lance la battle. Renvoie [{ type: 'battleStart', id, rival, stake, target, chart }]. */
export function startBattle(state, data, id, shareIndex = 0, rng = Math.random) {
  if (battleBlock(state, data, id, shareIndex)) return [];
  const t = territoryOf(data, id);
  const stake = battleStakes(state, data)[shareIndex].amount;
  const target = battleTarget(data, id);
  state.money -= stake;
  state.battles.pending = { territory: id, stake, target };
  state.battles.last[id] = state.time;
  const chart = createChart(data, id, rng);
  return [{ type: 'battleStart', id, name: t.name, rival: t.rival, stake, target, chart }];
}

/**
 * Fin de la battle en cours avec la précision obtenue.
 * Renvoie [{ type: 'battleWin' | 'battleLose', id, rival, accuracy, target, stake, payout }, ...conquête].
 */
export function finishBattle(state, data, accuracy, { forfeit = false } = {}) {
  const pending = state.battles.pending;
  if (!pending) return [];
  state.battles.pending = null;
  const t = territoryOf(data, pending.territory);
  const acc = clamp01(Number(accuracy) || 0);
  const payout = battlePayout(data, pending.stake, acc, pending.target);
  const won = payout > 0;
  const base = {
    id: pending.territory, name: t?.name ?? '', rival: t?.rival ?? '', accuracy: acc, target: pending.target,
    stake: pending.stake, payout, forfeit,
  };
  state.battles.best = Math.max(state.battles.best, acc);
  if (!won) {
    state.battles.losses += 1;
    return [{ type: 'battleLose', ...base, hype: 0 }];
  }
  state.battles.wins += 1;
  state.money += payout;
  state.totalEarned += payout - pending.stake; // le profit compte comme de l'argent gagné
  const hype = t && !isConquered(state, t.id) ? t.hype * data.battle.hypeShare : 0;
  const conquest = hype ? addTerritoryHype(state, data, t.id, hype) : [];
  return [{ type: 'battleWin', ...base, hype }, ...conquest];
}

/** Battle laissée en plan (jeu fermé pendant la partie) : elle compte comme perdue. */
export function abandonBattle(state, data) {
  return finishBattle(state, data, 0, { forfeit: true });
}

/** Relit `state.battles` d'une sauvegarde : champs manquants ou abîmés → valeurs par défaut. */
export function repairBattles(saved, data) {
  const out = emptyBattles();
  if (!saved || typeof saved !== 'object') return out;
  const count = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  out.wins = count(saved.wins);
  out.losses = count(saved.losses);
  out.best = Number.isFinite(saved.best) ? clamp01(saved.best) : 0;
  if (saved.last && typeof saved.last === 'object') {
    for (const [id, time] of Object.entries(saved.last)) {
      if (territoryOf(data, id) && Number.isFinite(time)) out.last[id] = time;
    }
  }
  const p = saved.pending;
  if (p && typeof p === 'object' && territoryOf(data, p.territory) && Number.isFinite(p.stake) && p.stake >= 0) {
    out.pending = { territory: p.territory, stake: p.stake, target: Number.isFinite(p.target) ? clamp01(p.target) : battleTarget(data, p.territory) };
  }
  return out;
}
