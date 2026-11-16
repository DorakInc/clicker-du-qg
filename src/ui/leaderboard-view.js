// Affichage du classement : l'onglet « 🏆 Top » avec ses deux classements (record de la
// meilleure partie, partie en cours en « Temps réel »), le profil, la page « Carrière de
// l'artiste » (on touche un joueur) et la pastille de rang dans l'en-tête.
// Lit l'état de src/online/leaderboard.js.

import { formatDuration, formatMoney, formatNumber } from '../game/index.js';
import { isPlayingNow } from '../online/rules.js';

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Tête du personnage (feuille de sprites existante), ou initiale si le personnage est inconnu. */
export function face(data, characterId) {
  const node = el('span', 'board-face');
  node.dataset.character = characterId;
  if (data.characters.some((c) => c.id === characterId)) {
    node.style.backgroundImage = `url("assets/images/personnages/${characterId}-sheet.png")`;
  }
  return node;
}

/** Le personnage en pied (vue de face qui respire), ou sa tête si l'image manque. */
function fullBody(data, characterId) {
  const character = data.characters.find((c) => c.id === characterId);
  if (!character) return face(data, characterId);
  const sprite = el('div', 'sprite');
  sprite.setAttribute('role', 'img');
  sprite.setAttribute('aria-label', character.name);
  sprite.style.setProperty('--s', 2);
  sprite.style.backgroundImage = `url("assets/images/personnages/${character.id}-sheet.png")`;
  return sprite;
}

function petSprite(def) {
  const pet = el('span', 'pet-sprite');
  pet.setAttribute('role', 'img');
  pet.setAttribute('aria-label', def.name);
  pet.style.backgroundImage = `url("assets/images/animaux/${def.id}.png")`;
  return pet;
}

