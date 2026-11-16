// L'éditeur de studio : le QG devient une pièce en vue isométrique où le
// joueur place les objets qu'il possède (améliorations, producteurs, déco).
// Données : data/decor.json. Purement cosmétique en v1.
//
// Le plan est sauvegardé dans state.studio :
//   layout : [{ id, x, y, rot }]  les objets posés (un exemplaire par id)
//   stored : [id]                 les objets que le joueur a rangés lui-même
// Un objet possédé qui n'est ni posé ni rangé est « nouveau » : syncStudio le
// pose tout seul. C'est ce qui installe aussi, d'un coup, les objets des
// parties commencées avant l'éditeur.
//
// Coordonnées : la pièce fait room.width × room.depth tuiles. x va vers la
// droite et l'avant de l'écran, y vers la gauche et l'avant ; (0, 0) est le
// coin du fond. Les deux murs visibles longent le fond :
//   mur de droite : la ligne y = 0 (objet mural avec rot 0, posé à x)
//   mur de gauche : la ligne x = 0 (objet mural avec rot 1, posé à y)
// Au sol, rot va de 0 à rotations - 1 ; les rotations impaires échangent la
// largeur et la profondeur de l'objet.

import { petLevel } from './pets.js';

export const SOURCES = ['upgrade', 'producer', 'pet', 'deco'];
export const SURFACES = ['sol', 'mur'];

export function emptyStudio() {
  return { layout: [], stored: [] };
}

export function decorDef(data, id) {
  return data.decor?.items.find((d) => d.id === id) ?? null;
}

export function isWallItem(def) {
  return def.surface === 'mur';
}

export function roomSize(state, data) {
  const room = data.decor?.room ?? { width: 8, depth: 8 };
  return { width: room.width, depth: room.depth };
}

/** Le nom affiché : celui de l'amélioration, du producteur ou de l'animal, sinon celui de l'objet déco. */
export function decorName(data, def) {
  if (def.name) return def.name;
  const list = { upgrade: data.upgrades, producer: data.producers, pet: data.pets }[def.source] ?? [];
  return list.find((x) => x.id === def.id)?.name ?? def.id;
}

/** On possède un objet quand on possède l'amélioration, le producteur ou l'animal. La déco est offerte. */
export function ownsDecor(state, data, def) {
  if (!def) return false;
  switch (def.source) {
    case 'upgrade': return Boolean(state.upgrades?.[def.id]);
    case 'producer': return (state.producers?.[def.id] ?? 0) > 0;
    case 'pet': return petLevel(state, def.id) > 0;
    case 'deco': return true;
    default: return false;
  }
}

/** Nombre de rotations permises : au mur, une par mur (2). */
export function rotationCount(def) {
  return isWallItem(def) ? 2 : def.rotations ?? 1;
}

/** Tuiles occupées [largeur en x, profondeur en y] selon la rotation. */
export function footprint(def, rot) {
  const [w, d] = def.footprint;
  if (isWallItem(def)) return rot === 1 ? [1, w] : [w, 1];
  return rot % 2 === 1 ? [d, w] : [w, d];
}

/** Clés des cases occupées. Le sol et chaque mur ont leurs propres cases. */
function cellsOf(def, x, y, rot) {
  const keys = [];
  if (isWallItem(def)) {
    const along = rot === 1 ? y : x;
    for (let i = 0; i < def.footprint[0]; i += 1) keys.push(`${rot === 1 ? 'L' : 'R'}${along + i}`);
    return keys;
  }
  const [w, d] = footprint(def, rot);
  for (let i = 0; i < w; i += 1) for (let j = 0; j < d; j += 1) keys.push(`${x + i},${y + j}`);
  return keys;
}

function isInt(n) {
  return Number.isInteger(n);
}

/** Vérifie la forme et les limites, sans regarder les autres objets. */
function inRoom(def, x, y, rot, room) {
  if (!isInt(x) || !isInt(y) || !isInt(rot) || rot < 0 || rot >= rotationCount(def)) return false;
  if (isWallItem(def)) {
    const len = def.footprint[0];
    if (rot === 0) return y === 0 && x >= 0 && x + len <= room.width;
    return x === 0 && y >= 0 && y + len <= room.depth;
  }
  const [w, d] = footprint(def, rot);
  return x >= 0 && y >= 0 && x + w <= room.width && y + d <= room.depth;
}

function occupied(data, layout, exceptId) {
  const taken = new Set();
  for (const entry of layout) {
    if (entry.id === exceptId) continue;
    const def = decorDef(data, entry.id);
    if (def) for (const key of cellsOf(def, entry.x, entry.y, entry.rot)) taken.add(key);
  }
  return taken;
}

