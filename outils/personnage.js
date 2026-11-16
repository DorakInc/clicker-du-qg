// Atelier des personnages : créer un personnage de départ à partir de photos en T-pose.
// Lancer `npm run atelier`, puis ouvrir http://127.0.0.1:8001
//
// Le dessin vient de src/poupee/index.js (le même code que `npm run sprites`),
// la validation de scripts/personnages.js (la même que le serveur et les tests).
// Les photos ne quittent jamais le navigateur : elles ne sont ni envoyées ni gardées.

import { STATS } from '../src/game/modifiers.js';
import { compose } from '../src/poupee/grid.js';
import { PARTS, DEFAULT_LOOK, VIEWS, characterFromLook, renderSheet } from '../src/poupee/index.js';
import { slugify, validateCharacter, MULTIPLY_RANGE } from '../scripts/personnages.js';

const $ = (id) => document.getElementById(id);
const BEAT = 700; // ms, un temps à 86 BPM
const SCALE = 5;
const DRAFT_KEY = 'atelier-personnage-brouillon';
const DEFAULT_CARD = '#8fb996';

/** Stats où un multiplicateur plus petit que 1 est un avantage. */
const LOWER_IS_BETTER = new Set(['churn', 'cannabisDecay', 'cannabisPrice']);

/** Idées de docs/prochaines-phases.md (section 2), avec les stats qui existent déjà. */
const ARCHETYPES = [
  { name: 'Le producteur', strength: 'Production', effects: [{ stat: 'bps', multiply: 1.4 }] },
  { name: 'Le hype man', strength: 'Ambiance', effects: [{ stat: 'fanGain', multiply: 1.2 }, { stat: 'churn', multiply: 0.8 }] },
  { name: 'Le jardinier', strength: 'Serre', effects: [{ stat: 'grow', multiply: 1.5 }] },
  { name: 'Le globe-trotter', strength: 'Tournée', effects: [{ stat: 'hype', multiply: 1.3 }] },
  { name: 'Le zen', strength: 'Zen', effects: [{ stat: 'cannabisDecay', multiply: 0.6 }] },
];

const VIEW_NAMES = { front: 'Face', side: 'Profil', back: 'Dos' };
const SKIN_TONES = ['#f6d7bd', '#f1c6a4', '#e0b08a', '#c98e65', '#a8704a', '#8d5a3b', '#6b4229', '#4a2c1c'];
const HAIR_COLORS = ['#1a1410', '#2f221b', '#3a2a20', '#5a3d27', '#7a5536', '#a07a52', '#c9973f', '#e2c27a', '#b3412f', '#8a8a8a'];
const CLOTH_COLORS = ['#1e1f25', '#2b2b31', '#f4f1ea', '#d94f3d', '#5b4b8a', '#2a6b4a', '#5f6751', '#2a3558', '#4b6aa8', '#c9973f', '#ff7eb6', '#4f86ff', '#9fc2e0', '#7a4b2a'];

// ---- État du formulaire ------------------------------------------------------------

let data = { characters: [], texts: { stats: {} } };
let form = blankForm();
let editing = null; // id du personnage existant qu'on modifie, ou null pour un nouveau
let activeSlot = 'skin';
let frame = 0;
let handSheet = null; // image de la planche dessinée à la main (personnage existant sans look)

function blankForm(look = DEFAULT_LOOK) {
  return {
    name: '', id: '', idTouched: false, strength: '', description: '', color: DEFAULT_CARD,
    effects: [{ stat: 'beatValue', multiply: 1.25 }],
    useLook: true,
    look: lookToForm(look),
  };
}

/** Dans le formulaire, « aucun » = '' et le chapeau garde sa couleur même retiré. */
function lookToForm(look) {
  const l = structuredClone(look);
  return {
    ...l,
    beard: l.beard ?? '',
    glasses: l.glasses ?? '',
    hat: l.hat ?? { style: '', color: '#c94d4d' },
    accessories: l.accessories ?? [],
  };
}

