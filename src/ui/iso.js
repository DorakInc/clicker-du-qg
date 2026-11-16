// Aide au dessin isométrique 2:1 sur un canvas 2D (pixel art, sans bibliothèque).
// Une tuile de sol fait 32 × 16 pixels. `origin` est le coin du fond de la
// pièce (la tuile 0, 0) à l'écran. x va vers la droite et l'avant, y vers la
// gauche et l'avant, z vers le haut (en pixels).

export const TILE_W = 32;
export const TILE_H = 16;

/** Position à l'écran d'un point de la pièce (en tuiles, z en pixels). */
export function project(origin, x, y, z = 0) {
  return { x: origin.x + (x - y) * (TILE_W / 2), y: origin.y + (x + y) * (TILE_H / 2) - z };
}

/** Point de la pièce (au sol, en tuiles, non arrondi) sous un point de l'écran. */
export function unproject(origin, sx, sy) {
  const u = (sx - origin.x) / (TILE_W / 2);
  const v = (sy - origin.y) / (TILE_H / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** Éclaircit (f > 0) ou assombrit (f < 0) une couleur #rrggbb. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f));
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function polygon(ctx, points, fill, stroke) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Le losange d'une zone du sol (x, y, largeur w, profondeur d en tuiles). */
export function tileDiamond(origin, x, y, w = 1, d = 1, z = 0) {
  return [project(origin, x, y, z), project(origin, x + w, y, z), project(origin, x + w, y + d, z), project(origin, x, y + d, z)];
}

/**
 * Boîte isométrique à trois faces ombrées : le dessus, la face avant gauche
 * et la face avant droite. Retourne le rectangle qu'elle occupe à l'écran.
 */
export function drawBox(ctx, origin, x, y, w, d, h, color) {
  const top = tileDiamond(origin, x, y, w, d, h);
  const left = [project(origin, x, y + d, h), project(origin, x + w, y + d, h), project(origin, x + w, y + d), project(origin, x, y + d)];
  const right = [project(origin, x + w, y, h), project(origin, x + w, y + d, h), project(origin, x + w, y + d), project(origin, x + w, y)];
  const edge = shade(color, -0.55);
  polygon(ctx, left, shade(color, -0.18), edge);
  polygon(ctx, right, shade(color, -0.36), edge);
  polygon(ctx, top, shade(color, 0.12), edge);
  return boundsOf([...top, ...left, ...right]);
}

/**
 * Panneau accroché à un mur : `wall` vaut 'R' (mur de droite, la ligne
 * y = 0) ou 'L' (mur de gauche, x = 0). `from` est la position le long du
 * mur, `len` la largeur en tuiles, `z` la hauteur du bas, `h` sa hauteur.
 */
export function wallPanel(origin, wall, from, len, z, h, inset = 0.08) {
  const a = from + inset;
  const b = from + len - inset;
  const off = 0.04; // un poil devant le mur
  const at = (t, zz) => (wall === 'R' ? project(origin, t, off, zz) : project(origin, off, t, zz));
  return [at(a, z), at(b, z), at(b, z + h), at(a, z + h)];
}

export function drawWallPanel(ctx, origin, wall, from, len, z, h, color) {
  const points = wallPanel(origin, wall, from, len, z, h);
  polygon(ctx, points, wall === 'R' ? shade(color, -0.1) : shade(color, -0.25), shade(color, -0.6));
  return boundsOf(points);
}

export function boundsOf(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
