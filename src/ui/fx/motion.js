// Réglages communs à toutes les animations : mouvements réduits et vitesse.
//   mode  'auto' (suit le système), 'reduced' (réduits), 'full' (complets)
//   speed multiplicateur de vitesse (1 = normal ; la démo va de 0,25 à 2)
// Le résultat est posé sur <html> : data-motion="reduced|full" et --fx-speed,
// pour que le CSS et le JavaScript suivent les mêmes règles.

const QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_MODES = ['auto', 'reduced', 'full'];

export function createMotion({ mode = 'auto', speed = 1, root = document.documentElement } = {}) {
  const media = window.matchMedia?.(QUERY);
  const listeners = new Set();

  const motion = {
    mode: MOTION_MODES.includes(mode) ? mode : 'auto',
    speed,
    get reduced() {
      return motion.mode === 'reduced' || (motion.mode === 'auto' && Boolean(media?.matches));
    },
    setMode(next) {
      motion.mode = MOTION_MODES.includes(next) ? next : 'auto';
      apply();
    },
    setSpeed(next) {
      motion.speed = Math.min(4, Math.max(0.1, Number(next) || 1));
      apply();
    },
    /** Durée réelle (pour setTimeout) d'une durée écrite à vitesse normale. */
    ms(duration) {
      return duration / motion.speed;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  function apply() {
    root.dataset.motion = motion.reduced ? 'reduced' : 'full';
    root.style.setProperty('--fx-speed', String(motion.speed));
    for (const fn of listeners) fn(motion);
  }

  media?.addEventListener?.('change', apply);
  apply();
  return motion;
}
