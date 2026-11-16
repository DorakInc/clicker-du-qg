// Les animaux de compagnie en pixel art, vus de profil (tournés vers la droite).
// Chaque animal : 2 images de 28 × 20 (la queue bouge). Le jeu les retourne
// en CSS pour qu'ils regardent le personnage.
// Minou et Pitou sont dessinés d'après des photos (chat noir et blanc, bully fauve) ;
// les autres sont provisoires.

export const PET_W = 28;
export const PET_H = 20;

const EYE = '#1e1e22';
const NOSE = '#2c2224';
const TONGUE = '#ff7eb6';

// Un animal = un pelage, des oreilles, une queue et une taille. Marques possibles :
//   saddle  couleur du dos (le haut du corps)      cap      couleur du dessus de la tête
//   chest   poitrail et ventre                     paws     bout des pattes
//   blaze   trait sur le front                     earInner intérieur des oreilles
//   eye, nose, shade (pattes du fond)
export const PETS = [
  {
    // Chat de ruelle noir et blanc : dos, tête et oreilles noirs, museau et pattes blancs, yeux verts.
    id: 'minou', fur: '#f4f1ea', dark: '#202026', light: '#ffffff', shade: '#cfc9bd',
    saddle: '#202026', cap: '#202026', earInner: '#e8a3a8', eye: '#a6c05a', nose: '#26222a',
    ears: 'pointues', tail: 'chat', legs: 4, body: { rx: 6.5, ry: 3 }, head: 3.4, snout: 'court',
  },
  {
    // Bully fauve : costaud, poitrail et pattes blancs, trait blanc sur le front, oreilles dressées, nez rosé.
    id: 'pitou', fur: '#c98a56', dark: '#8f5a34', light: '#e3b07f', shade: '#a8703f',
    chest: '#f4eee6', paws: '#f4eee6', blaze: '#f4eee6', earInner: '#e8a3a8', eye: '#2a1a12', nose: '#8a4f4c',
    ears: 'pointues', tail: 'chien', legs: 4, body: { rx: 7, ry: 4 }, head: 4, snout: 'bully',
  },
  {
    id: 'bouledogue', fur: '#8c8a92', dark: '#5f5d66', light: '#c9c6cf',
    ears: 'chauve-souris', tail: 'courte', legs: 3, body: { rx: 6.5, ry: 3.8 }, head: 3.8, snout: 'plat',
  },
  {
    id: 'husky', fur: '#7d8494', dark: '#555b68', light: '#f2f0ea', mask: true,
    ears: 'pointues', tail: 'enroulee', legs: 5, body: { rx: 7.5, ry: 3.5 }, head: 3.6, snout: 'long',
  },
  {
    id: 'golden', fur: '#e0a84a', dark: '#b98232', light: '#f4d18f',
    ears: 'tombantes', tail: 'plumeau', legs: 5, body: { rx: 7.5, ry: 3.8 }, head: 3.7, snout: 'long',
  },
];

/** Dessine un animal dans une grille de 28 × 20. frame 0 ou 1 : position de la queue. */
export function drawPet(g, pet, frame) {
  const ground = PET_H - 1;
  const legTop = ground - pet.legs;
  const cy = legTop - pet.body.ry + 1.5;
  const cx = 12;
  const hx = Math.round(cx + pet.body.rx + 1);
  const hy = cy - pet.head - 0.5;

  tail(g, pet, cx - pet.body.rx, cy - 1, frame);

  // Pattes : celles du fond plus sombres, celles de devant par-dessus.
  const back = Math.round(cx - pet.body.rx + 1);
  const front = Math.round(cx + pet.body.rx - 4);
  for (const x of [back + 1, front + 1]) {
    g.rect(x + 1, legTop, x + 2, ground, pet.shade ?? pet.dark);
    if (pet.paws) g.rect(x + 1, ground, x + 2, ground, pet.paws);
  }
  g.ellipse(cx, cy, pet.body.rx, pet.body.ry, pet.fur);
  if (pet.saddle) g.recolor(0, 0, PET_W - 1, Math.floor(cy), pet.fur, pet.saddle);
  // Ventre plus clair (ou poitrail blanc qui monte vers le cou).
  g.ellipse(cx + 1, cy + pet.body.ry - 1, pet.body.rx - 2, 1, pet.chest ?? pet.light);
  if (pet.chest) g.ellipse(cx + pet.body.rx - 1.5, cy + 1.5, 1.6, pet.body.ry - 1.8, pet.chest);
  if (pet.stripes) for (let x = Math.round(cx - pet.body.rx + 2); x < cx + pet.body.rx - 1; x += 3) g.rect(x, Math.ceil(cy - pet.body.ry), x, Math.round(cy), pet.dark);
  if (pet.patch) g.ellipse(cx - 2, cy - 1, 2.5, 1.6, pet.dark);
  for (const x of [back, front]) {
    g.rect(x, legTop, x + 1, ground, pet.fur);
    g.rect(x, ground, x + 1, ground, pet.paws ?? pet.light);
  }

  // Cou et tête.
  g.ellipse(hx - 2, (cy + hy) / 2 + 0.5, 2, 2.5, pet.fur);
  if (pet.chest) g.ellipse(hx - 0.5, hy + pet.head, 1.2, 1.5, pet.chest);
  if (pet.saddle) g.recolor(0, 0, Math.round(hx - 2), Math.floor((cy + hy) / 2), pet.fur, pet.saddle);
  g.disc(hx, hy, pet.head, pet.fur);
  if (pet.cap) g.recolor(0, 0, PET_W - 1, Math.round(hy - 0.5), pet.fur, pet.cap);
  if (pet.blaze) {
    const top = Math.round(hy - pet.head);
    g.rect(Math.round(hx + 1), top, Math.round(hx + 1), top + 1, pet.blaze);
    g.set(Math.round(hx + 2), top + 2, pet.blaze);
  }
  if (pet.mask) {
    g.ellipse(hx + 1, hy + 1.2, pet.head - 1, pet.head - 1.6, pet.light);
    g.ellipse(hx + 1, hy + 2, 1.5, 1, pet.light);
  }
  snout(g, pet, hx, hy);
  ears(g, pet, hx, hy);
  g.set(Math.round(hx + 1), Math.round(hy - 1), pet.eye ?? EYE);
}

