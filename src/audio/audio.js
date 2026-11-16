// Audio : joue les sons déclarés dans data/sounds.json (volet C).
// Chaque événement du jeu (click, buyUpgrade, failStart...) peut avoir
// plusieurs variantes ; une est choisie au hasard. Un fichier manquant est
// simplement ignoré, le jeu reste jouable sans son.

const BASE = 'assets/audio/';

export function createAudio(sounds, { enabled = true } = {}) {
  const cache = new Map();
  const broken = new Set();
  const music = new Audio();
  music.loop = true;
  music.volume = 0.5;
  let currentMood = null;
  let unlocked = false; // les navigateurs bloquent le son avant la première interaction

  function play(eventType) {
    if (!enabled || !unlocked) return;
    const variants = (sounds.effects?.[eventType] ?? []).filter((f) => !broken.has(f));
    if (variants.length === 0) return;
    const file = variants[Math.floor(Math.random() * variants.length)];
    let base = cache.get(file);
    if (!base) {
      base = new Audio(BASE + file);
      base.addEventListener('error', () => broken.add(file), { once: true });
      cache.set(file, base);
    }
    const node = base.cloneNode(); // permet plusieurs sons en même temps
    node.play().catch(() => {});
  }

  /** Change la musique selon l'ambiance : normal, cannabis, baisse, echec. */
  function setMood(mood) {
    if (mood === currentMood) return;
    currentMood = mood;
    const file = sounds.music?.[mood] ?? sounds.music?.normal;
    if (!file) {
      music.pause();
      music.removeAttribute('src');
      return;
    }
    music.src = BASE + file;
    if (enabled && unlocked) music.play().catch(() => {});
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (enabled && music.src) music.play().catch(() => {});
  }

  function setEnabled(value) {
    enabled = value;
    if (!enabled) music.pause();
    else if (unlocked && music.src) music.play().catch(() => {});
  }

  return { play, setMood, unlock, setEnabled, get enabled() { return enabled; } };
}
