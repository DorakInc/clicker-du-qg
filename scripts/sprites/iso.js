// Aide au dessin des objets du studio en vue isométrique 2:1 (tuile de sol = 32 × 16 px).
// Le format des images est décrit dans data/README.md (« Objets du studio ») et lu
// par src/ui/studio-view.js.
//
// IsoSprite : un objet posé au sol, d'emprise w × d tuiles. L'image va de la
// pointe gauche à la pointe droite du losange ((w + d) × 16 px de large) et
// son bas touche la pointe avant. On dessine dans l'espace de l'objet :
// u de 0 à w (vers la droite et l'avant), v de 0 à d (vers la gauche et
// l'avant), z en pixels vers le haut. L'objet « regarde » vers +v (la face
// avant gauche) ; la rotation suivante est le miroir de l'image.
//
// WallSprite : un objet accroché au mur, long de `len` tuiles et haut de `h`
// pixels. On dessine à plat (tx de 0 à len × 16, tz de 0 à h vers le haut) et
// chaque pixel est cisaillé pour suivre le mur de droite ('R') ou de gauche
// ('L'). Les deux vues vont côte à côte dans l'image : un texte reste lisible
// sur les deux murs.

import { Grid, darken } from './grid.js';

export const TILE_W = 32;
export const TILE_H = 16;

export function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** Le point (px, py) est-il dans le polygone convexe ? */
function inside(points, px, py) {
  let sign = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Remplit un polygone convexe : un pixel est peint si son centre est dedans. */
export function fillPoly(g, points, color) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y += 1) {
    for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x += 1) {
      if (inside(points, x + 0.5, y + 0.5)) g.set(x, y, color);
    }
  }
}

/** Trait d'un pixel d'épaisseur entre deux points (Bresenham). */
export function line(g, x0, y0, x1, y1, color) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.set(x, y, color);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Les trois teintes d'une boîte : dessus éclairé, face gauche, face droite dans l'ombre. */
export function shades(color) {
  return { top: lighten(color, 0.18), left: color, right: darken(color, 0.28) };
}

export class IsoSprite {
  constructor(w, d, headroom) {
    this.w = w;
    this.d = d;
    this.width = (w + d) * (TILE_W / 2);
    this.height = (w + d) * (TILE_H / 2) + headroom;
    this.g = new Grid(this.width, this.height);
  }

  /** Position dans l'image d'un point de l'objet. */
  p(u, v, z = 0) {
    return { x: (u - v + this.d) * (TILE_W / 2), y: this.height - (this.w - u + this.d - v) * (TILE_H / 2) - z };
  }

  poly(points, color) {
    fillPoly(this.g, points.map(([u, v, z]) => this.p(u, v, z)), color);
  }

  /** Boîte de (u0, v0, z0) à (u1, v1, z1). `color` : une couleur, ou { top, left, right }. */
  box(u0, v0, u1, v1, z0, z1, color) {
    const c = typeof color === 'string' ? shades(color) : color;
    this.poly([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], c.left);
    this.poly([[u1, v0, z0], [u1, v1, z0], [u1, v1, z1], [u1, v0, z1]], c.right);
    this.poly([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], c.top);
  }

  /** Rectangle sur une face qui regarde vers +v (face avant gauche), au plan v. */
  front(v, u0, u1, z0, z1, color) {
    this.poly([[u0, v, z0], [u1, v, z0], [u1, v, z1], [u0, v, z1]], color);
  }

  /** Rectangle sur une face qui regarde vers +u (face avant droite), au plan u. */
  side(u, v0, v1, z0, z1, color) {
    this.poly([[u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1]], color);
  }

  /** Rectangle sur un dessus, à la hauteur z. */
  top(z, u0, v0, u1, v1, color) {
    this.poly([[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]], color);
  }

  /** Un pixel à un point de l'objet. */
  dot(u, v, z, color) {
    const { x, y } = this.p(u, v, z);
    this.g.set(Math.floor(x), Math.floor(y), color);
  }

  /** Disque à plat (vu en isométrique : une ellipse 2 fois plus large que haute). */
  flatDisc(u, v, z, r, color) {
    const { x, y } = this.p(u, v, z);
    this.g.ellipse(x, y, r * 22.6, r * 11.3, color);
  }

