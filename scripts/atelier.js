// L'atelier des personnages : `npm run atelier`, puis ouvrir http://127.0.0.1:8001
//
// Sert le projet comme `npm start`, plus une route qui enregistre une fiche :
//   POST /api/personnages  { character, replace }
//     → valide la fiche, l'écrit dans data/characters.json, relance `npm run sprites`.
// N'écoute que sur 127.0.0.1 (l'ordi lui-même) : personne d'autre sur le réseau ne peut écrire.
// Les photos restent dans le navigateur : elles ne passent jamais par ce serveur.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './static.js';
import { STATS } from '../src/game/modifiers.js';
import { formatCharacters, upsertCharacter, validateCharacter } from './personnages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8001;
const host = '127.0.0.1';
const dataFile = path.join(root, 'data/characters.json');
const MAX_BODY = 64 * 1024;

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new Error('fiche trop lourde'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function buildSprites() {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(root, 'scripts/sprites/build.js')], { cwd: root }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}${stderr}`.trim() });
    });
  });
}

/** Seule une page servie par l'atelier lui-même peut enregistrer (pas un autre site ouvert dans le navigateur). */
function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${host}:${port}` || origin === `http://localhost:${port}`;
}

async function saveCharacter(req, res) {
  if (!sameOrigin(req) || !String(req.headers['content-type']).startsWith('application/json')) {
    send(res, 403, { errors: ['requête refusée'] });
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    send(res, 400, { errors: [error.message] });
    return;
  }
  const { character, replace = false } = payload ?? {};
  const errors = validateCharacter(character, STATS);
  if (errors.length) {
    send(res, 400, { errors });
    return;
  }
  const list = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  if (list.some((c) => c.id === character.id) && !replace) {
    send(res, 409, { errors: [`« ${character.id} » existe déjà`] });
    return;
  }
  // Garde l'ordre des clés du fichier : id, name, strength, description, effects, look.
  const { id, name, strength, description, effects, look, ...rest } = character;
  const clean = { id, name, strength, description, effects, ...rest, ...(look ? { look } : {}) };
  fs.writeFileSync(dataFile, formatCharacters(upsertCharacter(list, clean)));
  const build = await buildSprites();
  send(res, build.ok ? 200 : 500, { saved: id, build });
  console.log(`✔ ${id} enregistré dans data/characters.json${build.ok ? ', planche générée' : ' (échec de npm run sprites)'}`);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/personnages' && req.method === 'POST') {
    saveCharacter(req, res).catch((error) => send(res, 500, { errors: [error.message] }));
    return;
  }
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/outils/personnage.html' }).end();
    return;
  }
  serveStatic(root, req, res);
}).listen(port, host, () => {
  console.log(`Atelier des personnages : http://${host}:${port}`);
});
