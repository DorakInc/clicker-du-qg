// Affichage : lit l'état du jeu et met à jour la page. Ne modifie jamais
// l'état directement ; les clics passent par les fonctions `actions` reçues.
//
// Images : si un fichier existe à l'emplacement attendu, il est affiché,
// sinon un remplaçant texte apparaît. Emplacements (volet B) :
//   assets/images/personnages/<id>.png   portrait (sélection et QG)
//   assets/images/qg/<idUpgrade>.png      objet du QG une fois acheté

import {
  beatValue, beatsPerSecond, cannabisPrice, formatMoney, formatNumber, getModifiers,
  incomePerSecond, isOverdosed, isUnlocked, producerCost, quality,
} from '../game/index.js';

const $ = (id) => document.getElementById(id);

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
    const portrait = el('div', 'character-portrait');
    portrait.append(
      imageOr(`assets/images/personnages/${character.id}.png`, character.name, document.createTextNode(character.name[0])),
    );
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
  beatButton.onclick = (event) => actions.click(event);
  $('buy-cannabis').onclick = () => actions.buyCannabis();
  $('reset').onclick = () => actions.reset();
  $('toggle-sound').onclick = () => actions.toggleSound();

  const { maxHigh, overdose } = data.balance.cannabis;
  $('overdose-marker').style.left = `${(overdose.threshold / maxHigh) * 100}%`;
  $('overdose-marker').hidden = !overdose.enabled;

  let qgKey = '';

  function update(state) {
    const mods = getModifiers(state, data);
    const tier = data.tiers[state.tierIndex];
    const nextTier = data.tiers[state.tierIndex + 1];

    $('stat-money').textContent = formatMoney(state.money);
    $('stat-income').textContent = formatMoney(incomePerSecond(state, data, mods));
    $('stat-beat-value').textContent = formatMoney(beatValue(state, data, mods));
    $('stat-bps').textContent = formatNumber(beatsPerSecond(state, data, mods));
    $('stat-tier').textContent = tier.name;

    // Fans : la barre est relative au niveau de référence ; le repère montre le seuil de fail out.
    const scale = Math.max(state.fansReference, data.balance.fail.minReferenceFans);
    $('fans-fill').style.width = `${Math.min(100, (state.fans / scale) * 100)}%`;
    $('fans-ref').style.left = `${data.balance.fail.enterRatio * 100}%`;
    $('fans-ref').hidden = state.fansReference < data.balance.fail.minReferenceFans;
    $('fans-count').textContent = formatNumber(state.fans);
    $('next-tier').textContent = nextTier
      ? `Prochain palier : ${nextTier.name} à ${formatNumber(nextTier.fansRequired)} fans`
      : 'Palier maximum atteint.';

    $('high-fill').style.width = `${(state.high / maxHigh) * 100}%`;
    $('quality').textContent = `×${quality(state, data, mods).toFixed(2)}`;
    const price = cannabisPrice(state, data, mods);
    $('cannabis-price').textContent = `(${formatMoney(price)})`;
    $('buy-cannabis').disabled = state.money < price;

    const overdosed = isOverdosed(state, data);
    $('status-fail').hidden = !state.failOut;
    $('status-overdose').hidden = !overdosed;
    $('qg').classList.toggle('is-high', state.high > 0);
    $('qg').classList.toggle('is-failing', state.failOut);

    for (const row of producerRows) {
      const owned = state.producers[row.def.id] ?? 0;
      const cost = producerCost(row.def, owned);
      const unlocked = isUnlocked(row.def, state);
      row.owned.textContent = owned > 0 ? String(owned) : '';
      row.effect.textContent = `${formatNumber(row.def.beatsPerSecond * mods.bps)} beats/s chacun`;
      updateCost(row, cost, unlocked, state, false);
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
    if (bought) {
      row.cost.textContent = 'Installé';
      row.cost.classList.remove('too-expensive');
      row.button.disabled = true;
      return;
    }
    if (!unlocked) {
      const tier = data.tiers[row.def.requiresTier];
      row.cost.textContent = `Débloqué au palier « ${tier?.name ?? '?'} »`;
      row.cost.classList.remove('too-expensive');
      row.button.disabled = true;
      row.li.classList.add('is-locked');
      return;
    }
    row.li.classList.remove('is-locked');
    row.cost.textContent = formatMoney(cost);
    row.cost.classList.toggle('too-expensive', state.money < cost);
    row.button.disabled = state.money < cost;
  }

  function renderQg(state) {
    const character = data.characters.find((c) => c.id === state.characterId);
    const fallback = el('div', 'qg-character-fallback', character.name[0]);
    $('qg-character').replaceChildren(
      imageOr(`assets/images/personnages/${character.id}.png`, character.name, fallback),
      el('div', 'qg-character-name', character.name),
    );
    const items = data.upgrades
      .filter((u) => state.upgrades[u.id])
      .map((u) => {
        const item = el('div', 'qg-item');
        item.title = u.name;
        item.append(imageOr(`assets/images/qg/${u.id}.png`, u.name, document.createTextNode(u.name)));
        return item;
      });
    $('qg-items').replaceChildren(...items);
  }

  function showMessage(text, kind = '') {
    const list = $('messages');
    const li = el('li', kind, text);
    list.prepend(li);
    while (list.children.length > 5) list.lastElementChild.remove();
  }

  function floatText(text, x, y) {
    const node = el('div', 'floater', text);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
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
