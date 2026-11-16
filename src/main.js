// Point d'entrée : charge les données, la sauvegarde, puis fait tourner la
// boucle de jeu. Relie la logique (src/game), l'affichage (src/ui) et
// l'audio (src/audio).

import {
  SAVE_KEY, applyOffline, buyCannabis, buyEquipment, buyPet, buyProducer, buyStrain, buyUpgrade, click,
  createState, deserialize, formatDuration, formatMoney, formatNumber, giveSamples, harvest, playShow,
  resolveEvent, rollJoint, runPromo, serialize, setCompanion, startCampaign, tick, triggerEvent,
} from './game/index.js';
import { createGameView, showCharacterSelect } from './ui/view.js';
import { createAudio } from './audio/audio.js';
import { createFx } from './ui/fx/fx.js';
import { createMotion, MOTION_MODES } from './ui/fx/motion.js';
import { PROFILE_KEY, createLeaderboard } from './online/leaderboard.js';
import { liveFromState } from './online/rules.js';
import { createLeaderboardView } from './ui/leaderboard-view.js';

const DATA_FILES = ['balance', 'characters', 'producers', 'upgrades', 'tiers', 'texts', 'sounds', 'greenhouse', 'map', 'fx', 'online', 'events', 'pets'];
const MOTION_LABELS = { auto: 'Animations : auto', reduced: 'Animations : réduites', full: 'Animations : complètes' };
const SETTINGS_KEY = 'clicker-du-qg/settings';
const RENDER_INTERVAL = 1 / 15; // l'affichage est rafraîchi 15 fois par seconde
const FAN_TREND_INTERVAL = 5;
const FAN_REACTION_INTERVAL = 25;

// Événements qui affichent un message (clé dans texts.json → style).
const MESSAGE_EVENTS = {
  cannabisBuy: '',
  cannabisEmpty: '',
  overdose: 'danger',
  broke: 'danger',
  failStart: 'danger',
  failEnd: '',
  tierUp: '',
  buyUpgrade: '',
  greenhouseUnlock: '',
  jointHomegrown: '',
  buyStrain: '',
  mapUnlock: '',
  campaignStart: '',
  territoryConquered: '',
  adoptPet: '',
  treatPet: '',
  companion: '',
};

// ---- Stockage (protégé : navigation privée, stockage bloqué...) ----------

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* rien à faire */ }
  },
};

function loadSettings() {
  const defaults = { sound: true, motion: 'auto' };
  try { return { ...defaults, ...JSON.parse(storage.get(SETTINGS_KEY) ?? '{}') }; } catch { return defaults; }
}

// ---- Textes --------------------------------------------------------------

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function message(data, key, values = {}) {
  const list = data.texts.messages[key];
  return list?.length ? fill(pick(list), values) : null;
}

// ---- Démarrage -----------------------------------------------------------

async function loadData() {
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok) throw new Error(`data/${name}.json : ${response.status}`);
      return [name, await response.json()];
    }),
  );
  return Object.fromEntries(entries);
}

async function boot() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    console.error(error);
    document.getElementById('load-error').hidden = false;
    return;
  }

  const settings = loadSettings();
  const audio = createAudio(data.sounds, { enabled: settings.sound });
  const motion = createMotion({ mode: settings.motion });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('keydown', () => audio.unlock(), { once: true });

  const saved = deserialize(storage.get(SAVE_KEY) ?? '', data);
  if (saved) {
    const offline = applyOffline(saved, data);
    startGame(data, saved, { audio, settings, motion, offline });
  } else {
    showCharacterSelect(data, (characterId) => {
      audio.unlock();
      audio.play('characterSelect');
      const state = createState(data, characterId);
      storage.set(SAVE_KEY, serialize(state));
      startGame(data, state, { audio, settings, motion, offline: null });
    });
  }
}

