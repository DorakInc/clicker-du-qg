// Petit serveur local pour jouer : `npm start`, puis ouvrir http://localhost:8000
// (Le jeu charge ses fichiers JSON, ce qui ne marche pas en ouvrant index.html directement.)

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './static.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8000;

http.createServer((req, res) => serveStatic(root, req, res)).listen(port, () => {
  console.log(`Clicker du QG : http://localhost:${port}`);
});
