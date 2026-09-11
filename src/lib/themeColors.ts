import tokens from './tokens.css?raw';

export type EffectiveTheme = 'light' | 'dark';

function readBackground(selector: string): string {
  const block = tokens.slice(tokens.indexOf(selector)).split('}')[0];
  const value = block.match(/--color-background:\s*(#[0-9a-f]{6})\s*;/i)?.[1];
  if (!value) throw new Error(`Missing background token for ${selector}`);
  return value;
}

const backgrounds = {
  light: readBackground('@theme'),
  dark: readBackground(':root.dark')
};

export function themeColors(theme: EffectiveTheme = 'light') {
  return {
    theme_color: backgrounds[theme],
    background_color: backgrounds[theme]
  };
}