function formToLook(f = form.look) {
  return {
    body: f.body,
    skin: f.skin,
    hair: { ...f.hair },
    beard: f.beard || null,
    glasses: f.glasses || null,
    hat: f.hat.style ? { ...f.hat } : null,
    top: { ...f.top },
    bottom: { ...f.bottom },
    shoes: { ...f.shoes },
    accessories: [...f.accessories],
  };
}

function toCharacter() {
  const character = {
    id: form.id.trim(),
    name: form.name.trim(),
    strength: form.strength.trim(),
    description: form.description.trim(),
    effects: form.effects.map(({ stat, multiply }) => ({ stat, multiply })),
  };
  if (form.color && form.color !== DEFAULT_CARD) character.color = form.color;
  if (form.useLook) character.look = formToLook();
  return character;
}

// Chemins de couleur dans le look : 'skin', 'hair.color', 'top.accent'...
const getColor = (path) => path.split('.').reduce((o, k) => o[k], form.look);
function setColor(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], form.look)[last] = value;
}

// ---- Rendu de la poupée --------------------------------------------------------------

let sheetCanvas = document.createElement('canvas');

/** Redessine la planche (3 vues × 2 images) dans un canvas hors écran. */
function rebuildSheet() {
  if (!form.useLook && handSheet) {
    sheetCanvas.width = handSheet.width;
    sheetCanvas.height = handSheet.height;
    const ctx = sheetCanvas.getContext('2d');
    ctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    ctx.drawImage(handSheet, 0, 0);
  } else {
    const { width, height, rgba } = compose(renderSheet(characterFromLook('apercu', formToLook())));
    sheetCanvas.width = width;
    sheetCanvas.height = height;
    sheetCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  }
  drawViews();
  updateCard();
}

function drawViews() {
  for (const [row, view] of VIEWS.entries()) {
    const canvas = $(`view-${view}`);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sheetCanvas, frame * 32, row * 48, 32, 48, 0, 0, 32 * SCALE, 48 * SCALE);
  }
}