  /** Cylindre debout de rayon r (en tuiles), de z0 à z1. */
  cylinder(u, v, z0, z1, r, color) {
    const c = typeof color === 'string' ? shades(color) : color;
    const a = this.p(u, v, z0);
    const b = this.p(u, v, z1);
    const rx = r * 22.6;
    this.g.ellipse(a.x, a.y, rx, r * 11.3, c.left);
    for (let x = Math.floor(a.x - rx); x < Math.ceil(a.x + rx); x += 1) {
      const color2 = x + 0.5 < a.x + rx * 0.2 ? c.left : c.right;
      for (let y = Math.floor(b.y); y < Math.ceil(a.y); y += 1) this.g.set(x, y, color2);
    }
    this.g.ellipse(b.x, b.y, rx, r * 11.3, c.top);
  }
}

export class WallSprite {
  constructor(len, h, wall = 'R') {
    this.wall = wall;
    this.len = len;
    this.h = h;
    this.width = len * (TILE_W / 2);
    this.height = h + len * (TILE_H / 2);
    this.g = new Grid(this.width, this.height);
  }

  /** Rangée de l'image d'un pixel à plat : le mur descend vers la droite (R) ou vers la gauche (L). */
  row(tx, tz) {
    const rise = this.wall === 'R' ? Math.floor((this.width - tx) / 2) : Math.floor((tx + 1) / 2);
    return this.height - 1 - tz - rise;
  }

  /** Pixel à plat (tx vers la droite, tz vers le haut), cisaillé sur le mur. */
  set(tx, tz, color) {
    if (tx < 0 || tx >= this.width || tz < 0 || tz >= this.h) return;
    this.g.set(tx, this.row(tx, tz), color);
  }

  rect(tx0, tz0, tx1, tz1, color) {
    for (let tz = tz0; tz <= tz1; tz += 1) for (let tx = tx0; tx <= tx1; tx += 1) this.set(tx, tz, color);
  }

  /** Motif d'un petit dessin : rows du haut vers le bas, '#' = color. */
  pattern(tx0, tz0, rows, color, scale = 1) {
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '#') return;
      for (let sx = 0; sx < scale; sx += 1) {
        for (let sz = 0; sz < scale; sz += 1) this.set(tx0 + c * scale + sx, tz0 + (rows.length - 1 - r) * scale + sz, color);
      }
    }));
  }

  get(tx, tz) {
    if (tx < 0 || tx >= this.width || tz < 0 || tz >= this.h) return null;
    return this.g.get(tx, this.row(tx, tz));
  }
}

/** Gabarit pour dessiner à la main : le losange de l'emprise et la pointe d'ancrage. */
export function floorTemplate(w, d, headroom) {
  const s = new IsoSprite(w, d, headroom);
  const guide = '#c9c2d6';
  const corners = [[0, 0], [w, 0], [w, d], [0, d]].map(([u, v]) => s.p(u, v));
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    line(s.g, a.x, a.y - 0.5, b.x, b.y - 0.5, guide);
  });
  for (const [u, v] of [[0, d], [w, d], [w, 0]]) {
    const a = s.p(u, v);
    for (let y = 0; y < a.y; y += 2) s.g.set(Math.min(Math.round(a.x), s.width - 1), y, '#e4e0ec');
  }
  const anchor = s.p(w, d);
  s.g.set(Math.round(anchor.x) - 1, s.height - 1, '#ff3b3b');
  s.g.set(Math.round(anchor.x), s.height - 1, '#ff3b3b');
  return s.g;
}

export function wallTemplate(len, h) {
  const s = new WallSprite(len, h);
  for (let tx = 0; tx < s.width; tx += 1) {
    s.set(tx, 0, '#c9c2d6');
    s.set(tx, h - 1, '#c9c2d6');
  }
  for (let tz = 0; tz < h; tz += 1) {
    s.set(0, tz, '#c9c2d6');
    s.set(s.width - 1, tz, '#c9c2d6');
  }
  return s.g;
}
