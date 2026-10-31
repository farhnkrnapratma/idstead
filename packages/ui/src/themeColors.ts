import palette from 'tailwindcss/theme.css?raw';
import tokens from './styles/tokens.css?raw';
import { toHex } from './colorHex';

export type EffectiveTheme = 'light' | 'dark';

const selectors = { light: '@theme', dark: ':root.dark' } as const;

function declaration(source: string, name: string): string | undefined {
    return source.match(new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`))?.[1].trim();
}

function themeBlock(theme: EffectiveTheme): string {
    return tokens.slice(tokens.indexOf(selectors[theme])).split('}')[0];
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
