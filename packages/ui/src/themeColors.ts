import palette from 'tailwindcss/theme.css?raw';
import tokens from './styles/tokens.css?raw';

export type EffectiveTheme = 'light' | 'dark';

const selectors = { light: '@theme', dark: ':root.dark' } as const;

function declaration(source: string, name: string): string | undefined {
    return source.match(new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`))?.[1].trim();
}

function themeBlock(theme: EffectiveTheme): string {
    return tokens.slice(tokens.indexOf(selectors[theme])).split('}')[0];
}

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

function toHex(value: string): string | undefined {
    const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (hex) return `#${hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex}`;
    const oklch = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);
    if (oklch) return oklchToHex(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]));
}

export function themeToken(name: string, theme: EffectiveTheme = 'light'): string {
    const value = declaration(themeBlock(theme), name) ?? declaration(themeBlock('light'), name);
    const reference = value?.match(/^var\((--color-[a-z0-9-]+)\)$/)?.[1];
    if (reference) {
        return declaration(tokens, reference) ?
                themeToken(reference, theme)
            :   (toHex(declaration(palette, reference) ?? '') ?? missing(reference, theme));
    }
    return (value && toHex(value)) ?? missing(name, theme);
}

function missing(name: string, theme: EffectiveTheme): never {
    throw new Error(`Missing an opaque ${name} color for ${selectors[theme]}`);
}

const backgrounds = {
    light: themeToken('--color-canvas', 'light'),
    dark: themeToken('--color-canvas', 'dark')
};

export function themeColors(theme: EffectiveTheme = 'light') {
    return { theme_color: backgrounds[theme], background_color: backgrounds[theme] };
}