function buildViews() {
  $('views').replaceChildren(...VIEWS.map((view) => {
    const figure = document.createElement('figure');
    figure.className = 'view';
    const canvas = document.createElement('canvas');
    canvas.id = `view-${view}`;
    canvas.width = 32 * SCALE;
    canvas.height = 48 * SCALE;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Vue ${VIEW_NAMES[view].toLowerCase()}`);
    const caption = document.createElement('figcaption');
    caption.textContent = VIEW_NAMES[view];
    figure.append(canvas, caption);
    return figure;
  }));
}

setInterval(() => {
  if (!$('breathe').checked) return;
  frame = 1 - frame;
  drawViews();
}, BEAT);

// ---- Carte de l'écran de choix (mêmes classes que le jeu) ---------------------------

function describeEffect({ stat, multiply }) {
  const label = data.texts.stats[stat] ?? stat;
  if (multiply >= 2 && Number.isInteger(multiply)) return `${label} ×${multiply}`;
  const pct = Math.round((multiply - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct} % ${label}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateCard() {
  const c = toCharacter();
  const card = el('div', 'character-card');
  card.dataset.character = form.id; // les couleurs de carte déjà prévues dans style.css (Xavier, Émile...)
  if (form.color && form.color !== DEFAULT_CARD) card.style.setProperty('--stage', form.color);
  const portrait = el('div', 'character-portrait');
  const sprite = el('div', 'sprite');
  sprite.style.backgroundImage = `url("${sheetCanvas.toDataURL()}")`;
  portrait.append(sprite);
  const effects = el('ul', 'character-effects');
  for (const e of c.effects) if (STATS.includes(e.stat)) effects.append(el('li', '', describeEffect(e)));
  card.append(
    portrait,
    el('p', 'character-name', c.name || 'Nom'),
    el('p', 'character-strength', c.strength || 'Force'),
    el('p', 'character-description', c.description || 'Description'),
    effects,
  );
  $('card-preview').replaceChildren(card);
}

// ---- Champs du look ------------------------------------------------------------------

function swatch(path, label) {
  const wrap = el('div', 'swatch');
  wrap.dataset.slot = path;
  const button = el('button', 'swatch-pick');
  button.type = 'button';
  button.title = `${label} : rendre active pour la pipette`;
  button.setAttribute('aria-label', `${label} : case active pour la pipette`);
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', label);
  button.addEventListener('click', () => setActive(path));
  input.addEventListener('input', () => { setColor(path, input.value); setActive(path); changed(); });
  wrap.append(button, input);
  return wrap;
}

function select(part, value, onChange, { none } = {}) {
  const s = document.createElement('select');
  if (none) s.append(new Option(none, ''));
  for (const [id, label] of Object.entries(PARTS[part])) s.append(new Option(label, id));
  s.value = value;
  s.addEventListener('change', () => { onChange(s.value); changed(); });
  return s;
}

function lookRow(label, ...controls) {
  const row = el('div', 'look-row');
  row.append(el('span', 'look-label', label), ...controls);
  return row;
}

/** Pastilles de couleur rapides ; `path` absent = va dans la case active. */
function palette(path, colors) {
  const list = el('div', 'quick-colors');
  for (const c of colors) {
    const b = el('button', 'quick');
    b.type = 'button';
    b.style.background = c;
    b.title = c;
    b.setAttribute('aria-label', `couleur ${c}`);
    b.addEventListener('click', () => {
      if (path) setActive(path);
      setColor(activeSlot, c);
      changed();
    });
    list.append(b);
  }
  return list;
}

function buildLookFields() {
  const L = form.look;
  const body = el('div', 'segmented');
  for (const [id, label] of Object.entries(PARTS.body)) {
    const b = el('button', '', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(L.body === id));
    b.addEventListener('click', () => { L.body = id; changed(); buildLookFields(); });
    body.append(b);
  }
  const accessories = el('div', 'checks');
  for (const [id, label] of Object.entries(PARTS.accessories)) {
    const lab = el('label', 'check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = L.accessories.includes(id);
    box.addEventListener('change', () => {
      L.accessories = box.checked ? [...L.accessories, id] : L.accessories.filter((a) => a !== id);
      changed();
    });
    lab.append(box, ` ${label}`);
    accessories.append(lab);
  }
  $('look-fields').replaceChildren(
    lookRow('Corps', body),
    lookRow('Peau', swatch('skin', 'Peau'), palette('skin', SKIN_TONES)),
    lookRow('Cheveux', select('hair', L.hair.style, (v) => { L.hair.style = v; }), swatch('hair.color', 'Cheveux')),
    lookRow('', palette('hair.color', HAIR_COLORS)),
    lookRow('Barbe', select('beard', L.beard, (v) => { L.beard = v; }, { none: 'Aucune' })),
    lookRow('Lunettes', select('glasses', L.glasses, (v) => { L.glasses = v; }, { none: 'Aucune' })),
    lookRow('Chapeau', select('hat', L.hat.style, (v) => { L.hat.style = v; }, { none: 'Aucun' }), swatch('hat.color', 'Chapeau')),
    lookRow('Haut', select('top', L.top.style, (v) => { L.top.style = v; }), swatch('top.color', 'Haut'), swatch('top.accent', 'Détail du haut')),
    lookRow('Bas', select('bottom', L.bottom.style, (v) => { L.bottom.style = v; }), swatch('bottom.color', 'Bas')),
    lookRow('Souliers', select('shoes', L.shoes.style, (v) => { L.shoes.style = v; }), swatch('shoes.color', 'Souliers'), swatch('shoes.accent', 'Semelle')),
    lookRow('Vêtements', palette(null, CLOTH_COLORS)),
    lookRow('Extras', accessories),
  );
  syncSwatches();
  $('look-fields').toggleAttribute('inert', !form.useLook);
  $('random').disabled = !form.useLook;
  $('reset-look').disabled = !form.useLook;
  $('look-fields').classList.toggle('is-off', !form.useLook);
}

function syncSwatches() {
  for (const wrap of document.querySelectorAll('.swatch')) {
    const value = getColor(wrap.dataset.slot);
    wrap.querySelector('input').value = value;
    wrap.querySelector('.swatch-pick').style.background = value;
    wrap.classList.toggle('is-active', wrap.dataset.slot === activeSlot);
  }
}

function setActive(path) {
  activeSlot = path;
  syncSwatches();
}

function randomLook() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const keys = (part) => Object.keys(PARTS[part]);
  const maybe = (part, chance) => (Math.random() < chance ? pick(keys(part)) : '');
  const L = form.look;
  L.body = pick(keys('body'));
  L.skin = pick(SKIN_TONES);
  L.hair = { style: pick(keys('hair')), color: pick(HAIR_COLORS) };
  L.beard = maybe('beard', 0.3);
  L.glasses = maybe('glasses', 0.3);
  L.hat = { style: maybe('hat', 0.25), color: pick(CLOTH_COLORS) };
  L.top = { style: pick(keys('top')), color: pick(CLOTH_COLORS), accent: pick(CLOTH_COLORS) };
  L.bottom = { style: pick(keys('bottom')), color: pick(CLOTH_COLORS) };
  L.shoes = { style: pick(keys('shoes')), color: pick(CLOTH_COLORS), accent: pick(['#f4f1ea', '#1e1e22', '#b9b4a8']) };
  L.accessories = keys('accessories').filter(() => Math.random() < 0.25);
}

// ---- Photos et pipette -------------------------------------------------------------

const MAX_PHOTO = 900;

function buildPhotos() {
  $('photos').replaceChildren(...VIEWS.map((view) => {
    const slot = el('div', 'photo');
    const canvas = document.createElement('canvas');
    canvas.className = 'photo-canvas';
    canvas.hidden = true;
    canvas.setAttribute('aria-label', `Photo ${VIEW_NAMES[view].toLowerCase()} : toucher pour prendre une couleur`);
    const drop = el('label', 'photo-drop');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    drop.append(el('span', 'photo-name', VIEW_NAMES[view]), el('span', 'photo-call', 'Choisir ou déposer une photo'), input);
    const loupe = el('span', 'loupe');
    loupe.hidden = true;
    const chips = el('div', 'quick-colors photo-chips');
    const clear = el('button', 'photo-clear', '×');
    clear.type = 'button';
    clear.hidden = true;
    clear.setAttribute('aria-label', `Retirer la photo ${VIEW_NAMES[view].toLowerCase()}`);
    slot.append(drop, canvas, loupe, clear, chips);

    const load = (file) => loadPhoto(file, { canvas, drop, chips, clear });
    input.addEventListener('change', () => input.files[0] && load(input.files[0]));
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('is-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('is-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('is-over');
      if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);
    });
    clear.addEventListener('click', () => {
      canvas.hidden = true; clear.hidden = true; drop.hidden = false;
      chips.replaceChildren();
      input.value = '';
    });
    canvas.addEventListener('pointermove', (e) => {
      const c = sample(canvas, e);
      loupe.hidden = false;
      loupe.style.background = c;
      loupe.textContent = c;
      loupe.style.color = lightness(c) > 0.6 ? '#241a2e' : '#fbf4e6';
    });
    canvas.addEventListener('pointerleave', () => { loupe.hidden = true; });
    canvas.addEventListener('click', (e) => {
      setColor(activeSlot, sample(canvas, e));
      changed();
      flash(`Couleur prise pour « ${slotLabel(activeSlot)} »`);
    });
    return slot;
  }));
}

function slotLabel(path) {
  return document.querySelector(`.swatch[data-slot="${path}"] input`)?.getAttribute('aria-label') ?? path;
}

async function loadPhoto(file, { canvas, drop, chips, clear }) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, MAX_PHOTO / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.hidden = false;
    clear.hidden = false;
    drop.hidden = true;
    chips.replaceChildren(...dominantColors(canvas).map((c) => {
      const b = el('button', 'quick');
      b.type = 'button';
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', `couleur ${c} de la photo`);
      b.addEventListener('click', () => { setColor(activeSlot, c); changed(); });
      return b;
    }));
  } catch {
    flash('Ce navigateur ne lit pas cette image (HEIC ?). Convertis-la en JPEG ou ouvre l’atelier dans Safari.', true);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Charge une image (onload plutôt que decode(), qui ne se résout pas partout). */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function lightness(c) {
  const n = parseInt(c.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Moyenne 5 × 5 autour du point touché (moins de bruit qu'un seul pixel). */
function sample(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height);
  const x0 = Math.max(0, Math.min(canvas.width - 5, x - 2));
  const y0 = Math.max(0, Math.min(canvas.height - 5, y - 2));
  const { data: px } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, 5, 5);
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) for (let k = 0; k < 3; k += 1) sum[k] += px[i + k];
  return hex(...sum.map((v) => v / 25));
}

/** Les couleurs les plus présentes au centre de la photo (là où est la personne). */
function dominantColors(canvas, count = 8) {
  const w = canvas.width;
  const h = canvas.height;
  const { data: px } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.round(w * 0.3), Math.round(h * 0.08), Math.round(w * 0.4), Math.round(h * 0.88));
  const buckets = new Map();
  for (let i = 0; i < px.length; i += 16) { // un pixel sur 4
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
    buckets.set(key, b);
  }
  const colors = [];
  for (const b of [...buckets.values()].sort((a, z) => z.n - a.n)) {
    const c = [b.r / b.n, b.g / b.n, b.b / b.n];
    if (colors.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) < 40)) continue;
    colors.push(c);
    if (colors.length === count) break;
  }
  return colors.map((c) => hex(...c));
}

// ---- Pouvoirs ------------------------------------------------------------------------

/** Stats qui ne touchent qu'une partie du jeu (serre, cannabis, carte, fans perdus) : elles comptent moitié. */
const SECONDARY = new Set(['churn', 'cannabisDecay', 'cannabisPrice', 'cannabisPower', 'grow', 'harvest', 'hype']);

/** Gain d'un pouvoir, en log : positif = avantage, quel que soit le sens de la stat. */
const gain = ({ stat, multiply }) => (LOWER_IS_BETTER.has(stat) ? -1 : 1) * Math.log(multiply);
const weight = (stat) => (SECONDARY.has(stat) ? 0.5 : 1);
const power = (effects) => Math.round((Math.exp(effects.reduce((s, e) => s + (e.multiply > 0 ? gain(e) * weight(e.stat) : 0), 0)) - 1) * 100);

function buildEffects() {
  const [min, max] = MULTIPLY_RANGE;
  $('effects').replaceChildren(...form.effects.map((effect, i) => {
    const li = el('li', 'effect');
    const stat = document.createElement('select');
    stat.setAttribute('aria-label', 'Statistique');
    for (const s of STATS) stat.append(new Option(data.texts.stats[s] ?? s, s));
    stat.value = effect.stat;
    const pct = document.createElement('input');
    pct.type = 'number';
    pct.step = '5';
    pct.min = String(Math.round((min - 1) * 100));
    pct.max = String(Math.round((max - 1) * 100));
    pct.value = String(Math.round((effect.multiply - 1) * 100));
    pct.setAttribute('aria-label', 'Pourcentage');
    const sense = el('span', 'effect-sense');
    const updateSense = () => {
      const good = gain(effect) > 0;
      sense.textContent = effect.multiply === 1 ? 'sans effet' : good ? 'avantage' : 'désavantage';
      sense.dataset.good = String(good);
    };
    stat.addEventListener('change', () => { effect.stat = stat.value; updateSense(); changed(); });
    pct.addEventListener('input', () => {
      effect.multiply = Math.round((1 + Number(pct.value) / 100) * 1000) / 1000;
      updateSense();
      changed();
    });
    const remove = el('button', 'effect-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Retirer ce pouvoir');
    remove.addEventListener('click', () => { form.effects.splice(i, 1); buildEffects(); changed(); });
    updateSense();
    li.append(stat, pct, el('span', 'effect-unit', '%'), sense, remove);
    return li;
  }));
  $('add-effect').disabled = form.effects.length >= 3;
}

function buildArchetypes() {
  $('archetypes').replaceChildren(...ARCHETYPES.map((a) => {
    const b = el('button', 'a-chip', a.name);
    b.type = 'button';
    b.title = a.effects.map(describeEffect).join(', ');
    b.addEventListener('click', () => {
      form.effects = structuredClone(a.effects);
      if (!form.strength) { form.strength = a.strength; $('strength').value = a.strength; }
      buildEffects();
      changed();
    });
    return b;
  }));
}

function updateBalance() {
  const others = data.characters.filter((c) => c.id !== editing && c.id !== form.id).map((c) => ({ name: c.name, p: power(c.effects) }));
  const mine = power(form.effects);
  const top = Math.max(80, mine, ...others.map((o) => o.p));
  const marker = (name, p, me) => {
    const m = el('span', `balance-mark${me ? ' is-me' : ''}`, name);
    m.style.left = `${Math.max(0, Math.min(100, (p / top) * 100))}%`;
    m.title = `${p > 0 ? '+' : ''}${p} %`;
    return m;
  };
  const bar = el('div', 'balance-bar');
  bar.append(...others.map((o) => marker(o.name, o.p, false)), marker(form.name || 'Toi', mine, true));
  const avg = others.length ? others.reduce((s, o) => s + o.p, 0) / others.length : mine;
  const verdict = mine > avg * 1.6 ? 'Plus fort que les autres : à baisser, ou à débloquer plus tard.'
    : mine < avg * 0.5 ? 'Plus faible que les autres : il peut monter un peu.'
      : 'Dans la moyenne des personnages actuels.';
  const head = el('p', 'balance-head');
  head.append(el('b', '', `Puissance totale : ${mine > 0 ? '+' : ''}${mine} %`), ` — ${verdict}`);
  $('balance').replaceChildren(head, bar, el('p', 'hint', 'Repère grossier : les pouvoirs sont multipliés entre eux, et les stats secondaires (serre, cannabis, carte, perte de fans) comptent moitié. À valider en jouant.'));
}

// ---- Validation, enregistrement -------------------------------------------------------

function currentErrors() {
  const c = toCharacter();
  const errors = validateCharacter(c, STATS);
  if (!editing && data.characters.some((o) => o.id === c.id)) errors.push(`l'identifiant « ${c.id} » est déjà pris : change-le`);
  return errors;
}

function changed() {
  syncSwatches();
  rebuildSheet();
  updateBalance();
  const errors = currentErrors();
  $('errors').replaceChildren(...errors.map((e) => el('li', '', e)));
  $('save').disabled = errors.length > 0;
  $('desc-count').textContent = `${form.description.length} / 160`;
  if (!editing) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* navigation privée */ }
  }
}

let flashTimer;
function flash(text, bad = false) {
  $('status').textContent = text;
  $('status').dataset.bad = String(bad);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { $('status').textContent = ''; }, 6000);
}

