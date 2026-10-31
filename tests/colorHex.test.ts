import { describe, expect, test } from 'bun:test';
import { toHex } from '../packages/ui/src/colorHex';

const palette = await Bun.file(Bun.resolveSync('tailwindcss/theme.css', import.meta.dir)).text();

describe('toHex', () => {
    test('reads oklch() with a none hue, as Tailwind defines its neutrals', () => {
        expect(toHex('oklch(14.5% 0 none)')).toBe('#0a0a0a');
        expect(toHex('oklch(98.5% 0 none)')).toBe('#fafafa');
    });

    test('reads fractional lightness the same as a percentage', () => {
        expect(toHex('oklch(.145 0 none)')).toBe(toHex('oklch(14.5% 0 none)'));
    });

    test('expands short hex and rejects translucent colors', () => {
        expect(toHex('#fff')).toBe('#ffffff');
        expect(toHex('oklch(14.5% 0 none / 50%)')).toBeUndefined();
    });

    test('converts every opaque color in the Tailwind palette', () => {
        const colors = [...palette.matchAll(/(--color-[a-z0-9-]+):\s*([^;]+);/g)].filter(
            ([, , value]) => /^(#|oklch\()/.test(value.trim())
        );
        expect(colors.length).toBeGreaterThan(200);
        const unreadable = colors
            .filter(([, , value]) => !toHex(value.trim()))
            .map(([, name, value]) => `${name}: ${value}`);
        expect(unreadable).toEqual([]);
    });
});
