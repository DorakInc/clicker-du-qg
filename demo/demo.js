// Démo des animations : mêmes fichiers que le jeu (src/ui/fx/), décor de démonstration.
// Ouvrir http://localhost:8000/demo/animations.html après `npm start`.

import { createFx } from '../src/ui/fx/fx.js';
import { createMotion } from '../src/ui/fx/motion.js';
import { CATALOG } from '../src/ui/fx/catalog.js';
import { shopRow } from '../src/ui/view.js';
import { formatMoney } from '../src/game/index.js';

const $ = (id) => document.getElementById(id);
const config = await (await fetch('../data/fx.json')).json();
const motion = createMotion();

// ---- Décor : personnage, boutique, carte ----------------------------------

const character = $('demo-character');
const sprite = document.createElement('div');
sprite.className = 'sprite';
sprite.style.backgroundImage = 'url("../assets/images/personnages/xavier-sheet.png")';
character.append(sprite);

const producer = { id: 'boite-a-rythmes', name: 'Boîte à rythmes', description: 'Fait des beats toute seule, mal, mais toute seule.', baseCost: 15 };
const upgrade = { id: 'casque', name: 'Casque fermé', description: 'Enfin entendre ses propres beats.', cost: 100 };
let owned = 3;
const costOf = (n) => Math.ceil(producer.baseCost * 1.15 ** n);
const rows = {};

function buyProducer() {
  owned += 1;
  fx.play('shop_buy', { row: rows.producer }); // comme dans le jeu : l'animation part avant la mise à jour
  renderShop();
}
function buyUpgrade() {
  rows.upgrade.li.classList.remove('is-done');
  fx.play('shop_buy', { row: rows.upgrade, stamp: true });
  rows.upgrade.li.classList.add('is-done');
  rows.upgrade.owned.textContent = '✓';
  rows.upgrade.cost.textContent = 'installé au QG';
}
rows.producer = shopRow(producer, buyProducer);
rows.upgrade = shopRow(upgrade, buyUpgrade, 'installé');
rows.producer.effect.textContent = '+0.1 beats/s chacun';
rows.upgrade.effect.textContent = 'Puissance du clic ×2';
$('demo-shop').append(rows.producer.li, rows.upgrade.li);
function renderShop() {
  rows.producer.owned.textContent = `×${owned}`;
  rows.producer.cost.textContent = formatMoney(costOf(owned));
  if (!rows.upgrade.li.classList.contains('is-done')) {
    rows.upgrade.owned.textContent = '';
    rows.upgrade.cost.textContent = formatMoney(upgrade.cost);
  }
}
renderShop();

const TERRITORIES = [
  { id: 'quartier', x: 43, y: 27, label: '⌂', requires: [] },
  { id: 'montreal', x: 47, y: 22, label: '1', requires: ['quartier'] },
  { id: 'quebec', x: 52, y: 17, label: '2', requires: ['montreal'] },
  { id: 'toronto', x: 36, y: 31, label: '3', requires: ['montreal'] },
];
const markers = {};
const links = [];
for (const t of TERRITORIES) {
  for (const r of t.requires) {
    const from = TERRITORIES.find((x) => x.id === r);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
    line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
    $('demo-links').append(line);
    links.push({ line, from: r, to: t.id });
  }
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.style.left = `${(t.x / 160) * 100}%`;
  marker.style.top = `${t.y}%`;
  marker.textContent = t.label;
  $('demo-markers').append(marker);
  markers[t.id] = marker;
}

/** Remet la carte avant la conquête de Montréal (ou après, si `conquered`). */
function setMap(conquered) {
  const status = conquered
    ? { quartier: 'conquered', montreal: 'conquered', quebec: 'available', toronto: 'available' }
    : { quartier: 'conquered', montreal: 'campaign', quebec: 'locked', toronto: 'locked' };
  for (const [id, s] of Object.entries(status)) markers[id].className = `marker is-${s}`;
  for (const { line, from, to } of links) {
    const done = status[from] === 'conquered' && status[to] === 'conquered';
    line.setAttribute('class', done ? 'is-done' : status[from] === 'conquered' ? 'is-open' : '');
  }
  $('demo-hype').style.width = conquered ? '100%' : '92%';
  $('demo-territory-status').textContent = conquered ? '✓ Territoire conquis' : '▶ Campagne en cours';
  $('demo-territories').querySelector('.chip-value').textContent = conquered ? '2/14' : '1/14';
}
setMap(false);

