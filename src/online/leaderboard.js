// Le compte du joueur côté jeu : pseudo + code secret, qui portent à la fois
//   - le classement (score de la meilleure partie, envoyé toutes les minutes) ;
//   - la sauvegarde en ligne (la partie en cours, envoyée toutes les minutes).
// L'affichage est dans src/ui/leaderboard-view.js.
//
// Le profil est gardé dans le navigateur (clé clicker-du-qg/profile) avec la révision de la
// sauvegarde en ligne que cet appareil connaît. Si une autre révision apparaît sur le serveur
// (le joueur a joué ailleurs), on ne l'écrase jamais en silence : soit la partie locale vient de
// commencer et on reprend celle en ligne, soit on demande au joueur laquelle garder.

import {
  codeError, cleanPseudo, describeResult, isConfigured, isFreshGame, pseudoError, scoreFromState, summarize,
} from './rules.js';
import { createMemoryBackend, createSupabaseBackend } from './backend.js';

export const PROFILE_KEY = 'clicker-du-qg/profile';
const MIN_GAP_MS = 11000; // le serveur refuse plus d'un envoi par 10 s (score et sauvegarde, chacun)

/**
 * @param getSaveText  () => texte de la sauvegarde locale (serialize(state))
 * @param onLoadSave   (texte) => remplace la partie de cet appareil par celle en ligne
 * @param isValidSave  (objet) => vrai si la sauvegarde est lisible par cette version du jeu
 */
