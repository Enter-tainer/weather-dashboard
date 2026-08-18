import { cssVar } from './themeColors';

export interface TwilightPalette {
  day: string;
  warmDay: string;
  golden: string;
  blue: string;
  nautical: string;
  night: string;
}

export function getTwilightPalette(): TwilightPalette {
  return {
    day: cssVar('--twilight-day', '#ffffff'),
    warmDay: cssVar('--twilight-warm-day', '#ffe0b2'),
    golden: cssVar('--twilight-golden', '#ff9800'),
    blue: cssVar('--twilight-blue', '#3949ab'),
    nautical: cssVar('--twilight-nautical', '#1a237e'),
    night: cssVar('--twilight-night', '#0d0d1a'),
  };
}

export function altitudeToTwilightColor(altitudeDeg: number, palette: TwilightPalette): string {
  if (altitudeDeg >= 10) return palette.day;
  if (altitudeDeg >= 6) {
    return lerpColor(palette.warmDay, palette.day, (altitudeDeg - 6) / 4);
  }
  if (altitudeDeg >= -4) {
    return lerpColor(palette.golden, palette.warmDay, (altitudeDeg + 4) / 10);
  }
  if (altitudeDeg >= -6) {
    return lerpColor(palette.blue, palette.golden, (altitudeDeg + 6) / 2);
  }
  if (altitudeDeg >= -12) {
    return lerpColor(palette.nautical, palette.blue, (altitudeDeg + 12) / 6);
  }
  if (altitudeDeg >= -18) {
    return lerpColor(palette.night, palette.nautical, (altitudeDeg + 18) / 6);
  }
  return palette.night;
}

export function colorWithAlpha(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const hexMatch = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  const rgbMatch = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  const channels = hexMatch
    ? [hexMatch[1], hexMatch[2], hexMatch[3]].map((channel) => Number.parseInt(channel ?? '0', 16))
    : rgbMatch
      ? [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((channel) =>
          Math.round(Number.parseFloat(channel ?? '0')),
        )
      : null;

  return channels ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${safeAlpha})` : color;
}

function lerpColor(a: string, b: string, t: number): string {
  // Normalize 3-digit hex shorthand (e.g. minified #fff) to 6-digit before parsing.
  const expandHex = (color: string): string =>
    /^#[0-9a-f]{3}$/i.test(color)
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  const parse = (color: string): [number, number, number] => {
    const hex = expandHex(color);
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const blue = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${blue})`;
}
