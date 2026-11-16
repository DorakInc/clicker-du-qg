// Grille de pixels : on dessine avec des couleurs hexadécimales ('#rrggbb').

export const W = 32;
export const H = 48;

export class Grid {
  constructor(width = W, height = H) {
    this.width = width;
    this.height = height;
    this.px = Array.from({ length: height }, () => Array(width).fill(null));
  }

  set(x, y, color) {
    if (color && x >= 0 && y >= 0 && x < this.width && y < this.height) this.px[y][x] = color;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height ? this.px[y][x] : null;
  }

  clear(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.px[y][x] = null;
  }

  /** Rectangle plein, bornes incluses. */
  rect(x0, y0, x1, y1, color) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) this.set(x, y, color);
  }

  /** Ellipse pleine centrée en (cx, cy), rayons rx et ry. */
  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, color);
      }
    }
  }

  disc(cx, cy, r, color) {
    this.ellipse(cx, cy, r, r, color);
  }

  /** Lignes horizontales : rows = [[y, x0, x1], ...]. Pratique pour les formes arrondies. */
  spans(rows, color) {
    for (const [y, x0, x1] of rows) this.rect(x0, y, x1, y, color);
  }

  /** Repeint seulement les pixels déjà remplis par une certaine couleur. */
  recolor(x0, y0, x1, y1, from, to) {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) if (this.get(x, y) === from) this.set(x, y, to);
    }
  }

  /** Copie la moitié gauche en miroir sur la droite (vues de face et de dos). */
  mirrorLeft() {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width / 2; x += 1) this.px[y][this.width - 1 - x] = this.px[y][x];
    }
  }

  /** Décale le haut du corps d'un pixel vers le bas (respiration). */
  bob(waistY) {
    for (let y = waistY; y > 0; y -= 1) this.px[y] = [...this.px[y - 1]];
    this.px[0] = Array(this.width).fill(null);
  }

  /** Contour : chaque pixel vide qui touche le personnage prend une version sombre de son voisin. */
  outline(amount = 0.55) {
    const add = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.px[y][x]) continue;
        const near = [this.get(x, y + 1), this.get(x, y - 1), this.get(x - 1, y), this.get(x + 1, y)].find(Boolean);
        if (near) add.push([x, y, darken(near, amount)]);
      }
    }
    for (const [x, y, c] of add) this.px[y][x] = c;
  }

  flipped() {
    const g = new Grid(this.width, this.height);
    g.px = this.px.map((row) => [...row].reverse());
    return g;
  }
}

export function darken(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** Assemble des grilles dans une image RGBA (cells[ligne][colonne]). */
export function compose(cells, scale = 1) {
  const cw = cells[0][0].width;
  const ch = cells[0][0].height;
  const width = cw * cells[0].length * scale;
  const height = ch * cells.length * scale;
  const rgba = new Uint8Array(width * height * 4);
  cells.forEach((row, r) => row.forEach((grid, c) => {
    for (let y = 0; y < ch; y += 1) {
      for (let x = 0; x < cw; x += 1) {
        const color = grid.px[y][x];
        if (!color) continue;
        const n = parseInt(color.slice(1), 16);
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const i = (((r * ch + y) * scale + sy) * width + (c * cw + x) * scale + sx) * 4;
            rgba.set([n >> 16, (n >> 8) & 255, n & 255, 255], i);
          }
        }
      }
    }
  }));
  return { width, height, rgba };
}
