// Affichage : lit l'état du jeu et met à jour la page. Ne modifie jamais
// l'état directement ; les clics passent par les fonctions `actions` reçues.
//
// Images (volet B), cherchées par id ; un remplaçant s'affiche si le fichier manque :
//   assets/images/personnages/<id>-sheet.png  feuille de sprites (npm run sprites)
//   assets/images/qg/fond.png                 le décor du QG (npm run sprites)
//   assets/images/qg/<idUpgrade>.png          objet du QG une fois acheté

import {
  beatValue, beatsPerSecond, cannabisPrice, formatMoney, formatNumber, getModifiers,
  incomePerSecond, isOverdosed, isUnlocked, producerCost, quality,
} from '../game/index.js';

const $ = (id) => document.getElementById(id);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function describeEffect({ stat, multiply }, texts) {
  const label = texts.stats[stat] ?? stat;
  if (multiply >= 2 && Number.isInteger(multiply)) return `${label} ×${multiply}`;
  const pct = Math.round((multiply - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct} % ${label}`;
}

/** Image avec remplaçant si le fichier n'existe pas encore. */
function imageOr(src, alt, fallback) {
  const img = document.createElement('img');
  img.alt = alt;
  img.src = src;
  img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
  return img;
}

/**
 * Personnage animé (respiration) à partir de sa feuille de sprites :
 * 2 images de 32 × 48 par ligne, ligne 0 = vue de face. La taille vient de
 * la variable CSS --s (héritée du parent si `scale` n'est pas donné).
 */
function spriteOr(id, name, fallback, scale) {
  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  sprite.setAttribute('role', 'img');
  sprite.setAttribute('aria-label', name);
  if (scale) sprite.style.setProperty('--s', scale);
  const src = `assets/images/personnages/${id}-sheet.png`;
  const probe = new Image();
  probe.addEventListener('error', () => sprite.replaceWith(fallback), { once: true });
  probe.src = src;
  sprite.style.backgroundImage = `url("${src}")`;
  return sprite;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- Sélection de personnage --------------------------------------------

export function showCharacterSelect(data, onPick) {
  $('game-screen').hidden = true;
  $('select-screen').hidden = false;
  const list = $('character-list');
  list.replaceChildren();

  for (const character of data.characters) {
    const card = el('button', 'character-card');
    card.type = 'button';
    card.dataset.character = character.id;
    const portrait = el('div', 'character-portrait');
    portrait.append(spriteOr(character.id, character.name, document.createTextNode(character.name[0]), 3));
    const effects = el('ul', 'character-effects');
    for (const effect of character.effects) effects.append(el('li', '', describeEffect(effect, data.texts)));
    card.append(
      portrait,
      el('p', 'character-name', character.name),
      el('p', 'character-strength', character.strength),
      el('p', 'character-description', character.description),
      effects,
    );
    card.addEventListener('click', () => onPick(character.id));
    list.append(card);
  }
}

// ---- Écran de jeu ---------------------------------------------------------

export function createGameView(data, actions) {
  $('select-screen').hidden = true;
  $('game-screen').hidden = false;

  const producerRows = data.producers.map((def) => shopRow(def, () => actions.buyProducer(def.id)));
  const upgradeRows = data.upgrades.map((def) => shopRow(def, () => actions.buyUpgrade(def.id)));
  $('shop-producers').replaceChildren(...producerRows.map((r) => r.li));
  $('shop-upgrades').replaceChildren(...upgradeRows.map((r) => r.li));
  for (const row of upgradeRows) {
    row.effect.textContent = row.def.effects.map((e) => describeEffect(e, data.texts)).join(', ');
  }

  for (const tab of document.querySelectorAll('.tab')) {
    tab.onclick = () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('is-active', t === tab);
      for (const panel of document.querySelectorAll('.shop')) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    };
  }

  const beatButton = $('beat-button');
  beatButton.onclick = (event) => {
    beatButton.classList.remove('hit');
    void beatButton.offsetWidth; // relance l'animation à chaque clic
    beatButton.classList.add('hit');
    actions.click(event);
  };
  $('buy-cannabis').onclick = () => actions.buyCannabis();
  $('reset').onclick = () => actions.reset();
  $('toggle-sound').onclick = () => actions.toggleSound();

  const { maxHigh, overdose } = data.balance.cannabis;
  $('overdose-marker').style.left = `${(overdose.threshold / maxHigh) * 100}%`;
  $('overdose-marker').hidden = !overdose.enabled;

  // La scène est dessinée en 160 × 100 pixels : --s = taille d'un pixel à l'écran.
  const scene = $('qg');
  const fitScene = () => scene.style.setProperty('--s', scene.clientWidth / 160);
  new ResizeObserver(fitScene).observe(scene);
  fitScene();

  startTicker(data.texts.ticker ?? []);

  let qgKey = '';
  let spinKey = '';

  function update(state) {
    const mods = getModifiers(state, data);
    const tier = data.tiers[state.tierIndex];
    const nextTier = data.tiers[state.tierIndex + 1];
    const bps = beatsPerSecond(state, data, mods);

    $('stat-money').textContent = formatMoney(state.money);
    $('stat-income').textContent = formatMoney(incomePerSecond(state, data, mods));
    $('stat-beat-value').textContent = formatMoney(beatValue(state, data, mods));
    $('stat-bps').textContent = formatNumber(bps);
    $('stat-tier').textContent = tier.name;

    // Le vinyle tourne plus vite quand la production monte (par paliers, pour éviter les saccades).
    const spin = ['6s', '4s', '3s', '2s', '1.4s', '1s', '.7s'][Math.min(6, Math.floor(Math.log10(1 + bps * 3)))];
    if (spin !== spinKey) {
      spinKey = spin;
      beatButton.style.setProperty('--spin', spin);
    }

    // Fans : la barre est relative au niveau de référence ; le repère montre le seuil de fail out.
    const { fail } = data.balance;
    const scale = Math.max(state.fansReference, fail.minReferenceFans);
    $('fans-fill').style.width = `${Math.min(100, (state.fans / scale) * 100)}%`;
    $('fans-ref').style.left = `${fail.enterRatio * 100}%`;
    $('fans-ref').hidden = state.fansReference < fail.minReferenceFans;
    $('fans-count').textContent = formatNumber(state.fans);
    $('next-tier').textContent = nextTier
      ? `Prochain palier : ${nextTier.name} à ${formatNumber(nextTier.fansRequired)} abonnés`
      : 'Palier maximum. Légende du sous-sol.';

    $('high-fill').style.width = `${(state.high / maxHigh) * 100}%`;
    $('quality').textContent = `beats ×${quality(state, data, mods).toFixed(2)}`;
    const price = cannabisPrice(state, data, mods);
    $('cannabis-price').textContent = formatMoney(price);
    $('buy-cannabis').disabled = state.money < price;

    const overdosed = isOverdosed(state, data);
    $('status-fail').hidden = !state.failOut;
    $('status-fail-text').hidden = !state.failOut;
    $('status-overdose').hidden = !overdosed;
    scene.style.setProperty('--high', (state.high / maxHigh).toFixed(2));
    scene.classList.toggle('is-overdosed', overdosed);
    scene.classList.toggle('is-failing', state.failOut);

    for (const row of producerRows) {
      const owned = state.producers[row.def.id] ?? 0;
      row.owned.textContent = owned > 0 ? `×${owned}` : '';
      row.effect.textContent = `+${formatNumber(row.def.beatsPerSecond * mods.bps)} beats/s chacun`;
      updateCost(row, producerCost(row.def, owned), isUnlocked(row.def, state), state, false);
    }
    for (const row of upgradeRows) {
      const bought = Boolean(state.upgrades[row.def.id]);
      row.owned.textContent = bought ? '✓' : '';
      updateCost(row, row.def.cost, isUnlocked(row.def, state), state, bought);
    }

    // Le QG n'est reconstruit que quand les upgrades achetés changent.
    const key = `${state.characterId}|${Object.keys(state.upgrades).join(',')}`;
    if (key !== qgKey) {
      qgKey = key;
      renderQg(state);
    }
  }

  function updateCost(row, cost, unlocked, state, bought) {
    row.li.classList.toggle('is-locked', !unlocked && !bought);
    row.cost.classList.remove('too-expensive');
    if (bought) {
      row.cost.textContent = 'installé au QG';
      row.button.disabled = true;
    } else if (!unlocked) {
      row.cost.textContent = `🔒 palier « ${data.tiers[row.def.requiresTier]?.name ?? '?'} »`;
      row.button.disabled = true;
    } else {
      row.cost.textContent = formatMoney(cost);
      row.cost.classList.toggle('too-expensive', state.money < cost);
      row.button.disabled = state.money < cost;
    }
  }

  function renderQg(state) {
    const character = data.characters.find((c) => c.id === state.characterId);
    const fallback = el('div', 'qg-character-fallback', character.name[0]);
    $('qg-character').replaceChildren(spriteOr(character.id, character.name, fallback));
    const items = data.upgrades
      .filter((u) => state.upgrades[u.id])
      .map((u) => {
        const item = el('div', 'sticker');
        item.title = u.name;
        item.append(imageOr(`assets/images/qg/${u.id}.png`, u.name, document.createTextNode(u.name)));
        return item;
      });
    $('qg-items').replaceChildren(...items);
  }

  function startTicker(lines) {
    const text = $('ticker-text');
    if (!lines.length) return;
    let index = 0;
    const show = () => {
      text.textContent = lines[index % lines.length];
      text.style.setProperty('--ticker-duration', `${Math.max(10, text.textContent.length * 0.22)}s`);
      index += 1;
    };
    text.addEventListener('animationiteration', show);
    show();
  }

  function showMessage(text, kind = '') {
    if (!text) return;
    const list = $('messages');
    const li = el('li', kind);
    if (kind === 'fan') li.append(el('span', 'feed-handle', pick(data.texts.fanHandles ?? ['@fan'])));
    li.append(document.createTextNode(text));
    list.prepend(li);
    while (list.children.length > 5) list.lastElementChild.remove();
  }

  function floatText(text, x, y) {
    const node = el('div', 'floater', text);
    node.style.left = `${x - 20}px`;
    node.style.top = `${y - 10}px`;
    node.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 60)}px`);
    node.style.setProperty('--tilt', `${Math.round((Math.random() - 0.5) * 30)}deg`);
    node.addEventListener('animationend', () => node.remove());
    document.body.append(node);
  }

  function setFansTrend(direction) {
    const trend = $('fans-trend');
    trend.className = `trend ${direction}`;
    trend.textContent = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
  }

  function setSaveStatus(text) {
    $('save-status').textContent = text;
  }

  function setSoundLabel(enabled) {
    $('toggle-sound').textContent = enabled ? 'Couper le son' : 'Activer le son';
  }

  return { update, showMessage, floatText, setFansTrend, setSaveStatus, setSoundLabel, beatButton };
}

function shopRow(def, onBuy) {
  const li = el('li');
  const button = el('button', 'shop-item');
  button.type = 'button';
  const owned = el('span', 'shop-item-owned');
  const effect = el('span', 'shop-item-effect');
  const cost = el('span', 'shop-item-cost');
  button.append(el('span', 'shop-item-name', def.name), owned, el('span', 'shop-item-desc', def.description), effect, cost);
  button.addEventListener('click', onBuy);
  li.append(button);
  return { def, li, button, owned, effect, cost };
}
