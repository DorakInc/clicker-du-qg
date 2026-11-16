// Le classement côté jeu : profil (pseudo + code), envoi automatique du score,
// lecture du top et mise à jour en direct. L'affichage est dans src/ui/leaderboard-view.js.
//
// Le profil est gardé dans le navigateur (clé clicker-du-qg/profile), séparément de la
// sauvegarde : « Nouvelle partie » ne fait pas perdre son pseudo. Le serveur garde le record.

import { codeError, cleanPseudo, describeResult, isConfigured, pseudoError, scoreFromState } from './rules.js';
import { createMemoryBackend, createSupabaseBackend } from './backend.js';

export const PROFILE_KEY = 'clicker-du-qg/profile';
const MIN_GAP_MS = 11000; // le serveur refuse plus d'un envoi par 10 s

export function createLeaderboard({ config, storage, demo = false, onMessage = () => {} }) {
  const backend = demo ? createMemoryBackend() : isConfigured(config) ? createSupabaseBackend(config) : null;
  const listeners = new Set();
  let getState = () => null;
  let unsubscribe = null;
  let refreshing = false;
  let refreshTimer = null;
  let sending = false;
  let pending = false;
  let pollClock = 0;
  let blockedUntil = 0;

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
      if (lb.profile) pending = true;
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
          lb.profile = { pseudo: result.pseudo, code };
          saveProfile(lb.profile);
          lb.lastSentAt = 0;
          lb.lastSentTotal = -1;
          blockedUntil = 0;
          notify(describeResult(result), 'ok');
          onMessage(describeResult(result));
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

    /** Oublie le pseudo sur cet appareil (le score reste au classement). */
    leave() {
      lb.profile = null;
      lb.mine = null;
      lb.notice = null;
      storage.remove(PROFILE_KEY);
      emit();
    },

    submitNow() {
      pending = true;
      return submit({ manual: true });
    },

    /** Un palier vient d'être atteint : envoyer dès que le serveur le permet. */
    requestSubmit() {
      pending = true;
    },

    refresh,

    /** À chaque image : envoi automatique et lecture régulière si le direct ne marche pas. */
    tick(dt) {
      if (!backend) return;
      if (!lb.live) {
        pollClock += dt;
        if (pollClock >= config.pollSeconds) {
          pollClock = 0;
          refresh();
        }
      }
      if (!lb.profile || sending) return;
      const now = Date.now();
      if (now < blockedUntil || now - lb.lastSentAt < MIN_GAP_MS) return;
      const due = pending || now - lb.lastSentAt >= config.submitEverySeconds * 1000;
      if (!due) return;
      const state = getState();
      if (!state || state.totalEarned === lb.lastSentTotal) {
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
      return profile && typeof profile.pseudo === 'string' && /^\d{4}$/.test(profile.code) ? profile : null;
    } catch {
      return null;
    }
  }

  function saveProfile(profile) {
    storage.set(PROFILE_KEY, JSON.stringify(profile));
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
        if (manual || result.status === 'kept') notify(describeResult(result.status === 'ok' ? { status: 'ok' } : result), 'ok');
        scheduleRefresh();
      } else if (result.status === 'too_soon') {
        pending = true;
      } else if (result.status === 'unknown_player') {
        lb.leave();
        notify(describeResult(result), 'error');
      } else {
        // Mauvais code ou pseudo bloqué (le code a peut-être changé ailleurs) : on arrête d'insister.
        blockedUntil = result.retry_at ? new Date(result.retry_at).getTime() : Date.now() + 5 * 60 * 1000;
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
