// Génère les sprites des personnages : `npm run sprites`
//   assets/images/personnages/<id>.png        vue de face (portrait, sélection)
//   assets/images/personnages/<id>-sheet.png  feuille : lignes face / profil / dos, 2 images (respiration)
//   assets/images/personnages/sprites.json    description de la feuille
//   assets/images/qg/fond.png                 le QG (160 × 100)
//   assets/images/serre/fond.png              la serre (160 × 100)
//   assets/images/serre/plante.png            un plant : 3 stades de 16 × 24
//   assets/images/carte/fond.png              la carte du monde (160 × 100)
//   assets/images/animaux/<id>.png            un animal : 2 images de 28 × 20 (la queue bouge)
//   assets/images/effets/<nom>.png            pièce, note, drapeau (effets visuels)
//   assets/images/interface/icone-<taille>.png icône du jeu (192 et 512)
// Option --preview <fichier.png> : planche agrandie ×6 pour vérifier le rendu.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grid, W, H, compose } from './grid.js';
import { encodePng } from './png.js';
import { CHARACTERS } from './characters.js';
import { QG_W, QG_H, drawQg } from './qg.js';
import { SERRE_W, SERRE_H, PLANT_W, PLANT_H, drawSerre, drawPlant } from './serre.js';
import { CARTE_W, CARTE_H, drawCarte } from './carte.js';
import { PETS, PET_W, PET_H, drawPet } from './animaux.js';
import { COIN, NOTE, FLAG, ICON, drawCoin, drawNote, drawFlag, drawIcon } from './effets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'assets/images/personnages');
const VIEWS = ['front', 'side', 'back'];
const WAIST = 30;

function render(character, view, frame) {
  const g = new Grid(W, H);
  character[view](g);
  if (frame === 1) g.bob(WAIST);
  g.outline();
  return g;
}

function writePng(file, cells, scale = 1) {
  const { width, height, rgba } = compose(cells, scale);
  fs.writeFileSync(file, encodePng(width, height, rgba));
}

fs.mkdirSync(outDir, { recursive: true });
const sheets = {};
for (const character of CHARACTERS) {
  const cells = VIEWS.map((view) => [render(character, view, 0), render(character, view, 1)]);
  writePng(path.join(outDir, `${character.id}-sheet.png`), cells);
  writePng(path.join(outDir, `${character.id}.png`), [[cells[0][0]]]);
  sheets[character.id] = `${character.id}-sheet.png`;
}
fs.writeFileSync(path.join(outDir, 'sprites.json'), `${JSON.stringify({
  frameWidth: W,
  frameHeight: H,
  frames: 2,
  rows: { front: 0, side: 1, back: 2 },
  sideFacing: 'right',
  sheets,
}, null, 2)}\n`);

const qgDir = path.join(root, 'assets/images/qg');
fs.mkdirSync(qgDir, { recursive: true });
const room = new Grid(QG_W, QG_H);
drawQg(room);
writePng(path.join(qgDir, 'fond.png'), [[room]]);

const serreDir = path.join(root, 'assets/images/serre');
fs.mkdirSync(serreDir, { recursive: true });
const serre = new Grid(SERRE_W, SERRE_H);
drawSerre(serre);
writePng(path.join(serreDir, 'fond.png'), [[serre]]);
const plants = [0, 1, 2].map((stage) => {
  const p = new Grid(PLANT_W, PLANT_H);
  drawPlant(p, stage);
  p.outline(0.5);
  return p;
});
writePng(path.join(serreDir, 'plante.png'), [plants]);

const carteDir = path.join(root, 'assets/images/carte');
fs.mkdirSync(carteDir, { recursive: true });
const carte = new Grid(CARTE_W, CARTE_H);
drawCarte(carte);
writePng(path.join(carteDir, 'fond.png'), [[carte]]);

const animauxDir = path.join(root, 'assets/images/animaux');
fs.mkdirSync(animauxDir, { recursive: true });
const petFrames = PETS.map((pet) => [0, 1].map((frame) => {
  const g = new Grid(PET_W, PET_H);
  drawPet(g, pet, frame);
  g.outline();
  return g;
}));
PETS.forEach((pet, i) => writePng(path.join(animauxDir, `${pet.id}.png`), [petFrames[i]]));

const effetsDir = path.join(root, 'assets/images/effets');
fs.mkdirSync(effetsDir, { recursive: true });
for (const [file, size, draw] of [['piece', COIN, drawCoin], ['note', NOTE, drawNote], ['drapeau', FLAG, drawFlag]]) {
  const g = new Grid(size.w, size.h);
  draw(g);
  writePng(path.join(effetsDir, `${file}.png`), [[g]]);
}

const interfaceDir = path.join(root, 'assets/images/interface');
fs.mkdirSync(interfaceDir, { recursive: true });
const icon = new Grid(ICON.w, ICON.h);
drawIcon(icon);
for (const size of [192, 512]) writePng(path.join(interfaceDir, `icone-${size}.png`), [[icon]], size / ICON.w);

const previewIndex = process.argv.indexOf('--preview');
if (previewIndex !== -1) {
  const cells = CHARACTERS.map((c) => {
    const side = render(c, 'side', 0);
    return [render(c, 'front', 0), render(c, 'front', 1), side, side.flipped(), render(c, 'back', 0)];
  });
  writePng(process.argv[previewIndex + 1], cells, 6);
  // Le QG avec le premier personnage debout sur le tapis.
  const scene = new Grid(QG_W, QG_H);
  drawQg(scene);
  const hero = render(CHARACTERS[2], 'front', 0);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) scene.set(64 + x, 45 + y, hero.px[y][x]);
  }
  writePng(process.argv[previewIndex + 1].replace(/\.png$/, '-qg.png'), [[scene]], 5);
  // La serre avec des plants aux trois stades.
  const greenhouse = new Grid(SERRE_W, SERRE_H);
  drawSerre(greenhouse);
  const place = (plant, x0, y0) => {
    for (let y = 0; y < PLANT_H; y += 1) for (let x = 0; x < PLANT_W; x += 1) greenhouse.set(x0 + x, y0 + y, plant.px[y][x]);
  };
  for (let i = 0; i < 7; i += 1) place(plants[i % 3], 8 + i * 17, 25);
  for (let i = 0; i < 6; i += 1) place(plants[(i + 1) % 3], 6 + i * 18, 57);
  writePng(process.argv[previewIndex + 1].replace(/\.png$/, '-serre.png'), [[greenhouse]], 5);
  writePng(process.argv[previewIndex + 1].replace(/\.png$/, '-carte.png'), [[carte]], 5);
  writePng(process.argv[previewIndex + 1].replace(/\.png$/, '-animaux.png'), petFrames, 10);
}
console.log('Sprites générés dans assets/images/ (personnages, qg, serre, carte, animaux, effets)');
