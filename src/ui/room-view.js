// Une pièce en vue isométrique (le studio du QG, la serre) : la pièce dessinée
// sur deux canvas (derrière et devant le personnage), le mode Édition au
// toucher, la vibe (bonus quand deux objets se touchent) et, au studio, les
// animaux qui se promènent. Le décor de chaque pièce (murs, sol) est dans
// room-themes.js ; la logique (placer, tourner, ranger) dans src/game/studio.js.
//
// Ne modifie jamais l'état : les changements de plan passent par
// `actions` (place, move, rotate, store, done) fournies par main.js.
//
// Sprites (volet B) : assets/images/<sprite de l'objet> (data/decor.json pour le
// studio, "decor" de data/greenhouse.json pour la serre). Tant que le fichier
// manque, l'objet est une boîte de couleur (`color`, `height`).
//   Au sol : l'image est centrée sur l'emprise de l'objet, le bas de l'image
//   sur la pointe avant du losange. Largeur conseillée : (largeur + profondeur) × 16 px.
//   Les rotations impaires sont le miroir de l'image. Avec rotations: 4,
//   l'image contient 2 vues côte à côte (de face, puis de dos).
//   Au mur : large de longueur × 16 px, la vue du mur de droite puis, à côté
//   et facultative, celle du mur de gauche (sinon : miroir) ; le bas de l'image est le bout avant du panneau, à la
//   hauteur `elevation`.

import { decorName, footprint, isWallItem, nextRotation, petLevel, rotationCount } from '../game/index.js';
import { TILE_W, drawBox, drawWallPanel, polygon, project, shade, tileDiamond, unproject } from './iso.js';

const MARGIN_X = 8;
const FLOOR_TOP = 40; // les murs dépassent du haut du canvas : un sous-sol, vu de près
export const WALL_H = 140;
const LONG_PRESS_MS = 420;
const DRAG_START = 5; // pixels du canvas avant qu'un appui devienne un glisser
const PET_SPEED = 1.3; // tuiles par seconde
const PET_W = 28; // une image d'animal : 28 × 20, deux images côte à côte

const COLORS = {
  ok: 'rgba(110, 230, 120, .55)', okLine: '#3fbf4f',
  bad: 'rgba(240, 70, 70, .55)', badLine: '#d83a3a',
  select: '#ffd166',
};

/**
 * Crée la vue d'une pièce.
 *   room     les fonctions de la pièce (studioRoom ou serreRoom, src/game/studio.js)
 *   scene    l'élément de la scène (data-scene du jeu = room.id quand on la voit)
 *   canvases { back, front } : derrière et devant le personnage
 *   prefix   préfixe des identifiants de l'éditeur (<prefix>-edit, <prefix>-hint...)
 *   theme    { drawRoom(ctx, geo) } : les murs et le sol (room-themes.js)
 *   labels   { the: 'le studio', of: 'du studio' } pour les textes
 *   pet      l'animal assis à côté du personnage (facultatif)
 *   walkers  true : les autres animaux adoptés se promènent dans la pièce
 */