async function save() {
  const character = toCharacter();
  $('save').disabled = true;
  flash('Enregistrement et génération de la planche…');
  try {
    const res = await fetch('/api/personnages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character, replace: Boolean(editing) }),
    });
    if (res.status === 404 || res.status === 405) {
      flash('L’enregistrement direct marche seulement avec « npm run atelier ». Sinon : « Copier la fiche JSON » et colle-la dans data/characters.json.', true);
      return;
    }
    const body = await res.json();
    if (!res.ok) {
      flash(`Pas enregistré : ${(body.errors ?? [body.build?.output]).join(' · ')}`, true);
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* rien */ }
    await loadData();
    editing = character.id;
    fillPicker();
    $('pick').value = character.id;
    flash(`✔ ${character.name} est dans le jeu (data/characters.json + planche ${character.id}-sheet.png). Lance npm test, puis recharge le jeu.`);
  } catch {
    flash('Le serveur de l’atelier ne répond pas. Lance « npm run atelier ».', true);
  } finally {
    $('save').disabled = currentErrors().length > 0;
  }
}

// ---- Choix du personnage (nouveau ou existant) ---------------------------------------------

async function loadData() {
  const get = async (name) => (await fetch(`../data/${name}.json`, { cache: 'no-store' })).json();
  data = { characters: await get('characters'), texts: await get('texts') };
}

