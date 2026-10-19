import tokens from './styles/tokens.css?raw';

export type EffectiveTheme = 'light' | 'dark';

const selectors = { light: '@theme', dark: ':root.dark' } as const;

export function themeToken(name: string, theme: EffectiveTheme = 'light'): string {
    const block = tokens.slice(tokens.indexOf(selectors[theme])).split('}')[0];
    const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'))?.[1];
    if (!value) throw new Error(`Missing ${name} token for ${selectors[theme]}`);
    return value;
}

const backgrounds = {
    light: themeToken('--color-background', 'light'),
    dark: themeToken('--color-background', 'dark')
};

export function themeColors(theme: EffectiveTheme = 'light') {
    return { theme_color: backgrounds[theme], background_color: backgrounds[theme] };
}
