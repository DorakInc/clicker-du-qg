// Écran « Créer mon perso » : 3 étapes, pensées pour le téléphone.
//   1. Look : pièces (◀ ▶ et 🎲 par ligne) et couleurs des palettes de data/creation.json.
//   2. Talents : des points à répartir (data/creation.json → points, maxPerSkill), et un
//      signe particulier tiré au hasard parmi 3 (un bonus, un malus), avec une relance.
//   3. Nom : la carte du perso telle qu'elle sera, et « C'est parti ».
// Toute la logique (budget, effets, hasard) est dans src/game/creation.js, testée.

import {
  budget, buildEffects, buildErrors, cleanName, findTrait, isBenefit, offerTraits, randomName,
  randomSkills, skillMultiply, spentPoints, trimSkills,
} from '../game/index.js';
import { PARTS } from '../poupee/index.js';
import { encodeLook, randomLook } from '../poupee/code.js';
import { sheetCanvas } from './sprites.js';
import { describeEffect } from './view.js';

const $ = (id) => document.getElementById(id);
const BEAT = 700; // ms : un temps à 86 BPM
const VIEW_ROWS = ['Face', 'Profil', 'Dos'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick, label) {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

// Le signe particulier est tiré une fois par visite : rouvrir l'écran ne relance pas gratuitement.
let traitOffer = null;
let rerollsLeft = null;

/**
 * Ouvre l'écran de création.
 * onDone(characterId, build) : le perso est prêt ; onCancel() : retour au choix du personnage.
 */
export function openCreator(data, { onDone, onCancel }) {
  const C = data.creation;
  const pal = C.palettes;
  traitOffer ??= offerTraits(C);
  rerollsLeft ??= C.traits.rerolls;

  let step = 0;
  let view = 0;
  let frame = 0;
  let look = randomLook(pal);
  let build = { name: '', skills: {}, trait: '' };
  let colorTarget = 'skin';
  let sheet = sheetCanvas(look);

  $('select-screen').hidden = true;
  $('creator-screen').hidden = false;
  window.scrollTo(0, 0);

  // ---- Aperçu ------------------------------------------------------------------------
  const preview = $('creator-preview');
  const ctx = preview.getContext('2d');
  function drawPreview() {
    ctx.clearRect(0, 0, 32, 48);
    ctx.drawImage(sheet, frame * 32, view * 48, 32, 48, 0, 0, 32, 48);
    preview.setAttribute('aria-label', `Aperçu de ton perso, vue ${VIEW_ROWS[view].toLowerCase()}`);
  }
  const breathing = setInterval(() => { frame = 1 - frame; drawPreview(); }, BEAT);
  $('creator-turn').onclick = () => { view = (view + 1) % 3; drawPreview(); };

  function lookChanged() {
    sheet = sheetCanvas(look);
    drawPreview();
  }

  // ---- 1. Look -------------------------------------------------------------------------
  const PIECES = [
    { part: 'body', label: 'Corps', get: () => look.body, set: (v) => { look.body = v; } },
    { part: 'hair', label: 'Cheveux', get: () => look.hair.style, set: (v) => { look.hair.style = v; } },
    { part: 'beard', label: 'Barbe', optional: 'Aucune', get: () => look.beard, set: (v) => { look.beard = v; } },
    { part: 'glasses', label: 'Lunettes', optional: 'Aucunes', get: () => look.glasses, set: (v) => { look.glasses = v; } },
    {
      part: 'hat', label: 'Chapeau', optional: 'Aucun', get: () => look.hat?.style ?? null,
      set: (v) => { look.hat = v ? { style: v, color: look.hat?.color ?? pal.cloth[0] } : null; },
    },
    { part: 'top', label: 'Haut', get: () => look.top.style, set: (v) => { look.top.style = v; } },
    { part: 'bottom', label: 'Bas', get: () => look.bottom.style, set: (v) => { look.bottom.style = v; } },
    { part: 'shoes', label: 'Souliers', get: () => look.shoes.style, set: (v) => { look.shoes.style = v; } },
  ];
  const COLORS = [
    { id: 'skin', label: 'Peau', palette: 'skin', get: () => look.skin, set: (c) => { look.skin = c; } },
    { id: 'hair', label: 'Cheveux', palette: 'hair', get: () => look.hair.color, set: (c) => { look.hair.color = c; } },
    { id: 'hat', label: 'Chapeau', palette: 'cloth', get: () => look.hat?.color, set: (c) => { look.hat.color = c; }, when: () => look.hat },
    { id: 'top', label: 'Haut', palette: 'cloth', get: () => look.top.color, set: (c) => { look.top.color = c; } },
    { id: 'accent', label: 'Détail', palette: 'cloth', get: () => look.top.accent, set: (c) => { look.top.accent = c; } },
    { id: 'bottom', label: 'Bas', palette: 'cloth', get: () => look.bottom.color, set: (c) => { look.bottom.color = c; } },
    { id: 'shoes', label: 'Souliers', palette: 'cloth', get: () => look.shoes.color, set: (c) => { look.shoes.color = c; } },
    { id: 'sole', label: 'Semelle', palette: 'cloth', get: () => look.shoes.accent, set: (c) => { look.shoes.accent = c; } },
  ];

  const choicesOf = (piece) => [...(piece.optional ? [null] : []), ...Object.keys(PARTS[piece.part])];
  const nameOf = (piece, value) => (value === null ? piece.optional : PARTS[piece.part][value]);

  function renderLook() {
    const rows = PIECES.map((piece) => {
      const choices = choicesOf(piece);
      const shift = (d) => {
        const i = choices.indexOf(piece.get());
        piece.set(choices[(i + d + choices.length) % choices.length]);
        lookChanged();
        renderLook();
      };
      const row = el('div', 'creator-piece');
      row.append(
        el('span', 'creator-piece-label', piece.label),
        button('creator-arrow', '◀', () => shift(-1), `${piece.label} : précédent`),
        el('span', 'creator-piece-value', nameOf(piece, piece.get())),
        button('creator-arrow', '▶', () => shift(1), `${piece.label} : suivant`),
        button('creator-arrow creator-arrow-dice', '🎲', () => shift(1 + Math.floor(Math.random() * (choices.length - 1))), `${piece.label} au hasard`),
      );
      return row;
    });

    const extras = el('div', 'creator-extras');
    for (const [id, label] of Object.entries(PARTS.accessories)) {
      const on = look.accessories.includes(id);
      const b = button(`creator-toggle${on ? ' is-on' : ''}`, label, () => {
        look.accessories = on ? look.accessories.filter((a) => a !== id) : [...look.accessories, id];
        lookChanged();
        renderLook();
      });
      b.setAttribute('aria-pressed', String(on));
      extras.append(b);
    }

    const targets = COLORS.filter((c) => !c.when || c.when());
    if (!targets.some((c) => c.id === colorTarget)) colorTarget = 'skin';
    const target = targets.find((c) => c.id === colorTarget);
    const tabs = el('div', 'creator-color-tabs');
    for (const c of targets) {
      const b = button(`creator-color-tab${c.id === colorTarget ? ' is-on' : ''}`, '', () => { colorTarget = c.id; renderLook(); });
      const dot = el('span', 'creator-dot');
      dot.style.background = c.get();
      b.append(dot, c.label);
      b.setAttribute('aria-pressed', String(c.id === colorTarget));
      tabs.append(b);
    }
    const swatches = el('div', 'creator-swatches');
    for (const color of pal[target.palette]) {
      const b = button(`creator-swatch${color === target.get() ? ' is-on' : ''}`, '', () => { target.set(color); lookChanged(); renderLook(); }, `${target.label} : ${color}`);
      b.style.background = color;
      swatches.append(b);
    }

    $('creator-step-look').replaceChildren(
      el('h2', 'card-title', 'Ton look'),
      ...rows,
      el('p', 'creator-sub', 'Extras'),
      extras,
      el('p', 'creator-sub', 'Couleurs'),
      tabs,
      swatches,
      button('btn btn-setting creator-wide', '🎲 Tout le look au hasard', () => { look = randomLook(pal); lookChanged(); renderLook(); }),
    );
  }

  // ---- 2. Talents ----------------------------------------------------------------------
  const left = () => budget(C, build.trait) - spentPoints(build.skills);

  function setSkill(id, n) {
    const skills = { ...build.skills, [id]: n };
    if (n === 0) delete skills[id];
    build = { ...build, skills };
    renderTalents();
  }

  function effectList(effects) {
    const list = el('ul', 'creator-effects');
    for (const e of effects) {
      const li = el('li', isBenefit(e) ? 'is-good' : 'is-bad', describeEffect(e, data.texts));
      list.append(li);
    }
    return list;
  }

  function renderTalents() {
    const remaining = left();
    const head = el('div', 'creator-points');
    head.append(
      el('span', 'creator-points-value', String(remaining)),
      el('span', 'creator-points-label', remaining === 1 ? 'point à placer' : 'points à placer'),
    );

    const skills = C.skills.map((skill) => {
      const n = build.skills[skill.id] ?? 0;
      const row = el('div', 'creator-skill');
      const text = el('div', 'creator-skill-text');
      const title = el('p', 'creator-skill-name', `${skill.icon} ${skill.name}`);
      const effect = n > 0 ? describeEffect({ stat: skill.stat, multiply: skillMultiply(skill, n) }, data.texts) : skill.description;
      text.append(title, el('p', `creator-skill-effect${n > 0 ? ' is-on' : ''}`, effect));
      const pips = el('div', 'creator-pips');
      pips.setAttribute('aria-label', `${n} sur ${C.maxPerSkill}`);
      for (let i = 0; i < C.maxPerSkill; i += 1) pips.append(el('span', `creator-pip${i < n ? ' is-on' : ''}`));
      const minus = button('creator-arrow', '−', () => setSkill(skill.id, n - 1), `${skill.name} : retirer un point`);
      const plus = button('creator-arrow', '+', () => setSkill(skill.id, n + 1), `${skill.name} : ajouter un point`);
      minus.disabled = n === 0;
      plus.disabled = n >= C.maxPerSkill || remaining <= 0;
      row.append(text, minus, pips, plus);
      return row;
    });

    const tools = el('div', 'creator-row');
    tools.append(
      button('creator-chip', '🎲 Répartir au hasard', () => {
        build = { ...build, skills: randomSkills(C, budget(C, build.trait)) };
        renderTalents();
      }),
      button('creator-chip', 'Tout remettre', () => { build = { ...build, skills: {} }; renderTalents(); }),
    );

    // Signe particulier : un des 3 tirés, ou aucun.
    const traits = el('div', 'creator-traits');
    for (const id of traitOffer) {
      const trait = findTrait(C, id);
      const on = build.trait === id;
      const card = button(`creator-trait${on ? ' is-on' : ''}`, '', () => {
        build = { ...build, trait: on ? '' : id };
        build = { ...build, skills: trimSkills(build, C) }; // sans « Prodige », les points en trop partent
        renderTalents();
      });
      card.setAttribute('aria-pressed', String(on));
      card.append(el('span', 'creator-trait-name', trait.name), el('span', 'creator-trait-desc', trait.description));
      if (trait.points) card.append(el('span', 'creator-trait-points', `+${trait.points} points de talent`));
      card.append(effectList(trait.effects));
      traits.append(card);
    }
    const reroll = button('creator-chip', `🎲 Relancer les signes (${rerollsLeft})`, () => {
      rerollsLeft -= 1;
      traitOffer = offerTraits(C, Math.random, traitOffer);
      build = { ...build, trait: '' }; // l'ancien signe n'est plus proposé
      build = { ...build, skills: trimSkills(build, C) };
      renderTalents();
    });
    reroll.disabled = rerollsLeft <= 0;

    $('creator-step-talents').replaceChildren(
      el('h2', 'card-title', 'Tes talents'),
      head,
      el('p', 'hint', `Place tes points : ${C.maxPerSkill} au maximum par talent.`),
      ...skills,
      tools,
      el('h2', 'card-title creator-title-gap', 'Signe particulier'),
      el('p', 'hint', 'Un bonus, un prix à payer. Prends-en un, ou aucun. Tirés au hasard pour toi.'),
      traits,
      reroll,
    );
    updateBadge();
  }

  function updateBadge() {
    const badge = $('creator-points-badge');
    const remaining = left();
    badge.hidden = step !== 1 || remaining === 0;
    badge.textContent = `${remaining} pt${remaining > 1 ? 's' : ''}`;
  }

  // ---- 3. Nom et carte -----------------------------------------------------------------
  function renderName() {
    const input = document.createElement('input');
    input.id = 'creator-name-input';
    input.className = 'creator-name-input';
    input.maxLength = 16;
    input.autocomplete = 'off';
    input.placeholder = 'Ton nom d’artiste';
    input.value = build.name;
    const errorLine = el('p', 'creator-error');
    const card = el('div', 'creator-card-slot');
    input.addEventListener('input', () => { build = { ...build, name: input.value }; updateCard(card, errorLine); });
    const field = el('label', 'creator-name-field');
    field.append(el('span', 'creator-sub', 'Nom d’artiste'), input);
    const row = el('div', 'creator-name-row');
    row.append(field, button('creator-arrow creator-arrow-dice', '🎲', () => {
      build = { ...build, name: randomName(C) };
      input.value = build.name;
      updateCard(card, errorLine);
    }, 'Nom au hasard'));
    $('creator-step-name').replaceChildren(el('h2', 'card-title', 'Ton nom'), row, errorLine, card);
    updateCard(card, errorLine);
  }

  function updateCard(slot, errorLine) {
    const trait = findTrait(C, build.trait);
    const card = el('div', 'character-card creator-card');
    const portrait = el('div', 'character-portrait');
    const sprite = el('div', 'sprite');
    sprite.style.backgroundImage = `url("${sheet.toDataURL()}")`;
    portrait.append(sprite);
    const effects = el('ul', 'character-effects');
    for (const e of buildEffects(build, C)) effects.append(el('li', isBenefit(e) ? '' : 'is-bad', describeEffect(e, data.texts)));
    card.append(
      portrait,
      el('p', 'character-name', cleanName(build.name) || '???'),
      el('p', 'character-strength', trait?.name ?? 'Perso maison'),
      el('p', 'character-description', trait?.description ?? 'Un parcours encore à écrire.'),
      effects,
    );
    slot.replaceChildren(card);
    const remaining = left();
    const nameError = cleanName(build.name) ? buildErrors(build, C)[0] : null;
    errorLine.textContent = nameError ?? (remaining > 0 ? `Il te reste ${remaining} point${remaining > 1 ? 's' : ''} de talent : ils seront perdus.` : '');
    $('creator-next').disabled = buildErrors(build, C).length > 0;
  }

  // ---- Navigation ----------------------------------------------------------------------
  function go(next) {
    step = next;
    $('creator-step-look').hidden = step !== 0;
    $('creator-step-talents').hidden = step !== 1;
    $('creator-step-name').hidden = step !== 2;
    for (const b of $('creator-steps').querySelectorAll('button')) {
      const on = Number(b.dataset.step) === step;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    }
    $('creator-prev').hidden = step === 0;
    $('creator-next').textContent = step === 2 ? 'C’est parti !' : 'Suivant';
    $('creator-next').disabled = false;
    if (step === 0) renderLook();
    if (step === 1) renderTalents();
    if (step === 2) renderName();
    updateBadge();
  }

  function close() {
    clearInterval(breathing);
    $('creator-screen').hidden = true;
  }

  function finish() {
    const finalBuild = { ...build, name: cleanName(build.name) };
    if (buildErrors(finalBuild, C).length) return;
    const code = encodeLook(look, pal);
    if (!code) return;
    close();
    onDone(`p-${code}`, finalBuild);
  }

  for (const b of $('creator-steps').querySelectorAll('button')) b.onclick = () => go(Number(b.dataset.step));
  $('creator-prev').onclick = () => go(step - 1);
  $('creator-next').onclick = () => (step === 2 ? finish() : go(step + 1));
  $('creator-quit').onclick = () => { close(); onCancel(); };
  $('creator-surprise').onclick = () => {
    look = randomLook(pal);
    const trait = Math.random() < 0.7 ? traitOffer[Math.floor(Math.random() * traitOffer.length)] : '';
    build = { name: randomName(C), trait, skills: {} };
    build.skills = randomSkills(C, budget(C, trait));
    lookChanged();
    go(2);
  };

  drawPreview();
  go(0);
}
