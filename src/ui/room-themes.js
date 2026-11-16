// Le décor des pièces isométriques (room-view.js) : les murs et le sol,
// dessinés une fois sur un canvas. Chaque thème reçoit la géométrie :
//   geo = { origin, room: { width, depth }, width, height, wallH }
// Les murs sont plus hauts que le canvas : on ne voit que leur bas, comme
// dans une pièce vue de près.

import { polygon, project, shade, tileDiamond } from './iso.js';

/** Petit hasard fixe (toujours le même dessin d'une partie à l'autre). */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Les deux murs du fond : gauche (x = 0) et droite (y = 0), de z0 à z1. */
function wallQuads(origin, room, z0, z1) {
  return {
    L: [project(origin, 0, 0, z1), project(origin, 0, room.depth, z1), project(origin, 0, room.depth, z0), project(origin, 0, 0, z0)],
    R: [project(origin, 0, 0, z1), project(origin, room.width, 0, z1), project(origin, room.width, 0, z0), project(origin, 0, 0, z0)],
  };
}

/** Un point sur un mur : `t` le long du mur (en tuiles), `z` en pixels. */
function onWall(origin, wall, t, z) {
  return wall === 'R' ? project(origin, t, 0, z) : project(origin, 0, t, z);
}

// ---- Le studio : le sous-sol du QG ----

const STUDIO = {
  void: '#1b1426',
  floor: ['#d8ccb0', '#cfc2a5'],
  floorLine: 'rgba(90, 70, 50, .18)',
  wallR: '#b3a274', wallL: '#9c8b5f', wallTrim: '#3b2f2a', wallGlow: 'rgba(255, 240, 200, .12)',
  rug: '#f4efe6', rugSpot: '#7a4e33',
};

