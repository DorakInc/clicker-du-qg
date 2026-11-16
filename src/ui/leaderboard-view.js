// Affichage du classement : l'onglet « 🏆 Classement », le tableau, le profil et la
// pastille de rang dans l'en-tête. Lit l'état de src/online/leaderboard.js.

import { formatDuration, formatMoney } from '../game/index.js';

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

function ago(date) {
  if (!date) return '';
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function createLeaderboardView(data, lb, { goToBoard, openSheet = () => {}, closeSheet = () => {} }) {
  const list = $('board-list');
  const seen = new Set();
  let shownConflict = null;

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

  function row(entry, rank, isMe) {
    const li = el('li', `board-row${isMe ? ' is-me' : ''}`);
    const key = `${entry.pseudo}|${rank}`;
    if (!seen.has(key)) li.classList.add('is-new');
    seen.add(key);
    const who = el('span', 'board-who');
    const tier = data.tiers[entry.tierIndex]?.name ?? `palier ${entry.tierIndex + 1}`;
    who.append(
      el('span', 'board-pseudo', isMe ? `${entry.pseudo} (toi)` : entry.pseudo),
      el('span', 'board-tier', `${tier} · ${ago(entry.updatedAt)}`),
    );
    li.append(el('span', 'board-rank', `#${rank}`), face(data, entry.character), who, el('span', 'board-money', formatMoney(entry.totalEarned)));
    return li;
  }

  function render() {
    // En-tête : direct ou non.
    const live = $('board-live');
    live.classList.toggle('is-live', lb.live);
    live.textContent = lb.mode === 'off' ? '○ hors ligne'
      : lb.live ? `● en direct${lb.mode === 'demo' ? ' (démo)' : ''}`
        : lb.updatedAt ? `○ mis à jour ${ago(lb.updatedAt)}` : '○ connexion…';

    // Message général (pas configuré, erreur réseau, vide).
    const message = $('board-message');
    let text = '';
    if (lb.mode === 'off') {
      text = "Le classement en ligne n'est pas encore branché : il faut créer le projet Supabase (voir supabase/README.md). En attendant, essaie la démo : ajoute ?classement=demo à l'adresse du jeu.";
    } else if (lb.error) {
      text = lb.error;
    } else if (lb.loaded && !lb.rows.length) {
      text = 'Personne au classement pour le moment. Sois le premier !';
    } else if (!lb.loaded) {
      text = 'Chargement du classement…';
    }
    message.hidden = !text;
    message.textContent = text;

    const me = lb.profile?.pseudo;
    list.replaceChildren(...lb.rows.map((entry, i) => row(entry, i + 1, entry.pseudo === me)));
    const outside = lb.mine && !lb.rows.some((entry) => entry.pseudo === me);
    $('board-mine').hidden = !outside;
    if (outside) {
      const ol = el('ol', 'board-list');
      ol.append(row(lb.mine.row, lb.mine.rank, true));
      $('board-mine').replaceChildren(ol);
    }

    // Profil.
    const online = lb.mode !== 'off';
    $('profile-form').hidden = Boolean(lb.profile) || !online;
    $('profile-card').hidden = !lb.profile;
    $('profile-join').disabled = lb.busy;
    $('profile-join').firstElementChild.textContent = lb.busy ? 'Connexion…' : 'Entrer dans le classement';
    if (lb.profile) {
      $('profile-current').textContent = lb.profile.pseudo;
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
  return { render };
}
