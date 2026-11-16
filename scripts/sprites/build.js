// Génère les sprites des personnages : `npm run sprites`
//   assets/images/personnages/<id>.png        vue de face (portrait, sélection)
//   assets/images/personnages/<id>-sheet.png  feuille : lignes face / profil / dos, 2 images (respiration)
//   assets/images/personnages/sprites.json    description de la feuille
//   assets/images/qg/fond.png                 le QG (160 × 100)
// Option --preview <fichier.png> : planche agrandie ×6 pour vérifier le rendu.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grid, W, H, compose } from './grid.js';
import { encodePng } from './png.js';
import { CHARACTERS } from './characters.js';
import { QG_W, QG_H, drawQg } from './qg.js';

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
}
console.log('Sprites générés dans assets/images/personnages/ et assets/images/qg/');
