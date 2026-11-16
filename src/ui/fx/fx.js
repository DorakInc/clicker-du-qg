// Point d'accès commun des animations (docs/animations/).
//
//   const fx = createFx(data.fx, { anchors, motion });
//   fx.play('tier_up', { name: 'Buzz local' });   // lancer une animation à la main
//   fx.onGameEvent(event);                         // brancher un événement de src/game
//   fx.update(dt);                                 // à chaque image (pièces du revenu automatique)
//
// `anchors` dit où trouver les éléments de la page (le jeu et la démo n'ont pas
// les mêmes). Toutes les fonctions sont facultatives :
//   counter()            compteur « le cash »
//   coinSource()         d'où partent les pièces (vinyle ou scène)
//   isFailing()          vrai pendant un fail out (pièces ternies)
//   characters()         conteneurs de personnage (respiration selon l'humeur)
//   character()          personnage visible (saut au palier), ou null
//   scene()              scène visible (bannière de palier)
//   currentScene()       'studio' | 'serre' | 'carte'
//   tierChip()           pastille « palier »
//   shopRow(type, id)    { owned, cost, stamp } d'une ligne de boutique
//   territoriesChip()    pastille « territoires »
//   flagMapTab()         signale l'onglet « La carte »
//   selectTerritory(id)  affiche la fiche d'un territoire
//   marker(id), hypeFill(), territoryCard(), territoryBonus()
//   openedLinks(id)      [{ line, marker }] routes ouvertes par une conquête
//
// Effets et nœuds vivent dans une couche fixe, au-dessus de tout, sans pointeur.

import { createPool } from './pool.js';
import { createMotion } from './motion.js';
import { EVENT_FX } from './catalog.js';

