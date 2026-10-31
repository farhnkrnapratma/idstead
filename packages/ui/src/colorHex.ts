function hexByte(channel: number): string {
    const encoded =
        channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
        .toString(16)
        .padStart(2, '0');
}

function oklchToHex(lightness: number, chroma: number, hue: number): string {
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return `#${hexByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)}${hexByte(
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    )}${hexByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)}`;
}

function channel(value: string): number {
    return value === 'none' ? 0 : Number(value);
}

/**
 * Converts an opaque `#rgb`, `#rrggbb` or `oklch()` color to `#rrggbb`.
 * Accepts lightness as a percentage (`14.5%`) or a fraction (`.145`), and
 * `none` for any channel, as emitted by Tailwind's palette.
 */
export function toHex(value: string): string | undefined {
    const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (hex) return `#${hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex}`;
    const oklch = value.match(/^oklch\(\s*([\d.]+%?|none)\s+([\d.]+|none)\s+([\d.]+|none)\s*\)$/);
    if (!oklch) return undefined;
    const lightness =
        oklch[1].endsWith('%') ? Number(oklch[1].slice(0, -1)) / 100 : channel(oklch[1]);
    return oklchToHex(lightness, channel(oklch[2]), channel(oklch[3]));
}
