import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const ui = new URL('../packages/ui/src/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ui), 'utf8');

describe('typography', () => {
    test('vendors the Paper Mono and Martian Mono variable fonts with their licenses', () => {
        for (const file of [
            'fonts/PaperMono-VF.woff2',
            'fonts/PaperMono-OFL.txt',
            'fonts/MartianMono-VF.woff2',
            'fonts/MartianMono-OFL.txt'
        ]) {
            expect(existsSync(new URL(file, ui))).toBe(true);
        }
    });

    test('maps sans to Paper Mono, mono to Martian Mono and titles to Archivo', () => {
        const tokens = read('styles/tokens.css');
        expect(tokens).toMatch(/--font-sans:\s*'Paper Mono'/);
        expect(tokens).toMatch(/--font-mono:\s*'Martian Mono'/);
        expect(tokens).toMatch(/--font-title:\s*'Archivo Variable'/);
    });

    test('enables the requested OpenType features for sans and mono', () => {
        const css = read('styles/global.css');
        expect(css).toContain(
            "font-feature-settings: 'ss01', 'ss02', 'ss03', 'ss04', 'cv01', 'zero';"
        );
        expect(css).toContain("font-feature-settings: 'calt', 'case', 'cv01';");
    });

    test('loads the bundled fonts from global.css, not from Fontsource packages', () => {
        const css = read('styles/global.css');
        expect(css).toContain("url('../fonts/PaperMono-VF.woff2')");
        expect(css).toContain("url('../fonts/MartianMono-VF.woff2')");
        expect(css).toContain("@import '@fontsource-variable/archivo/wdth.css';");
        expect(css).not.toContain('ia-writer-quattro');
        expect(css).not.toContain('lilex');
    });
});