const CANCEL = Symbol('cancel');
const rand = (min, max) => min + Math.random() * (max - min);
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function createFx(config, { anchors = {}, motion = createMotion(), root = document.body } = {}) {
  const caps = config.caps;
  const px = config.pixel;
  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name) => rootStyle.getPropertyValue(name).trim();

  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--fx-px', `${px}px`);
  root.append(layer);

  const floaters = createPool(layer, {
    className: 'fx-float',
    size: caps.floatersPool,
    build(node) {
      const pop = document.createElement('span');
      pop.className = 'fx-float-pop';
      const text = document.createElement('span');
      text.className = 'fx-float-text';
      pop.append(text);
      node.append(pop);
    },
  });
  const particles = createPool(layer, { className: 'fx-particle', size: caps.particles });
  const coins = createPool(layer, { className: 'fx-coin', size: caps.coinsInFlight });

  // ---- Animations suivies (vitesse globale, nettoyage) --------------------

  const live = new Set();
  function animate(el, keyframes, options) {
    const anim = el.animate(keyframes, { fill: 'none', ...options });
    anim.playbackRate = motion.speed;
    live.add(anim);
    const forget = () => live.delete(anim);
    anim.finished.then(forget, forget);
    return anim;
  }
  motion.onChange(() => {
    for (const anim of live) anim.playbackRate = motion.speed;
  });

  function make(className, text) {
    const node = document.createElement('div');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
  }

  // ---- File des récompenses majeures (P0) ---------------------------------

  const major = { running: null, queue: [], cooling: false };
  const isMajor = () => Boolean(major.running);

  function makeJob(kind, run, extra = {}) {
    const job = { kind, run, cancelled: false, anims: new Set(), nodes: [], cleanups: [], ...extra };
    job.cancelPromise = new Promise((resolve) => { job.resolveCancel = resolve; });
    job.animate = (el, keyframes, options) => {
      const anim = animate(el, keyframes, options);
      job.anims.add(anim);
      return anim;
    };
    job.add = (node, parent = layer) => {
      parent.append(node);
      job.nodes.push(node);
      return node;
    };
    /** Attend une durée (vitesse normale), une durée réelle ou une animation ; s'arrête si la tâche est annulée. */
    job.step = async (what, { real = false } = {}) => {
      const wait = typeof what === 'number'
        ? new Promise((resolve) => setTimeout(resolve, Math.max(0, real ? what : motion.ms(what))))
        : what.finished.catch(() => {});
      await Promise.race([wait, job.cancelPromise]);
      if (job.cancelled) throw CANCEL;
    };
    job.cancel = () => {
      job.cancelled = true;
      job.resolveCancel();
    };
    return job;
  }

  function finishJob(job) {
    for (const anim of job.anims) anim.cancel();
    for (const node of job.nodes) node.remove();
    for (const fn of job.cleanups) fn();
  }

  const MAX_QUEUE = 4;
  function enqueueMajor(job) {
    // Même récompense déjà en cours ou en file (ex. même territoire) : on ne la rejoue pas.
    const same = (other) => other && other.kind === job.kind && job.id !== undefined && other.id === job.id && !other.cancelled;
    if (same(major.running) || major.queue.some(same)) return;
    major.queue.push(job);
    // File trop longue : la plus ancienne en attente saute (son résultat est déjà affiché à l'écran).
    while (major.queue.length > MAX_QUEUE) major.queue.shift().cancel();
    pump();
  }

  async function pump() {
    if (major.running || major.cooling || !major.queue.length) return;
    const job = major.queue.shift();
    if (job.cancelled) {
      pump();
      return;
    }
    major.running = job;
    try {
      await nextFrame(); // laisse l'affichage se mettre à jour avant de mesurer quoi que ce soit
      if (job.cancelled) throw CANCEL;
      await job.run(job);
    } catch (error) {
      if (error !== CANCEL) console.error(error);
    } finally {
      finishJob(job);
      major.running = null;
    }
    major.cooling = true;
    setTimeout(() => {
      major.cooling = false;
      pump();
    }, motion.ms(config.majorGapMs));
  }

  // ---- 01 click_squash ----------------------------------------------------

  const squashes = new WeakMap();
  const rings = new WeakMap();

  function clickSquash({ target, arm }) {
    if (!target) return;
    if (!rings.has(target)) rings.set(target, getComputedStyle(target).boxShadow);
    const ring = rings.get(target);
    if (motion.reduced) {
      if (ring === 'none') return;
      const lit = ring.replace(/^rgba?\([^)]*\)/, token('--sunset'));
      animate(target, [{ boxShadow: lit }, { boxShadow: lit }], { duration: 80 });
      return;
    }
    const pressed = ring === 'none' ? 'none' : ring.replace(/[\d.]+px\s*$/, '2px');
    const previous = squashes.get(target);
    const running = previous?.playState === 'running';
    previous?.cancel();
    const down = { transform: 'translateY(3px) scale(.93)', boxShadow: pressed };
    const frames = running
      ? [down, { transform: 'scale(1.03)', boxShadow: ring, offset: 0.55 }, { transform: 'none', boxShadow: ring }]
      : [
        { transform: 'none', boxShadow: ring },
        { ...down, offset: 0.28 },
        { transform: 'scale(1.03)', boxShadow: ring, offset: 0.67 },
        { transform: 'none', boxShadow: ring },
      ];
    squashes.set(target, animate(target, frames, { duration: running ? 130 : 180, easing: 'ease-out' }));
    if (arm) {
      animate(arm, [
        { transform: 'rotate(24deg)' },
        { transform: 'rotate(26.5deg)', offset: 0.3 },
        { transform: 'rotate(24deg)' },
      ], { duration: 180 });
    }
  }

  // ---- 05 gain_float ------------------------------------------------------

  const lastFloat = {};

  function gainFloat({ x, y, home, amount, kind = 'money', format = String, level = 0, touch = false }) {
    const now = performance.now();
    const mergeWindow = motion.ms(isMajor() ? config.mergeMsDuringMajor : config.mergeMs);
    const last = lastFloat[kind];
    if (last && last.node.gen === last.gen && now - last.born < mergeWindow) {
      last.amount += amount;
      last.level = Math.max(last.level, level);
      last.text.textContent = format(last.amount);
      last.node.classList.toggle('is-good', last.level === 1);
      last.node.classList.toggle('is-big', last.level === 2);
      if (!motion.reduced) {
        animate(last.text, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 80 });
      }
      return;
    }

    if (floaters.active >= caps.floatersVisible) floaters.release(floaters.oldest());
    const levelClass = level === 2 ? 'is-big' : level === 1 ? 'is-good' : '';
    const node = floaters.acquire({ recycle: true, extra: `is-${kind} ${levelClass}` });
    const gen = node.gen;
    const pop = node.firstChild;
    const text = pop.firstChild;
    text.textContent = format(amount);
    lastFloat[kind] = { node, gen, born: now, amount, level, text };

    let end;
    if (motion.reduced) {
      const spot = home ?? { x, y };
      node.style.left = `${spot.x}px`;
      node.style.top = `${spot.y - 24}px`;
      end = animate(pop, [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 800, fill: 'forwards' });
    } else {
      node.style.left = `${x}px`;
      node.style.top = `${y - (touch ? 40 : 0)}px`;
      const drift = Math.round(rand(-30, 30));
      const tilt = Math.round(rand(-12, 12));
      animate(node, [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${drift}px, -48px) rotate(${tilt}deg)` },
      ], { duration: 680, easing: 'steps(8, end)', fill: 'forwards' });
      end = animate(pop, [
        { transform: 'scale(.7)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1, offset: 0.05 },
        { transform: 'scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'scale(1.15)', opacity: 1, offset: 0.91 },
        { transform: 'scale(0)', opacity: 0 },
      ], { duration: 800, fill: 'forwards' });
    }
    end.finished.then(() => floaters.release(node, gen), () => {});
  }

  // ---- 06 click_quality ---------------------------------------------------

  let lastNotes = -Infinity;

  /** Retourne le niveau du beat (0 normal, 1 bon, 2 gros) et lance les notes si besoin. */
  function clickQuality({ quality = 1, target }) {
    const q = config.quality;
    const level = quality >= q.big ? 2 : quality >= q.good ? 1 : 0;
    if (!level || motion.reduced || !target) return level;
    const now = performance.now();
    if (now - lastNotes < motion.ms(q.minIntervalMs)) return level;
    lastNotes = now;

    let count = level === 2 ? q.notesBig : q.notesGood;
    if (isMajor()) count = Math.ceil(count / 2);
    const { x, y } = centerOf(target);
    animate(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 175, easing: 'steps(2, end)' });
    for (let i = 0; i < count; i += 1) {
      const node = particles.acquire({ extra: 'fx-note' });
      if (!node) break;
      const gen = node.gen;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      const dir = count === 1 ? (Math.random() < 0.5 ? -1 : 1) : (i / (count - 1)) * 2 - 1;
      const dx = Math.round(dir * 56 + rand(-6, 6));
      const peak = -Math.round(rand(50, 72));
      const base = 'translate(-50%, -50%)';
      animate(node, [
        { transform: `${base} translate(0, 0) scale(.6)`, easing: 'steps(3, end)' },
        { transform: `${base} translate(${Math.round(dx * 0.7)}px, ${peak}px) scale(1)`, offset: 0.42, easing: 'steps(3, end)' },
        { transform: `${base} translate(${dx}px, ${peak + 6 * px}px) scale(1)`, offset: 0.83, easing: 'steps(1, end)' },
        { transform: `${base} translate(${dx}px, ${peak + 6 * px}px) scale(0)`, opacity: 0 },
      ], { duration: 420, fill: 'forwards' }).finished.then(() => particles.release(node, gen), () => {});
    }
    return level;
  }

  // ---- 11 char_breathe ----------------------------------------------------

  const watched = new WeakSet();
  let mood = 'normal';

  function applyMood(container) {
    const next = container.dataset.moodNext;
    if (next && container.dataset.mood !== next) container.dataset.mood = next;
  }

  /** Humeur du personnage : 'normal', 'zen' ou 'fail'. Le changement attend la fin du cycle de respiration. */
  function setMood(next) {
    mood = next;
    for (const container of anchors.characters?.() ?? []) {
      if (!watched.has(container)) {
        watched.add(container);
        container.addEventListener('animationiteration', (event) => {
          if (event.target.classList.contains('sprite')) applyMood(container);
        });
      }
      if (container.dataset.moodNext === next && container.dataset.mood === next) continue;
      container.dataset.moodNext = next;
      const sprite = container.querySelector('.sprite');
      const breathing = sprite?.getAnimations().some((a) => a.playState === 'running');
      if (!container.dataset.mood || !breathing || motion.reduced) applyMood(container);
    }
  }

  // ---- 22 coins_to_counter ------------------------------------------------

  let income = 0;
  let coinClock = 0;

  function addIncome(amount) {
    if (amount > 0) income += amount;
  }

  function update(dt) {
    coinClock += dt;
    if (coinClock < config.coins.intervalSeconds / motion.speed) return;
    coinClock = 0;
    if (income <= 0 || isMajor() || document.hidden) return; // pendant un P0, le montant est reporté
    if (coinsToCounter({ amount: income })) income = 0;
  }

  function counterBump(counter) {
    if (motion.reduced) {
      const light = token('--paper-2');
      animate(counter, [{ color: light }, { color: light }], { duration: 200 });
    } else {
      animate(counter, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 80, easing: 'steps(2, end)' });
    }
  }

  /** Envoie un groupe de pièces ; retourne false si la réserve est pleine (montant reporté). */
  function coinsToCounter({ amount = 1 } = {}) {
    const counter = anchors.counter?.();
    if (!counter) return true;
    if (motion.reduced) {
      counterBump(counter);
      return true;
    }
    const source = anchors.coinSource?.();
    if (!source) return true;
    const n = Math.min(config.coins.max, Math.max(1, 1 + Math.floor(Math.log10(Math.max(1, amount)))));
    if (coins.available < n) return false;

    const from = centerOf(source);
    const to = centerOf(counter);
    const dull = anchors.isFailing?.() ? 'is-dull' : '';
    let arrived = false;
    for (let i = 0; i < n; i += 1) {
      const node = coins.acquire({ extra: dull });
      const gen = node.gen;
      const sx = from.x + (i - (n - 1) / 2) * 2 * px;
      const sy = from.y - rand(0, 2 * px);
      node.style.left = `${sx}px`;
      node.style.top = `${sy}px`;
      const cx = (sx + to.x) / 2 + rand(-60, 60);
      const cy = Math.min(sy, to.y) - 80;
      const frames = [];
      for (let k = 0; k <= 8; k += 1) {
        const u = (k / 8) ** 2; // accélère : aspirée par le compteur
        const bx = (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u ** 2 * to.x;
        const by = (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u ** 2 * to.y;
        const scale = k === 8 ? 0.3 : 1;
        frames.push({ transform: `translate(-50%, -50%) translate(${Math.round(bx - sx)}px, ${Math.round(by - sy)}px) scale(${scale})`, opacity: k === 8 ? 0 : 1 });
      }
      animate(node, frames, { duration: 650, delay: i * 40, fill: 'both' }).finished.then(() => {
        coins.release(node, gen);
        if (!arrived) {
          arrived = true;
          counterBump(counter);
        }
      }, () => {});
    }
    return true;
  }

  // ---- 32 ui_press --------------------------------------------------------

  const PRESSABLE = '.btn, .shop-item, .tab, .scene-tab, .character-card';
  const canPress = (el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true';

  function press(el) {
    el.classList.remove('is-released');
    el.classList.add('is-pressed');
  }
  function release(el) {
    if (!el.classList.contains('is-pressed')) return;
    el.classList.remove('is-pressed');
    if (motion.reduced) return;
    void el.offsetWidth; // relance l'animation de retour
    el.classList.add('is-released');
  }

  function installPress(scope = document) {
    scope.addEventListener('pointerdown', (event) => {
      const el = event.target.closest?.(PRESSABLE);
      if (!canPress(el) || event.button > 0) return;
      press(el);
      const up = () => {
        release(el);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    scope.addEventListener('keydown', (event) => {
      if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
      const el = event.target.closest?.(PRESSABLE);
      if (canPress(el)) press(el);
    });
    scope.addEventListener('keyup', (event) => {
      const el = event.target.closest?.(PRESSABLE);
      if (el) release(el);
    });
    scope.addEventListener('animationend', (event) => {
      if (event.animationName === 'fx-press-release') event.target.classList.remove('is-released');
    });
  }

  // ---- 34 ui_refuse -------------------------------------------------------

  const refusals = new WeakMap();

  function uiRefuse({ target, text }) {
    if (!target) return;
    const state = refusals.get(target) ?? {};
    refusals.set(target, state);
    if (state.wobble?.playState === 'running') return; // ignore pendant la secousse

    if (motion.reduced) {
      target.classList.add('fx-refuse-mark');
      clearTimeout(state.markTimer);
      state.markTimer = setTimeout(() => target.classList.remove('fx-refuse-mark'), motion.ms(400));
    } else {
      const step = 'steps(1, end)';
      state.wobble = animate(target, [0, -2, 2, -2, 2, -1, 0].map((x) => ({ transform: `translateX(${x}px)`, easing: step })), { duration: 240 });
    }
    if (!text) return;

    if (!state.tag) {
      const r = target.getBoundingClientRect();
      const tag = make('fx-refuse-tag', text);
      tag.style.left = `${r.left}px`;
      tag.style.top = `${r.bottom + 4}px`;
      layer.append(tag);
      state.tag = tag;
      if (motion.reduced) animate(tag, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
      else animate(tag, [{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 100, easing: 'steps(2, end)' });
    } else {
      state.tag.textContent = text;
    }
    clearTimeout(state.tagTimer);
    state.tagTimer = setTimeout(() => {
      const tag = state.tag;
      state.tag = null;
      if (!tag) return;
      const close = motion.reduced
        ? animate(tag, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' })
        : animate(tag, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: 120, easing: 'steps(3, end)', fill: 'forwards' });
      close.finished.then(() => tag.remove(), () => tag.remove());
    }, motion.ms(config.holdMs.refuseTag));
  }

  // ---- 41 shop_buy --------------------------------------------------------

  const ghosts = new WeakMap();

  function shopBuy({ row, stamp = false }) {
    if (!row) return;
    const { owned, cost } = row;
    for (const anim of owned.getAnimations()) anim.cancel();
    if (motion.reduced) {
      const ring = `0 0 0 3px ${token('--sunset')}`;
      animate(owned, [{ boxShadow: ring }, { boxShadow: ring }], { duration: 400 });
      animate(cost, [{ boxShadow: ring }, { boxShadow: ring }], { duration: 400 });
      if (stamp && row.stamp) animate(row.stamp, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      return;
    }
    animate(owned, [
      { transform: 'scale(1)' },
      { transform: 'scale(1.4)', offset: 0.35 },
      { transform: 'scale(.95)', offset: 0.7 },
      { transform: 'scale(1)' },
    ], { duration: 240, easing: 'steps(6, end)' });

    // Prix : l'ancien sort par le haut (fantôme), le nouveau entre par le bas.
    ghosts.get(cost)?.remove();
    for (const anim of cost.getAnimations()) anim.cancel();
    const r = cost.getBoundingClientRect();
    if (cost.textContent && r.width) {
      const ghost = make('fx-ghost', cost.textContent);
      const style = getComputedStyle(cost);
      Object.assign(ghost.style, {
        left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`,
        font: style.font, color: style.color, letterSpacing: style.letterSpacing,
      });
      layer.append(ghost);
      ghosts.set(cost, ghost);
      animate(ghost, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 160, easing: 'steps(4, end)', fill: 'forwards' })
        .finished.then(() => ghost.remove(), () => ghost.remove());
    }
    animate(cost, [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 160, easing: 'steps(4, end)' });

    if (stamp && row.stamp) {
      animate(row.stamp, [
        { transform: 'rotate(-8deg) scale(2.2)', opacity: 0 },
        { transform: 'rotate(-8deg) scale(.95)', opacity: 1, offset: 0.7 },
        { transform: 'rotate(-8deg) scale(1)', opacity: 1 },
      ], { duration: 350, easing: 'ease-out' });
    }
  }

  // ---- 45 tier_up ---------------------------------------------------------

  function confetti(x, y, job) {
    const colors = [token('--lamp'), token('--pink'), token('--paper')];
    for (let i = 0; i < config.confetti; i += 1) {
      const node = particles.acquire({ extra: 'fx-confetti' });
      if (!node) break;
      const gen = node.gen;
      node.style.left = `${x + rand(-60, 60)}px`;
      node.style.top = `${y}px`;
      node.style.background = colors[i % colors.length];
      if (i % 3 === 0) node.classList.add('is-big');
      const angle = rand(-160, -20) * (Math.PI / 180);
      const speed = rand(120, 220);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const spin = Math.round(rand(-360, 360));
      const frames = [];
      for (let k = 0; k <= 6; k += 1) {
        const tau = k / 6;
        const dx = Math.round(vx * tau);
        const dy = Math.round(vy * tau + 260 * tau * tau);
        frames.push({ transform: `translate(${dx}px, ${dy}px) rotate(${Math.round(spin * tau)}deg)`, opacity: k === 6 ? 0 : 1, easing: 'steps(2, end)' });
      }
      job.animate(node, frames, { duration: rand(900, 1100), fill: 'forwards' })
        .finished.then(() => particles.release(node, gen), () => particles.release(node, gen));
    }
  }

  function charJump(job) {
    const el = anchors.character?.();
    if (!el) return;
    const s = parseFloat(getComputedStyle(el).getPropertyValue('--s')) || 3;
    job.animate(el, [
      { transform: 'none' },
      { transform: `translateY(${-4 * s}px)`, offset: 0.4 },
      { transform: 'translateY(0) scale(1.06, .9)', offset: 0.8 },
      { transform: 'none' },
    ], { duration: 400, easing: 'steps(6, end)' });
  }

  function tierUp({ name }) {
    const current = [major.running, ...major.queue].find((job) => job?.kind === 'tier' && job.phase !== 'peel' && !job.cancelled);
    if (current) {
      current.merge(name);
      return;
    }
    const job = makeJob('tier', runTierUp, { name, extra: 0, phase: 'queued' });
    job.merge = (next) => {
      job.name = next;
      job.extra += 1;
      job.render?.();
      if (job.phase === 'hold') job.holdUntil = performance.now() + motion.ms(config.holdMs.tierUp);
    };
    enqueueMajor(job);
  }

  async function runTierUp(job) {
    const scene = anchors.scene?.();
    if (!scene) return;
    const { x, y, rect } = centerOf(scene);
    const banner = make('fx-banner');
    const kicker = make('fx-banner-kicker', 'nouveau palier');
    const title = make('fx-banner-title');
    const more = make('fx-banner-extra');
    banner.append(kicker, title, more);
    banner.style.left = `${x}px`;
    banner.style.top = `${rect.top + rect.height * 0.38}px`;
    job.render = () => {
      title.textContent = job.name;
      more.textContent = job.extra ? `+${job.extra + 1} paliers d'un coup` : '';
      more.hidden = !job.extra;
      if (job.phase === 'hold' && !motion.reduced) {
        job.animate(title, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'steps(2, end)' });
      }
    };
    job.render();
    const base = 'translate(-50%, -50%) rotate(6deg)';

    if (motion.reduced) {
      banner.style.transform = base;
      job.add(banner);
      job.phase = 'enter';
      await job.step(job.animate(banner, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 }));
    } else {
      job.phase = 'anticipation';
      const chip = anchors.tierChip?.();
      if (chip) {
        await job.step(job.animate(chip, [
          { transform: 'scale(1)' },
          { transform: 'scale(1.08) translateX(1px)' },
          { transform: 'scale(1.08) translateX(-1px)' },
          { transform: 'scale(1.08) translateX(1px)' },
          { transform: 'scale(1)' },
        ], { duration: 200, easing: 'steps(4, end)' }));
      }
      job.phase = 'enter';
      banner.style.transform = base;
      job.add(banner);
      await job.step(job.animate(banner, [
        { transform: 'translate(-50%, -50%) rotate(6deg) scale(2.2)', opacity: 0 },
        { transform: 'translate(-50%, -50%) rotate(6deg) scale(.95)', opacity: 1, offset: 0.7 },
        { transform: base, opacity: 1 },
      ], { duration: 350, easing: 'ease-out' }));
      const landed = centerOf(banner);
      confetti(landed.x, landed.y, job);
      charJump(job);
    }

    job.phase = 'hold';
    job.holdUntil = performance.now() + motion.ms(config.holdMs.tierUp);
    while (performance.now() < job.holdUntil) await job.step(job.holdUntil - performance.now(), { real: true });

    job.phase = 'peel';
    if (motion.reduced) {
      await job.step(job.animate(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }));
    } else {
      await job.step(job.animate(banner, [
        { transform: base, opacity: 1 },
        { transform: 'translate(-50%, -50%) translateY(-140%) rotate(-4deg)', opacity: 0 },
      ], { duration: 350, easing: 'ease-in', fill: 'forwards' }));
    }
    // Laisse les confettis finir leur chute avant de libérer la file.
    for (const anim of job.anims) if (anim.playState === 'running') await job.step(anim);
  }

  // ---- 55 territory_conquered ---------------------------------------------

  const pendingConquests = [];

  function territoryConquered({ id }) {
    if ((anchors.currentScene?.() ?? 'carte') !== 'carte') {
      if (!pendingConquests.includes(id)) pendingConquests.push(id);
      anchors.flagMapTab?.();
      const chip = anchors.territoriesChip?.();
      if (chip && !motion.reduced) {
        animate(chip, [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'steps(3, end)' });
      }
      return;
    }
    enqueueMajor(makeJob('conquest', runConquest, { id, scene: 'carte' }));
  }

  async function runConquest(job) {
    if ((anchors.currentScene?.() ?? 'carte') !== 'carte') {
      pendingConquests.push(job.id); // le joueur a quitté la carte avant le début
      return;
    }
    anchors.selectTerritory?.(job.id);
    await nextFrame();
    const marker = anchors.marker?.(job.id);
    if (!marker) return;
    const card = anchors.territoryCard?.();
    const bonus = anchors.territoryBonus?.();
    const at = centerOf(marker);
    const markerBase = 'translate(-50%, -50%)';

    const flag = make('fx-flag');
    flag.style.left = `${at.x}px`;
    flag.style.top = `${at.y}px`;
    const sticker = make('fx-sticker', 'CONQUIS');
    job.cleanups.push(() => bonus?.classList.remove('fx-highlight'));

    if (motion.reduced) {
      job.add(flag);
      job.animate(flag, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      if (card) {
        job.add(sticker, card);
        job.animate(sticker, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      }
      bonus?.classList.add('fx-highlight');
      await job.step(2000);
      return;
    }

    const fill = anchors.hypeFill?.();
    if (fill) {
      await job.step(job.animate(fill, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.35)' }, { transform: 'scaleY(1)' }], { duration: 150, easing: 'steps(3, end)' }));
    }

    job.add(flag);
    job.animate(flag, [
      { transform: 'translate(-20%, -100%) translateY(-40px) scale(2)', opacity: 0 },
      { transform: 'translate(-20%, -100%) scale(.9)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-20%, -100%)', opacity: 1 },
    ], { duration: 350, easing: 'ease-out', fill: 'forwards' });
    job.animate(marker, [
      { transform: `${markerBase} scale(1)` },
      { transform: `${markerBase} scale(1.35)` },
      { transform: `${markerBase} scale(1)` },
    ], { duration: 200, delay: 245, easing: 'steps(4, end)' });
    await job.step(350);

    for (let i = 0; i < 2; i += 1) {
      const ring = particles.acquire({ extra: 'fx-ring' });
      if (!ring) break;
      const gen = ring.gen;
      ring.style.left = `${at.x}px`;
      ring.style.top = `${at.y}px`;
      job.animate(ring, [
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 },
      ], { duration: 400, delay: i * 120, easing: 'steps(5, end)', fill: 'both' })
        .finished.then(() => particles.release(ring, gen), () => particles.release(ring, gen));
    }
    await job.step(400);

    const opened = anchors.openedLinks?.(job.id) ?? [];
    opened.forEach(({ line, marker: next }, i) => {
      job.animate(line, [{ strokeDashoffset: 40, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 500, delay: i * 120, easing: 'steps(5, end)', fill: 'backwards' });
      if (next) {
        job.animate(next, [
          { transform: `${markerBase} scale(0)` },
          { transform: `${markerBase} scale(1.2)`, offset: 0.7 },
          { transform: `${markerBase} scale(1)` },
        ], { duration: 200, delay: i * 120 + 400, easing: 'steps(4, end)', fill: 'backwards' });
      }
    });
    if (opened.length) await job.step(500 + (opened.length - 1) * 120);

    if (card) {
      job.add(sticker, card);
      job.animate(sticker, [
        { transform: 'rotate(-6deg) scale(2.2)', opacity: 0 },
        { transform: 'rotate(-6deg) scale(.95)', opacity: 1, offset: 0.7 },
        { transform: 'rotate(-6deg) scale(1)', opacity: 1 },
      ], { duration: 350, easing: 'ease-out' });
    }
    bonus?.classList.add('fx-highlight');
    await job.step(350 + config.holdMs.conquest);

    if (card) {
      job.animate(sticker, [
        { transform: 'rotate(-6deg)', opacity: 1 },
        { transform: 'rotate(4deg) translateY(-60%)', opacity: 0 },
      ], { duration: 250, easing: 'ease-in', fill: 'forwards' });
    }
    await job.step(job.animate(flag, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'steps(3, end)', fill: 'forwards' }));
  }

  /** À appeler quand le joueur change de scène : arrête une conquête en cours ailleurs, rejoue celles en attente. */
  function sceneShown(name) {
    if (major.running?.scene && major.running.scene !== name) major.running.cancel();
    for (const job of major.queue) if (job.scene && job.scene !== name) job.cancel();
    major.queue = major.queue.filter((job) => !job.cancelled);
    if (name === 'carte') {
      for (const id of pendingConquests.splice(0)) enqueueMajor(makeJob('conquest', runConquest, { id, scene: 'carte' }));
    }
  }

  // ---- Point d'accès ------------------------------------------------------

  const PLAYERS = {
    click_squash: clickSquash,
    gain_float: gainFloat,
    click_quality: clickQuality,
    char_breathe: ({ mood: next = 'normal' } = {}) => setMood(next),
    coins_to_counter: coinsToCounter,
    ui_press: ({ target }) => {
      if (!canPress(target)) return;
      press(target);
      setTimeout(() => release(target), motion.ms(60));
    },
    ui_refuse: uiRefuse,
    shop_buy: shopBuy,
    tier_up: tierUp,
    territory_conquered: territoryConquered,
  };

  function play(id, options = {}) {
    const player = PLAYERS[id];
    if (!player) throw new Error(`Animation inconnue : ${id}`);
    return player(options);
  }

  function onGameEvent(event) {
    const id = EVENT_FX[event.type];
    if (!id) return;
    if (id === 'shop_buy') {
      play(id, { row: anchors.shopRow?.(event.type, event.id), stamp: event.type === 'buyUpgrade' });
    } else {
      play(id, event);
    }
  }

  function stats() {
    return {
      nodes: [...layer.children].filter((n) => !n.hidden).length,
      floaters: floaters.active,
      particles: particles.active,
      coins: coins.active,
      animations: live.size,
      major: major.running?.kind ?? null,
      queued: major.queue.length,
      pendingConquests: pendingConquests.length,
    };
  }

  /** Arrête tout (démo, changement de partie). */
  function clear() {
    major.running?.cancel();
    for (const job of major.queue) job.cancel();
    major.queue = [];
    for (const anim of [...live]) anim.cancel();
    floaters.releaseAll();
    particles.releaseAll();
    coins.releaseAll();
    for (const node of [...layer.children]) if (!node.dataset.base) node.remove();
    income = 0;
  }

  return {
    play, onGameEvent, update, addIncome, setMood, sceneShown, installPress, stats, clear,
    motion, layer, get mood() { return mood; },
  };
}