export function createRoomView(data, {
  room, scene, canvases, prefix, theme, labels, character, pet = null, walkers: withWalkers = false, actions, toast, describe, onPet,
}) {
  const $ = (name) => document.getElementById(`${prefix}-${name}`);
  const { back, front } = canvases;
  const editor = $('editor');
  const editButton = $('edit');
  const hint = $('hint');
  const inventoryList = $('inventory');
  const inventoryTitle = $('inventory-title');
  const tools = {
    rotate: $('rotate'),
    move: $('move'),
    store: $('store'),
    drop: $('drop'),
    cancel: $('cancel'),
    done: $('done'),
  };
  const game = document.getElementById('game-screen');
  const vibeList = $('vibe');
  const vibeTitle = $('vibe-title');
  const vibeChip = $('vibe-chip');
  const vibeCount = $('vibe-count');
  const { canPlace, decorDef, inventory, placedEntry, roomSize, vibeStatus } = room;
  const plan = () => state[room.plan];
  const items = () => room.decorOf(data)?.items ?? [];
  const editLabel = `Réaménager ${labels.the}`;
  const roomLayer = document.createElement('canvas'); // murs et sol, dessinés une fois

  let state = null;
  let size = { width: 8, depth: 8 };
  let origin = { x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let editing = false;
  let selected = ''; // objet posé sélectionné
  let holding = null; // { id, from: entry | null, ghost: { x, y, rot } | null }
  let hits = []; // rectangles des objets dessinés, de l'arrière vers l'avant
  let ghostBox = null; // rectangle de l'ombre dessinée
  let drawnKey = '';
  let inventoryKey = '';
  const sprites = new Map(); // id → Image chargée
  let vibeKey = '';
  let activeVibes = null; // ids des combos actifs (null = pas encore calculé)
  // Les animaux adoptés (sauf celui à côté du personnage) se promènent entre les objets.
  const petImages = new Map(); // id → Image
  const walkers = new Map(); // id → { x, y (centre, en tuiles), path, wait, clock, frame, left, petted }
  let petHits = [];
  let lastStep = 0;

  // ---- Géométrie ----

  function resize() {
    size = roomSize(state, data);
    width = (size.width + size.depth) * (TILE_W / 2) + MARGIN_X * 2;
    height = FLOOR_TOP + (size.width + size.depth) * 8 + 2;
    origin = { x: MARGIN_X + size.depth * (TILE_W / 2), y: FLOOR_TOP };
    for (const canvas of [back, front, roomLayer]) {
      canvas.width = width;
      canvas.height = height;
    }
    scene.dataset.width = width; // --s : taille d'un pixel de la pièce à l'écran (voir view.js)
    scene.style.aspectRatio = `${width} / ${height}`;
    drawRoom(roomLayer.getContext('2d'));
  }

  /** Point du canvas sous le doigt. */
  function toCanvas(event) {
    const rect = front.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * width) / rect.width, y: ((event.clientY - rect.top) * height) / rect.height };
  }

  /** Coin haut-gauche (x, y en tuiles) pour que l'objet soit centré sous le doigt. */
  function spotAt(def, point, rot) {
    if (isWallItem(def)) {
      const len = def.footprint[0];
      const wall = rot === 1 || (rot === undefined && point.x < origin.x) ? 'L' : 'R';
      const along = Math.abs(point.x - origin.x) / (TILE_W / 2) - len / 2;
      if (wall === 'R') return { x: clamp(Math.round(along), 0, size.width - len), y: 0, rot: 0 };
      return { x: 0, y: clamp(Math.round(along), 0, size.depth - len), rot: 1 };
    }
    const [w, d] = footprint(def, rot);
    const at = unproject(origin, point.x, point.y);
    return {
      x: clamp(Math.round(at.x - w / 2), 0, size.width - w),
      y: clamp(Math.round(at.y - d / 2), 0, size.depth - d),
      rot,
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /** Le point touché est-il sur l'ombre ? (pour « toucher encore pour poser ») */
  function onGhost(def, ghost, point) {
    if (!ghost || !ghostBox) return false;
    const pad = 4;
    if (point.x >= ghostBox.x0 - pad && point.x <= ghostBox.x1 + pad && point.y >= ghostBox.y0 - pad && point.y <= ghostBox.y1 + pad) return true;
    if (isWallItem(def)) return false;
    const [w, d] = footprint(def, ghost.rot);
    const at = unproject(origin, point.x, point.y);
    return at.x >= ghost.x && at.x < ghost.x + w && at.y >= ghost.y && at.y < ghost.y + d;
  }

  // ---- Dessin ----

  function loadSprites() {
    for (const def of items()) {
      if (!def.sprite) continue;
      const img = new Image();
      img.addEventListener('load', () => {
        sprites.set(def.id, img);
        refresh(true);
      }, { once: true });
      img.src = `assets/images/${def.sprite}`;
    }
  }

  function drawRoom(ctx) {
    theme.drawRoom(ctx, { origin, room: size, width, height, wallH: WALL_H });
  }

  function wallPoints(def, { x, y, rot }) {
    const wall = rot === 1 ? 'L' : 'R';
    const from = rot === 1 ? y : x;
    const z = def.elevation ?? 12;
    const along = (t, zz) => (wall === 'R' ? project(origin, t, 0.04, zz) : project(origin, 0.04, t, zz));
    return [along(from + 0.08, z), along(from + def.footprint[0] - 0.08, z), along(from + def.footprint[0] - 0.08, z + def.height), along(from + 0.08, z + def.height)];
  }

  /** Dessine un objet (sprite ou boîte de couleur) et retourne son rectangle à l'écran. */
  function drawItem(ctx, def, { x, y, rot }) {
    const img = sprites.get(def.id);
    if (isWallItem(def)) {
      if (img) {
        const from = rot === 1 ? y : x;
        // Le bas de l'image est le point le plus bas du panneau (son bout avant), à la hauteur elevation.
        const len = def.footprint[0];
        const mid = rot === 1 ? project(origin, 0, from + len / 2, def.elevation ?? 12) : project(origin, from + len / 2, 0, def.elevation ?? 12);
        // Deux vues côte à côte (mur de droite, mur de gauche) ; sinon, miroir pour le mur de gauche.
        const frames = img.width >= len * TILE_W ? 2 : 1; // une vue fait len × 16 px
        return drawSprite(ctx, img, { x: mid.x, y: mid.y + len * 4 }, rot === 1 && frames === 1, rot === 1 && frames === 2 ? 1 : 0, frames);
      }
      const wall = rot === 1 ? 'L' : 'R';
      return drawWallPanel(ctx, origin, wall, rot === 1 ? y : x, def.footprint[0], def.elevation ?? 12, def.height, def.color);
    }
    const [w, d] = footprint(def, rot);
    if (img) {
      const bottom = project(origin, x + w, y + d);
      const center = project(origin, x + w / 2, y + d / 2);
      const frames = rotationCount(def) === 4 ? 2 : 1;
      return drawSprite(ctx, img, { x: center.x, y: bottom.y }, rot % 2 === 1, rot >= 2 ? 1 : 0, frames);
    }
    const inset = 0.1;
    const box = drawBox(ctx, origin, x + inset, y + inset, w - inset * 2, d - inset * 2, def.height, def.color);
    // Un trait clair sur le bord du dessus montre de quel côté l'objet est tourné.
    if (rotationCount(def) > 1) {
      const h = def.height;
      const edges = [
        [project(origin, x + inset, y + d - inset, h), project(origin, x + w - inset, y + d - inset, h)],
        [project(origin, x + w - inset, y + inset, h), project(origin, x + w - inset, y + d - inset, h)],
        [project(origin, x + inset, y + inset, h), project(origin, x + w - inset, y + inset, h)],
        [project(origin, x + inset, y + inset, h), project(origin, x + inset, y + d - inset, h)],
      ];
      const [a, b] = edges[rot % 4];
      ctx.strokeStyle = shade(def.color, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    return box;
  }

  function drawSprite(ctx, img, anchor, mirror, frame, frames) {
    const fw = img.width / frames;
    const left = Math.round(anchor.x - fw / 2);
    const top = Math.round(anchor.y - img.height);
    ctx.save();
    if (mirror) {
      ctx.translate(Math.round(anchor.x) * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, frame * fw, 0, fw, img.height, left, top, fw, img.height);
    ctx.restore();
    return { x0: left, y0: top, x1: left + fw, y1: top + img.height };
  }

  /** Profondeur d'un objet au sol : on dessine de l'arrière vers l'avant. */
  function depthOf(def, entry) {
    const [w, d] = footprint(def, entry.rot);
    return entry.x + w / 2 + entry.y + d / 2;
  }

  /** La tuile libre la plus proche du milieu de la pièce (pour le personnage), puis une voisine pour l'animal. */
  function standingSpots() {
    const taken = new Set();
    for (const entry of plan().layout) {
      const def = decorDef(data, entry.id);
      if (!def || isWallItem(def)) continue;
      const [w, d] = footprint(def, entry.rot);
      for (let i = 0; i < w; i += 1) for (let j = 0; j < d; j += 1) taken.add(`${entry.x + i},${entry.y + j}`);
    }
    const free = (x, y) => x >= 0 && y >= 0 && x < size.width && y < size.depth && !taken.has(`${x},${y}`);
    const cx = Math.floor(size.width / 2) - 1;
    const cy = Math.floor(size.depth / 2);
    let best = null;
    for (let x = 0; x < size.width; x += 1) {
      for (let y = 0; y < size.depth; y += 1) {
        if (!free(x, y)) continue;
        const dist = Math.abs(x - cx) + Math.abs(y - cy) + (x + y < cx + cy ? 0.5 : 0); // plutôt vers l'avant
        if (!best || dist < best.dist) best = { x, y, dist };
      }
    }
    const me = best ?? { x: cx, y: cy };
    const petSpot = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]]
      .map(([dx, dy]) => ({ x: me.x + dx, y: me.y + dy }))
      .find((p) => free(p.x, p.y)) ?? { x: me.x + 1, y: me.y };
    return { me, pet: petSpot };
  }

  function placeOverlay(el, tile, flip) {
    const feet = project(origin, tile.x + 0.5, tile.y + 0.5);
    el.style.left = `${(feet.x / width) * 100}%`;
    el.style.top = `${(feet.y / height) * 100}%`;
    if (flip !== undefined) el.classList.toggle('is-facing-right', flip);
  }

  function draw() {
    const bctx = back.getContext('2d');
    const fctx = front.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    fctx.imageSmoothingEnabled = false;
    fctx.clearRect(0, 0, width, height);
    bctx.drawImage(roomLayer, 0, 0);
    hits = [];
    petHits = [];
    ghostBox = null;

    const entries = plan().layout
      .map((entry) => ({ entry, def: decorDef(data, entry.id) }))
      .filter((x) => x.def);
    const walls = entries.filter((x) => isWallItem(x.def));
    const floor = entries.filter((x) => !isWallItem(x.def)).sort((a, b) => depthOf(a.def, a.entry) - depthOf(b.def, b.entry) || a.def.height - b.def.height);

    // Hors édition, le personnage se tient sur une tuile libre : ce qui est devant lui va sur le canvas de devant.
    let splitDepth = Infinity;
    let pets = [];
    if (!editing) {
      const spots = standingSpots();
      splitDepth = spots.me.x + spots.me.y + 1;
      placeOverlay(character, spots.me);
      if (pet) placeOverlay(pet, spots.pet, project(origin, spots.pet.x, spots.pet.y).x < project(origin, spots.me.x, spots.me.y).x);
      if (withWalkers) {
        syncWalkers(spots);
        pets = [...walkers.entries()].map(([id, w]) => ({ id, w, depth: w.x + w.y }));
      }
    }

    const lifted = holding?.from ? holding.id : '';
    for (const { entry, def } of walls) drawEntry(bctx, def, entry, lifted);
    // Objets au sol et animaux, de l'arrière vers l'avant.
    const drawables = [
      ...floor.map(({ entry, def }) => ({ depth: depthOf(def, entry), item: { entry, def } })),
      ...pets.map((p) => ({ depth: p.depth + 0.01, pet: p })),
    ].sort((a, b) => a.depth - b.depth);
    for (const d of drawables) {
      const ctx = d.depth > splitDepth ? fctx : bctx;
      if (d.item) drawEntry(ctx, d.item.def, d.item.entry, lifted);
      else drawWalker(ctx, d.pet.id, d.pet.w);
    }

    if (!editing) return;
    if (selected && !holding) outline(fctx, decorDef(data, selected), placedEntry(state, selected), COLORS.select);
    if (holding?.ghost) {
      const def = decorDef(data, holding.id);
      const ok = ghostValid();
      if (!isWallItem(def)) {
        const [w, d] = footprint(def, holding.ghost.rot);
        polygon(fctx, tileDiamond(origin, holding.ghost.x, holding.ghost.y, w, d), ok ? COLORS.ok : COLORS.bad, ok ? COLORS.okLine : COLORS.badLine);
      }
      fctx.globalAlpha = 0.75;
      ghostBox = drawItem(fctx, def, holding.ghost);
      fctx.globalAlpha = 1;
      outline(fctx, def, holding.ghost, ok ? COLORS.okLine : COLORS.badLine);
    }
  }

  function drawEntry(ctx, def, entry, lifted) {
    ctx.globalAlpha = entry.id === lifted ? 0.3 : 1;
    const box = drawItem(ctx, def, entry);
    ctx.globalAlpha = 1;
    if (entry.id !== lifted) hits.push({ id: entry.id, ...box });
  }

  // ---- Les animaux qui se promènent ----

  function petImage(id) {
    if (!petImages.has(id)) {
      const img = new Image();
      img.addEventListener('load', () => refresh(true), { once: true });
      img.src = `assets/images/animaux/${id}.png`;
      petImages.set(id, img);
    }
    return petImages.get(id);
  }

  /** Les tuiles où un animal peut marcher : ni objet, ni personnage, ni compagnon. */
  function walkable(spots) {
    const free = new Set();
    const taken = new Set([`${spots.me.x},${spots.me.y}`, `${spots.pet.x},${spots.pet.y}`]);
    for (const entry of plan().layout) {
      const def = decorDef(data, entry.id);
      if (!def || isWallItem(def)) continue;
      const [w, d] = footprint(def, entry.rot);
      for (let i = 0; i < w; i += 1) for (let j = 0; j < d; j += 1) taken.add(`${entry.x + i},${entry.y + j}`);
    }
    for (let x = 0; x < size.width; x += 1) for (let y = 0; y < size.depth; y += 1) if (!taken.has(`${x},${y}`)) free.add(`${x},${y}`);
    return free;
  }

  let free = new Set();

  function syncWalkers(spots) {
    free = walkable(spots);
    const ids = (data.pets ?? []).filter((p) => petLevel(state, p.id) > 0 && p.id !== state.companion).map((p) => p.id);
    for (const id of walkers.keys()) if (!ids.includes(id)) walkers.delete(id);
    const tiles = [...free].map((k) => k.split(',').map(Number));
    for (const id of ids) {
      let w = walkers.get(id);
      const here = w && `${Math.floor(w.x)},${Math.floor(w.y)}`;
      if (w && free.has(here) && w.path.every((t) => free.has(`${t.x},${t.y}`))) continue;
      // Nouvel animal, ou un objet vient d'être posé sur son chemin : il réapparaît sur une tuile libre.
      if (!tiles.length) {
        walkers.delete(id);
        continue;
      }
      const [tx, ty] = w && free.has(here) ? [Math.floor(w.x), Math.floor(w.y)] : tiles[Math.floor(Math.random() * tiles.length)];
      w = { x: tx + 0.5, y: ty + 0.5, path: [], wait: 1 + Math.random() * 3, clock: 0, frame: 0, left: Math.random() < 0.5, petted: 0 };
      petImage(id);
      walkers.set(id, w);
    }
  }

  /** Chemin (tuile par tuile) vers une tuile libre au hasard, en contournant les objets. */
  function wanderPath(w) {
    const start = `${Math.floor(w.x)},${Math.floor(w.y)}`;
    const from = new Map([[start, null]]);
    const queue = [start];
    const others = new Set([...walkers.values()].filter((o) => o !== w).map((o) => `${Math.floor(o.x)},${Math.floor(o.y)}`));
    while (queue.length) {
      const key = queue.shift();
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = `${x + dx},${y + dy}`;
        if (free.has(next) && !from.has(next) && !others.has(next)) {
          from.set(next, key);
          queue.push(next);
        }
      }
    }
    const targets = [...from.keys()].filter((k) => k !== start);
    if (!targets.length) return [];
    let key = targets[Math.floor(Math.random() * targets.length)];
    const path = [];
    while (key && key !== start) {
      const [x, y] = key.split(',').map(Number);
      path.unshift({ x, y });
      key = from.get(key);
    }
    return path.slice(0, 6); // une petite balade à la fois
  }

  function stepWalkers(dt) {
    let moved = false;
    for (const w of walkers.values()) {
      w.clock += dt;
      if (w.petted > 0) {
        w.petted -= dt;
        if (w.clock > 0.08) { w.clock = 0; w.frame = 1 - w.frame; moved = true; }
        continue;
      }
      if (!w.path.length) {
        w.wait -= dt;
        if (w.clock > 0.6) { w.clock = 0; w.frame = 1 - w.frame; moved = true; } // la queue bouge
        if (w.wait <= 0) {
          w.path = wanderPath(w);
          w.wait = 2 + Math.random() * 4;
        }
        continue;
      }
      const target = { x: w.path[0].x + 0.5, y: w.path[0].y + 0.5 };
      const dx = target.x - w.x;
      const dy = target.y - w.y;
      const dist = Math.hypot(dx, dy);
      const step = PET_SPEED * dt;
      if ((dx - dy) !== 0) w.left = dx - dy < 0; // vers la gauche de l'écran : on retourne l'image
      if (dist <= step) {
        w.x = target.x;
        w.y = target.y;
        w.path.shift();
      } else {
        w.x += (dx / dist) * step;
        w.y += (dy / dist) * step;
      }
      if (w.clock > 0.15) { w.clock = 0; w.frame = 1 - w.frame; }
      moved = true;
    }
    return moved;
  }

  function drawWalker(ctx, id, w) {
    const img = petImages.get(id);
    if (!img?.complete || !img.naturalWidth) return;
    const feet = project(origin, w.x, w.y);
    const box = drawSprite(ctx, img, { x: feet.x, y: feet.y + 3 }, w.left, w.frame, img.width / PET_W);
    petHits.push({ id, ...box });
  }

  /** Flatter un animal qui se promène : il s'arrête, remue la queue, un cœur s'envole. */
  scene.addEventListener('click', (event) => {
    if (!withWalkers || editing || (event.target !== scene && !event.target.classList?.contains('room-canvas'))) return;
    const point = toCanvas(event);
    const hit = [...petHits].reverse().find((h) => point.x >= h.x0 - 2 && point.x <= h.x1 + 2 && point.y >= h.y0 - 2 && point.y <= h.y1 + 2);
    const w = hit && walkers.get(hit.id);
    if (!w) return;
    w.path = [];
    w.petted = 1.2;
    w.wait = 2.5;
    onPet?.();
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '❤';
    heart.style.left = `${((hit.x0 + hit.x1) / 2 / width) * 100}%`;
    heart.style.top = `${(hit.y0 / height) * 100}%`;
    scene.append(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
    setTimeout(() => heart.remove(), 1500);
  });

  function outline(ctx, def, at, color) {
    if (!def || !at) return;
    if (isWallItem(def)) {
      polygon(ctx, wallPoints(def, at), null, color);
      return;
    }
    const [w, d] = footprint(def, at.rot);
    ctx.lineWidth = 1;
    polygon(ctx, tileDiamond(origin, at.x, at.y, w, d), null, color);
    polygon(ctx, tileDiamond(origin, at.x, at.y, w, d, def.height), null, color);
  }

  function ghostValid() {
    return Boolean(holding?.ghost) && canPlace(state, data, holding.id, holding.ghost.x, holding.ghost.y, holding.ghost.rot);
  }

  function itemAt(point) {
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      const h = hits[i];
      if (point.x >= h.x0 && point.x <= h.x1 && point.y >= h.y0 && point.y <= h.y1) return h.id;
    }
    return '';
  }

  // ---- Mode Édition ----

  function setEditing(on) {
    if (on === editing) return;
    editing = on;
    selected = '';
    holding = null;
    game.classList.toggle('is-editing', on);
    editor.hidden = !on;
    editButton.setAttribute('aria-pressed', String(on));
    editButton.textContent = on ? '✓' : '✏️';
    editButton.setAttribute('aria-label', on ? 'Terminer le réaménagement' : editLabel);
    if (!on) actions.done();
    refresh(true);
  }

  function hold(id, from) {
    const def = decorDef(data, id);
    const ghost = from ? { x: from.x, y: from.y, rot: from.rot } : findGhostStart(def);
    holding = { id, from, ghost };
    selected = '';
    refresh(true);
  }

  /** Pour un objet de l'inventaire : l'ombre apparaît tout de suite sur une place libre. */
  function findGhostStart(def) {
    for (let rot = 0; rot < rotationCount(def); rot += 1) {
      const [w, d] = isWallItem(def) ? [def.footprint[0], 1] : footprint(def, rot);
      const lenX = isWallItem(def) ? (rot === 1 ? 1 : size.width - w + 1) : size.width - w + 1;
      const lenY = isWallItem(def) ? (rot === 1 ? size.depth - def.footprint[0] + 1 : 1) : size.depth - d + 1;
      // On commence au milieu de la pièce, puis on s'en éloigne.
      const cells = [];
      for (let x = 0; x < lenX; x += 1) for (let y = 0; y < lenY; y += 1) cells.push({ x, y });
      cells.sort((a, b) => Math.abs(a.x - size.width / 2 + 1) + Math.abs(a.y - size.depth / 2 + 1) - (Math.abs(b.x - size.width / 2 + 1) + Math.abs(b.y - size.depth / 2 + 1)));
      const free = cells.find((c) => canPlace(state, data, def.id, c.x, c.y, rot));
      if (free) return { ...free, rot };
    }
    return spotAt(def, project(origin, size.width / 2, size.depth / 2), 0);
  }

  function drop() {
    if (!holding || !ghostValid()) return false;
    const { id, from, ghost } = holding;
    const ok = from ? actions.move(id, ghost.x, ghost.y, ghost.rot) : actions.place(id, ghost.x, ghost.y, ghost.rot);
    if (!ok) return false;
    holding = null;
    selected = id;
    refresh(true);
    return true;
  }

  function rotate() {
    if (holding?.ghost) {
      const def = decorDef(data, holding.id);
      const next = nextRotation(def, holding.ghost.x, holding.ghost.y, holding.ghost.rot);
      if (!isWallItem(def)) {
        const [w, d] = footprint(def, next.rot);
        next.x = clamp(next.x, 0, size.width - w);
        next.y = clamp(next.y, 0, size.depth - d);
      }
      holding.ghost = next;
    } else if (selected && !actions.rotate(selected)) {
      toast('Pas la place pour le tourner ici.');
    }
    refresh(true);
  }

  function store() {
    const id = holding?.from ? holding.id : selected;
    if (id) actions.store(id);
    holding = null;
    selected = '';
    refresh(true);
  }

  // Le doigt sur la pièce.
  let press = null; // { point, id, timer, moved, onGhost, spotKey }

  function spotKey(spot) {
    return spot ? `${spot.x},${spot.y},${spot.rot}` : '';
  }

  function moveGhost(point) {
    const def = decorDef(data, holding.id);
    const keepRot = isWallItem(def) ? undefined : holding.ghost?.rot ?? 0;
    const next = spotAt(def, point, keepRot);
    if (spotKey(next) !== spotKey(holding.ghost)) {
      holding.ghost = next;
      refresh(true);
    }
  }

  front.addEventListener('pointerdown', (event) => {
    if (!editing) return;
    event.preventDefault();
    try {
      front.setPointerCapture(event.pointerId); // le glisser continue même si le doigt sort de la pièce
    } catch { /* doigt déjà levé : rien à capturer */ }
    const point = toCanvas(event);
    if (holding) {
      const def = decorDef(data, holding.id);
      const again = onGhost(def, holding.ghost, point) && ghostValid();
      press = { point, onGhost: again, spot: spotKey(holding.ghost), moved: false };
      if (!again) moveGhost(point);
      return;
    }
    const id = itemAt(point);
    press = { point, id, moved: false };
    if (id) {
      selected = id;
      press.timer = setTimeout(() => {
        if (press?.id === id) {
          hold(id, { ...placedEntry(state, id) });
          press.onGhost = false;
          navigator.vibrate?.(15);
        }
      }, LONG_PRESS_MS);
    } else {
      selected = '';
    }
    refresh(true);
  });

  front.addEventListener('pointermove', (event) => {
    if (!editing) return;
    const point = toCanvas(event);
    if (!press) {
      // Souris : l'ombre suit le pointeur.
      if (holding && event.pointerType === 'mouse') moveGhost(point);
      return;
    }
    const far = Math.hypot(point.x - press.point.x, point.y - press.point.y) > DRAG_START;
    if (!far && !press.moved) return;
    press.moved = true;
    if (!holding && press.id) {
      // Glisser un objet posé le reprend tout de suite.
      clearTimeout(press.timer);
      hold(press.id, { ...placedEntry(state, press.id) });
    }
    if (holding) moveGhost(point);
  });

  function release() {
    if (!press) return;
    clearTimeout(press.timer);
    // Toucher encore l'ombre (sans la déplacer) pose l'objet.
    if (holding && press.onGhost && spotKey(holding.ghost) === press.spot) drop();
    press = null;
    refresh(true);
  }
  front.addEventListener('pointerup', release);
  front.addEventListener('pointercancel', () => {
    if (press) clearTimeout(press.timer);
    press = null;
  });

  editButton.addEventListener('click', () => setEditing(!editing));
  tools.done.addEventListener('click', () => setEditing(false));
  tools.rotate.addEventListener('click', rotate);
  tools.store.addEventListener('click', store);
  tools.drop.addEventListener('click', drop);
  tools.move.addEventListener('click', () => selected && hold(selected, { ...placedEntry(state, selected) }));
  tools.cancel.addEventListener('click', () => {
    holding = null;
    refresh(true);
  });

  resize();
  loadSprites();

  // ---- Barre d'outils et inventaire ----

  function renderTools() {
    const def = decorDef(data, holding?.id || selected);
    const name = def ? decorName(data, def) : '';
    tools.rotate.hidden = !def || rotationCount(def) < 2;
    tools.move.hidden = !selected || Boolean(holding);
    tools.store.hidden = !(selected && !holding) && !holding?.from;
    tools.drop.hidden = !holding;
    tools.drop.disabled = !ghostValid();
    tools.cancel.hidden = !holding;
    if (holding) {
      hint.textContent = ghostValid()
        ? `${def.icon ?? ''} ${name} : touche encore l'ombre verte (ou ✓) pour poser.`
        : `${def.icon ?? ''} ${name} : pas de place ici. Glisse ${isWallItem(def) ? 'le long des murs' : 'sur une zone libre'}.`;
    } else if (selected) {
      hint.textContent = `${def.icon ?? ''} ${name} · appui long ou glisser pour le déplacer.`;
    } else {
      hint.textContent = 'Touche un objet de l\'inventaire, puis la pièce. Appui long sur un objet posé pour le reprendre.';
    }
  }

  function renderInventory() {
    const items = inventory(state, data);
    const key = `${items.map((d) => d.id).join(',')}|${holding?.from ? '' : holding?.id ?? ''}`;
    editButton.classList.toggle('has-items', items.length > 0);
    if (key === inventoryKey) return;
    inventoryKey = key;
    inventoryTitle.textContent = items.length ? `Inventaire (${items.length})` : 'Inventaire vide : tout est installé';
    inventoryList.replaceChildren(...items.map((def) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studio-item';
      button.classList.toggle('is-held', holding?.id === def.id && !holding.from);
      button.style.setProperty('--swatch', def.color);
      const icon = document.createElement('span');
      icon.className = 'studio-item-icon';
      icon.textContent = def.icon ?? '📦';
      const label = document.createElement('span');
      label.className = 'studio-item-name';
      label.textContent = decorName(data, def);
      const where = document.createElement('span');
      where.className = 'studio-item-where';
      where.textContent = isWallItem(def) ? 'mur' : `sol ${def.footprint[0]}×${def.footprint[1]}`;
      button.append(icon, label, where);
      button.addEventListener('click', () => hold(def.id, null));
      return button;
    }));
  }

  // ---- La vibe ----

  function vibeHow(entry, preview) {
    const [a, b] = entry.vibe.items.map((id) => decorName(data, decorDef(data, id)));
    const bonus = entry.vibe.effects.map((e) => describe?.(e) ?? e.stat).join(', ');
    if (entry.active && entry.losing) return `⚠️ perdu si tu poses ici · ${bonus}`;
    if (entry.active) return `✓ ${bonus}`;
    if (preview) return `✨ ici : ${bonus}`;
    if (!entry.owned) {
      const missing = entry.vibe.items.filter((id) => !room.owns(state, data, decorDef(data, id)));
      return `🔒 Il te faut : ${missing.map((id) => decorName(data, decorDef(data, id))).join(', ')} · ${bonus}`;
    }
    return `${a} à côté de ${b} · ${bonus}`;
  }

  /** Les combos si l'ombre était posée là. */
  function previewVibes() {
    if (!holding?.ghost || !ghostValid()) return null;
    const layout = plan().layout.filter((e) => e.id !== holding.id).concat([{ id: holding.id, ...holding.ghost }]);
    return vibeStatus({ ...state, [room.plan]: { ...plan(), layout } }, data);
  }

  function renderVibe() {
    const status = vibeStatus(state, data);
    const active = status.filter((x) => x.active).map((x) => x.vibe.id);
    vibeCount.textContent = `${active.length}/${status.length}`;
    vibeChip.classList.toggle('is-zero', active.length === 0);
    vibeChip.setAttribute('aria-label', `La vibe ${labels.of} : ${active.length} combo${active.length > 1 ? 's' : ''} sur ${status.length}`);
    // Un combo vient de s'activer : on le dit.
    if (activeVibes) {
      for (const x of status) {
        if (x.active && !activeVibes.includes(x.vibe.id)) {
          toast(`✨ ${x.vibe.icon ?? ''} ${x.vibe.name} : ${x.vibe.effects.map((e) => describe?.(e) ?? e.stat).join(', ')}`);
          vibeChip.classList.remove('is-pop');
          void vibeChip.offsetWidth;
          vibeChip.classList.add('is-pop');
        }
      }
    }
    activeVibes = active;
    if (!editing) return;

    const preview = previewVibes();
    const related = holding?.id || selected;
    const rows = status.map((x, i) => ({
      ...x,
      preview: Boolean(preview?.[i].active && !x.active),
      losing: Boolean(preview && x.active && !preview[i].active),
    }));
    if (holding) {
      const gained = rows.filter((r) => r.preview).map((r) => r.vibe.name);
      const lost = rows.filter((r) => r.losing).map((r) => r.vibe.name);
      if (gained.length) hint.textContent += ` ✨ ${gained.join(', ')} !`;
      if (lost.length) hint.textContent += ` ⚠️ Tu perds : ${lost.join(', ')}.`;
    }
    const key = rows.map((r) => `${+r.active}${+r.owned}${+r.preview}${+r.losing}`).join('') + related;
    if (key === vibeKey) return;
    vibeKey = key;
    vibeTitle.textContent = `Vibe ${labels.of} (${active.length}/${status.length})`;
    const rank = (r) => (r.active ? 0 : r.preview ? 1 : r.owned ? 2 : 3);
    vibeList.replaceChildren(...[...rows].sort((a, b) => rank(a) - rank(b)).map((r) => {
      const li = document.createElement('li');
      li.classList.toggle('is-active', r.active);
      li.classList.toggle('is-preview', r.preview);
      li.classList.toggle('is-losing', r.losing);
      li.classList.toggle('is-locked', !r.owned);
      li.classList.toggle('is-related', Boolean(related) && r.vibe.items.includes(related));
      const icon = document.createElement('span');
      icon.className = 'vibe-icon';
      icon.textContent = r.vibe.icon ?? '✨';
      const name = document.createElement('span');
      name.className = 'vibe-name';
      name.textContent = r.vibe.name;
      const how = document.createElement('span');
      how.className = 'vibe-how';
      how.textContent = vibeHow(r, r.preview);
      li.append(icon, name, how);
      return li;
    }));
  }

  vibeChip.addEventListener('click', () => {
    setEditing(true);
    vibeTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function refresh(force = false) {
    if (!state) return;
    const key = [
      plan().layout.map((e) => `${e.id}:${e.x},${e.y},${e.rot}`).join('|'),
      editing, selected, holding ? `${holding.id}@${spotKey(holding.ghost)}` : '', sprites.size, state.companion,
      Object.keys(state.pets ?? {}).join(','),
    ].join('#');
    if (force || key !== drawnKey) {
      drawnKey = key;
      draw();
    }
    if (editing) renderTools();
    renderInventory();
    renderVibe();
  }

  return {
    update(nextState) {
      state = nextState;
      // Les animaux avancent à chaque rafraîchissement (15 fois par seconde), seulement si on les voit.
      const now = performance.now();
      const dt = Math.min(0.25, (now - (lastStep || now)) / 1000);
      lastStep = now;
      const visible = game.dataset.scene === room.id && !editing && document.visibilityState === 'visible';
      const still = document.documentElement.dataset.motion === 'reduced';
      const moved = visible && !still && walkers.size > 0 && stepWalkers(dt);
      refresh(moved);
    },
    /** Quitter le mode Édition (changement de lieu, par exemple). */
    stopEditing() {
      setEditing(false);
    },
    get editing() {
      return editing;
    },
  };
}
