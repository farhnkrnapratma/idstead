import { describe, expect, test } from 'bun:test';

const tokens = await Bun.file(
    new URL('../packages/ui/src/styles/tokens.css', import.meta.url)
).text();

function block(selector: string): string {
    const start = tokens.indexOf(`${selector} {`);
    expect(start).toBeGreaterThanOrEqual(0);
    return tokens.slice(start, tokens.indexOf('\n}', start));
}

function colorNames(css: string): Set<string> {
    return new Set(css.match(/--color-[a-z0-9-]+(?=:)/g) ?? []);
}

describe('theme tokens', () => {
    test('dark mode redefines every surface, text and line color', () => {
        const light = colorNames(block('@theme'));
        const dark = colorNames(block(':root.dark'));
        const themed = [...light].filter(name =>
            /^--color-(canvas|surface|overlay|fg|line)/.test(name)
        );
        expect(themed.length).toBeGreaterThan(10);
        expect(themed.filter(name => !dark.has(name))).toEqual([]);
    });

    test('dark mode keys off the class the theme store toggles', () => {
        const store = Bun.file(
            new URL('../packages/ui/src/stores/themeStore.svelte.ts', import.meta.url)
        );
        expect(store.text()).resolves.toContain("classList.toggle('dark'");
    });
});