function fits(data, room, layout, def, x, y, rot) {
  if (!inRoom(def, x, y, rot, room)) return false;
  const taken = occupied(data, layout, def.id);
  return cellsOf(def, x, y, rot).every((key) => !taken.has(key));
}

/**
 * Peut-on poser l'objet `id` en (x, y) avec la rotation `rot` ? Vérifie la
 * possession, la surface (sol ou mur), les limites et les chevauchements.
 * L'objet lui-même est ignoré : on peut donc tester un déplacement.
 */
export function canPlace(state, data, id, x, y, rot = 0) {
  const def = decorDef(data, id);
  if (!def || !ownsDecor(state, data, def)) return false;
  return fits(data, roomSize(state, data), state.studio.layout, def, x, y, rot);
}

export function placedEntry(state, id) {
  return state.studio.layout.find((e) => e.id === id) ?? null;
}

/** Les objets possédés mais pas posés : le contenu du tiroir. */
export function inventory(state, data) {
  return (data.decor?.items ?? []).filter((def) => ownsDecor(state, data, def) && !placedEntry(state, def.id));
}

/** Poser un objet de l'inventaire. */
export function placeItem(state, data, id, x, y, rot = 0) {
  if (placedEntry(state, id) || !canPlace(state, data, id, x, y, rot)) return false;
  state.studio.layout.push({ id, x, y, rot });
  state.studio.stored = state.studio.stored.filter((s) => s !== id);
  return true;
}

/** Déplacer (et éventuellement tourner) un objet déjà posé. */
export function moveItem(state, data, id, x, y, rot) {
  const entry = placedEntry(state, id);
  if (!entry) return false;
  const nextRot = rot ?? entry.rot;
  if (!canPlace(state, data, id, x, y, nextRot)) return false;
  Object.assign(entry, { x, y, rot: nextRot });
  return true;
}

/**
 * Position et rotation suivantes pour un objet : au sol, on tourne sur place ;
 * au mur, on passe sur l'autre mur à la même distance du coin.
 */
export function nextRotation(def, x, y, rot) {
  const next = (rot + 1) % rotationCount(def);
  if (!isWallItem(def)) return { x, y, rot: next };
  return next === 1 ? { x: 0, y: x, rot: 1 } : { x: y, y: 0, rot: 0 };
}

/** Tourner un objet posé. Retourne false s'il n'y a pas la place. */
export function rotateItem(state, data, id) {
  const entry = placedEntry(state, id);
  const def = decorDef(data, id);
  if (!entry || !def || rotationCount(def) < 2) return false;
  const { x, y, rot } = nextRotation(def, entry.x, entry.y, entry.rot);
  return moveItem(state, data, id, x, y, rot);
}

/** Ranger un objet posé dans l'inventaire. Il n'en ressortira que si le joueur le pose. */
export function storeItem(state, data, id) {
  const before = state.studio.layout.length;
  state.studio.layout = state.studio.layout.filter((e) => e.id !== id);
  if (state.studio.layout.length === before) return false;
  if (!state.studio.stored.includes(id)) state.studio.stored.push(id);
  return true;
}

/**
 * Les places à essayer, dans l'ordre : au sol, on longe d'abord les murs du
 * fond pour garder le milieu de la pièce libre ; au mur, le mur de droite puis
 * celui de gauche.
 */
function candidateSpots(def, room) {
  const spots = [];
  if (isWallItem(def)) {
    for (let x = 0; x < room.width; x += 1) spots.push({ x, y: 0, rot: 0 });
    for (let y = 0; y < room.depth; y += 1) spots.push({ x: 0, y, rot: 1 });
    return spots;
  }
  const tiles = [];
  for (let x = 0; x < room.width; x += 1) for (let y = 0; y < room.depth; y += 1) tiles.push({ x, y });
  tiles.sort((a, b) => Math.min(a.x, a.y) - Math.min(b.x, b.y) || a.x + a.y - (b.x + b.y) || a.y - b.y);
  for (const tile of tiles) for (let rot = 0; rot < rotationCount(def); rot += 1) spots.push({ ...tile, rot });
  return spots;
}

/** La première place libre pour un objet (sans le poser), ou null si la pièce est pleine. */
export function findSpot(state, data, id) {
  const def = decorDef(data, id);
  if (!def) return null;
  const room = roomSize(state, data);
  return candidateSpots(def, room).find((s) => fits(data, room, state.studio.layout, def, s.x, s.y, s.rot)) ?? null;
}