export function createLeaderboard({
  config, storage, demo = false, onMessage = () => {}, getSaveText = () => null, onLoadSave = () => {}, isValidSave = () => true,
}) {
  const backend = demo ? createMemoryBackend({ storage }) : isConfigured(config) ? createSupabaseBackend(config) : null;
  const listeners = new Set();
  let getState = () => null;
  let unsubscribe = null;
  let refreshing = false;
  let refreshTimer = null;
  let sending = false;
  let saving = false;
  let pending = false;
  let pollClock = 0;
  let blockedUntil = 0;
  let lastSaveAt = 0;
  let lastSavedTime = -1;

  const lb = {
    mode: backend?.kind ?? 'off', // 'supabase' | 'demo' | 'off'
    profile: loadProfile(),
    rows: [],
    mine: null, // { row, rank }
    live: false,
    loaded: false,
    error: null,
    notice: null, // { text, kind: 'ok' | 'error' }
    busy: false,
    lastSentAt: 0,
    lastSentTotal: -1,
    updatedAt: null,
    // Sauvegarde en ligne
    cloud: {
      status: 'idle', // 'idle' | 'checking' | 'synced' | 'conflict' | 'missing' | 'error'
      savedAt: null,
      conflict: null, // { local, remote, remoteSave, remoteRevision }
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    start(stateGetter) {
      getState = stateGetter;
      if (!backend) return emit();
      unsubscribe = backend.subscribe(scheduleRefresh, (live) => {
        lb.live = live;
        emit();
      });
      refresh();
      if (lb.profile) {
        pending = true;
        reconcile();
      }
      return undefined;
    },

    stop() {
      unsubscribe?.();
      backend?.stop?.();
    },

    async join(pseudoInput, codeInput) {
      const pseudo = cleanPseudo(pseudoInput);
      const code = String(codeInput ?? '').trim();
      const invalid = pseudoError(pseudo) ?? codeError(code);
      if (invalid) return notify(invalid, 'error');
      if (!backend || lb.busy) return undefined;
      lb.busy = true;
      emit();
      try {
        const result = await backend.join(pseudo, code);
        if (result.status === 'created' || result.status === 'ok') {
          // Nouveau pseudo sur cet appareil : on ne connaît encore aucune révision en ligne.
          lb.profile = { pseudo: result.pseudo, code, revision: 0 };
          saveProfile();
          lb.lastSentAt = 0;
          lb.lastSentTotal = -1;
          lastSaveAt = 0;
          blockedUntil = 0;
          notify(describeResult(result), 'ok');
          onMessage(describeResult(result));
          await reconcile({ joining: true });
          await submit();
        } else {
          notify(describeResult({ ...result, pseudo }), 'error');
        }
        return result;
      } catch (error) {
        console.warn('Classement :', error);
        return notify(describeResult({ status: 'network' }), 'error');
      } finally {
        lb.busy = false;
        emit();
      }
    },

    /** Oublie le pseudo sur cet appareil (le score et la sauvegarde en ligne restent). */
    leave() {
      lb.profile = null;
      lb.mine = null;
      lb.notice = null;
      lb.cloud = { status: 'idle', savedAt: null, conflict: null };
      storage.remove(PROFILE_KEY);
      emit();
    },

    /** Bouton « Sauvegarder et envoyer » : partie en ligne + score, tout de suite. */
    async submitNow() {
      pending = true;
      await saveCloud({ manual: true });
      return submit({ manual: true });
    },

    /** Un palier vient d'être atteint : envoyer dès que le serveur le permet. */
    requestSubmit() {
      pending = true;
    },

    /** Le joueur a choisi entre deux parties ('remote' = celle en ligne, 'local' = celle-ci). */
    async resolveConflict(choice) {
      const conflict = lb.cloud.conflict;
      if (!conflict || !lb.profile) return;
      lb.profile.revision = conflict.remoteRevision;
      saveProfile();
      lb.cloud.conflict = null;
      if (choice === 'remote') {
        lb.cloud.status = 'synced';
        emit();
        onLoadSave(JSON.stringify(conflict.remoteSave));
        return;
      }
      lb.cloud.status = 'idle';
      lastSaveAt = 0;
      emit();
      await saveCloud({ manual: true });
    },

    /** L'onglet passe en arrière-plan : dernière chance de sauvegarder en ligne. */
    flush() {
      if (lb.profile && Date.now() - lastSaveAt >= MIN_GAP_MS) saveCloud();
    },

    refresh,

    /** À chaque image : envois automatiques et lecture régulière si le direct ne marche pas. */
    tick(dt) {
      if (!backend) return;
      if (!lb.live) {
        pollClock += dt;
        if (pollClock >= config.pollSeconds) {
          pollClock = 0;
          refresh();
        }
      }
      if (!lb.profile) return;
      const now = Date.now();
      if (now < blockedUntil) return;
      const state = getState();
      if (!state) return;

      // Sauvegarde en ligne : toutes les minutes, si la partie a avancé.
      if (!saving && now - lastSaveAt >= config.submitEverySeconds * 1000 && state.time !== lastSavedTime) saveCloud();

      // Score : toutes les minutes, ou dès un nouveau palier.
      if (sending || now - lb.lastSentAt < MIN_GAP_MS) return;
      const due = pending || now - lb.lastSentAt >= config.submitEverySeconds * 1000;
      if (!due) return;
      if (state.totalEarned === lb.lastSentTotal) {
        pending = false;
        return;
      }
      submit();
    },
  };

  function emit() {
    for (const fn of listeners) fn(lb);
  }

  function notify(text, kind) {
    lb.notice = { text, kind };
    emit();
    return undefined;
  }

  function loadProfile() {
    try {
      const profile = JSON.parse(storage.get(PROFILE_KEY) ?? 'null');
      if (!profile || typeof profile.pseudo !== 'string' || !/^\d{4}$/.test(profile.code)) return null;
      return { pseudo: profile.pseudo, code: profile.code, revision: Number(profile.revision) || 0 };
    } catch {
      return null;
    }
  }

  function saveProfile() {
    if (lb.profile) storage.set(PROFILE_KEY, JSON.stringify(lb.profile));
  }

  /** Mauvais code, pseudo bloqué ou disparu : on arrête d'insister et on le dit. */
  function handleAccountProblem(result) {
    if (result.status === 'unknown_player') {
      lb.leave();
      notify(describeResult(result), 'error');
      return true;
    }
    if (result.status === 'wrong_code' || result.status === 'locked') {
      blockedUntil = result.retry_at ? new Date(result.retry_at).getTime() : Date.now() + 5 * 60 * 1000;
      notify(describeResult(result), 'error');
      return true;
    }
    return false;
  }

  function cloudMissing(error) {
    // PostgREST : fonction introuvable → la migration de la sauvegarde n'a pas été lancée.
    return error?.code === 'PGRST202' || /could not find the function/i.test(error?.message ?? '');
  }

  /** Compare la partie en ligne avec celle de cet appareil et décide (ou demande) laquelle garder. */
  async function reconcile({ joining = false } = {}) {
    if (!backend?.loadGame || !lb.profile) return;
    lb.cloud.status = 'checking';
    emit();
    try {
      const result = await backend.loadGame(lb.profile);
      if (result.status !== 'ok') {
        lb.cloud.status = 'error';
        handleAccountProblem(result);
        return;
      }
      const state = getState();
      if (!result.save) {
        // Rien en ligne : cette partie devient la partie en ligne.
        lb.profile.revision = 0;
        saveProfile();
        lb.cloud.status = 'idle';
        lastSaveAt = 0;
        await saveCloud();
        return;
      }
      if (result.revision === lb.profile.revision) {
        lb.cloud.status = 'synced';
        lb.cloud.savedAt = result.updated_at ? new Date(result.updated_at) : null;
        return;
      }
      if (!isValidSave(result.save)) {
        lb.cloud.status = 'error';
        notify('La partie en ligne est illisible par cette version du jeu.', 'error');
        return;
      }
      if (isFreshGame(state)) {
        // Partie à peine commencée ici : on reprend celle en ligne sans rien demander.
        lb.profile.revision = result.revision;
        saveProfile();
        lb.cloud.status = 'synced';
        onMessage(`Partie de ${lb.profile.pseudo} reprise depuis la sauvegarde en ligne.`);
        emit();
        onLoadSave(JSON.stringify(result.save));
        return;
      }
      lb.cloud.status = 'conflict';
      lb.cloud.conflict = {
        local: summarize(state),
        remote: summarize({ ...result.save, ...result }),
        remoteSave: result.save,
        remoteRevision: result.revision,
        joining,
      };
    } catch (error) {
      if (cloudMissing(error)) {
        lb.cloud.status = 'missing';
      } else {
        console.warn('Sauvegarde en ligne :', error);
        lb.cloud.status = 'error';
      }
    } finally {
      emit();
    }
  }

  async function saveCloud({ manual = false } = {}) {
    if (!backend?.saveGame || !lb.profile || saving) return undefined;
    if (lb.cloud.status === 'conflict' || lb.cloud.status === 'missing' || lb.cloud.status === 'checking') return undefined;
    if (Date.now() - lastSaveAt < MIN_GAP_MS) return undefined;
    const state = getState();
    const text = getSaveText();
    if (!state || !text) return undefined;
    saving = true;
    lastSaveAt = Date.now();
    try {
      const score = scoreFromState(state);
      const result = await backend.saveGame(lb.profile, {
        save: JSON.parse(text),
        revision: lb.profile.revision,
        totalEarned: score.totalEarned,
        tierIndex: score.tierIndex,
        character: score.character,
      });
      if (result.status === 'ok') {
        lb.profile.revision = result.revision;
        saveProfile();
        lastSavedTime = state.time;
        lb.cloud.status = 'synced';
        lb.cloud.savedAt = new Date();
      } else if (result.status === 'conflict') {
        saving = false;
        await reconcile();
      } else if (result.status === 'too_soon') {
        lastSaveAt = Date.now() - MIN_GAP_MS + 2000; // réessayer dans quelques secondes
      } else if (!handleAccountProblem(result)) {
        lb.cloud.status = 'error';
        if (manual) notify(describeResult(result), 'error');
      }
      return result;
    } catch (error) {
      if (cloudMissing(error)) {
        lb.cloud.status = 'missing';
      } else {
        console.warn('Sauvegarde en ligne :', error);
        lb.cloud.status = 'error';
        if (manual) notify(describeResult({ status: 'network' }), 'error');
      }
      return undefined;
    } finally {
      saving = false;
      emit();
    }
  }

  async function submit({ manual = false } = {}) {
    const state = getState();
    if (!backend || !lb.profile || !state || sending) return undefined;
    if (Date.now() - lb.lastSentAt < MIN_GAP_MS) {
      if (manual) notify(describeResult({ status: 'too_soon' }), 'ok');
      return undefined;
    }
    sending = true;
    pending = false;
    const score = scoreFromState(state);
    try {
      const result = await backend.submit(lb.profile, score);
      lb.lastSentAt = Date.now();
      if (result.status === 'ok' || result.status === 'kept') {
        lb.lastSentTotal = score.totalEarned;
        if (manual) notify(result.status === 'kept' ? describeResult(result) : 'Partie sauvegardée et score envoyé.', 'ok');
        scheduleRefresh();
      } else if (result.status === 'too_soon') {
        pending = true;
      } else if (!handleAccountProblem(result)) {
        notify(describeResult(result), 'error');
      }
      return result;
    } catch (error) {
      console.warn('Classement :', error);
      lb.lastSentAt = Date.now();
      pending = true;
      if (manual) notify(describeResult({ status: 'network' }), 'error');
      return undefined;
    } finally {
      sending = false;
      emit();
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 600);
  }

  async function refresh() {
    if (!backend || refreshing) return;
    refreshing = true;
    const previousRank = lb.mine?.rank ?? null;
    try {
      lb.rows = await backend.top(config.topSize);
      if (lb.profile) {
        const index = lb.rows.findIndex((row) => row.pseudo === lb.profile.pseudo);
        lb.mine = index >= 0 ? { row: lb.rows[index], rank: index + 1 } : await backend.mine(lb.profile.pseudo);
      } else {
        lb.mine = null;
      }
      lb.loaded = true;
      lb.error = null;
      lb.updatedAt = new Date();
      announceRank(previousRank);
    } catch (error) {
      console.warn('Classement :', error);
      lb.error = describeResult({ status: 'network' });
    } finally {
      refreshing = false;
      emit();
    }
  }

  /** Messages au fil QGram quand on monte ou qu'un ami nous dépasse. */
  function announceRank(previousRank) {
    const rank = lb.mine?.rank;
    if (!previousRank || !rank || rank === previousRank) return;
    if (rank < previousRank) {
      onMessage(rank === 1 ? 'Tu es #1 du classement. Le QG est à toi.' : `Tu montes au #${rank} du classement !`);
    } else {
      const above = lb.rows[rank - 2];
      onMessage(above ? `${above.pseudo} vient de te dépasser au classement (#${rank}).` : `Tu descends au #${rank} du classement.`, 'danger');
    }
  }

  return lb;
}
