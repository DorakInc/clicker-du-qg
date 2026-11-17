// Écran de la battle de beat (bottom sheet #sheet-battle) : choix de la mise, partie, résultat.
// La logique (partition, jugement, gains) est dans src/game/battle.js ; ici, on dessine les notes
// qui tombent et on transmet les frappes. La mise et le résultat passent par `actions` :
//   actions.start(idTerritoire, indexMise) → l'événement battleStart (avec la partition), ou null
//   actions.finish(précision)              → les événements battleWin / battleLose (+ conquête)
//   actions.sound(type)                    → petit son (battleBeat à chaque temps, battleNote, battleMiss)
//   actions.getState()                     → l'état du jeu, pour les mises et les blocages
// Le temps de la partie vient de performance.now() : il ne dépend pas de la boucle du jeu.

import {
  advanceRun, battleBlock, battleCooldownLeft, battlePayout, battleStakes, battleTarget, createRun, formatDuration,
  formatMoney, formatNumber, runAccuracy, runDone, tapRun,
} from '../game/index.js';

const $ = (id) => document.getElementById(id);
const LANE_KEYS = [['arrowleft', 'a', 'j', '1'], ['arrowdown', 's', 'k', '2'], ['arrowright', 'd', 'l', '3']];
const LANE_ICONS = ['🥁', '🎹', '🎤'];
const LOOKAHEAD_BEATS = 2.5; // une note apparaît en haut 2,5 temps avant de toucher la ligne
const LINE = 0.86; // hauteur de la ligne de frappe, en part de la piste
const JUDGE_TEXT = { perfect: 'Parfait !', good: 'Bien', stray: 'Dans le vide', miss: 'Raté' };
const BLOCK_TEXT = {
  rival: 'Pas de rival à défier ici.',
  busy: 'Une battle est déjà en cours.',
  failOut: 'Pas de battle pendant un fail out : remonte la pente d\'abord.',
  event: 'Réponds d\'abord à l\'événement en cours.',
  money: 'Pas assez de cash pour cette mise.',
};
const pct = (x) => `${Math.round(x * 100)} %`;