function fillPicker() {
  const pick = $('pick');
  pick.replaceChildren(new Option('➕ Nouveau personnage', ''), ...data.characters.map((c) => new Option(`${c.name}${c.look ? '' : ' (dessiné à la main)'}`, c.id)));
  pick.value = editing ?? '';
}

async function choose(id) {
  editing = id || null;
  handSheet = null;
  if (!editing) {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { /* rien */ }
    form = draft?.look ? { ...blankForm(), ...draft } : blankForm();
  } else {
    const c = data.characters.find((o) => o.id === editing);
    form = {
      ...blankForm(c.look ?? DEFAULT_LOOK),
      name: c.name, id: c.id, idTouched: true, strength: c.strength, description: c.description,
      color: c.color ?? DEFAULT_CARD, effects: structuredClone(c.effects), useLook: Boolean(c.look),
    };
    if (!c.look) {
      handSheet = await loadImage(`../assets/images/personnages/${c.id}-sheet.png?${Date.now()}`).catch(() => null);
    }
  }
  for (const key of ['name', 'id', 'strength', 'description']) $(key).value = form[key];
  $('card-color').value = form.color;
  $('id').readOnly = Boolean(editing);
  $('uselook-row').hidden = !(editing && handSheet);
  $('uselook').checked = form.useLook;
  buildLookFields();
  buildEffects();
  changed();
}