export const studioTheme = {
  drawRoom(ctx, { origin, room, width, height, wallH }) {
    const C = STUDIO;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, width, height);
    const walls = wallQuads(origin, room, 0, wallH);
    polygon(ctx, walls.L, C.wallL);
    polygon(ctx, walls.R, C.wallR);
    // Lumière douce de la lampe du plafond sur le mur de droite.
    polygon(ctx, [project(origin, 1, 0, wallH), project(origin, 4, 0, wallH), project(origin, 4, 0), project(origin, 1, 0)], C.wallGlow);
    // Le sol en béton peint, en damier léger.
    for (let x = 0; x < room.width; x += 1) {
      for (let y = 0; y < room.depth; y += 1) {
        polygon(ctx, tileDiamond(origin, x, y), C.floor[(x + y) % 2], C.floorLine);
      }
    }
    // Plinthes.
    const trim = wallQuads(origin, room, 0, 3);
    polygon(ctx, trim.L, C.wallTrim);
    polygon(ctx, trim.R, shade(C.wallTrim, 0.15));
    // Le tapis en peau de vache, au milieu de la pièce.
    const c = project(origin, room.width / 2, room.depth / 2);
    ctx.fillStyle = C.rug;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.rugSpot;
    for (const [dx, dy, rx, ry] of [[-18, -3, 7, 3], [8, 4, 9, 4], [20, -5, 5, 2], [-4, 7, 4, 2]]) {
      ctx.beginPath();
      ctx.ellipse(c.x + dx, c.y + dy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ---- La serre : une serre vitrée la nuit, sous la Lune ----

const SERRE = {
  void: '#1d1838',
  sky: { L: '#262052', R: '#2e2760' },
  reflect: 'rgba(140, 130, 220, .16)',
  frame: '#8c93a3', frameDark: '#5d6372',
  star: '#f6f0c8', moon: '#f6f0c8', moonShade: '#d9d2a6',
  knee: { L: '#6e6a74', R: '#827d88' }, kneeTop: '#a39fab', kneeLine: 'rgba(40, 30, 50, .35)',
  floor: ['#5a4636', '#4f3d2f'], floorLine: 'rgba(30, 20, 15, .35)', speck: 'rgba(30, 20, 15, .45)',
  path: ['#8f8a80', '#827d74'], pathLine: 'rgba(40, 35, 30, .3)',
  glow: 'rgba(255, 95, 210, .10)',
};
const KNEE = 14; // muret de béton sous les vitres
const BARS = [52, 96]; // traverses des vitres

export const serreTheme = {
  drawRoom(ctx, { origin, room, width, height, wallH }) {
    const C = SERRE;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, width, height);

    // Les vitres : le ciel de nuit, des étoiles, la Lune sur le mur de droite.
    const glass = wallQuads(origin, room, KNEE, wallH);
    for (const wall of ['L', 'R']) {
      polygon(ctx, glass[wall], C.sky[wall]);
      const len = wall === 'R' ? room.width : room.depth;
      for (let i = 0; i < len * 5; i += 1) {
        const p = onWall(origin, wall, hash(i + (wall === 'R' ? 0 : 99)) * len, KNEE + 8 + hash(i * 3.3 + 7) * (wallH - KNEE - 8));
        ctx.fillStyle = C.star;
        ctx.globalAlpha = 0.35 + hash(i * 1.7) * 0.65;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const moon = onWall(origin, 'R', room.width - 1.6, 74);
    for (const [dx, dy, r, color] of [[0, 0, 7, C.moon], [-2, -2, 1.6, C.moonShade], [3, 2, 1.2, C.moonShade], [1, -4, 0.9, C.moonShade]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(moon.x + dx, moon.y + dy, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Reflets en biais sur les vitres.
    for (const wall of ['L', 'R']) {
      const len = wall === 'R' ? room.width : room.depth;
      for (let t = 0.4; t < len; t += 2.3) {
        polygon(ctx, [
          onWall(origin, wall, t, KNEE + 2), onWall(origin, wall, t + 0.25, KNEE + 2),
          onWall(origin, wall, t + 1.05, wallH), onWall(origin, wall, t + 0.8, wallH),
        ], C.reflect);
      }
    }
    // La lumière mauve des lampes horticoles sur les vitres.
    polygon(ctx, [onWall(origin, 'R', 0, wallH), onWall(origin, 'R', 5, wallH), onWall(origin, 'R', 5, KNEE), onWall(origin, 'R', 0, KNEE)], C.glow);
    polygon(ctx, [onWall(origin, 'L', 0, wallH), onWall(origin, 'L', 4, wallH), onWall(origin, 'L', 4, KNEE), onWall(origin, 'L', 0, KNEE)], C.glow);

    // Les montants d'aluminium (un par tuile) et les traverses.
    ctx.lineWidth = 1;
    for (const wall of ['L', 'R']) {
      const len = wall === 'R' ? room.width : room.depth;
      ctx.strokeStyle = wall === 'R' ? C.frame : C.frameDark;
      for (let t = 0; t <= len; t += 1) {
        const a = onWall(origin, wall, t, KNEE);
        const b = onWall(origin, wall, t, wallH);
        ctx.beginPath();
        ctx.moveTo(Math.round(a.x) + 0.5, a.y);
        ctx.lineTo(Math.round(b.x) + 0.5, b.y);
        ctx.stroke();
      }
      for (const z of BARS) {
        const a = onWall(origin, wall, 0, z);
        const b = onWall(origin, wall, len, z);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 0.5);
        ctx.lineTo(b.x, b.y + 0.5);
        ctx.stroke();
      }
    }

    // Le muret de béton, avec ses joints.
    const knee = wallQuads(origin, room, 0, KNEE);
    polygon(ctx, knee.L, C.knee.L);
    polygon(ctx, knee.R, C.knee.R);
    for (const wall of ['L', 'R']) {
      const len = wall === 'R' ? room.width : room.depth;
      const a = onWall(origin, wall, 0, KNEE);
      const b = onWall(origin, wall, len, KNEE);
      ctx.strokeStyle = C.kneeTop;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 0.5);
      ctx.lineTo(b.x, b.y + 0.5);
      ctx.stroke();
      ctx.strokeStyle = C.kneeLine;
      for (let t = 1; t < len; t += 2) {
        const p = onWall(origin, wall, t, 0);
        const q = onWall(origin, wall, t, KNEE);
        ctx.beginPath();
        ctx.moveTo(Math.round(p.x) + 0.5, p.y);
        ctx.lineTo(Math.round(q.x) + 0.5, q.y);
        ctx.stroke();
      }
    }

    // Le sol de terre battue, et une allée de dalles au milieu.
    const midY = Math.floor(room.depth / 2);
    for (let x = 0; x < room.width; x += 1) {
      for (let y = 0; y < room.depth; y += 1) {
        const path = y === midY || y === midY - 1;
        polygon(ctx, tileDiamond(origin, x, y), path ? C.path[(x + y) % 2] : C.floor[(x + y) % 2], path ? C.pathLine : C.floorLine);
        if (path) continue;
        ctx.fillStyle = C.speck;
        for (let i = 0; i < 4; i += 1) {
          const p = project(origin, x + 0.15 + hash(x * 13 + y * 7 + i) * 0.7, y + 0.15 + hash(x * 5 + y * 11 + i * 3) * 0.7);
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      }
    }
  },
};
