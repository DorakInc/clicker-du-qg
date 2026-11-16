// Création de personnage par le joueur (data/creation.json) : des points de talent à
// répartir (comme les points de compétence au début de Fallout), un signe particulier tiré
// au hasard (un bonus et un malus), un nom. Le look, lui, est encodé dans l'identifiant
// du personnage (src/poupee/code.js) : « p- » + 17 caractères.
//
// Une partie avec un perso créé : state.characterId = 'p-…', state.custom = { name, skills, trait }.

export const CUSTOM_ID = /^p-[0-9a-z]{17}$/;
export const NAME_PATTERN = /^[A-Za-z0-9À-ÖØ-öø-ÿ _.'-]{2,16}$/;
export const DEFAULT_NAME = 'Artiste';

export const isCustomId = (id) => CUSTOM_ID.test(String(id ?? ''));

/** Stats où un multiplicateur plus petit que 1 est un avantage. */
export const LOWER_IS_BETTER = ['churn', 'cannabisDecay', 'cannabisPrice'];

/** Un effet est-il un avantage pour le joueur ? */
export const isBenefit = ({ stat, multiply }) => (LOWER_IS_BETTER.includes(stat) ? multiply < 1 : multiply > 1);

/** Retire des points (en partant du dernier talent) jusqu'à rentrer dans le budget. */
export function trimSkills(build, creation) {
  const skills = { ...build.skills };
  let extra = spentPoints(skills) - budget(creation, build.trait);
  for (const skill of [...creation.skills].reverse()) {
    while (extra > 0 && skills[skill.id] > 0) {
      skills[skill.id] -= 1;
      extra -= 1;
    }
    if (skills[skill.id] === 0) delete skills[skill.id];
  }
  return skills;
}

export function emptyBuild() {
  return { name: '', skills: {}, trait: '' };
}

export const cleanName = (text) => String(text ?? '').trim().replace(/\s+/g, ' ');

export function findTrait(creation, id) {
  return creation?.traits.list.find((t) => t.id === id) ?? null;
}

/** Points à répartir : la base, plus ceux du signe particulier (Touche-à-tout, Prodige...). */
export function budget(creation, traitId) {
  return creation.points + (findTrait(creation, traitId)?.points ?? 0);
}

export function spentPoints(skills) {
  return Object.values(skills ?? {}).reduce((sum, n) => sum + n, 0);
}

const round = (n) => Math.round(n * 10000) / 10000;

/** Le multiplicateur d'un talent à n points (perPoint négatif = la stat baisse, c'est voulu). */
export function skillMultiply(skill, points) {
  return round(1 + skill.perPoint * points);
}

/** Les effets du perso : talents puis signe particulier, combinés par stat. */
export function buildEffects(build, creation) {
  const byStat = new Map();
  const add = (stat, multiply) => byStat.set(stat, (byStat.get(stat) ?? 1) * multiply);
  for (const skill of creation.skills) {
    const n = build?.skills?.[skill.id] ?? 0;
    if (n > 0) add(skill.stat, skillMultiply(skill, n));
  }
  for (const e of findTrait(creation, build?.trait)?.effects ?? []) add(e.stat, e.multiply);
  return [...byStat].map(([stat, multiply]) => ({ stat, multiply: round(multiply) })).filter((e) => e.multiply !== 1);
}

/** Liste des problèmes d'un perso créé (vide si tout va bien). */
export function buildErrors(build, creation) {
  const errors = [];
  if (!NAME_PATTERN.test(cleanName(build?.name))) errors.push('Le nom fait de 2 à 16 caractères (lettres, chiffres, espace, tiret).');
  if (build?.trait && !findTrait(creation, build.trait)) errors.push('Signe particulier inconnu.');
  for (const [id, n] of Object.entries(build?.skills ?? {})) {
    if (!creation.skills.some((s) => s.id === id)) errors.push(`Talent inconnu : ${id}.`);
    else if (!Number.isInteger(n) || n < 0 || n > creation.maxPerSkill) errors.push(`Talent ${id} : de 0 à ${creation.maxPerSkill} points.`);
  }
  const left = budget(creation, build?.trait) - spentPoints(build?.skills);
  if (left < 0) errors.push(`${-left} point${left < -1 ? 's' : ''} de trop.`);
  return errors;
}

/** Relit un perso sauvegardé : ce qui est inconnu ou abîmé est retiré, jamais de points en trop. */
export function repairBuild(raw, creation) {
  const build = emptyBuild();
  if (!raw || typeof raw !== 'object' || !creation) return build;
  const name = cleanName(raw.name);
  build.name = NAME_PATTERN.test(name) ? name : DEFAULT_NAME;
  build.trait = findTrait(creation, raw.trait) ? raw.trait : '';
  for (const skill of creation.skills) {
    const n = raw.skills?.[skill.id];
    if (Number.isInteger(n) && n > 0) build.skills[skill.id] = Math.min(n, creation.maxPerSkill);
  }
  if (spentPoints(build.skills) > budget(creation, build.trait)) build.skills = {};
  return build;
}

// ---- Hasard (rng remplaçable dans les tests, comme events.js) ----------------------

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/** Répartit `total` points un par un sur des talents tirés au hasard. */
export function randomSkills(creation, total, rng = Math.random) {
  const skills = {};
  for (let i = 0; i < total; i += 1) {
    const open = creation.skills.filter((s) => (skills[s.id] ?? 0) < creation.maxPerSkill);
    if (!open.length) break;
    const s = pick(open, rng);
    skills[s.id] = (skills[s.id] ?? 0) + 1;
  }
  return skills;
}

/** Les signes particuliers proposés : `offer` différents, en évitant ceux de `exclude` s'il en reste assez. */
export function offerTraits(creation, rng = Math.random, exclude = []) {
  const { offer, list } = creation.traits;
  const fresh = list.filter((t) => !exclude.includes(t.id));
  const pool = [...(fresh.length >= offer ? fresh : list)];
  const chosen = [];
  while (chosen.length < offer && pool.length) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return chosen;
}

/** « DJ Caribou », « Ti-Béton »... toujours 16 caractères au plus. */
export function randomName(creation, rng = Math.random) {
  for (let i = 0; i < 30; i += 1) {
    const first = pick(creation.names.first, rng);
    const last = pick(creation.names.last, rng);
    const name = first.endsWith('-') ? `${first}${last}` : `${first} ${last}`;
    if (NAME_PATTERN.test(name)) return name;
  }
  return DEFAULT_NAME;
}

// ---- Le personnage d'une partie, préfait ou créé --------------------------------------

/**
 * Le personnage joué, au format de data/characters.json ({ id, name, strength, description, effects }).
 * Pour un perso créé : custom = true, et la force est son signe particulier.
 */
export function characterOf(state, data) {
  if (!isCustomId(state.characterId)) return data.characters.find((c) => c.id === state.characterId) ?? null;
  const build = state.custom ?? emptyBuild();
  const trait = findTrait(data.creation, build.trait);
  return {
    id: state.characterId,
    custom: true,
    name: build.name || DEFAULT_NAME,
    strength: trait?.name ?? 'Perso maison',
    description: trait?.description ?? '',
    effects: data.creation ? buildEffects(build, data.creation) : [],
  };
}