// ---- Effets ---------------------------------------------------------------

const vinyl = $('demo-vinyl');
const arm = document.querySelector('.deck .tonearm');
const onMap = $('demo-on-map');

const fx = createFx(config, {
  motion,
  anchors: {
    counter: () => $('demo-money'),
    coinSource: () => vinyl,
    isFailing: () => $('demo-mood').value === 'fail',
    characters: () => [character],
    character: () => character,
    scene: () => $('demo-qg'),
    currentScene: () => (onMap.checked ? 'carte' : 'studio'),
    tierChip: () => document.querySelector('.chip-tier'),
    territoriesChip: () => $('demo-territories'),
    flagMapTab: () => $('demo-map-tab').classList.add('is-new'),
    selectTerritory: () => {},
    marker: (id) => markers[id],
    hypeFill: () => $('demo-hype'),
    territoryCard: () => document.querySelector('.card-territory'),
    territoryBonus: () => $('demo-bonus'),
    openedLinks: (id) => links.filter((l) => l.from === id).map((l) => ({ line: l.line, marker: markers[l.to] })),
  },
});
fx.installPress();
fx.setMood('normal');
window.fxDemo = { fx, motion }; // pour les vérifications depuis la console

onMap.addEventListener('change', () => {
  if (!onMap.checked) return;
  $('demo-map-tab').classList.remove('is-new');
  fx.sceneShown('carte');
});

// ---- Le vinyle, comme dans le jeu ---------------------------------------

const BEAT_VALUE = 1.34;
let money = 1200;
function beat(x, y) {
  const quality = Number($('demo-zen').value);
  const earned = BEAT_VALUE * quality;
  money += earned;
  $('demo-money').textContent = formatMoney(money);
  const level = fx.play('click_quality', { quality, target: vinyl.querySelector('.vinyl-label') });
  const r = vinyl.getBoundingClientRect();
  fx.play('gain_float', {
    x: x ?? r.left + r.width * (0.25 + Math.random() * 0.5),
    y: y ?? r.top + r.height * (0.25 + Math.random() * 0.5),
    home: { x: r.left + r.width / 2, y: r.top },
    amount: earned, kind: 'money', format: (n) => `+${formatMoney(n)}`, level,
  });
}
vinyl.addEventListener('pointerdown', () => fx.play('click_squash', { target: vinyl, arm }));
vinyl.addEventListener('click', (event) => {
  if (event.detail === 0) fx.play('click_squash', { target: vinyl, arm });
  beat(event.detail === 0 ? undefined : event.clientX, event.detail === 0 ? undefined : event.clientY);
});

$('demo-weed').addEventListener('click', () => {
  fx.play('ui_refuse', { target: $('demo-weed-price'), text: `il manque ${formatMoney(85)}` });
});

// ---- Lanceurs ---------------------------------------------------------------

const TIERS = ['Artiste SoundCloud', 'Buzz local', "Révélation de l'année", "Tête d'affiche", 'Star nationale'];
let tierIndex = 0;

const LAUNCHERS = {
  click_squash: () => fx.play('click_squash', { target: vinyl, arm }),
  gain_float: () => {
    const zen = $('demo-zen').value;
    $('demo-zen').value = '1';
    beat();
    $('demo-zen').value = zen;
  },
  click_quality: () => {
    fx.play('click_squash', { target: vinyl, arm });
    beat();
  },
  char_breathe: () => {
    const select = $('demo-mood');
    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
    fx.setMood(select.value);
  },
  coins_to_counter: () => fx.play('coins_to_counter', { amount: 10 ** Math.floor(Math.random() * 6) }),
  ui_press: () => fx.play('ui_press', { target: rows.producer.button }),
  ui_refuse: () => fx.play('ui_refuse', { target: $('demo-weed-price'), text: `il manque ${formatMoney(85)}` }),
  shop_buy: () => (Math.random() < 0.5 ? buyProducer() : buyUpgrade()),
  tier_up: () => {
    const name = TIERS[tierIndex % TIERS.length];
    tierIndex += 1;
    $('demo-tier').textContent = name;
    fx.play('tier_up', { name });
  },
  territory_conquered: () => {
    setMap(false);
    requestAnimationFrame(() => {
      setMap(true);
      fx.play('territory_conquered', { id: 'montreal', name: 'Montréal' });
    });
  },
};

