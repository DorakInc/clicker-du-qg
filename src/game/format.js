// Affichage des grands nombres : 1.5K, 12.3M, 4B...

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const n = Math.abs(value);

  if (n < 1000) {
    if (n < 100 && !Number.isInteger(n)) return sign + trimZeros(n.toFixed(1));
    return sign + String(Math.floor(n));
  }

  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return sign + n.toExponential(2);

  let scaled = n / 10 ** (tier * 3);
  let text = scaled.toFixed(scaled < 100 ? 1 : 0);
  // 999.96K s'arrondit à "1000K" : on passe au suffixe suivant.
  if (Number(text) >= 1000 && tier + 1 < SUFFIXES.length) {
    tier += 1;
    scaled /= 1000;
    text = scaled.toFixed(1);
  }
  return sign + trimZeros(text) + SUFFIXES[tier];
}

export function formatMoney(value) {
  return `${formatNumber(value)} $`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

function trimZeros(text) {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