export function createBattleView(data, actions, { openSheet, closeSheet }) {
  const lanes = data.battle.lanes;
  let territoryId = '';
  let shareIndex = 0;
  let run = null; // partie en cours
  let startedAt = 0;
  let target = 0;
  let noteEls = [];
  let frameId = 0;
  let beatShown = -1;

  // ---- Pistes et pads ----
  const laneEls = Array.from({ length: lanes }, (_, i) => {
    const lane = document.createElement('div');
    lane.className = 'battle-lane';
    lane.dataset.lane = String(i);
    lane.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(i); });
    return lane;
  });
  $('battle-lanes').replaceChildren(...laneEls);
  const padEls = Array.from({ length: lanes }, (_, i) => {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = 'battle-pad';
    pad.textContent = LANE_ICONS[i] ?? String(i + 1);
    pad.setAttribute('aria-label', `Piste ${i + 1}`);
    pad.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(i); });
    // Au clavier (Entrée / espace sur le pad), le clic arrive sans pointerdown.
    pad.addEventListener('click', (event) => { if (event.detail === 0) tap(i); });
    return pad;
  });
  $('battle-pads').replaceChildren(...padEls);
  $('battle-lanes').style.setProperty('--lanes', String(lanes));
  $('battle-pads').style.setProperty('--lanes', String(lanes));

  document.addEventListener('keydown', (event) => {
    if (!run || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const lane = LANE_KEYS.findIndex((keys) => keys.includes(event.key.toLowerCase()));
    if (lane < 0 || lane >= lanes) return;
    event.preventDefault();
    tap(lane);
  });

  // ---- 1. Le choix de la mise ----
  const stakeEls = data.battle.stakes.map((share, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'battle-stake';
    button.setAttribute('role', 'radio');
    const label = document.createElement('strong');
    label.textContent = pct(share);
    button.append(label, document.createElement('span'));
    button.onclick = () => { shareIndex = i; renderSetup(); };
    return button;
  });
  $('battle-stakes').replaceChildren(...stakeEls);

  function renderSetup() {
    const state = actions.getState();
    const t = data.map.territories.find((x) => x.id === territoryId);
    if (!state || !t) return;
    const goal = battleTarget(data, territoryId);
    $('battle-title').textContent = `Battle : ${t.name}`;
    $('battle-intro').textContent = `${t.rival} défend ${t.name}. Fais plus de ${pct(goal)} de précision pour gagner.`;
    const stakes = battleStakes(state, data);
    stakes.forEach((s, i) => {
      const button = stakeEls[i];
      button.classList.toggle('is-selected', i === shareIndex);
      button.setAttribute('aria-checked', String(i === shareIndex));
      button.lastChild.textContent = formatMoney(s.amount);
    });
    const amount = stakes[shareIndex]?.amount ?? 0;
    const best = battlePayout(data, amount, 1, goal);
    const atGoal = battlePayout(data, amount, goal, goal);
    $('battle-odds').textContent = `Victoire : de ${formatMoney(atGoal)} à ${formatMoney(best)} (sans-faute), et +${pct(data.battle.hypeShare)} de hype à ${t.name}. Défaite : la mise est perdue.`;
    $('battle-go-stake').textContent = formatMoney(amount);
    const block = battleBlock(state, data, territoryId, shareIndex);
    $('battle-block').textContent = block === 'cooldown'
      ? `${t.rival} récupère. Revanche dans ${formatDuration(battleCooldownLeft(state, data, territoryId))}.`
      : block === 'money' ? `Il faut une mise d'au moins ${formatMoney(data.battle.minStake)}.` : BLOCK_TEXT[block] ?? '';
    $('battle-go').disabled = Boolean(block);
  }

  function showPhase(name) {
    $('battle-setup').hidden = name !== 'setup';
    $('battle-play').hidden = name !== 'play';
    $('battle-result').hidden = name !== 'result';
    $('battle-close').hidden = name === 'play';
    $('sheet-battle').dataset.phase = name;
  }

  /** Ouvre l'écran de la battle pour un territoire. */
  function open(id) {
    if (run) return;
    territoryId = id;
    shareIndex = Math.min(shareIndex, data.battle.stakes.length - 1);
    showPhase('setup');
    $('sheet-battle').dataset.tone = '';
    renderSetup();
    openSheet('sheet-battle');
  }

  // ---- 2. La partie ----
  $('battle-go').onclick = () => {
    const start = actions.start(territoryId, shareIndex);
    if (!start) { renderSetup(); return; }
    target = start.target;
    run = createRun(start.chart);
    noteEls = run.notes.map((note) => {
      const n = document.createElement('div');
      n.className = 'battle-note';
      n.hidden = true;
      laneEls[note.lane].append(n);
      return n;
    });
    $('battle-rival-name').textContent = start.rival;
    $('battle-target').textContent = pct(target);
    $('battle-accuracy').textContent = '—';
    $('battle-combo').textContent = '';
    $('battle-judge').textContent = '';
    beatShown = -1;
    showPhase('play');
    openSheet('sheet-battle', { locked: true }); // pas de fermeture en pleine battle
    startedAt = performance.now();
    frameId = requestAnimationFrame(frame);
  };

  const now = () => (performance.now() - startedAt) / 1000;

  function judge(result, lane) {
    const el = $('battle-judge');
    el.textContent = JUDGE_TEXT[result];
    el.dataset.result = result;
    el.classList.remove('is-pop');
    void el.offsetWidth; // relance l'animation
    el.classList.add('is-pop');
    const pad = padEls[lane];
    if (pad) {
      pad.dataset.result = result;
      pad.classList.remove('is-hit');
      void pad.offsetWidth;
      pad.classList.add('is-hit');
    }
  }

  function tap(lane) {
    if (!run) return;
    const { result, note } = tapRun(run, data, lane, now());
    if (note) noteEls[run.notes.indexOf(note)].hidden = true;
    actions.sound(result === 'stray' ? 'battleMiss' : 'battleNote');
    judge(result, lane);
    renderScore();
  }

  /** Précision sur les notes déjà jouées (le score final compte toutes les notes). */
  function renderScore() {
    const judged = run.notes.filter((n) => n.result);
    if (judged.length || run.strays) {
      const partial = { notes: judged, strays: run.strays };
      $('battle-accuracy').textContent = pct(runAccuracy(partial, data));
    }
    $('battle-combo').textContent = run.combo >= 4 ? `combo ×${run.combo}` : '';
  }

  function frame() {
    if (!run) return;
    const t = now();
    const { spb } = run.chart;
    const lookahead = LOOKAHEAD_BEATS * spb;

    // Décompte pendant les temps d'intro, puis la ligne bat la mesure.
    const beat = Math.floor(t / spb);
    if (beat !== beatShown) {
      beatShown = beat;
      const lead = data.battle.leadInBeats;
      if (beat < lead) {
        const el = $('battle-judge');
        el.dataset.result = 'count';
        el.textContent = beat === lead - 1 ? 'Go !' : String(lead - 1 - beat);
      }
      $('battle-track').classList.toggle('is-beat', beat % 2 === 0);
      if (t < run.chart.duration) actions.sound('battleBeat'); // la grosse caisse donne le tempo
    }

    for (const note of advanceRun(run, data, t)) {
      noteEls[run.notes.indexOf(note)].hidden = true;
      judge('miss', note.lane);
      renderScore();
    }
    run.notes.forEach((note, i) => {
      if (note.result) return;
      const ahead = note.t - t;
      const el = noteEls[i];
      el.hidden = ahead > lookahead;
      if (!el.hidden) el.style.top = `${(LINE * (1 - ahead / lookahead)) * 100}%`;
    });

    if (runDone(run, t)) {
      finish();
      return;
    }
    frameId = requestAnimationFrame(frame);
  }

  // ---- 3. Le résultat ----
  function finish() {
    cancelAnimationFrame(frameId);
    const accuracy = runAccuracy(run, data);
    const maxCombo = run.maxCombo;
    run = null;
    for (const el of noteEls) el.remove();
    noteEls = [];
    const events = actions.finish(accuracy) ?? [];
    const result = events.find((e) => e.type === 'battleWin' || e.type === 'battleLose');
    showResult(result, maxCombo, events.some((e) => e.type === 'territoryConquered'));
  }

  function showResult(result, maxCombo = 0, conquered = false) {
    if (!result) { closeSheet(false, { force: true }); return; }
    const won = result.type === 'battleWin';
    $('sheet-battle').dataset.tone = won ? 'good' : 'bad';
    $('battle-result-icon').textContent = won ? '🏆' : '💀';
    $('battle-result-text').textContent = result.forfeit
      ? `La battle contre ${result.rival} a été laissée en plan. Elle compte comme perdue.`
      : won
        ? `Tu as battu ${result.rival} : ${pct(result.accuracy)} contre ${pct(result.target)}.${conquered ? ` ${result.name} est à toi !` : ''}`
        : `${result.rival} gagne : ${pct(result.accuracy)} contre ${pct(result.target)}. Retourne pratiquer.`;
    const items = won
      ? [[`+${formatMoney(result.payout - result.stake)}`, 'is-up'], ...(result.hype ? [[`+${formatNumber(result.hype)} hype`, 'is-up']] : [])]
      : [[`−${formatMoney(result.stake)}`, 'is-down']];
    if (maxCombo >= 4) items.push([`combo max ×${maxCombo}`, '']);
    $('battle-changes').replaceChildren(...items.map(([text, cls]) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (cls) li.className = cls;
      return li;
    }));
    showPhase('result');
    openSheet('sheet-battle', { locked: false });
    $('battle-ok').focus({ preventScroll: true });
  }
  $('battle-ok').onclick = () => closeSheet(false, { force: true });

  /** Fiche ouverte sur le choix de la mise : on garde les montants et les blocages à jour. */
  function update() {
    if (!run && !$('battle-setup').hidden && !$('sheet-battle').hidden) renderSetup();
  }

  return { open, update, showResult, get playing() { return Boolean(run); } };
}