/** Pose un objet tout juste acheté sur la première place libre. */
export function autoPlace(state, data, id) {
  if (placedEntry(state, id)) return false;
  const spot = findSpot(state, data, id);
  return spot ? placeItem(state, data, id, spot.x, spot.y, spot.rot) : false;
}

/**
 * Installe les objets possédés qui ne sont ni posés ni rangés : les achats
 * récents, et tout le QG d'une partie commencée avant l'éditeur. S'il n'y a
 * plus de place, l'objet attend dans l'inventaire.
 * Événements : studioPlaced (posé tout seul), studioFull (pas de place).
 */
export function syncStudio(state, data) {
  const events = [];
  for (const def of data.decor?.items ?? []) {
    if (!ownsDecor(state, data, def) || placedEntry(state, def.id) || state.studio.stored.includes(def.id)) continue;
    const event = { id: def.id, name: decorName(data, def), source: def.source };
    if (autoPlace(state, data, def.id)) {
      events.push({ type: 'studioPlaced', ...event });
    } else {
      state.studio.stored.push(def.id);
      events.push({ type: 'studioFull', ...event });
    }
  }
  return events;
}

/**
 * Répare un plan relu d'une sauvegarde (abîmée, trafiquée ou d'une ancienne
 * version des données) : un objet inconnu, en double ou plus possédé
 * disparaît ; un objet mal placé ou qui en chevauche un autre retourne dans
 * l'inventaire.
 */
export function repairStudio(raw, state, data) {
  const studio = emptyStudio();
  if (!raw || typeof raw !== 'object') return studio;
  const room = roomSize(state, data);
  const owned = (id) => ownsDecor(state, data, decorDef(data, id));
  const seen = new Set();

  for (const entry of Array.isArray(raw.layout) ? raw.layout : []) {
    const id = entry?.id;
    if (typeof id !== 'string' || seen.has(id) || !owned(id)) continue;
    seen.add(id);
    const { x, y, rot } = entry;
    if (fits(data, room, studio.layout, decorDef(data, id), x, y, rot)) studio.layout.push({ id, x, y, rot });
    else studio.stored.push(id);
  }
  for (const id of Array.isArray(raw.stored) ? raw.stored : []) {
    if (typeof id !== 'string' || seen.has(id) || !owned(id)) continue;
    seen.add(id);
    studio.stored.push(id);
  }
  return studio;
}

// ---- La vibe du studio : des bonus quand deux objets sont côte à côte ----
// data/decor.json → "vibe" : [{ id, name, icon, items: [a, b], effects }].
// Deux objets sont côte à côte quand leurs emprises se touchent (par un côté
// ou un coin). Un objet mural occupe une bande juste derrière la pièce : il
// touche ce qui est posé au sol contre son mur, et les objets muraux voisins
// (y compris de l'autre côté du coin).

/** Emprise d'un objet posé : rectangle [x0, x1) × [y0, y1) en tuiles. */
function rectOf(def, entry) {
  if (isWallItem(def)) {
    const len = def.footprint[0];
    return entry.rot === 1
      ? { x0: -1, x1: 0, y0: entry.y, y1: entry.y + len }
      : { x0: entry.x, x1: entry.x + len, y0: -1, y1: 0 };
  }
  const [w, d] = footprint(def, entry.rot);
  return { x0: entry.x, x1: entry.x + w, y0: entry.y, y1: entry.y + d };
}

function touching(a, b) {
  const gapX = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const gapY = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return gapX === 0 && gapY === 0;
}

/** Les deux objets posés sont-ils côte à côte ? */
export function areAdjacent(state, data, idA, idB) {
  const a = placedEntry(state, idA);
  const b = placedEntry(state, idB);
  const defA = decorDef(data, idA);
  const defB = decorDef(data, idB);
  if (!a || !b || !defA || !defB) return false;
  return touching(rectOf(defA, a), rectOf(defB, b));
}

/**
 * Où en est chaque combo de vibe : active (les deux objets côte à côte),
 * possible (les deux sont possédés), ou pas encore (il en manque un).
 */
export function vibeStatus(state, data) {
  return (data.decor?.vibe ?? []).map((vibe) => {
    const [a, b] = vibe.items;
    const owned = vibe.items.every((id) => ownsDecor(state, data, decorDef(data, id)));
    const active = Boolean(state.studio?.layout) && areAdjacent(state, data, a, b);
    return { vibe, owned, active };
  });
}

/** Les effets des combos actifs, à ajouter aux autres bonus (modifiers.js). */
export function vibeEffects(state, data) {
  if (!state.studio?.layout?.length) return [];
  return vibeStatus(state, data).filter((s) => s.active).flatMap((s) => s.vibe.effects);
}
