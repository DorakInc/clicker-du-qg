// Point d'entrée : charge les données, la sauvegarde, puis fait tourner la
// boucle de jeu. Relie la logique (src/game), l'affichage (src/ui) et
// l'audio (src/audio).

import {
  SAVE_KEY, applyOffline, buyCannabis, buyProducer, buyUpgrade, click, createState,
  deserialize, formatDuration, formatMoney, serialize, tick,
} from './game/index.js';
import { createGameView, showCharacterSelect } from './ui/view.js';
import { createAudio } from './audio/audio.js';

const DATA_FILES = ['balance', 'characters', 'producers', 'upgrades', 'tiers', 'texts', 'sounds'];
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
  try { return { sound: true, ...JSON.parse(storage.get(SETTINGS_KEY) ?? '{}') }; } catch { return { sound: true }; }
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
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('keydown', () => audio.unlock(), { once: true });

  const saved = deserialize(storage.get(SAVE_KEY) ?? '', data);
  if (saved) {
    const offline = applyOffline(saved, data);
    startGame(data, saved, { audio, settings, offline });
  } else {
    showCharacterSelect(data, (characterId) => {
      audio.unlock();
      audio.play('characterSelect');
      const state = createState(data, characterId);
      storage.set(SAVE_KEY, serialize(state));
      startGame(data, state, { audio, settings, offline: null });
    });
  }
}

function startGame(data, state, { audio, settings, offline }) {
  const character = data.characters.find((c) => c.id === state.characterId);
  let resetting = false;

  const view = createGameView(data, {
    click(event) {
      const events = click(state, data);
      const { earned } = events[0];
      const rect = view.beatButton.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top;
      view.floatText(`+${formatMoney(earned)}`, x, y);
      handle(events);
    },
    buyCannabis: () => handle(buyCannabis(state, data)),
    buyProducer: (id) => handle(buyProducer(state, data, id)),
    buyUpgrade: (id) => handle(buyUpgrade(state, data, id)),
    reset() {
      if (!confirm('Recommencer une nouvelle partie ? La progression actuelle sera perdue.')) return;
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
  });
  view.setSoundLabel(settings.sound);

  function handle(events) {
    for (const event of events) {
      audio.play(event.type);
      if (event.type in MESSAGE_EVENTS) {
        const text = message(data, event.type, { tier: event.name, name: event.name });
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
  }

  view.showMessage(message(data, 'welcome', { name: character.name }));
  showOffline(offline);
  view.update(state);

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
      handle(tick(state, data, dt));
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
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
}

boot();