// ---- Démarrage -----------------------------------------------------------------------

function wire() {
  $('pick').addEventListener('change', () => choose($('pick').value));
  $('name').addEventListener('input', () => {
    form.name = $('name').value;
    if (!form.idTouched && !editing) { form.id = slugify(form.name); $('id').value = form.id; }
    changed();
  });
  $('id').addEventListener('input', () => { form.id = $('id').value; form.idTouched = true; changed(); });
  $('strength').addEventListener('input', () => { form.strength = $('strength').value; changed(); });
  $('description').addEventListener('input', () => { form.description = $('description').value; changed(); });
  $('card-color').addEventListener('input', () => { form.color = $('card-color').value; changed(); });
  $('uselook').addEventListener('change', () => { form.useLook = $('uselook').checked; buildLookFields(); changed(); });
  $('add-effect').addEventListener('click', () => {
    const free = STATS.find((s) => !form.effects.some((e) => e.stat === s));
    form.effects.push({ stat: free, multiply: 1.1 });
    buildEffects();
    changed();
  });
  $('random').addEventListener('click', () => { randomLook(); buildLookFields(); changed(); });
  $('reset-look').addEventListener('click', () => { form.look = lookToForm(DEFAULT_LOOK); buildLookFields(); changed(); });
  $('save').addEventListener('click', save);
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(toCharacter(), null, 2));
      flash('Fiche copiée.');
    } catch {
      flash('Copie impossible dans ce navigateur.', true);
    }
  });
  $('download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `${form.id || 'personnage'}-sheet.png`;
    a.href = sheetCanvas.toDataURL('image/png');
    a.click();
  });
}

await loadData();
buildViews();
buildPhotos();
buildArchetypes();
wire();
fillPicker();
await choose('');
