import { describe, expect, test } from 'bun:test';
import { assetAltText, assetFileName } from '../packages/lib/src/assetNaming.ts';

describe('assetFileName', () => {
    test.each([
        ['Ubuntu-Release_a_New-Version-for-2026.avif', 'ubuntu-release-a-new-version-for-2026'],
        ['My  Holiday Photo (1).PNG', 'my-holiday-photo-1'],
        ['Café Crème.jpg', 'cafe-creme'],
        ['../../etc/passwd', 'passwd'],
        ['---.webm', 'image'],
        ['', 'image']
    ])('%s → %s', (input, expected) => {
        expect(assetFileName(input)).toBe(expected);
    });

    test('uses the given fallback and caps the length', () => {
        expect(assetFileName('???.webm', 'video')).toBe('video');
        expect(assetFileName(`${'a'.repeat(120)}.png`)).toHaveLength(80);
    });
});

describe('assetAltText', () => {
    test.each([
        ['Ubuntu-Release_a_New-Version-for-2026.avif', 'Ubuntu release a new version for 2026'],
        ['KDE-Plasma-6.png', 'KDE plasma 6'],
        ['screenshot_2026-10-16 at 10.42.png', 'Screenshot 2026 10 16 at 10 42'],
        ['Café Crème.jpg', 'Cafe creme'],
        ['___', 'Image']
    ])('%s → %s', (input, expected) => {
        expect(assetAltText(input)).toBe(expected);
    });
});