function snout(g, pet, hx, hy) {
  const x = Math.round(hx + pet.head - 1);
  const y = Math.round(hy);
  const nose = pet.nose ?? NOSE;
  if (pet.snout === 'bully') {
    // Museau court et large, nez rosé au bout, babines qui pendent un peu.
    g.rect(x, y - 1, x + 2, y + 2, pet.light);
    g.rect(x + 2, y - 1, x + 2, y - 1, nose);
    g.set(x + 1, y + 2, pet.dark);
    g.set(x + 2, y + 2, pet.dark);
  } else if (pet.snout === 'long') {
    g.rect(x, y, x + 3, y + 2, pet.light);
    g.rect(x + 3, y, x + 3, y, nose);
    g.set(x + 2, y + 3, TONGUE);
  } else if (pet.snout === 'plat') {
    g.rect(x, y, x + 1, y + 2, pet.light);
    g.set(x + 1, y, nose);
    g.set(x + 1, y + 2, pet.dark);
  } else {
    g.rect(x, y, x + 1, y + 1, pet.light);
    g.set(x + 1, y, pet.nose ?? TONGUE);
  }
}

function ears(g, pet, hx, hy) {
  const top = Math.round(hy - pet.head);
  const x = Math.round(hx);
  if (pet.ears === 'tombantes') {
    g.rect(x - 2, top + 1, x - 1, top + 5, pet.dark);
    g.set(x - 1, top + 6, pet.dark);
  } else if (pet.ears === 'chauve-souris') {
    g.spans([[top - 3, x - 2, x - 2], [top - 2, x - 3, x - 1], [top - 1, x - 3, x - 1], [top, x - 3, x]], pet.dark);
    g.spans([[top - 1, x - 2, x - 2], [top, x - 2, x - 1]], TONGUE);
  } else {
    g.spans([[top - 2, x - 1, x - 1], [top - 1, x - 2, x], [top, x - 2, x + 1]], pet.cap ?? pet.dark);
    g.set(x - 1, top, pet.earInner ?? pet.light);
    if (pet.earInner) g.set(x - 1, top - 1, pet.earInner);
  }
}

function tail(g, pet, x0, y0, frame) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  const up = frame === 0;
  switch (pet.tail) {
    case 'chat': // longue, en crochet, qui ondule
      g.spans(up
        ? [[y, x - 1, x], [y - 1, x - 2, x - 2], [y - 2, x - 2, x - 2], [y - 3, x - 2, x - 2], [y - 4, x - 1, x - 1], [y - 5, x, x]]
        : [[y, x - 1, x], [y - 1, x - 2, x - 2], [y - 2, x - 3, x - 3], [y - 3, x - 3, x - 3], [y - 4, x - 3, x - 3], [y - 5, x - 4, x - 4]], pet.dark);
      break;
    case 'courte':
      g.rect(x - 1, y - (up ? 1 : 0), x, y - (up ? 1 : 0), pet.dark);
      break;
    case 'enroulee': // husky : la queue fait une boucle sur le dos
      g.spans(up
        ? [[y, x - 1, x], [y - 1, x - 2, x - 1], [y - 2, x - 2, x], [y - 3, x - 1, x + 1]]
        : [[y, x - 1, x], [y - 1, x - 2, x - 1], [y - 2, x - 3, x - 1], [y - 3, x - 2, x]], pet.light);
      break;
    case 'plumeau': // golden : longue et touffue
      g.spans(up
        ? [[y, x - 2, x], [y - 1, x - 3, x - 1], [y - 2, x - 4, x - 2], [y - 3, x - 5, x - 4]]
        : [[y, x - 2, x], [y + 1, x - 4, x - 1], [y + 2, x - 5, x - 3], [y + 1, x - 6, x - 6]], pet.fur);
      g.set(x - (up ? 5 : 6), y + (up ? -3 : 1), pet.light);
      break;
    default: // chien : la queue qui frétille
      g.spans(up
        ? [[y, x - 1, x], [y - 1, x - 2, x - 2], [y - 2, x - 3, x - 3]]
        : [[y, x - 1, x], [y, x - 2, x - 2], [y + 1, x - 3, x - 3]], pet.fur);
  }
}