function ago(date) {
  if (!date) return '';
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

const FOOTS = {
  record: "Classé selon l'argent total gagné pendant la meilleure partie de chacun. Touche un joueur pour voir sa carrière.",
  live: "La partie en cours de chacun, classée par argent gagné par seconde. Mise à jour toutes les minutes. Touche un joueur pour voir sa carrière.",
};

export function createLeaderboardView(data, lb, { goToBoard, openSheet = () => {}, closeSheet = () => {} }) {
  const list = $('board-list');
  const seen = new Set();
  let shownConflict = null;
  let tab = 'record'; // 'record' | 'live'
  let career = null; // page « Carrière de l'artiste » ouverte : { pseudo, record, recordRank, live, liveRank, ... }
  const tierName = (index) => data.tiers[index]?.name ?? `palier ${index + 1}`;
  const territoryCount = data.map?.territories?.length ?? 0;

  $('profile-conflict').onclick = () => openSheet('sheet-sync');
  $('sync-keep-remote').onclick = () => {
    closeSheet();
    lb.resolveConflict('remote');
  };
  $('sync-keep-local').onclick = () => {
    closeSheet();
    lb.resolveConflict('local');
  };
  $('settings-login').onclick = () => goToBoard();

  for (const button of document.querySelectorAll('[data-board]')) {
    button.onclick = () => {
      tab = button.dataset.board;
      render();
    };
  }

  function cloudLine() {
    const cloud = lb.cloud;
    if (!lb.profile) return ['', ''];
    switch (cloud.status) {
      case 'synced': return [`☁️ Partie sauvegardée en ligne ${cloud.savedAt ? ago(cloud.savedAt) : ''}`.trim(), 'is-ok'];
      case 'checking': return ['☁️ Vérification de ta partie en ligne…', ''];
      case 'conflict': return ['⚠️ Deux parties trouvées : choisis laquelle garder.', 'is-warn'];
      case 'missing': return ['☁️ Sauvegarde en ligne pas encore activée sur le serveur.', 'is-warn'];
      case 'error': return ['☁️ Sauvegarde en ligne impossible pour le moment. On réessaie.', 'is-warn'];
      default: return ['☁️ Ta partie part en ligne dans un instant.', ''];
    }
  }

  function summary(target, game) {
    const tier = data.tiers[game.tierIndex]?.name ?? '';
    const lines = [
      el('strong', '', formatMoney(game.totalEarned)),
      el('span', '', `${tier}${game.playedSeconds ? ` · ${formatDuration(game.playedSeconds)} de jeu` : ''}`),
      el('span', '', game.updatedAt ? `dernière partie ${ago(game.updatedAt)}` : ''),
    ];
    target.replaceChildren(face(data, game.character), ...lines);
  }

  function renderConflict() {
    const conflict = lb.cloud.conflict;
    $('profile-conflict').hidden = !conflict;
    if (!conflict || conflict === shownConflict) return;
    shownConflict = conflict;
    summary($('sync-remote'), conflict.remote);
    summary($('sync-local'), conflict.local);
    const remoteAhead = conflict.remote.totalEarned >= conflict.local.totalEarned;
    $('sync-remote').closest('.sync-card').classList.toggle('is-ahead', remoteAhead);
    $('sync-local').closest('.sync-card').classList.toggle('is-ahead', !remoteAhead);
    openSheet('sheet-sync');
  }

  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    lb.join($('profile-pseudo').value, $('profile-code').value);
  });
  $('profile-code').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  });
  $('profile-send').onclick = () => lb.submitNow();
  $('profile-leave').onclick = () => {
    if (confirm('Oublier ton pseudo sur cet appareil ? Ton score reste au classement, et tu pourras te reconnecter avec ton code.')) lb.leave();
  };
  $('chip-rank').onclick = () => goToBoard();

  // ---- Les lignes du classement ----

  /** Une ligne : un bouton qui ouvre la carrière du joueur. `right` = le chiffre à droite. */
  function row(entry, rank, isMe, sub, right) {
    const li = el('li', 'board-item');
    const button = el('button', `board-row${isMe ? ' is-me' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${entry.pseudo}, numéro ${rank} : voir sa carrière`);
    const key = `${tab}|${entry.pseudo}|${rank}`;
    if (!seen.has(key)) button.classList.add('is-new');
    seen.add(key);
    const who = el('span', 'board-who');
    const name = el('span', 'board-pseudo', isMe ? `${entry.pseudo} (toi)` : entry.pseudo);
    who.append(name, el('span', 'board-tier', sub));
    button.append(el('span', 'board-rank', `#${rank}`), face(data, entry.character), who, right);
    button.onclick = () => openCareer(entry.pseudo);
    li.append(button);
    return li;
  }

  function recordRow(entry, rank, isMe) {
    return row(entry, rank, isMe, `${tierName(entry.tierIndex)} · ${ago(entry.updatedAt)}`, el('span', 'board-money', formatMoney(entry.totalEarned)));
  }

  function liveRow(entry, rank, isMe) {
    const playing = isPlayingNow(entry.updatedAt);
    const right = el('span', 'board-figures');
    right.append(el('span', 'board-money', `${formatMoney(entry.income)}/s`), el('span', 'board-cash', `${formatMoney(entry.money)} en poche`));
    const li = row(entry, rank, isMe, `${playing ? '● en jeu' : ago(entry.updatedAt)} · ${formatNumber(entry.fans)} abonnés`, right);
    const sub = li.querySelector('.board-tier');
    sub.classList.toggle('is-playing', playing);
    if (entry.failOut) sub.prepend(el('span', 'board-flag', 'fail out'));
    return li;
  }

  function boardMessage() {
    if (lb.mode === 'off') {
      return "Le classement en ligne n'est pas encore branché : il faut créer le projet Supabase (voir supabase/README.md). En attendant, essaie la démo : ajoute ?classement=demo à l'adresse du jeu.";
    }
    if (tab === 'record') {
      if (lb.error) return lb.error;
      if (lb.loaded && !lb.rows.length) return 'Personne au classement pour le moment. Sois le premier !';
      if (!lb.loaded) return 'Chargement du classement…';
      return '';
    }
    if (lb.liveStatus === 'missing') return "Le classement en temps réel n'est pas encore activé sur le serveur (voir supabase/README.md).";
    if (lb.liveStatus === 'error' || lb.error) return lb.error ?? 'Impossible de joindre le classement. On réessaie plus tard.';
    if (!lb.loaded || lb.liveStatus === 'loading') return 'Chargement des parties en cours…';
    if (!lb.liveRows.length) return "Personne n'a encore de partie en ligne. Connecte-toi : ta partie part toutes les minutes.";
    return '';
  }

  function renderBoard() {
    for (const button of document.querySelectorAll('[data-board]')) {
      const active = button.dataset.board === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      if (active) $('board-panel').setAttribute('aria-labelledby', button.id);
    }
    const message = $('board-message');
    const text = boardMessage();
    message.hidden = !text;
    message.textContent = text;
    $('board-foot').textContent = lb.mode === 'off' ? '' : FOOTS[tab];

    const me = lb.profile?.pseudo;
    const rows = tab === 'record' ? lb.rows : lb.liveRows;
    const mine = tab === 'record' ? lb.mine : lb.liveMine;
    const make = tab === 'record' ? recordRow : liveRow;
    list.replaceChildren(...rows.map((entry, i) => make(entry, i + 1, entry.pseudo === me)));
    const outside = mine && !rows.some((entry) => entry.pseudo === me);
    $('board-mine').hidden = !outside;
    if (outside) {
      const ol = el('ol', 'board-list');
      ol.append(make(mine.row, mine.rank, true));
      $('board-mine').replaceChildren(ol);
    }
  }

  // ---- Page « Carrière de l'artiste » ----

  /** Ce qu'on sait déjà d'un joueur grâce aux deux classements chargés. */
  function fromLists(pseudo) {
    const known = {};
    const recordIndex = lb.rows.findIndex((r) => r.pseudo === pseudo);
    if (recordIndex >= 0) Object.assign(known, { record: lb.rows[recordIndex], recordRank: recordIndex + 1 });
    else if (lb.mine?.row.pseudo === pseudo) Object.assign(known, { record: lb.mine.row, recordRank: lb.mine.rank });
    const liveIndex = lb.liveRows.findIndex((r) => r.pseudo === pseudo);
    if (liveIndex >= 0) Object.assign(known, { live: lb.liveRows[liveIndex], liveRank: liveIndex + 1 });
    else if (lb.liveMine?.row.pseudo === pseudo) Object.assign(known, { live: lb.liveMine.row, liveRank: lb.liveMine.rank });
    return known;
  }

  async function openCareer(pseudo) {
    career = { pseudo, record: null, live: null, ...fromLists(pseudo), loading: true };
    renderCareer();
    openSheet('sheet-career');
    const result = await lb.loadCareer(pseudo);
    if (career?.pseudo !== pseudo) return; // un autre joueur a été ouvert entre-temps
    career = result && !result.error
      ? { pseudo, ...result, loading: false }
      : { ...career, loading: false, error: result?.error ?? null };
    renderCareer();
  }

  function stats(target, items) {
    target.replaceChildren(...items.map(([label, value, className = '']) => {
      const item = el('div', `artist-stat ${className}`.trim());
      item.append(el('dt', '', label), el('dd', '', value));
      return item;
    }));
  }

  function renderCareer() {
    if (!career) return;
    const { pseudo, record, live } = career;
    const isMe = pseudo === lb.profile?.pseudo;
    const current = live ?? record;
    const characterId = current?.character ?? '';
    const character = data.characters.find((c) => c.id === characterId);
    const tierIndex = current?.tierIndex ?? 0; // palier de la partie en cours (sinon du record)

    // Le personnage, son animal, son nom, son palier.
    const stage = el('div', 'artist-stage');
    stage.dataset.character = characterId;
    stage.append(fullBody(data, characterId));
    const companion = live?.companion && live.pets[live.companion] ? (data.pets ?? []).find((p) => p.id === live.companion) : null;
    if (companion) stage.append(petSprite(companion));
    if (live?.failOut) stage.append(el('span', 'artist-stamp', 'FAIL OUT'));

    const id = el('div', 'artist-id');
    const name = el('p', 'artist-name', pseudo);
    if (isMe) name.append(el('span', 'artist-you', 'toi'));
    id.append(name);
    if (current) id.append(el('p', 'artist-tier', `${tierName(tierIndex)} · palier ${tierIndex + 1}/${data.tiers.length}`));
    if (character) id.append(el('p', 'artist-meta', `${character.name} · ${character.strength}`));
    if (live) {
      const playing = isPlayingNow(live.updatedAt);
      id.append(el('p', `artist-presence${playing ? ' is-playing' : ''}`, playing ? '● en jeu en ce moment' : `vu ${ago(live.updatedAt)}`));
    }
    const ranks = el('p', 'artist-ranks');
    if (career.liveRank) ranks.append(el('span', 'artist-rank', `⚡ #${career.liveRank} temps réel`));
    if (career.recordRank) ranks.append(el('span', 'artist-rank', `🏆 #${career.recordRank} record`));
    if (ranks.childElementCount) id.append(ranks);
    $('artist-hero').replaceChildren(stage, id);

    // Partie en cours.
    const liveNote = $('artist-live-note');
    liveNote.hidden = Boolean(live);
    if (!live) {
      liveNote.textContent = career.loading ? 'Chargement…'
        : career.liveMissing || lb.liveStatus === 'missing' ? "Le temps réel n'est pas encore activé sur le serveur."
          : isMe ? "Ta partie n'est pas encore en ligne : elle part toutes les minutes."
            : "Pas encore de partie en ligne : la partie part toutes les minutes quand le pseudo est connecté sur un appareil.";
    }
    stats($('artist-live'), live ? [
      ['Cash', formatMoney(live.money), 'is-big'],
      ['Revenu', `${formatMoney(live.income)}/s`, 'is-big'],
      ['Abonnés', formatNumber(live.fans)],
      ['Beats/s', formatNumber(live.bps)],
      ['Gagné (partie)', formatMoney(live.totalEarned)],
      ['Beats produits', formatNumber(live.totalBeats)],
      ['Territoires', territoryCount ? `${live.territories}/${territoryCount}` : String(live.territories)],
      ['Serre', live.greenhouse ? `${formatNumber(live.totalGrams)} g récoltés` : '🔒 pas encore'],
      ['Temps de jeu', formatDuration(live.playedSeconds)],
    ] : []);
    const pets = live ? (data.pets ?? []).filter((p) => live.pets[p.id] > 0) : [];
    $('artist-pets').hidden = !live;
    $('artist-pets').replaceChildren(...(pets.length ? pets.map((def) => {
      const li = el('li', `artist-pet${def.id === live.companion ? ' is-companion' : ''}`);
      const text = el('span', 'artist-pet-text');
      text.append(el('strong', '', def.name), el('span', '', `amitié niv. ${live.pets[def.id]}${def.id === live.companion ? ' · compagnon' : ''}`));
      li.append(petSprite(def), text);
      return li;
    }) : [el('li', 'artist-pet is-empty', 'Aucun animal adopté pour le moment.')]));

    // Record.
    const recordNote = $('artist-record-note');
    recordNote.hidden = Boolean(record);
    if (!record) recordNote.textContent = career.loading ? 'Chargement…' : 'Pas encore de score au classement.';
    stats($('artist-record'), record ? [
      ['Argent gagné', formatMoney(record.totalEarned), 'is-big'],
      ['Rang', career.recordRank ? `#${career.recordRank}` : '–', 'is-big'],
      ['Palier', tierName(record.tierIndex)],
      ['Abonnés', formatNumber(record.fans)],
      ['Territoires', territoryCount ? `${record.territories}/${territoryCount}` : String(record.territories)],
      ['Établi', ago(record.updatedAt) || '–'],
    ] : []);

    const status = $('artist-status');
    status.textContent = career.error ?? '';
    status.hidden = !career.error;
  }

  /** Le classement a bougé : la carrière ouverte suit les nouveaux chiffres. */
  function refreshCareer() {
    if (!career || $('sheet-career').hidden || career.loading) return;
    Object.assign(career, fromLists(career.pseudo));
    renderCareer();
  }

  function render() {
    // En-tête : direct ou non.
    const live = $('board-live');
    live.classList.toggle('is-live', lb.live);
    live.textContent = lb.mode === 'off' ? '○ hors ligne'
      : lb.live ? `● en direct${lb.mode === 'demo' ? ' (démo)' : ''}`
        : lb.updatedAt ? `○ mis à jour ${ago(lb.updatedAt)}` : '○ connexion…';

    renderBoard();
    refreshCareer();

    // Profil.
    const me = lb.profile?.pseudo;
    const online = lb.mode !== 'off';
    $('profile-form').hidden = Boolean(lb.profile) || !online;
    $('profile-card').hidden = !lb.profile;
    $('profile-join').disabled = lb.busy;
    $('profile-join').firstElementChild.textContent = lb.busy ? 'Connexion…' : 'Entrer dans le classement';
    if (lb.profile) {
      $('profile-current').textContent = me;
      $('profile-rank').textContent = lb.mine ? `#${lb.mine.rank} au classement` : 'Pas encore classé';
      $('profile-sent').textContent = lb.lastSentAt
        ? `Score envoyé ${ago(new Date(lb.lastSentAt))}. Envoi automatique toutes les minutes.`
        : 'Ta partie et ton score partent automatiquement toutes les minutes.';
      $('profile-send').disabled = !online;
      const character = lb.mine?.row.character;
      $('profile-face').replaceWith(Object.assign(face(data, character ?? data.characters[0].id), { id: 'profile-face' }));
    }
    const notice = $('profile-notice');
    notice.hidden = !lb.notice;
    if (lb.notice) {
      notice.textContent = lb.notice.text;
      notice.classList.toggle('is-error', lb.notice.kind === 'error');
    }

    // Sauvegarde en ligne : ligne d'état (profil et « Ton QG »), choix entre deux parties.
    const [cloudText, cloudKind] = cloudLine();
    for (const id of ['profile-cloud', 'settings-cloud']) {
      $(id).textContent = cloudText;
      $(id).className = `cloud-line ${cloudKind}`;
      $(id).hidden = !cloudText;
    }
    $('settings-account').textContent = lb.mode === 'off'
      ? 'Classement et sauvegarde en ligne : hors ligne pour le moment.'
      : lb.profile
        ? `Connecté : ${lb.profile.pseudo}${lb.mine ? ` (#${lb.mine.rank})` : ''}`
        : 'Pas connecté : ta partie reste sur cet appareil.';
    $('settings-login').hidden = lb.mode === 'off';
    $('settings-login-label').textContent = lb.profile ? 'Voir le classement' : 'Se connecter (pseudo + code)';
    renderConflict();

    // Pastille de rang dans l'en-tête.
    $('chip-rank').hidden = !lb.mine;
    if (lb.mine) $('stat-rank').textContent = `#${lb.mine.rank}`;
  }

  lb.onChange(render);
  render();
  setInterval(() => { if (lb.loaded) render(); }, 30000); // « il y a X min » reste à jour
  return { render, openCareer };
}
