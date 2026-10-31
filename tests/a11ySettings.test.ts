// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    A11Y_DEFAULTS,
    A11Y_SYSTEM_QUERIES,
    parseOverrides,
    resolveSettings
} from '../packages/ui/src/a11ySettings';

describe('a11y settings: stored overrides', () => {
    test.each([
        ['missing', null],
        ['empty', ''],
        ['malformed JSON', '{reduceMotion: true'],
        ['array', '[true]'],
        ['primitive', '"yes"'],
        ['null', 'null']
    ])('ignores %s input', (_label, raw) => {
        expect(parseOverrides(raw)).toEqual({});
    });

    test('keeps only known keys with valid values', () => {
        const raw = JSON.stringify({
            reduceMotion: false,
            highContrast: 'yes',
            fontScale: 125,
            dyslexicFont: true,
            theme: 'dark'
        });
        expect(parseOverrides(raw)).toEqual({ reduceMotion: false, dyslexicFont: true });
    });

    test('keeps explicit values that equal the defaults', () => {
        const raw = JSON.stringify({ reduceMotion: false, fontScale: 100 });
        expect(parseOverrides(raw)).toEqual({ reduceMotion: false, fontScale: 100 });
    });
});

describe('a11y settings: resolution', () => {
    test('falls back to the defaults', () => {
        expect(resolveSettings({}, {})).toEqual(A11Y_DEFAULTS);
    });

    test('follows the device until the visitor overrides it', () => {
        const system = { reduceMotion: true, highContrast: true };
        expect(resolveSettings(system, {})).toMatchObject(system);
        expect(resolveSettings(system, { reduceMotion: false })).toMatchObject({
            reduceMotion: false,
            highContrast: true
        });
    });

    test('auto-detects only settings with an OS media query', () => {
        expect(Object.keys(A11Y_SYSTEM_QUERIES).sort()).toEqual(['highContrast', 'reduceMotion']);
    });
});

describe('a11y settings: pre-paint script', () => {
    test.each(['web', 'admin'])(
        'the %s shell reads the same storage keys and queries',
        async app => {
            const html = await Bun.file(
                new URL(`../apps/${app}/src/app.html`, import.meta.url)
            ).text();
            expect(html).toContain("read('a11y_overrides')");
            expect(html).not.toContain('a11y_settings');
            for (const query of Object.values(A11Y_SYSTEM_QUERIES)) {
                expect(html).toContain(`'${query}'`);
            }
        }
    );
});
