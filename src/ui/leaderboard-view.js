// Affichage du classement : l'onglet « 🏆 Classement », le tableau, le profil et la
// pastille de rang dans l'en-tête. Lit l'état de src/online/leaderboard.js.

import { formatMoney } from '../game/index.js';

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

export function createLeaderboardView(data, lb, { goToBoard }) {
  const list = $('board-list');
  const seen = new Set();

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
        : 'Ton score part automatiquement toutes les minutes.';
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

    // Pastille de rang dans l'en-tête.
    $('chip-rank').hidden = !lb.mine;
    if (lb.mine) $('stat-rank').textContent = `#${lb.mine.rank}`;
  }

  lb.onChange(render);
  render();
  setInterval(() => { if (lb.loaded) render(); }, 30000); // « il y a X min » reste à jour
  return { render };
}