function startGame(data, state, { audio, settings, motion, offline }) {
  const character = data.characters.find((c) => c.id === state.characterId);
  let resetting = false;

  // Les animations trouvent les éléments de la page par la vue (créée juste après).
  let viewRef = null;
  const anchors = new Proxy({}, { get: (_, key) => viewRef?.anchors[key] });
  const fx = createFx(data.fx, { anchors, motion });
  fx.installPress();

  /** Nombre de gain au point de contact (animation 05). */
  function floatGain(event, button, amount, kind, format, level = 0) {
    const rect = button.getBoundingClientRect();
    const keyboard = !event.clientX && !event.clientY;
    const home = { x: rect.left + rect.width / 2, y: rect.top };
    fx.play('gain_float', {
      x: keyboard ? home.x : event.clientX,
      y: keyboard ? home.y : event.clientY,
      home, amount, kind, format, level,
      touch: event.pointerType === 'touch',
    });
  }

  const view = createGameView(data, {
    click(event) {
      const events = click(state, data);
      const { earned, quality } = events[0];
      const level = fx.play('click_quality', { quality, target: view.beatButton.querySelector('.vinyl-label') });
      floatGain(event, view.beatButton, earned, 'money', (n) => `+${formatMoney(n)}`, level);
      handle(events);
    },
    harvest(event) {
      const events = harvest(state, data);
      if (!events.length) return;
      floatGain(event, view.harvestButton, events[0].grams, 'grams', (n) => `+${formatNumber(n)} g`);
      handle(events);
    },
    rollJoint: () => handle(rollJoint(state, data)),
    startCampaign: (id) => handle(startCampaign(state, data, id)),
    playShow(event) {
      const events = playShow(state, data);
      if (!events.length) return;
      floatGain(event, view.showButton, events[0].hype, 'hype', (n) => `+${formatNumber(n)} hype`);
      handle(events);
    },
    runPromo: () => handle(runPromo(state, data)),
    giveSamples: () => handle(giveSamples(state, data)),
    buyEquipment: (id) => handle(buyEquipment(state, data, id)),
    buyStrain: (id) => handle(buyStrain(state, data, id)),
    buyCannabis: () => handle(buyCannabis(state, data)),
    buyProducer: (id) => handle(buyProducer(state, data, id)),
    buyUpgrade: (id) => handle(buyUpgrade(state, data, id)),
    buyPet: (id) => handle(buyPet(state, data, id)),
    setCompanion: (id) => handle(setCompanion(state, data, id)),
    petPet: () => audio.play('petPet'),
    reset() {
      const online = storage.get(PROFILE_KEY) ? ' Tu es connecté : la partie en ligne sera aussi remplacée (ton record au classement reste).' : '';
      if (!confirm(`Recommencer une nouvelle partie ? La progression actuelle sera perdue.${online}`)) return;
      resetting = true;
      storage.remove(SAVE_KEY);
      location.reload();
    },
    toggleSound() {
      settings.sound = !settings.sound;
      audio.setEnabled(settings.sound);
      view.setSoundLabel(settings.sound);
      storage.set(SETTINGS_KEY, JSON.stringify(settings));
    },
  }, fx);
  viewRef = view;
  view.setSoundLabel(settings.sound);

  // Option mouvements réduits : auto (système) → réduites → complètes.
  const motionButton = document.getElementById('toggle-motion');
  const showMotion = () => { motionButton.textContent = MOTION_LABELS[motion.mode]; };
  motionButton.onclick = () => {
    const next = MOTION_MODES[(MOTION_MODES.indexOf(motion.mode) + 1) % MOTION_MODES.length];
    motion.setMode(next);
    settings.motion = next;
    storage.set(SETTINGS_KEY, JSON.stringify(settings));
    showMotion();
  };
  showMotion();

  // ---- Classement en ligne (src/online/) ----
  // ?classement=demo : faux serveur en mémoire, pour essayer sans compte Supabase.
  // Le pseudo + code portent aussi la sauvegarde en ligne : la partie suit le joueur d'un appareil à l'autre.
  // Avec la sauvegarde partent les stats publiques de la partie (onglet « Temps réel », page de carrière).
  const leaderboard = createLeaderboard({
    config: data.online,
    storage,
    demo: new URLSearchParams(location.search).get('classement') === 'demo',
    onMessage: (text, kind = '') => view.showMessage(text, kind),
    getSaveText: () => {
      state.lastSeen = Date.now();
      return serialize(state);
    },
    getLiveStats: () => liveFromState(state, data),
    isValidSave: (saved) => deserialize(JSON.stringify(saved), data) !== null,
    onLoadSave(text) {
      // Reprendre la partie en ligne : on remplace la sauvegarde locale et on relance le jeu.
      resetting = true;
      storage.set(SAVE_KEY, text);
      location.reload();
    },
  });
  createLeaderboardView(data, leaderboard, {
    goToBoard: () => view.setScene('classement'),
    openSheet: (id) => view.openSheet(id),
    closeSheet: () => view.closeSheet(),
  });
  leaderboard.start(() => state);

  /** Réponse du joueur à une question d'événement (police, voisin...). */
  function chooseEvent(index) {
    handle(resolveEvent(state, data, index));
  }

  function handle(events) {
    for (const event of events) {
      audio.play(event.type);
      if (event.type === 'event' || event.type === 'eventPrompt' || event.type === 'eventResult') {
        view.showEvent(event, chooseEvent);
        const def = data.events.list.find((e) => e.id === event.id);
        if (event.type !== 'eventPrompt') {
          view.showMessage(`${def.icon} ${def.title} : ${event.text}`, event.tone === 'bad' ? 'danger' : '');
        }
      }
      if (event.type === 'eventEnd') {
        const def = data.events.list.find((e) => e.id === event.id);
        if (def) view.showMessage(`${def.icon} Fin de l'effet : ${def.title.toLowerCase()}.`);
      }
      fx.onGameEvent(event);
      if (event.type === 'tierUp') leaderboard.requestSubmit();
      if (event.type === 'greenhouseUnlock') view.announceGreenhouse();
      if (event.type === 'mapUnlock') view.announceMap();
      if (event.type in MESSAGE_EVENTS) {
        const key = event.type === 'campaignStart' && event.rival ? 'campaignRival' : event.type;
        const text = message(data, key, { tier: event.name, name: event.name, rival: event.rival, level: event.level });
        if (text) view.showMessage(text, MESSAGE_EVENTS[event.type]);
      }
    }
    if (events.length) view.update(state);
  }

  function save() {
    if (resetting) return;
    state.lastSeen = Date.now();
    const ok = storage.set(SAVE_KEY, serialize(state));
    view.setSaveStatus(ok ? `Sauvegardé à ${new Date().toLocaleTimeString('fr-CA')}` : 'Sauvegarde impossible dans ce navigateur');
  }

  function showOffline(result) {
    if (result && result.earned > 0) {
      view.showMessage(message(data, 'offline', {
        duration: formatDuration(result.seconds),
        money: formatMoney(result.earned),
      }));
    }
    if (result && result.grams > 0) {
      view.showMessage(message(data, 'offlineGrams', { grams: `${formatNumber(result.grams)} g` }));
    }
  }

  view.showMessage(message(data, 'welcome', { name: character.name }));
  showOffline(offline);
  view.update(state);

  // Une question d'événement restée sans réponse (jeu fermé entre-temps) revient à l'écran.
  if (state.events.pending) view.showEvent({ type: 'eventPrompt', id: state.events.pending }, chooseEvent);
  // Pour essayer un événement sans attendre : ?evenement=police (voir data/events.json).
  const forcedEvent = new URLSearchParams(location.search).get('evenement');
  if (forcedEvent && !state.events.pending) handle(triggerEvent(state, data, forcedEvent));

  // ---- Boucle de jeu ----
  const { minSeconds } = data.balance.offline;
  let last = performance.now();
  let sinceRender = 0;
  let sinceSave = 0;
  let sinceTrend = 0;
  let sinceReaction = 0;
  let trendFans = state.fans;
  let trend = '';

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;

    if (dt > minSeconds) {
      // Onglet en arrière-plan ou ordinateur en veille : calcul hors ligne.
      showOffline(applyOffline(state, data, Date.now()));
    } else {
      const earnedBefore = state.totalEarned;
      handle(tick(state, data, dt));
      fx.addIncome(state.totalEarned - earnedBefore); // revenu automatique → pièces (animation 22)
      fx.update(dt);
      leaderboard.tick(dt);
      state.lastSeen = Date.now();
    }

    audio.setMood(
      state.failOut ? 'echec'
        : state.high > 0 ? 'cannabis'
          : trend === 'down' ? 'baisse'
            : 'normal',
    );

    sinceTrend += dt;
    if (sinceTrend >= FAN_TREND_INTERVAL) {
      sinceTrend = 0;
      const delta = state.fans - trendFans;
      trend = Math.abs(delta) < Math.max(1, trendFans * 0.01) ? '' : delta > 0 ? 'up' : 'down';
      trendFans = state.fans;
      view.setFansTrend(trend);
    }

    sinceReaction += dt;
    if (sinceReaction >= FAN_REACTION_INTERVAL && trend && state.fans >= 10) {
      sinceReaction = 0;
      view.showMessage(pick(data.texts.fanReactions[trend]), 'fan');
    }

    sinceRender += dt;
    if (sinceRender >= RENDER_INTERVAL) {
      sinceRender = 0;
      view.update(state);
    }

    sinceSave += dt;
    if (sinceSave >= data.balance.autosaveSeconds) {
      sinceSave = 0;
      save();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      save();
      leaderboard.flush();
    }
  });
  window.addEventListener('pagehide', save);
}

boot();