let last = null;
const list = $('demo-list');
for (const entry of CATALOG) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span class="num">${String(entry.num).padStart(2, '0')}</span><span></span>`;
  button.lastChild.textContent = entry.name;
  button.title = `${entry.id} · P${entry.priority} · ${entry.rule}`;
  button.addEventListener('click', () => {
    last = entry.id;
    for (const b of list.querySelectorAll('button')) b.classList.toggle('is-last', b === button);
    LAUNCHERS[entry.id]();
  });
  li.append(button);
  list.append(li);
}
$('demo-replay').addEventListener('click', () => last && LAUNCHERS[last]());
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r' && !event.target.closest('input, select') && last) LAUNCHERS[last]();
});

// ---- Réglages -------------------------------------------------------------

$('demo-speed').addEventListener('input', (event) => {
  motion.setSpeed(Number(event.target.value));
  $('demo-speed-value').textContent = `${event.target.value}×`;
});
$('demo-motion').addEventListener('change', (event) => motion.setMode(event.target.value));
$('demo-mood').addEventListener('change', (event) => fx.setMood(event.target.value));

// ---- Mode stress : 20 clics/s, pièces en continu, récompenses en même temps ----

let stress = null;
let peak = { nodes: 0, floaters: 0, particles: 0, coins: 0 };
$('demo-stress').addEventListener('click', () => {
  if (stress) {
    clearInterval(stress.clicks);
    clearInterval(stress.events);
    stress = null;
    $('demo-stress').firstElementChild.textContent = 'Mode stress';
    return;
  }
  peak = { nodes: 0, floaters: 0, particles: 0, coins: 0 };
  $('demo-income').checked = true;
  const burst = () => {
    LAUNCHERS.tier_up();
    LAUNCHERS.territory_conquered();
    buyProducer();
    LAUNCHERS.ui_refuse();
  };
  stress = {
    clicks: setInterval(() => {
      fx.play('click_squash', { target: vinyl, arm });
      beat();
    }, 50),
    events: setInterval(burst, 3000),
  };
  burst();
  $('demo-stress').firstElementChild.textContent = 'Arrêter le stress';
});

// ---- Boucle : revenu simulé, statistiques ----------------------------------

let prev = performance.now();
let frames = 0;
let fps = 0;
let fpsClock = 0;
function frame(now) {
  const dt = (now - prev) / 1000;
  prev = now;
  if ($('demo-income').checked) fx.addIncome(250 * dt);
  fx.update(dt);

  frames += 1;
  fpsClock += dt;
  const s = fx.stats();
  for (const key of Object.keys(peak)) peak[key] = Math.max(peak[key], s[key]);
  if (fpsClock >= 0.5) {
    fps = Math.round(frames / fpsClock);
    frames = 0;
    fpsClock = 0;
    $('demo-stats').textContent = [
      `images/s        ${fps}`,
      `nœuds actifs    ${s.nodes}  (max ${peak.nodes} / 80)`,
      `nombres         ${s.floaters}  (max ${peak.floaters} / ${config.caps.floatersVisible})`,
      `particules      ${s.particles}  (max ${peak.particles} / ${config.caps.particles})`,
      `pièces          ${s.coins}  (max ${peak.coins} / ${config.caps.coinsInFlight})`,
      `animations      ${s.animations}`,
      `récompense      ${s.major ?? '—'}${s.queued ? ` (+${s.queued} en file)` : ''}`,
      `conquêtes vues  ${s.pendingConquests ? `${s.pendingConquests} en attente` : 'toutes'}`,
      `mouvements      ${motion.reduced ? 'réduits' : 'complets'} (${motion.mode})`,
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
